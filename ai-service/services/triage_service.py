"""Ticket triage service using Gemini AI for classification."""
import json
import logging
import time
from typing import Dict, List, Optional
import hashlib
from datetime import datetime

from clients.gemini_client import gemini_client
from cache.redis_cache import redis_cache
from models.ticket_models import (
    TicketTriageRequest,
    TriageResult,
    TicketCategory,
    Priority,
    Urgency,
    Impact,
    CategoryConfidence,
    PriorityMatrix
)

logger = logging.getLogger(__name__)


class TicketTriageService:
    """Service for AI-powered ticket triage and classification."""
    
    def __init__(self):
        """Initialize the triage service."""
        self.system_prompt = self._build_system_prompt()
        self.category_keywords = self._build_category_keywords()
        self.priority_matrix = self._build_priority_matrix()
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for ticket classification."""
        return """You are an expert IT support ticket classifier for Managed Service Providers (MSPs). 
Your task is to analyze support tickets and classify them accurately.

For each ticket, you must determine:
1. Category (hardware, software, network, security, email, backup, printer, phone, access, other)
2. Urgency (urgent, high, medium, low) - How quickly this needs attention
3. Impact (high, medium, low) - How many users/systems are affected
4. Required technician skills
5. Estimated resolution time in minutes

Consider these factors:
- Customer tier (premium customers get higher priority)
- Business hours vs after-hours
- Number of affected users
- System criticality
- Security implications
- Error message severity

