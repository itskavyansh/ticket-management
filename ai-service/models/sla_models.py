"""
SLA prediction models and data structures.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from enum import Enum


class TicketStatus(str, Enum):
    """Ticket status enumeration."""
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    PENDING_CUSTOMER = "pending_customer"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Priority(str, Enum):
    """Ticket priority enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class CustomerTier(str, Enum):
    """Customer tier enumeration."""
    BASIC = "basic"
    PREMIUM = "premium"
    ENTERPRISE = "enterprise"


class SLAPredictionRequest(BaseModel):
    """Request model for SLA breach prediction."""
    
    ticket_id: str = Field(..., description="Unique ticket identifier")
    customer_id: str = Field(..., description="Customer identifier")
    customer_tier: CustomerTier = Field(..., description="Customer service tier")
    priority: Priority = Field(..., description="Ticket priority level")
    status: TicketStatus = Field(..., description="Current ticket status")
    
    # Timing information
    created_at: datetime = Field(..., description="Ticket creation timestamp")
    sla_deadline: datetime = Field(..., description="SLA deadline timestamp")
    current_time: Optional[datetime] = Field(None, description="Current timestamp for prediction")
    
    # Ticket details
    category: Optional[str] = Field(None, description="Ticket category")
    title: str = Field(..., description="Ticket title")
    description: str = Field(..., description="Ticket description")
    
    # Assignment and progress
    assigned_technician_id: Optional[str] = Field(None, description="Assigned technician ID")
    technician_skill_level: Optional[float] = Field(None, ge=0.0, le=10.0, description="Technician skill level (0-10)")
    time_spent: Optional[int] = Field(0, ge=0, description="Time spent on ticket in minutes")
    escalation_level: Optional[int] = Field(0, ge=0, description="Current escalation level")
    
    # Historical context
    similar_tickets_avg_resolution: Optional[float] = Field(None, description="Average resolution time for similar tickets")
    customer_avg_response_time: Optional[float] = Field(None, description="Customer's average response time")
    technician_current_workload: Optional[float] = Field(None, ge=0.0, le=1.0, description="Technician's current workload (0-1)")
    
    # External factors
    is_business_hours: Optional[bool] = Field(None, description="Whether current time is within business hours")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="Day of week (0=Sunday)")
    hour_of_day: Optional[int] = Field(None, ge=0, le=23, description="Hour of day (0-23)")
    
    @validator('current_time', pre=True, always=True)
    def set_current_time(cls, v):
        return v or datetime.utcnow()


class SLARiskLevel(str, Enum):
    """SLA risk level enumeration."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SLAPredictionResult(BaseModel):
    """SLA prediction result."""
    
    ticket_id: str = Field(..., description="Ticket identifier")
    breach_probability: float = Field(..., ge=0.0, le=1.0, description="Probability of SLA breach (0-1)")
    risk_level: SLARiskLevel = Field(..., description="Risk level classification")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Prediction confidence (0-1)")
    
    # Time predictions
    estimated_completion_time: Optional[datetime] = Field(None, description="Estimated completion timestamp")
    time_remaining_minutes: int = Field(..., description="Minutes remaining until SLA deadline")
    estimated_resolution_minutes: Optional[int] = Field(None, description="Estimated minutes to resolution")
    
    # Risk factors
    primary_risk_factors: List[str] = Field(default_factory=list, description="Main factors contributing to risk")
    risk_factor_scores: Dict[str, float] = Field(default_factory=dict, description="Individual risk factor scores")
    
    # Recommendations
    recommended_actions: List[str] = Field(default_factory=list, description="Recommended actions to mitigate risk")
    escalation_recommended: bool = Field(False, description="Whether escalation is recommended")
    reassignment_recommended: bool = Field(False, description="Whether reassignment is recommended")


class SLAPredictionResponse(BaseModel):
    """Response model for SLA prediction."""
    
    success: bool = Field(..., description="Whether the prediction was successful")
    result: Optional[SLAPredictionResult] = Field(None, description="Prediction result")
    error: Optional[str] = Field(None, description="Error message if prediction failed")
    processing_time_ms: int = Field(..., description="Processing time in milliseconds")
    cached: bool = Field(False, description="Whether result was served from cache")
    model_version: str = Field("1.0", description="Prediction model version")


class HistoricalTicketData(BaseModel):
    """Historical ticket data for training and context."""
    
    ticket_id: str
    customer_tier: CustomerTier
    priority: Priority
    category: str
    status: TicketStatus
    
    # Timing
    created_at: datetime
    sla_deadline: datetime
    resolved_at: Optional[datetime]
    actual_resolution_time: Optional[int]  # minutes
    
    # Assignment
    assigned_technician_id: Optional[str]
    technician_skill_level: Optional[float]
    escalation_level: int
    
    # Outcome
    sla_breached: bool
    breach_margin_minutes: Optional[int]  # positive if breached, negative if met
    
    # Context
    time_spent: int
    customer_response_count: int
    technician_response_count: int
    was_escalated: bool
    was_reassigned: bool


class SLAModelFeatures(BaseModel):
    """Feature vector for SLA prediction model."""
    
    # Time-based features
    time_remaining_ratio: float  # (deadline - current) / (deadline - created)
    progress_ratio: float  # time_spent / estimated_total_time
    business_hours_remaining: float  # business hours until deadline
    
    # Priority and tier features
    priority_score: float  # numerical priority (1-4)
    tier_score: float  # numerical tier (1-3)
    
    # Complexity features
    description_length: int
    title_length: int
    category_complexity: float  # based on historical data
    
    # Assignment features
    technician_skill_match: float  # skill level for this category
    technician_workload: float  # current workload ratio
    is_assigned: bool
    
    # Historical features
    similar_tickets_avg_time: float
    customer_avg_response_time: float
    technician_avg_resolution_time: float
    
    # Temporal features
    hour_of_day: int
    day_of_week: int
    is_business_hours: bool
    
    # Progress features
    escalation_level: int
    time_since_last_update: float  # hours
    response_velocity: float  # responses per hour


class SLATrainingData(BaseModel):
    """Training data structure for SLA prediction model."""
    
    features: SLAModelFeatures
    target: float  # breach probability (0-1)
    actual_outcome: bool  # whether SLA was actually breached
    ticket_metadata: Dict[str, Any]  # additional context