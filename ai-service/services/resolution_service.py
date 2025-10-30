"""Resolution suggestion service using embeddings and AI generation."""
import json
import logging
import time
from typing import List, Dict, Optional
import hashlib

from clients.gemini_client import gemini_client
from cache.redis_cache import redis_cache
from services.embedding_service import embedding_service
from models.resolution_models import (
    ResolutionSuggestionRequest,
    ResolutionSuggestion,
    ResolutionStep,
    SimilarityMatch,
    KnowledgeBaseArticle
)

logger = logging.getLogger(__name__)


class ResolutionSuggestionService:
    """Service for generating AI-powered resolution suggestions."""
    
    def __init__(self):
        """Initialize the resolution suggestion service."""
        self.system_prompt = self._build_system_prompt()
        self.knowledge_base = self._load_mock_knowledge_base()
    
    def _build_system_prompt(self) -> str:
        """Build system prompt for resolution generation."""
        return """You are an expert IT support technician with years of experience resolving technical issues.
Your task is to generate detailed, step-by-step resolution suggestions for support tickets.

For each resolution suggestion, provide:
1. A clear title describing the solution approach
2. Detailed step-by-step instructions
3. Expected outcomes for each step
4. Troubleshooting tips for common issues
5. Estimated time to complete
6. Required technical skills

Consider these factors:
- Similar historical resolutions provided as context
- Customer environment and affected systems
- Error messages and symptoms
- Best practices for the specific technology
- Safety and security considerations

Respond with valid JSON only, no additional text. Use this exact structure:
{
    "title": "Solution title",
    "description": "Brief description of the approach",
    "confidence_score": 0.85,
    "resolution_steps": [
        {
            "step_number": 1,
            "description": "Detailed step description",
            "command": "command to run if applicable",
            "expected_outcome": "what should happen",
            "troubleshooting_tips": ["tip1", "tip2"]
        }
    ],
    "estimated_time_minutes": 30,
    "required_skills": ["skill1", "skill2"],
    "tags": ["tag1", "tag2"]
}"""
    
    def _load_mock_knowledge_base(self) -> List[KnowledgeBaseArticle]:
        """Load mock knowledge base articles."""
        from datetime import datetime, timedelta
        
        articles = [
            {
                "article_id": "KB-001",
                "title": "Troubleshooting Outlook Connection Issues",
                "content": "Common steps to resolve Outlook connectivity problems including profile recreation, credential reset, and Exchange server configuration.",
                "category": "email",
                "tags": ["outlook", "exchange", "email", "connection"],
                "last_updated": datetime.now() - timedelta(days=10),
                "view_count": 245,
                "helpfulness_score": 4.3
            },
            {
                "article_id": "KB-002",
                "title": "Resolving Slow Computer Performance",
                "content": "Step-by-step guide to diagnose and fix slow computer performance including disk cleanup, driver updates, and hardware checks.",
                "category": "hardware",
                "tags": ["performance", "slow", "optimization", "hardware"],
                "last_updated": datetime.now() - timedelta(days=5),
                "view_count": 189,
                "helpfulness_score": 4.1
            },
            {
                "article_id": "KB-003",
                "title": "Network Drive Access Problems",
                "content": "How to troubleshoot and resolve network drive access issues including credential management and permission problems.",
                "category": "network",
                "tags": ["network", "shared drive", "access", "permissions"],
                "last_updated": datetime.now() - timedelta(days=3),
                "view_count": 156,
                "helpfulness_score": 4.5
            }
        ]
        
        return [KnowledgeBaseArticle(**article) for article in articles]
    
    def _generate_cache_key(self, request: ResolutionSuggestionRequest) -> str:
        """Generate cache key for resolution request."""
        content = f"{request.title}|{request.description}|{request.category}"
        return f"resolution:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def _find_relevant_knowledge_base(self, query_text: str, max_results: int = 3) -> List[KnowledgeBaseArticle]:
        """Find relevant knowledge base articles."""
        try:
            # Create embedding for query
            query_embedding = await embedding_service.create_embedding(query_text)
            
            article_similarities = []
            
            for article in self.knowledge_base:
                # Create embedding for article
                article_text = f"{article.title} {article.content}"
                article_embedding = await embedding_service.create_embedding(article_text)
                
                # Calculate similarity
                similarity = embedding_service.calculate_cosine_similarity(query_embedding, article_embedding)
                
                if similarity > 0.6:  # Minimum threshold for relevance
                    article_similarities.append((article, similarity))
            
            # Sort by similarity and return top results
            article_similarities.sort(key=lambda x: x[1], reverse=True)
            return [article for article, _ in article_similarities[:max_results]]
            
        except Exception as e:
            logger.error(f"Error finding relevant knowledge base articles: {str(e)}")
            return []
    
    async def _generate_ai_resolution(
        self, 
        request: ResolutionSuggestionRequest,
        similar_tickets: List[SimilarityMatch],
        knowledge_articles: List[KnowledgeBaseArticle]
    ) -> Dict:
        """Generate AI-powered resolution suggestion with enhanced accuracy."""
        
        try:
            # Use Gemini API for resolution suggestions
            from clients.gemini_client import gemini_client
            
            result = await gemini_client.suggest_resolution(
                title=request.title,
                description=request.description,
                category=request.category
            )
            
            if result and "suggestions" in result:
                # Enhance with historical context
                enhanced_result = self._enhance_with_historical_context(result, similar_tickets, knowledge_articles)
                return self._format_resolution_result(enhanced_result)
            
        except Exception as e:
            logger.warning(f"Gemini resolution generation failed, using fallback: {str(e)}")
        
        # Fallback to template-based resolution
        return await self._generate_template_resolution(request, similar_tickets, knowledge_articles)
    
    def _enhance_with_historical_context(self, ai_result: Dict, similar_tickets: List[SimilarityMatch], knowledge_articles: List[KnowledgeBaseArticle]) -> Dict:
        """Enhance AI result with historical context and confidence scoring."""
        if not ai_result.get("suggestions"):
            return ai_result
        
        # Boost confidence if we have similar historical resolutions
        if similar_tickets:
            for suggestion in ai_result["suggestions"]:
                # Check if suggestion aligns with historical resolutions
                historical_alignment = self._calculate_historical_alignment(suggestion, similar_tickets)
                original_confidence = suggestion.get("confidence_score", 0.5)
                suggestion["confidence_score"] = min(0.95, original_confidence + historical_alignment * 0.2)
                
                # Add historical context to steps if relevant
                if historical_alignment > 0.7:
                    suggestion["steps"] = self._merge_historical_steps(suggestion.get("steps", []), similar_tickets)
        
        # Add knowledge base references
        if knowledge_articles:
            for suggestion in ai_result["suggestions"]:
                suggestion["knowledge_base_refs"] = [
                    {"title": article.title, "article_id": article.article_id}
                    for article in knowledge_articles[:2]
                ]
        
        return ai_result
    
    def _calculate_historical_alignment(self, suggestion: Dict, similar_tickets: List[SimilarityMatch]) -> float:
        """Calculate how well the suggestion aligns with historical resolutions."""
        suggestion_text = suggestion.get("suggestion", "").lower()
        steps_text = " ".join(suggestion.get("steps", [])).lower()
        combined_text = f"{suggestion_text} {steps_text}"
        
        alignment_scores = []
        for ticket in similar_tickets[:3]:  # Check top 3 similar tickets
            # This would normally check against actual historical resolution text
            # For now, we'll use a simplified keyword matching approach
            common_keywords = ["restart", "update", "check", "verify", "install", "configure", "reset"]
            matches = sum(1 for keyword in common_keywords if keyword in combined_text)
            alignment_scores.append(matches / len(common_keywords))
        
        return max(alignment_scores) if alignment_scores else 0.0
    
    def _merge_historical_steps(self, ai_steps: List[str], similar_tickets: List[SimilarityMatch]) -> List[str]:
        """Merge AI-generated steps with insights from historical resolutions."""
        enhanced_steps = ai_steps.copy()
        
        # Add verification steps based on historical patterns
        if any("restart" in step.lower() for step in ai_steps):
            if not any("verify" in step.lower() for step in ai_steps):
                enhanced_steps.append("Verify the service is running properly after restart")
        
        if any("install" in step.lower() or "update" in step.lower() for step in ai_steps):
            if not any("backup" in step.lower() for step in ai_steps):
                enhanced_steps.insert(0, "Create a backup before making changes")
        
        return enhanced_steps
    
    def _format_resolution_result(self, ai_result: Dict) -> Dict:
        """Format AI result to match expected structure."""
        if "suggestions" in ai_result and ai_result["suggestions"]:
            # Take the first suggestion and format it
            suggestion = ai_result["suggestions"][0]
            return {
                "title": suggestion.get("suggestion", "AI Generated Solution"),
                "description": suggestion.get("suggestion", "AI-generated resolution approach"),
                "confidence_score": suggestion.get("confidence_score", 0.8),
                "resolution_steps": [
                    {
                        "step_number": i + 1,
                        "description": step,
                        "expected_outcome": f"Step {i + 1} completed successfully"
                    }
                    for i, step in enumerate(suggestion.get("steps", []))
                ],
                "estimated_time_minutes": suggestion.get("estimated_time_minutes", 60),
                "required_skills": ["troubleshooting", "technical_support"],
                "tags": ["ai_generated"]
            }
        
        # Fallback structure
        return {
            "title": "Standard Resolution Approach",
            "description": "Follow standard troubleshooting procedures",
            "confidence_score": 0.6,
            "resolution_steps": [
                {
                    "step_number": 1,
                    "description": "Identify the root cause of the issue",
                    "expected_outcome": "Root cause identified"
                },
                {
                    "step_number": 2,
                    "description": "Apply appropriate solution",
                    "expected_outcome": "Issue resolved"
                }
            ],
            "estimated_time_minutes": 90,
            "required_skills": ["troubleshooting"],
            "tags": ["standard"]
        }
    
    async def _generate_template_resolution(self, request: ResolutionSuggestionRequest, similar_tickets: List[SimilarityMatch], knowledge_articles: List[KnowledgeBaseArticle]) -> Dict:
        """Generate template-based resolution when AI fails."""
        category = request.category or "other"
        
        # Category-specific resolution templates
        templates = {
            "software": {
                "title": "Software Issue Resolution",
                "steps": [
                    "Check if the application is running",
                    "Restart the application",
                    "Check for available updates",
                    "Verify system requirements",
                    "Reinstall if necessary"
                ],
                "time": 45
            },
            "hardware": {
                "title": "Hardware Issue Resolution", 
                "steps": [
                    "Check physical connections",
                    "Run hardware diagnostics",
                    "Check device manager for errors",
                    "Update drivers if needed",
                    "Replace hardware if faulty"
                ],
                "time": 90
            },
            "network": {
                "title": "Network Issue Resolution",
                "steps": [
                    "Check network connectivity",
                    "Verify IP configuration",
                    "Test DNS resolution",
                    "Check firewall settings",
                    "Restart network services"
                ],
                "time": 60
            },
            "email": {
                "title": "Email Issue Resolution",
                "steps": [
                    "Check email client configuration",
                    "Verify server settings",
                    "Test email connectivity",
                    "Check for account lockouts",
                    "Recreate email profile if needed"
                ],
                "time": 30
            }
        }
        
        template = templates.get(category, {
            "title": "General Issue Resolution",
            "steps": [
                "Gather detailed information about the issue",
                "Identify potential causes",
                "Apply appropriate troubleshooting steps",
                "Test the solution",
                "Document the resolution"
            ],
            "time": 60
        })
        
        # Enhance with historical context if available
        confidence = 0.7
        if similar_tickets:
            confidence = min(0.85, confidence + len(similar_tickets) * 0.05)
        
        return {
            "title": template["title"],
            "description": f"Standard resolution approach for {category} issues",
            "confidence_score": confidence,
            "resolution_steps": [
                {
                    "step_number": i + 1,
                    "description": step,
                    "expected_outcome": f"Step {i + 1} completed successfully",
                    "troubleshooting_tips": self._get_troubleshooting_tips(step)
                }
                for i, step in enumerate(template["steps"])
            ],
            "estimated_time_minutes": template["time"],
            "required_skills": self._get_skills_for_category(category),
            "tags": [category, "template_based"]
        }
    
    def _get_troubleshooting_tips(self, step: str) -> List[str]:
        """Get troubleshooting tips for a resolution step."""
        tips_mapping = {
            "restart": ["Save any open work before restarting", "Wait 30 seconds before restarting"],
            "check": ["Document current settings before making changes", "Take screenshots for reference"],
            "install": ["Download from official sources only", "Create system restore point first"],
            "update": ["Check compatibility before updating", "Have rollback plan ready"],
            "verify": ["Test functionality thoroughly", "Check with end user if possible"]
        }
        
        step_lower = step.lower()
        for keyword, tips in tips_mapping.items():
            if keyword in step_lower:
                return tips[:2]  # Return max 2 tips
        
        return ["Document all changes made", "Test thoroughly before closing ticket"]
    
    def _get_skills_for_category(self, category: str) -> List[str]:
        """Get required skills for a category."""
        skill_mapping = {
            "software": ["software_support", "application_troubleshooting"],
            "hardware": ["hardware_troubleshooting", "desktop_support"],
            "network": ["network_administration", "connectivity_troubleshooting"],
            "email": ["email_administration", "exchange_support"],
            "security": ["cybersecurity", "incident_response"],
            "other": ["general_support", "troubleshooting"]
        }
        
        return skill_mapping.get(category, ["general_support", "troubleshooting"])
    
    def _create_resolution_from_historical(self, historical_ticket, similarity_score: float) -> ResolutionSuggestion:
        """Create resolution suggestion from historical ticket."""
        steps = []
        for i, step_desc in enumerate(historical_ticket.resolution_steps, 1):
            steps.append(ResolutionStep(
                step_number=i,
                description=step_desc,
                expected_outcome=f"Step {i} completed successfully"
            ))
        
        return ResolutionSuggestion(
            suggestion_id=f"hist_{historical_ticket.ticket_id}",
            title=f"Similar Issue Resolution: {historical_ticket.title}",
            description=historical_ticket.resolution,
            confidence_score=min(0.9, similarity_score + 0.1),  # Boost confidence slightly
            similarity_score=similarity_score,
            source_type="historical_ticket",
            source_id=historical_ticket.ticket_id,
            resolution_steps=steps,
            estimated_time_minutes=historical_ticket.resolution_time_minutes,
            required_skills=historical_ticket.tags[:3],  # Use tags as skills
            success_rate=0.85,  # Mock success rate
            tags=historical_ticket.tags
        )
    
    def _create_resolution_from_ai(self, ai_result: Dict, request: ResolutionSuggestionRequest) -> ResolutionSuggestion:
        """Create resolution suggestion from AI generation."""
        steps = []
        for step_data in ai_result.get("resolution_steps", []):
            steps.append(ResolutionStep(
                step_number=step_data.get("step_number", 1),
                description=step_data.get("description", ""),
                command=step_data.get("command"),
                expected_outcome=step_data.get("expected_outcome"),
                troubleshooting_tips=step_data.get("troubleshooting_tips", [])
            ))
        
        return ResolutionSuggestion(
            suggestion_id=f"ai_{int(time.time())}",
            title=ai_result.get("title", "AI Generated Solution"),
            description=ai_result.get("description", "AI-generated resolution approach"),
            confidence_score=ai_result.get("confidence_score", 0.8),
            similarity_score=0.0,  # AI generated, not based on similarity
            source_type="ai_generated",
            resolution_steps=steps,
            estimated_time_minutes=ai_result.get("estimated_time_minutes"),
            required_skills=ai_result.get("required_skills", []),
            tags=ai_result.get("tags", [])
        )
    
    async def get_resolution_suggestions(self, request: ResolutionSuggestionRequest) -> List[ResolutionSuggestion]:
        """
        Get resolution suggestions for a ticket.
        
        Args:
            request: Resolution suggestion request
            
        Returns:
            List of resolution suggestions
        """
        try:
            # Check cache first
            cache_key = self._generate_cache_key(request)
            cached_suggestions = await redis_cache.get(cache_key)
            
            if cached_suggestions:
                logger.info(f"Returning cached resolution suggestions for ticket {request.ticket_id}")
                return [ResolutionSuggestion(**suggestion) for suggestion in cached_suggestions]
            
            suggestions = []
            
            # Find similar historical tickets
            query_text = f"{request.title} {request.description}"
            similar_tickets = await embedding_service.find_similar_tickets(
                query_text, 
                max_results=request.max_suggestions,
                min_similarity=0.7
            )
            
            # Create suggestions from historical tickets
            for similar_ticket in similar_tickets[:3]:  # Limit to top 3
                historical_ticket = await embedding_service.get_ticket_by_id(similar_ticket.ticket_id)
                if historical_ticket:
                    suggestion = self._create_resolution_from_historical(historical_ticket, similar_ticket.similarity_score)
                    suggestions.append(suggestion)
            
            # Find relevant knowledge base articles if requested
            knowledge_articles = []
            if request.include_knowledge_base:
                knowledge_articles = await self._find_relevant_knowledge_base(query_text)
            
            # Generate AI-powered suggestion
            try:
                ai_result = await self._generate_ai_resolution(request, similar_tickets, knowledge_articles)
                ai_suggestion = self._create_resolution_from_ai(ai_result, request)
                suggestions.append(ai_suggestion)
            except Exception as e:
                logger.warning(f"AI resolution generation failed, continuing with historical suggestions: {str(e)}")
            
            # Sort by confidence score
            suggestions.sort(key=lambda x: x.confidence_score, reverse=True)
            
            # Limit to requested number of suggestions
            suggestions = suggestions[:request.max_suggestions]
            
            # Cache the results
            suggestions_dict = [suggestion.dict() for suggestion in suggestions]
            await redis_cache.set(cache_key, suggestions_dict, ttl=1800)  # Cache for 30 minutes
            
            logger.info(f"Generated {len(suggestions)} resolution suggestions for ticket {request.ticket_id}")
            return suggestions
            
        except Exception as e:
            logger.error(f"Failed to get resolution suggestions for ticket {request.ticket_id}: {str(e)}")
            raise


# Global service instance
resolution_service = ResolutionSuggestionService()