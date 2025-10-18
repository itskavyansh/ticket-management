"""Pydantic models for ticket triage and AI processing."""
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TicketCategory(str, Enum):
    """Ticket categories for classification."""
    HARDWARE = "hardware"
    SOFTWARE = "software"
    NETWORK = "network"
    SECURITY = "security"
    EMAIL = "email"
    BACKUP = "backup"
    PRINTER = "printer"
    PHONE = "phone"
    ACCESS = "access"
    OTHER = "other"


class Priority(str, Enum):
    """Ticket priority levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Urgency(str, Enum):
    """Ticket urgency levels."""
    URGENT = "urgent"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Impact(str, Enum):
    """Ticket impact levels."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TicketTriageRequest(BaseModel):
    """Request model for ticket triage."""
    ticket_id: str = Field(..., description="Unique ticket identifier")
    title: str = Field(..., description="Ticket title/subject")
    description: str = Field(..., description="Detailed ticket description")
    customer_id: str = Field(..., description="Customer identifier")
    customer_tier: Optional[str] = Field(None, description="Customer service tier (premium, standard, basic)")
    reported_by: Optional[str] = Field(None, description="Person who reported the issue")
    affected_systems: Optional[List[str]] = Field(default_factory=list, description="List of affected systems")
    error_messages: Optional[List[str]] = Field(default_factory=list, description="Any error messages")
    attachments: Optional[List[str]] = Field(default_factory=list, description="List of attachment filenames")
    created_at: Optional[datetime] = Field(None, description="Ticket creation timestamp")
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class TriageResult(BaseModel):
    """Result model for ticket triage."""
    ticket_id: str
    category: TicketCategory
    priority: Priority
    urgency: Urgency
    impact: Impact
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence in classification (0-1)")
    reasoning: str = Field(..., description="AI reasoning for the classification")
    suggested_technician_skills: List[str] = Field(default_factory=list, description="Required skills for resolution")
    estimated_resolution_time: Optional[int] = Field(None, description="Estimated resolution time in minutes")
    similar_tickets: Optional[List[str]] = Field(default_factory=list, description="IDs of similar historical tickets")
    
    class Config:
        use_enum_values = True


class TriageResponse(BaseModel):
    """Response model for ticket triage endpoint."""
    success: bool
    result: Optional[TriageResult] = None
    error: Optional[str] = None
    processing_time_ms: int
    cached: bool = Field(default=False, description="Whether result was served from cache")


class CategoryConfidence(BaseModel):
    """Category classification with confidence score."""
    category: TicketCategory
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str


class PriorityMatrix(BaseModel):
    """Priority calculation based on urgency and impact."""
    urgency: Urgency
    impact: Impact
    priority: Priority
    reasoning: str