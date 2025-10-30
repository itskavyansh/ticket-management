"""
AI Performance Optimization Configuration
Optimized for AWS GenAI services within budget constraints.
"""

from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class ModelTier(Enum):
    """AI model performance tiers for budget optimization."""
    BUDGET = "budget"      # Fastest, cheapest models
    BALANCED = "balanced"  # Good balance of speed/accuracy/cost
    PREMIUM = "premium"    # Best accuracy, higher cost


@dataclass
class AIOptimizationConfig:
    """Configuration for AI performance optimization."""
    
    # Model selection based on budget tier
    model_tier: ModelTier = ModelTier.BALANCED
    
    # Confidence thresholds for different operations
    triage_confidence_threshold: float = 0.6
    sla_confidence_threshold: float = 0.7
    resolution_confidence_threshold: float = 0.5
    
    # Caching configuration
    enable_aggressive_caching: bool = True
    cache_ttl_high_confidence: int = 3600  # 1 hour for high confidence
    cache_ttl_low_confidence: int = 1800   # 30 minutes for low confidence
    
    # Performance optimization
    max_concurrent_requests: int = 10
    request_timeout_seconds: int = 15
    enable_request_batching: bool = True
    batch_size: int = 5
    
    # Fallback configuration
    enable_fallback_models: bool = True
    fallback_timeout_seconds: int = 5
    max_fallback_attempts: int = 2
    
    # Cost optimization
    daily_api_call_limit: int = 1000  # Adjust based on $100 budget
    enable_cost_monitoring: bool = True
    cost_alert_threshold: float = 80.0  # Alert at 80% of budget
    
    # Quality optimization
    enable_feedback_learning: bool = True
    min_feedback_samples: int = 10
    feedback_weight: float = 0.3
    
    # AWS-specific optimizations
    use_aws_bedrock: bool = False  # Enable if available in region
    prefer_local_models: bool = True  # Use local models when possible
    enable_model_compression: bool = True


class AIModelConfig:
    """Configuration for different AI models based on budget tier."""
    
    BUDGET_CONFIG = {
        "triage_model": {
            "provider": "gemini",
            "model": "gemini-1.5-flash",
            "max_tokens": 500,
            "temperature": 0.1,
            "cost_per_1k_tokens": 0.0001
        },
        "resolution_model": {
            "provider": "gemini", 
            "model": "gemini-1.5-flash",
            "max_tokens": 800,
            "temperature": 0.2,
            "cost_per_1k_tokens": 0.0001
        },
        "sla_model": {
            "provider": "local",  # Use local ML model
            "model": "gradient_boosting",
            "cost_per_prediction": 0.0
        }
    }
    
    BALANCED_CONFIG = {
        "triage_model": {
            "provider": "gemini",
            "model": "gemini-1.5-pro",
            "max_tokens": 1000,
            "temperature": 0.1,
            "cost_per_1k_tokens": 0.0005
        },
        "resolution_model": {
            "provider": "gemini",
            "model": "gemini-1.5-pro", 
            "max_tokens": 1500,
            "temperature": 0.2,
            "cost_per_1k_tokens": 0.0005
        },
        "sla_model": {
            "provider": "hybrid",  # ML model + AI validation
            "model": "gradient_boosting_plus_ai",
            "cost_per_prediction": 0.001
        }
    }
    
    PREMIUM_CONFIG = {
        "triage_model": {
            "provider": "openai",
            "model": "gpt-4",
            "max_tokens": 1000,
            "temperature": 0.1,
            "cost_per_1k_tokens": 0.03
        },
        "resolution_model": {
            "provider": "openai",
            "model": "gpt-4",
            "max_tokens": 2000,
            "temperature": 0.2,
            "cost_per_1k_tokens": 0.03
        },
        "sla_model": {
            "provider": "openai",
            "model": "gpt-4",
            "cost_per_prediction": 0.01
        }
    }
    
    @classmethod
    def get_config(cls, tier: ModelTier) -> Dict[str, Any]:
        """Get configuration for specified tier."""
        configs = {
            ModelTier.BUDGET: cls.BUDGET_CONFIG,
            ModelTier.BALANCED: cls.BALANCED_CONFIG,
            ModelTier.PREMIUM: cls.PREMIUM_CONFIG
        }
        return configs[tier]


