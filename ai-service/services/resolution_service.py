"""Resolution suggestion service using embeddings and AI generation."""
import json
import logging
import time
from typing import List, Dict, Optional
import hashlib

from clients.openai_client import openai_client
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
        """Generate AI-powered resolution suggestion."""
        
        # Build context from similar tickets
        similar_context = ""
        if similar_tickets:
            similar_context = "Similar historical resolutions:\n"
            for i, ticket in enumerate(similar_tickets[:3], 1):
                # Get full ticket details
                historical_ticket = await embedding_service.get_ticket_by_id(ticket.ticket_id)
                if historical_ticket:
                    similar_context += f"{i}. {ticket.title}\n"
                    similar_context += f"   Resolution: {historical_ticket.resolution}\n"
                    if historical_ticket.resolution_steps:
                        similar_context += f"   Steps: {'; '.join(historical_ticket.resolution_steps)}\n"
                    similar_context += f"   Time: {historical_ticket.resolution_time_minutes} minutes\n\n"
        
        # Build context from knowledge base
        kb_context = ""
        if knowledge_articles:
            kb_context = "Relevant knowledge base articles:\n"
            for article in knowledge_articles:
                kb_context += f"- {article.title}: {article.content[:200]}...\n"
        
        # Build user prompt
        user_prompt = f"""
Current Ticket:
Title: {request.title}
Description: {request.description}
Category: {request.category or 'Unknown'}
Error Messages: {', '.join(request.error_messages) if request.error_messages else 'None'}
Affected Systems: {', '.join(request.affected_systems) if request.affected_systems else 'Not specified'}

{similar_context}

{kb_context}

Please generate a detailed resolution suggestion for this ticket based on the context provided.
"""
        
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        
        try:
            response = await openai_client.chat_completion(
                messages=messages,
                temperature=0.2,  # Low temperature for consistent suggestions
                max_tokens=1000
            )
            
            content = response.choices[0].message.content.strip()
            
            # Clean up JSON formatting
            if content.startswith("```json"):
                content = content[7:]
            if content.endswith("```"):
                content = content[:-3]
            
            result = json.loads(content)
            return result
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse AI resolution response: {e}")
            raise ValueError(f"Invalid AI response format: {e}")
        except Exception as e:
            logger.error(f"AI resolution generation failed: {e}")
            raise
    
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