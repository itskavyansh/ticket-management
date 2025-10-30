"""Embedding service for similarity search and vector operations."""
import logging
import numpy as np
from typing import List, Dict, Tuple, Optional
import hashlib

from clients.gemini_client import gemini_client
from cache.redis_cache import redis_cache
from models.resolution_models import HistoricalTicket, SimilarityMatch

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for creating and managing text embeddings."""
    
    def __init__(self):
        """Initialize the embedding service."""
        self.embedding_model = "text-embedding-ada-002"
        self.embedding_dimension = 1536  # OpenAI ada-002 dimension
        
        # Mock historical tickets for demonstration
        # In production, this would come from a database
        self.historical_tickets = self._load_mock_historical_tickets()
    
    def _load_mock_historical_tickets(self) -> List[HistoricalTicket]:
        """Load mock historical tickets for demonstration."""
        from datetime import datetime, timedelta
        
        mock_tickets = [
            {
                "ticket_id": "HIST-001",
                "title": "Outlook not connecting to Exchange server",
                "description": "User cannot connect to Exchange server, getting authentication errors",
                "category": "email",
                "resolution": "Reset Outlook profile and reconfigure Exchange settings",
                "resolution_steps": [
                    "Close Outlook completely",
                    "Go to Control Panel > Mail > Show Profiles",
                    "Delete existing profile",
                    "Create new profile with correct Exchange settings",
                    "Test connection"
                ],
                "resolution_time_minutes": 30,
                "technician_id": "TECH-001",
                "customer_satisfaction": 4.5,
                "tags": ["outlook", "exchange", "email", "authentication"],
                "created_at": datetime.now() - timedelta(days=30),
                "resolved_at": datetime.now() - timedelta(days=30, hours=1)
            },
            {
                "ticket_id": "HIST-002", 
                "title": "Computer running very slow",
                "description": "Desktop computer taking long time to boot and applications are slow",
                "category": "hardware",
                "resolution": "Cleaned up disk space and updated drivers",
                "resolution_steps": [
                    "Run disk cleanup utility",
                    "Uninstall unused programs",
                    "Update graphics and network drivers",
                    "Run memory diagnostic",
                    "Restart computer"
                ],
                "resolution_time_minutes": 45,
                "technician_id": "TECH-002",
                "customer_satisfaction": 4.0,
                "tags": ["performance", "slow", "hardware", "drivers"],
                "created_at": datetime.now() - timedelta(days=15),
                "resolved_at": datetime.now() - timedelta(days=15, hours=2)
            },
            {
                "ticket_id": "HIST-003",
                "title": "Cannot access shared network drive",
                "description": "User getting access denied when trying to open shared folder on network",
                "category": "network",
                "resolution": "Reset network credentials and mapped drive",
                "resolution_steps": [
                    "Open Credential Manager",
                    "Remove old network credentials",
                    "Disconnect mapped network drive",
                    "Reconnect with correct credentials",
                    "Test access to shared folders"
                ],
                "resolution_time_minutes": 20,
                "technician_id": "TECH-001",
                "customer_satisfaction": 5.0,
                "tags": ["network", "shared drive", "access", "credentials"],
                "created_at": datetime.now() - timedelta(days=7),
                "resolved_at": datetime.now() - timedelta(days=7, minutes=30)
            },
            {
                "ticket_id": "HIST-004",
                "title": "Printer not responding",
                "description": "Network printer shows offline status and won't print documents",
                "category": "printer",
                "resolution": "Restarted print spooler service and updated printer driver",
                "resolution_steps": [
                    "Check printer network connection",
                    "Restart Print Spooler service",
                    "Clear print queue",
                    "Update printer driver",
                    "Test print functionality"
                ],
                "resolution_time_minutes": 25,
                "technician_id": "TECH-003",
                "customer_satisfaction": 4.2,
                "tags": ["printer", "network", "offline", "driver"],
                "created_at": datetime.now() - timedelta(days=3),
                "resolved_at": datetime.now() - timedelta(days=3, minutes=45)
            },
            {
                "ticket_id": "HIST-005",
                "title": "VPN connection keeps dropping",
                "description": "VPN connection disconnects every few minutes, affecting remote work",
                "category": "network",
                "resolution": "Updated VPN client and adjusted power management settings",
                "resolution_steps": [
                    "Update VPN client software",
                    "Disable power management for network adapter",
                    "Configure VPN to auto-reconnect",
                    "Test connection stability",
                    "Document new settings"
                ],
                "resolution_time_minutes": 35,
                "technician_id": "TECH-002",
                "customer_satisfaction": 4.8,
                "tags": ["vpn", "connection", "remote work", "network"],
                "created_at": datetime.now() - timedelta(days=1),
                "resolved_at": datetime.now() - timedelta(days=1, hours=1)
            }
        ]
        
        return [HistoricalTicket(**ticket) for ticket in mock_tickets]
    
    def _generate_embedding_cache_key(self, text: str) -> str:
        """Generate cache key for embedding."""
        text_hash = hashlib.md5(text.encode()).hexdigest()
        return f"embedding:{self.embedding_model}:{text_hash}"
    
    async def create_embedding(self, text: str) -> List[float]:
        """
        Create embedding for text with caching.
        
        Args:
            text: Text to embed
            
        Returns:
            List of embedding values
        """
        # Check cache first
        cache_key = self._generate_embedding_cache_key(text)
        cached_embedding = await redis_cache.get(cache_key)
        
        if cached_embedding:
            logger.debug(f"Using cached embedding for text: {text[:50]}...")
            return cached_embedding
        
        try:
            # Create embedding using OpenAI
            embedding = await gemini_client.create_embedding(text, self.embedding_model)
            
            # Cache the embedding (embeddings don't change, so long TTL)
            await redis_cache.set(cache_key, embedding, ttl=86400)  # 24 hours
            
            logger.debug(f"Created new embedding for text: {text[:50]}...")
            return embedding
            
        except Exception as e:
            logger.error(f"Failed to create embedding: {str(e)}")
            raise
    
    def calculate_cosine_similarity(self, embedding1: List[float], embedding2: List[float]) -> float:
        """
        Calculate cosine similarity between two embeddings.
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Cosine similarity score (0-1)
        """
        try:
            vec1 = np.array(embedding1)
            vec2 = np.array(embedding2)
            
            # Calculate cosine similarity
            dot_product = np.dot(vec1, vec2)
            norm1 = np.linalg.norm(vec1)
            norm2 = np.linalg.norm(vec2)
            
            if norm1 == 0 or norm2 == 0:
                return 0.0
            
            similarity = dot_product / (norm1 * norm2)
            
            # Ensure result is between 0 and 1
            return max(0.0, min(1.0, float(similarity)))
            
        except Exception as e:
            logger.error(f"Error calculating cosine similarity: {str(e)}")
            return 0.0
    
    async def find_similar_tickets(
        self, 
        query_text: str, 
        max_results: int = 5,
        min_similarity: float = 0.7
    ) -> List[SimilarityMatch]:
        """
        Find similar historical tickets using embedding similarity.
        
        Args:
            query_text: Text to find similar tickets for
            max_results: Maximum number of results to return
            min_similarity: Minimum similarity threshold
            
        Returns:
            List of similar tickets with similarity scores
        """
        try:
            # Create embedding for query text
            query_embedding = await self.create_embedding(query_text)
            
            similarities = []
            
            # Compare with historical tickets
            for ticket in self.historical_tickets:
                # Create combined text for comparison
                ticket_text = f"{ticket.title} {ticket.description}"
                
                # Get embedding for historical ticket
                ticket_embedding = await self.create_embedding(ticket_text)
                
                # Calculate similarity
                similarity = self.calculate_cosine_similarity(query_embedding, ticket_embedding)
                
                if similarity >= min_similarity:
                    similarities.append(SimilarityMatch(
                        ticket_id=ticket.ticket_id,
                        similarity_score=similarity,
                        title=ticket.title,
                        category=ticket.category,
                        resolution_summary=ticket.resolution
                    ))
            
            # Sort by similarity score (descending) and limit results
            similarities.sort(key=lambda x: x.similarity_score, reverse=True)
            return similarities[:max_results]
            
        except Exception as e:
            logger.error(f"Error finding similar tickets: {str(e)}")
            return []
    
    async def get_ticket_by_id(self, ticket_id: str) -> Optional[HistoricalTicket]:
        """
        Get historical ticket by ID.
        
        Args:
            ticket_id: Ticket identifier
            
        Returns:
            Historical ticket or None if not found
        """
        for ticket in self.historical_tickets:
            if ticket.ticket_id == ticket_id:
                return ticket
        return None


# Global service instance
embedding_service = EmbeddingService()