Respond with valid JSON only, no additional text. Use this exact structure:
{
    "category": "category_name",
    "urgency": "urgency_level", 
    "impact": "impact_level",
    "confidence_score": 0.95,
    "reasoning": "Brief explanation of classification",
    "suggested_technician_skills": ["skill1", "skill2"],
    "estimated_resolution_time": 60
}"""
    
    def _build_category_keywords(self) -> Dict[TicketCategory, List[str]]:
        """Build keyword mappings for category detection."""
        return {
            TicketCategory.HARDWARE: [
                "computer", "laptop", "desktop", "server", "hard drive", "memory", "ram",
                "cpu", "motherboard", "power supply", "monitor", "keyboard", "mouse",
                "hardware failure", "blue screen", "bsod", "overheating", "fan noise"
            ],
            TicketCategory.SOFTWARE: [
                "application", "program", "software", "install", "update", "patch",
                "license", "crash", "error message", "bug", "feature request",
                "office", "excel", "word", "outlook", "adobe", "browser"
            ],
            TicketCategory.NETWORK: [
                "internet", "wifi", "ethernet", "connection", "network", "router",
                "switch", "firewall", "vpn", "dns", "dhcp", "ip address",
                "bandwidth", "slow connection", "timeout", "ping", "latency"
            ],
            TicketCategory.SECURITY: [
                "virus", "malware", "antivirus", "security", "breach", "hack",
                "phishing", "spam", "suspicious", "unauthorized", "password",
                "encryption", "certificate", "ssl", "firewall rule"
            ],
            TicketCategory.EMAIL: [
                "email", "outlook", "exchange", "smtp", "imap", "pop3",
                "mail server", "mailbox", "attachment", "spam filter",
                "email delivery", "bounce", "undeliverable"
            ],
            TicketCategory.BACKUP: [
                "backup", "restore", "recovery", "data loss", "file recovery",
                "backup failure", "tape", "cloud backup", "snapshot",
                "disaster recovery", "archive"
            ],
            TicketCategory.PRINTER: [
                "printer", "print", "printing", "toner", "ink", "paper jam",
                "print queue", "driver", "scanner", "fax", "multifunction"
            ],
            TicketCategory.PHONE: [
                "phone", "voip", "pbx", "extension", "voicemail", "call",
                "dial tone", "conference", "transfer", "hold music"
            ],
            TicketCategory.ACCESS: [
                "access", "login", "password", "account", "permissions",
                "locked out", "reset", "authentication", "authorization",
                "active directory", "user account", "group membership"
            ]
        }
    
    def _build_priority_matrix(self) -> Dict[tuple, Priority]:
        """Build priority matrix based on urgency and impact."""
        return {
            (Urgency.URGENT, Impact.HIGH): Priority.CRITICAL,
            (Urgency.URGENT, Impact.MEDIUM): Priority.HIGH,
            (Urgency.URGENT, Impact.LOW): Priority.HIGH,
            (Urgency.HIGH, Impact.HIGH): Priority.HIGH,
            (Urgency.HIGH, Impact.MEDIUM): Priority.HIGH,
            (Urgency.HIGH, Impact.LOW): Priority.MEDIUM,
            (Urgency.MEDIUM, Impact.HIGH): Priority.MEDIUM,
            (Urgency.MEDIUM, Impact.MEDIUM): Priority.MEDIUM,
            (Urgency.MEDIUM, Impact.LOW): Priority.LOW,
            (Urgency.LOW, Impact.HIGH): Priority.MEDIUM,
            (Urgency.LOW, Impact.MEDIUM): Priority.LOW,
            (Urgency.LOW, Impact.LOW): Priority.LOW,
        }
    
    def _generate_cache_key(self, request: TicketTriageRequest) -> str:
        """Generate cache key for triage request."""
        # Create hash of ticket content for caching
        content = f"{request.title}|{request.description}|{request.customer_tier}"
        return f"triage:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def _classify_with_ai(self, request: TicketTriageRequest) -> Dict:
        """Use Gemini AI to classify the ticket with enhanced accuracy."""
        try:
            # First try Gemini API for classification
            from clients.gemini_client import gemini_client
            
            result = await gemini_client.classify_ticket(
                title=request.title,
                description=request.description,
                customer_tier=request.customer_tier or 'standard'
            )
            
            if result:
                # Validate and enhance the result
                result = self._validate_and_enhance_ai_result(result, request)
                return result
            
        except Exception as e:
            logger.warning(f"Gemini classification failed, using fallback: {str(e)}")
        
        # Fallback to rule-based classification with keyword analysis
        return await self._fallback_classification(request)
    
    def _validate_and_enhance_ai_result(self, result: Dict, request: TicketTriageRequest) -> Dict:
        """Validate and enhance AI classification result."""
        # Ensure all required fields are present with defaults
        defaults = {
            "category": "other",
            "urgency": "medium", 
            "impact": "medium",
            "confidence_score": 0.5,
            "reasoning": "AI classification",
            "suggested_technician_skills": [],
            "estimated_resolution_time": 120
        }
        
        for key, default_value in defaults.items():
            if key not in result or result[key] is None:
                result[key] = default_value
        
        # Validate enum values
        valid_categories = ["hardware", "software", "network", "security", "email", "backup", "printer", "phone", "access", "other"]
        if result["category"] not in valid_categories:
            result["category"] = "other"
            result["confidence_score"] *= 0.8  # Reduce confidence for invalid category
        
        valid_levels = ["low", "medium", "high", "urgent"]
        if result["urgency"] not in valid_levels:
            result["urgency"] = "medium"
        if result["impact"] not in valid_levels:
            result["impact"] = "medium"
        
        # Enhance with keyword-based confidence boost
        confidence_boost = self._calculate_keyword_confidence(request, result["category"])
        result["confidence_score"] = min(0.95, result["confidence_score"] + confidence_boost)
        
        # Add time-based urgency adjustment
        if hasattr(request, 'created_at') and request.created_at:
            hours_old = (datetime.utcnow() - request.created_at).total_seconds() / 3600
            if hours_old > 24 and result["urgency"] == "low":
                result["urgency"] = "medium"
                result["reasoning"] += " (escalated due to age)"
        
        return result
    
    def _calculate_keyword_confidence(self, request: TicketTriageRequest, predicted_category: str) -> float:
        """Calculate confidence boost based on keyword matching."""
        text = f"{request.title} {request.description}".lower()
        category_keywords = self.category_keywords.get(TicketCategory(predicted_category), [])
        
        matches = sum(1 for keyword in category_keywords if keyword.lower() in text)
        if category_keywords:
            match_ratio = matches / len(category_keywords)
            return min(0.2, match_ratio * 0.3)  # Max boost of 0.2
        
        return 0.0
    
    async def _fallback_classification(self, request: TicketTriageRequest) -> Dict:
        """Fallback rule-based classification when AI fails."""
        text = f"{request.title} {request.description}".lower()
        
        # Category detection using keywords
        category_scores = {}
        for category, keywords in self.category_keywords.items():
            score = sum(1 for keyword in keywords if keyword.lower() in text)
            if score > 0:
                category_scores[category.value] = score / len(keywords)
        
        # Select category with highest score
        if category_scores:
            category = max(category_scores, key=category_scores.get)
            confidence = min(0.8, category_scores[category] * 2)
        else:
            category = "other"
            confidence = 0.3
        
        # Determine urgency and impact based on keywords and customer tier
        urgency = "medium"
        impact = "medium"
        
        # High urgency indicators
        urgent_keywords = ["urgent", "critical", "down", "outage", "emergency", "asap", "immediately"]
        if any(keyword in text for keyword in urgent_keywords):
            urgency = "urgent"
            impact = "high"
        
        # Security issues are always high priority
        if category == "security":
            urgency = "urgent"
            impact = "high"
        
        # Premium customers get priority boost
        if request.customer_tier == "premium":
            if urgency == "low":
                urgency = "medium"
            if impact == "low":
                impact = "medium"
        
        # Estimate resolution time based on category and priority
        base_times = {
            "security": 60, "hardware": 180, "network": 120,
            "software": 90, "email": 60, "other": 120
        }
        estimated_time = base_times.get(category, 120)
        
        if urgency == "urgent":
            estimated_time = int(estimated_time * 0.5)
        elif urgency == "low":
            estimated_time = int(estimated_time * 1.5)
        
        return {
            "category": category,
            "urgency": urgency,
            "impact": impact,
            "confidence_score": confidence,
            "reasoning": f"Rule-based classification using keyword analysis",
            "suggested_technician_skills": self._get_skills_for_category(category),
            "estimated_resolution_time": estimated_time
        }
    
    def _get_skills_for_category(self, category: str) -> List[str]:
        """Get suggested technician skills for a category."""
        skill_mapping = {
            "hardware": ["hardware_troubleshooting", "desktop_support", "server_maintenance"],
            "software": ["software_support", "application_troubleshooting", "user_training"],
            "network": ["network_administration", "cisco_networking", "firewall_management"],
            "security": ["cybersecurity", "incident_response", "malware_removal"],
            "email": ["exchange_administration", "email_troubleshooting", "office365"],
            "backup": ["backup_administration", "data_recovery", "disaster_recovery"],
            "printer": ["printer_support", "hardware_troubleshooting"],
            "phone": ["voip_support", "pbx_administration", "telecommunications"],
            "access": ["active_directory", "user_management", "authentication_systems"],
            "other": ["general_support", "troubleshooting"]
        }
        
        return skill_mapping.get(category, ["general_support"])
    
    def _calculate_priority(self, urgency: Urgency, impact: Impact) -> Priority:
        """Calculate priority based on urgency and impact matrix."""
        return self.priority_matrix.get((urgency, impact), Priority.MEDIUM)
    
    def _enhance_with_rules(self, ai_result: Dict, request: TicketTriageRequest) -> Dict:
        """Enhance AI results with rule-based logic."""
        # Apply customer tier adjustments
        if request.customer_tier == "premium":
            if ai_result.get("urgency") == "medium":
                ai_result["urgency"] = "high"
            if ai_result.get("impact") == "low":
                ai_result["impact"] = "medium"
        
        # Security-related tickets get higher priority
        if ai_result.get("category") == "security":
            ai_result["urgency"] = "urgent"
            if ai_result.get("impact") == "low":
                ai_result["impact"] = "medium"
        
        # Recalculate priority based on adjusted urgency/impact
        urgency = Urgency(ai_result["urgency"])
        impact = Impact(ai_result["impact"])
        priority = self._calculate_priority(urgency, impact)
        ai_result["priority"] = priority.value
        
        return ai_result
    
    async def triage_ticket(self, request: TicketTriageRequest) -> TriageResult:
        """
        Perform AI-powered ticket triage.
        
        Args:
            request: Ticket triage request
            
        Returns:
            TriageResult with classification and recommendations
            
        Raises:
            Exception: If triage fails
        """
        start_time = time.time()
        
        try:
            # Check cache first
            cache_key = self._generate_cache_key(request)
            cached_result = await redis_cache.get(cache_key)
            
            if cached_result:
                logger.info(f"Returning cached triage result for ticket {request.ticket_id}")
                return TriageResult(**cached_result)
            
            # Perform AI classification
            ai_result = await self._classify_with_ai(request)
            
            # Enhance with rule-based logic
            enhanced_result = self._enhance_with_rules(ai_result, request)
            
            # Build final result
            triage_result = TriageResult(
                ticket_id=request.ticket_id,
                category=TicketCategory(enhanced_result["category"]),
                priority=Priority(enhanced_result["priority"]),
                urgency=Urgency(enhanced_result["urgency"]),
                impact=Impact(enhanced_result["impact"]),
                confidence_score=enhanced_result.get("confidence_score", 0.8),
                reasoning=enhanced_result.get("reasoning", "AI classification"),
                suggested_technician_skills=enhanced_result.get("suggested_technician_skills", []),
                estimated_resolution_time=enhanced_result.get("estimated_resolution_time")
            )
            
            # Cache the result
            await redis_cache.set(cache_key, triage_result.dict(), ttl=3600)  # Cache for 1 hour
            
            processing_time = (time.time() - start_time) * 1000
            logger.info(f"Ticket {request.ticket_id} triaged in {processing_time:.2f}ms")
            
            return triage_result
            
        except Exception as e:
            logger.error(f"Triage failed for ticket {request.ticket_id}: {str(e)}")
            raise


# Global service instance
triage_service = TicketTriageService()