class CostOptimizer:
    """Cost optimization utilities for AI services."""
    
    def __init__(self, daily_budget: float = 3.33):  # $100/30 days
        self.daily_budget = daily_budget
        self.current_spend = 0.0
        self.api_calls_today = 0
        self.cost_per_call_estimates = {
            "triage": 0.002,
            "resolution": 0.005,
            "sla_prediction": 0.001
        }
    
    def can_make_request(self, request_type: str) -> bool:
        """Check if request is within budget constraints."""
        estimated_cost = self.cost_per_call_estimates.get(request_type, 0.001)
        return (self.current_spend + estimated_cost) <= self.daily_budget
    
    def record_request(self, request_type: str, actual_cost: float = None):
        """Record API request and cost."""
        cost = actual_cost or self.cost_per_call_estimates.get(request_type, 0.001)
        self.current_spend += cost
        self.api_calls_today += 1
    
    def get_budget_status(self) -> Dict[str, Any]:
        """Get current budget status."""
        return {
            "daily_budget": self.daily_budget,
            "current_spend": self.current_spend,
            "remaining_budget": self.daily_budget - self.current_spend,
            "budget_utilization": (self.current_spend / self.daily_budget) * 100,
            "api_calls_today": self.api_calls_today,
            "avg_cost_per_call": self.current_spend / max(1, self.api_calls_today)
        }
    
    def should_use_fallback(self) -> bool:
        """Determine if fallback should be used to save costs."""
        utilization = (self.current_spend / self.daily_budget) * 100
        return utilization > 80  # Use fallback if over 80% of budget used


class PerformanceOptimizer:
    """Performance optimization utilities."""
    
    @staticmethod
    def optimize_prompt(prompt: str, max_length: int = 2000) -> str:
        """Optimize prompt length to reduce costs while maintaining quality."""
        if len(prompt) <= max_length:
            return prompt
        
        # Keep the most important parts: beginning and end
        keep_start = max_length // 2
        keep_end = max_length - keep_start - 20  # Leave space for truncation notice
        
        truncated = prompt[:keep_start] + "\n[...truncated...]\n" + prompt[-keep_end:]
        return truncated
    
    @staticmethod
    def should_use_cache(confidence_score: float, age_minutes: int) -> bool:
        """Determine if cached result should be used based on confidence and age."""
        # High confidence results can be cached longer
        if confidence_score > 0.8:
            return age_minutes < 60  # 1 hour
        elif confidence_score > 0.6:
            return age_minutes < 30  # 30 minutes
        else:
            return age_minutes < 15  # 15 minutes
    
    @staticmethod
    def calculate_priority_score(
        confidence: float,
        urgency: str,
        customer_tier: str
    ) -> float:
        """Calculate priority score for request processing."""
        base_score = confidence
        
        # Urgency multiplier
        urgency_multipliers = {
            "low": 0.8,
            "medium": 1.0,
            "high": 1.3,
            "urgent": 1.5
        }
        base_score *= urgency_multipliers.get(urgency, 1.0)
        
        # Customer tier multiplier
        tier_multipliers = {
            "basic": 0.9,
            "standard": 1.0,
            "premium": 1.2,
            "enterprise": 1.4
        }
        base_score *= tier_multipliers.get(customer_tier, 1.0)
        
        return min(2.0, base_score)  # Cap at 2.0


# Global configuration instance
ai_config = AIOptimizationConfig()
cost_optimizer = CostOptimizer()
performance_optimizer = PerformanceOptimizer()


def get_optimized_model_config(operation: str) -> Dict[str, Any]:
    """Get optimized model configuration for specific operation."""
    base_config = AIModelConfig.get_config(ai_config.model_tier)
    
    # Apply cost-based optimizations
    if cost_optimizer.should_use_fallback():
        # Switch to budget tier if over budget
        base_config = AIModelConfig.get_config(ModelTier.BUDGET)
    
    return base_config.get(f"{operation}_model", base_config["triage_model"])


def should_enable_feature(feature_name: str) -> bool:
    """Determine if a feature should be enabled based on current constraints."""
    budget_status = cost_optimizer.get_budget_status()
    
    # Disable expensive features if budget is tight
    if budget_status["budget_utilization"] > 90:
        expensive_features = ["premium_models", "detailed_analysis", "multiple_suggestions"]
        return feature_name not in expensive_features
    
    return True