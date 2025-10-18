"""Ticket triage service using OpenAI GPT-4 for classification."""
import json
import logging
import time
from typing import Dict, List, Optional
import hashlib

from clients.openai_client import openai_client
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
        """Use OpenAI to classify the ticket."""
        # Build user prompt with ticket details
        user_prompt = f"""
Ticket Details:
Title: {request.title}
Description: {request.description}
Customer Tier: {request.customer_tier or 'standard'}
Affected Systems: {', '.join(request.affected_systems) if request.affected_systems else 'Not specified'}
Error Messages: {', '.join(request.error_messages) if request.error_messages else 'None'}
Reported By: {request.reported_by or 'Not specified'}

Please classify this ticket according to the system instructions.
"""
        
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        try:
            response = await openai_client.chat_completion(
                messages=messages,
                temperature=0.1,  # Low temperature for consistent classification
                max_tokens=500
            )
            
            # Parse the JSON response
            content = response.choices[0].message.content.strip()
            
            # Remove any markdown formatting if present
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            result = json.loads(content)
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI response as JSON: {e}")
            raise ValueError(f"Invalid AI response format: {e}")
        except Exception as e:
            logger.error(f"AI classification failed: {e}")
            raise
    
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