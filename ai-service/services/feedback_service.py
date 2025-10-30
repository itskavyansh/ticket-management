"""
AI Feedback Service for continuous model improvement.
Collects feedback on AI predictions and suggestions to improve accuracy over time.
"""

import logging
import json
import time
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from enum import Enum

from cache.redis_cache import redis_cache

logger = logging.getLogger(__name__)


class FeedbackType(Enum):
    """Types of feedback that can be collected."""
    TRIAGE_ACCURACY = "triage_accuracy"
    SLA_PREDICTION = "sla_prediction"
    RESOLUTION_EFFECTIVENESS = "resolution_effectiveness"
    WORKLOAD_OPTIMIZATION = "workload_optimization"


class FeedbackRating(Enum):
    """Feedback rating scale."""
    EXCELLENT = 5
    GOOD = 4
    AVERAGE = 3
    POOR = 2
    TERRIBLE = 1


@dataclass
class AIFeedback:
    """Feedback data structure for AI predictions."""
    feedback_id: str
    ticket_id: str
    feedback_type: FeedbackType
    ai_prediction: Dict[str, Any]
    actual_outcome: Dict[str, Any]
    user_rating: FeedbackRating
    user_comments: Optional[str]
    technician_id: Optional[str]
    timestamp: datetime
    processing_time_ms: int
    confidence_score: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage."""
        data = asdict(self)
        data['feedback_type'] = self.feedback_type.value
        data['user_rating'] = self.user_rating.value
        data['timestamp'] = self.timestamp.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AIFeedback':
        """Create from dictionary."""
        data['feedback_type'] = FeedbackType(data['feedback_type'])
        data['user_rating'] = FeedbackRating(data['user_rating'])
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)


class AIFeedbackService:
    """Service for collecting and analyzing AI feedback."""
    
    def __init__(self):
        """Initialize feedback service."""
        self.feedback_cache_ttl = 86400 * 30  # 30 days
        self.analytics_cache_ttl = 3600  # 1 hour
        
    async def collect_triage_feedback(
        self,
        ticket_id: str,
        ai_prediction: Dict[str, Any],
        actual_outcome: Dict[str, Any],
        user_rating: FeedbackRating,
        user_comments: Optional[str] = None,
        technician_id: Optional[str] = None
    ) -> str:
        """Collect feedback on ticket triage accuracy."""
        
        feedback = AIFeedback(
            feedback_id=f"triage_{ticket_id}_{int(time.time())}",
            ticket_id=ticket_id,
            feedback_type=FeedbackType.TRIAGE_ACCURACY,
            ai_prediction=ai_prediction,
            actual_outcome=actual_outcome,
            user_rating=user_rating,
            user_comments=user_comments,
            technician_id=technician_id,
            timestamp=datetime.utcnow(),
            processing_time_ms=ai_prediction.get('processing_time_ms', 0),
            confidence_score=ai_prediction.get('confidence_score', 0.0)
        )
        
        await self._store_feedback(feedback)
        await self._update_model_metrics(feedback)
        
        logger.info(f"Collected triage feedback for ticket {ticket_id}: {user_rating.name}")
        return feedback.feedback_id
    
    async def collect_sla_feedback(
        self,
        ticket_id: str,
        ai_prediction: Dict[str, Any],
        actual_outcome: Dict[str, Any],
        user_rating: FeedbackRating,
        user_comments: Optional[str] = None,
        technician_id: Optional[str] = None
    ) -> str:
        """Collect feedback on SLA prediction accuracy."""
        
        feedback = AIFeedback(
            feedback_id=f"sla_{ticket_id}_{int(time.time())}",
            ticket_id=ticket_id,
            feedback_type=FeedbackType.SLA_PREDICTION,
            ai_prediction=ai_prediction,
            actual_outcome=actual_outcome,
            user_rating=user_rating,
            user_comments=user_comments,
            technician_id=technician_id,
            timestamp=datetime.utcnow(),
            processing_time_ms=ai_prediction.get('processing_time_ms', 0),
            confidence_score=ai_prediction.get('confidence_score', 0.0)
        )
        
        await self._store_feedback(feedback)
        await self._update_model_metrics(feedback)
        
        logger.info(f"Collected SLA feedback for ticket {ticket_id}: {user_rating.name}")
        return feedback.feedback_id
    
    async def collect_resolution_feedback(
        self,
        ticket_id: str,
        ai_suggestion: Dict[str, Any],
        resolution_outcome: Dict[str, Any],
        user_rating: FeedbackRating,
        user_comments: Optional[str] = None,
        technician_id: Optional[str] = None
    ) -> str:
        """Collect feedback on resolution suggestion effectiveness."""
        
        feedback = AIFeedback(
            feedback_id=f"resolution_{ticket_id}_{int(time.time())}",
            ticket_id=ticket_id,
            feedback_type=FeedbackType.RESOLUTION_EFFECTIVENESS,
            ai_prediction=ai_suggestion,
            actual_outcome=resolution_outcome,
            user_rating=user_rating,
            user_comments=user_comments,
            technician_id=technician_id,
            timestamp=datetime.utcnow(),
            processing_time_ms=ai_suggestion.get('processing_time_ms', 0),
            confidence_score=ai_suggestion.get('confidence_score', 0.0)
        )
        
        await self._store_feedback(feedback)
        await self._update_model_metrics(feedback)
        
        logger.info(f"Collected resolution feedback for ticket {ticket_id}: {user_rating.name}")
        return feedback.feedback_id
    
    async def get_model_performance_metrics(self, days: int = 30) -> Dict[str, Any]:
        """Get AI model performance metrics."""
        cache_key = f"ai_metrics:{days}days"
        cached_metrics = await redis_cache.get(cache_key)
        
        if cached_metrics:
            return cached_metrics
        
        # Calculate metrics from feedback data
        metrics = await self._calculate_performance_metrics(days)
        
        # Cache metrics
        await redis_cache.set(cache_key, metrics, ttl=self.analytics_cache_ttl)
        
        return metrics
    
    async def get_improvement_recommendations(self) -> List[Dict[str, Any]]:
        """Get recommendations for improving AI model performance."""
        metrics = await self.get_model_performance_metrics()
        recommendations = []
        
        # Analyze triage accuracy
        triage_accuracy = metrics.get('triage_accuracy', {})
        if triage_accuracy.get('average_rating', 3.0) < 3.5:
            recommendations.append({
                "area": "triage_accuracy",
                "priority": "high",
                "recommendation": "Improve ticket classification model",
                "details": "Consider retraining with more diverse examples",
                "current_score": triage_accuracy.get('average_rating', 0),
                "target_score": 4.0
            })
        
        # Analyze SLA prediction accuracy
        sla_accuracy = metrics.get('sla_prediction', {})
        if sla_accuracy.get('average_rating', 3.0) < 3.5:
            recommendations.append({
                "area": "sla_prediction",
                "priority": "high",
                "recommendation": "Enhance SLA prediction model",
                "details": "Include more historical data and technician workload factors",
                "current_score": sla_accuracy.get('average_rating', 0),
                "target_score": 4.0
            })
        
        # Analyze resolution effectiveness
        resolution_effectiveness = metrics.get('resolution_effectiveness', {})
        if resolution_effectiveness.get('average_rating', 3.0) < 3.5:
            recommendations.append({
                "area": "resolution_suggestions",
                "priority": "medium",
                "recommendation": "Improve resolution suggestion quality",
                "details": "Expand knowledge base and improve similarity matching",
                "current_score": resolution_effectiveness.get('average_rating', 0),
                "target_score": 4.0
            })
        
        # Check confidence calibration
        overall_confidence = metrics.get('overall_confidence_accuracy', 0)
        if overall_confidence < 0.7:
            recommendations.append({
                "area": "confidence_calibration",
                "priority": "medium",
                "recommendation": "Improve confidence score calibration",
                "details": "AI confidence scores don't align well with actual performance",
                "current_score": overall_confidence,
                "target_score": 0.8
            })
        
        return recommendations
    
    async def _store_feedback(self, feedback: AIFeedback) -> None:
        """Store feedback in cache."""
        cache_key = f"feedback:{feedback.feedback_id}"
        await redis_cache.set(cache_key, feedback.to_dict(), ttl=self.feedback_cache_ttl)
        
        # Also store in feedback list for analytics
        list_key = f"feedback_list:{feedback.feedback_type.value}"
        feedback_list = await redis_cache.get(list_key) or []
        feedback_list.append(feedback.feedback_id)
        
        # Keep only recent feedback (last 1000 items)
        if len(feedback_list) > 1000:
            feedback_list = feedback_list[-1000:]
        
        await redis_cache.set(list_key, feedback_list, ttl=self.feedback_cache_ttl)
    
    async def _update_model_metrics(self, feedback: AIFeedback) -> None:
        """Update real-time model metrics."""
        metrics_key = f"model_metrics:{feedback.feedback_type.value}"
        current_metrics = await redis_cache.get(metrics_key) or {
            "total_feedback": 0,
            "average_rating": 0.0,
            "rating_distribution": {str(i): 0 for i in range(1, 6)},
            "confidence_accuracy": 0.0,
            "last_updated": datetime.utcnow().isoformat()
        }
        
        # Update metrics
        total_feedback = current_metrics["total_feedback"]
        current_avg = current_metrics["average_rating"]
        new_rating = feedback.user_rating.value
        
        # Calculate new average
        new_avg = ((current_avg * total_feedback) + new_rating) / (total_feedback + 1)
        
        # Update rating distribution
        current_metrics["rating_distribution"][str(new_rating)] += 1
        current_metrics["total_feedback"] = total_feedback + 1
        current_metrics["average_rating"] = new_avg
        current_metrics["last_updated"] = datetime.utcnow().isoformat()
        
        # Update confidence accuracy (simplified)
        confidence_diff = abs(feedback.confidence_score - (new_rating / 5.0))
        current_metrics["confidence_accuracy"] = 1.0 - confidence_diff
        
        await redis_cache.set(metrics_key, current_metrics, ttl=self.feedback_cache_ttl)
    
    async def _calculate_performance_metrics(self, days: int) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics."""
        cutoff_date = datetime.utcnow() - timedelta(days=days)
        metrics = {
            "period_days": days,
            "calculation_time": datetime.utcnow().isoformat(),
            "triage_accuracy": await self._get_feedback_metrics(FeedbackType.TRIAGE_ACCURACY, cutoff_date),
            "sla_prediction": await self._get_feedback_metrics(FeedbackType.SLA_PREDICTION, cutoff_date),
            "resolution_effectiveness": await self._get_feedback_metrics(FeedbackType.RESOLUTION_EFFECTIVENESS, cutoff_date),
            "overall_confidence_accuracy": 0.0,
            "improvement_trends": await self._calculate_improvement_trends(cutoff_date)
        }
        
        # Calculate overall confidence accuracy
        all_feedback = []
        for feedback_type in FeedbackType:
            feedback_list = await self._get_feedback_by_type(feedback_type, cutoff_date)
            all_feedback.extend(feedback_list)
        
        if all_feedback:
            confidence_accuracies = []
            for feedback in all_feedback:
                actual_performance = feedback.user_rating.value / 5.0
                confidence_diff = abs(feedback.confidence_score - actual_performance)
                confidence_accuracies.append(1.0 - confidence_diff)
            
            metrics["overall_confidence_accuracy"] = sum(confidence_accuracies) / len(confidence_accuracies)
        
        return metrics
    
    async def _get_feedback_metrics(self, feedback_type: FeedbackType, cutoff_date: datetime) -> Dict[str, Any]:
        """Get metrics for a specific feedback type."""
        feedback_list = await self._get_feedback_by_type(feedback_type, cutoff_date)
        
        if not feedback_list:
            return {
                "total_feedback": 0,
                "average_rating": 0.0,
                "rating_distribution": {str(i): 0 for i in range(1, 6)},
                "confidence_accuracy": 0.0
            }
        
        ratings = [f.user_rating.value for f in feedback_list]
        rating_distribution = {str(i): ratings.count(i) for i in range(1, 6)}
        
        confidence_accuracies = []
        for feedback in feedback_list:
            actual_performance = feedback.user_rating.value / 5.0
            confidence_diff = abs(feedback.confidence_score - actual_performance)
            confidence_accuracies.append(1.0 - confidence_diff)
        
        return {
            "total_feedback": len(feedback_list),
            "average_rating": sum(ratings) / len(ratings),
            "rating_distribution": rating_distribution,
            "confidence_accuracy": sum(confidence_accuracies) / len(confidence_accuracies) if confidence_accuracies else 0.0
        }
    
    async def _get_feedback_by_type(self, feedback_type: FeedbackType, cutoff_date: datetime) -> List[AIFeedback]:
        """Get feedback by type within date range."""
        list_key = f"feedback_list:{feedback_type.value}"
        feedback_ids = await redis_cache.get(list_key) or []
        
        feedback_list = []
        for feedback_id in feedback_ids:
            cache_key = f"feedback:{feedback_id}"
            feedback_data = await redis_cache.get(cache_key)
            
            if feedback_data:
                try:
                    feedback = AIFeedback.from_dict(feedback_data)
                    if feedback.timestamp >= cutoff_date:
                        feedback_list.append(feedback)
                except Exception as e:
                    logger.warning(f"Failed to parse feedback {feedback_id}: {str(e)}")
        
        return feedback_list
    
    async def _calculate_improvement_trends(self, cutoff_date: datetime) -> Dict[str, Any]:
        """Calculate improvement trends over time."""
        # This is a simplified implementation
        # In production, you'd want more sophisticated trend analysis
        
        trends = {}
        for feedback_type in FeedbackType:
            feedback_list = await self._get_feedback_by_type(feedback_type, cutoff_date)
            
            if len(feedback_list) >= 10:  # Need minimum data for trend analysis
                # Sort by timestamp
                feedback_list.sort(key=lambda x: x.timestamp)
                
                # Split into first and second half
                mid_point = len(feedback_list) // 2
                first_half = feedback_list[:mid_point]
                second_half = feedback_list[mid_point:]
                
                first_avg = sum(f.user_rating.value for f in first_half) / len(first_half)
                second_avg = sum(f.user_rating.value for f in second_half) / len(second_half)
                
                trend = "improving" if second_avg > first_avg else "declining" if second_avg < first_avg else "stable"
                change = second_avg - first_avg
                
                trends[feedback_type.value] = {
                    "trend": trend,
                    "change": change,
                    "first_period_avg": first_avg,
                    "second_period_avg": second_avg
                }
            else:
                trends[feedback_type.value] = {
                    "trend": "insufficient_data",
                    "change": 0.0,
                    "first_period_avg": 0.0,
                    "second_period_avg": 0.0
                }
        
        return trends


# Global service instance
feedback_service = AIFeedbackService()