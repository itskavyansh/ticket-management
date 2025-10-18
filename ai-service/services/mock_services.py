"""Mock services for demo purposes when full AI services are not available."""
import asyncio
import random
import time
from typing import Dict, Any, List


class MockTriageService:
    """Mock triage service for demo purposes."""
    
    async def triage_ticket(self, request) -> Dict[str, Any]:
        """Mock ticket triage."""
        # Simulate processing time
        await asyncio.sleep(0.1)
        
        categories = ["hardware", "software", "network", "security", "email", "database"]
        priorities = ["low", "medium", "high", "critical"]
        
        return {
            "category": random.choice(categories),
            "priority": random.choice(priorities),
            "confidence_score": round(random.uniform(0.7, 0.95), 2),
            "suggested_technician_skills": ["troubleshooting", "system_administration"],
            "estimated_resolution_hours": round(random.uniform(1, 8), 1)
        }


class MockResolutionService:
    """Mock resolution service for demo purposes."""
    
    async def get_resolution_suggestions(self, request) -> List[Dict[str, Any]]:
        """Mock resolution suggestions."""
        # Simulate processing time
        await asyncio.sleep(0.2)
        
        suggestions = [
            {
                "suggestion": "Restart the affected service and check system logs for errors",
                "confidence_score": 0.85,
                "estimated_time_minutes": 15,
                "steps": [
                    "Access the server console",
                    "Stop the service using appropriate command",
                    "Check logs for error messages",
                    "Restart the service",
                    "Verify functionality"
                ]
            },
            {
                "suggestion": "Check network connectivity and firewall settings",
                "confidence_score": 0.72,
                "estimated_time_minutes": 30,
                "steps": [
                    "Test network connectivity",
                    "Review firewall rules",
                    "Check port availability",
                    "Verify DNS resolution"
                ]
            }
        ]
        
        return suggestions


class MockEmbeddingService:
    """Mock embedding service for demo purposes."""
    
    async def find_similar_tickets(self, query_text: str, max_results: int = 5, min_similarity: float = 0.6) -> List[Dict[str, Any]]:
        """Mock similar ticket search."""
        # Simulate processing time
        await asyncio.sleep(0.1)
        
        similar_tickets = [
            {
                "ticket_id": "TKT-001",
                "title": "Server connectivity issues",
                "similarity_score": 0.85,
                "resolution": "Restarted network service and updated firewall rules"
            },
            {
                "ticket_id": "TKT-002", 
                "title": "Application not responding",
                "similarity_score": 0.78,
                "resolution": "Increased memory allocation and optimized database queries"
            }
        ]
        
        return similar_tickets[:max_results]


# Global mock service instances
mock_triage_service = MockTriageService()
mock_resolution_service = MockResolutionService()
mock_embedding_service = MockEmbeddingService()