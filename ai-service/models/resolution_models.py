"""Pydantic models for resolution suggestion system."""
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class HistoricalTicket(BaseModel):
    """Model for historical ticket data."""
    ticket_id: str
    title: str
    description: str
    category: str
    resolution: str
    resolution_steps: List[str] = Field(default_factory=list)
    resolution_time_minutes: Optional[int] = None
    technician_id: Optional[str] = None
    customer_satisfaction: Optional[float] = Field(None, ge=1.0, le=5.0)
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    resolved_at: Optional[datetime] = None


class ResolutionSuggestionRequest(BaseModel):
    """Request model for resolution suggestions."""
    ticket_id: str = Field(..., description="Current ticket identifier")
    title: str = Field(..., description="Ticket title/subject")
    description: str = Field(..., description="Detailed ticket description")
    category: Optional[str] = Field(None, description="Ticket category if known")
    error_messages: Optional[List[str]] = Field(default_factory=list, description="Error messages")
    affected_systems: Optional[List[str]] = Field(default_factory=list, description="Affected systems")
    customer_environment: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Customer environment details")
    max_suggestions: int = Field(default=5, ge=1, le=10, description="Maximum number of suggestions to return")
    include_knowledge_base: bool = Field(default=True, description="Include knowledge base articles")


class ResolutionStep(BaseModel):
    """Individual resolution step."""
    step_number: int
    description: str
    command: Optional[str] = Field(None, description="Command to execute if applicable")
    expected_outcome: Optional[str] = Field(None, description="Expected result of this step")
    troubleshooting_tips: Optional[List[str]] = Field(default_factory=list)


class ResolutionSuggestion(BaseModel):
    """Individual resolution suggestion."""
    suggestion_id: str
    title: str
    description: str
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence in suggestion (0-1)")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Similarity to current ticket (0-1)")
    source_type: str = Field(..., description="Source of suggestion (historical_ticket, knowledge_base, ai_generated)")
    source_id: Optional[str] = Field(None, description="ID of source ticket or article")
    resolution_steps: List[ResolutionStep] = Field(default_factory=list)
    estimated_time_minutes: Optional[int] = Field(None, description="Estimated resolution time")
    required_skills: List[str] = Field(default_factory=list, description="Skills required for this resolution")
    success_rate: Optional[float] = Field(None, ge=0.0, le=1.0, description="Historical success rate")
    tags: List[str] = Field(default_factory=list)


class KnowledgeBaseArticle(BaseModel):
    """Knowledge base article model."""
    article_id: str
    title: str
    content: str
    category: str
    tags: List[str] = Field(default_factory=list)
    last_updated: datetime
    view_count: int = Field(default=0)
    helpfulness_score: Optional[float] = Field(None, ge=0.0, le=5.0)


class SimilarityMatch(BaseModel):
    """Similarity match result."""
    ticket_id: str
    similarity_score: float = Field(..., ge=0.0, le=1.0)
    title: str
    category: str
    resolution_summary: str


class ResolutionSuggestionResponse(BaseModel):
    """Response model for resolution suggestions."""
    success: bool
    ticket_id: str
    suggestions: List[ResolutionSuggestion] = Field(default_factory=list)
    similar_tickets: List[SimilarityMatch] = Field(default_factory=list)
    processing_time_ms: int
    cached: bool = Field(default=False)
    error: Optional[str] = None


class EmbeddingRequest(BaseModel):
    """Request for text embedding."""
    text: str
    model: str = Field(default="text-embedding-ada-002")


class EmbeddingResponse(BaseModel):
    """Response for text embedding."""
    embedding: List[float]
    model: str
    usage_tokens: int