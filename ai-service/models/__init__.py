"""Data models for AI service."""
from .ticket_models import (
    TicketCategory,
    Priority,
    Urgency,
    Impact,
    TicketTriageRequest,
    TriageResult,
    TriageResponse,
    CategoryConfidence,
    PriorityMatrix
)
from .resolution_models import (
    HistoricalTicket,
    ResolutionSuggestionRequest,
    ResolutionStep,
    ResolutionSuggestion,
    KnowledgeBaseArticle,
    SimilarityMatch,
    ResolutionSuggestionResponse,
    EmbeddingRequest,
    EmbeddingResponse
)

__all__ = [
    "TicketCategory",
    "Priority", 
    "Urgency",
    "Impact",
    "TicketTriageRequest",
    "TriageResult",
    "TriageResponse",
    "CategoryConfidence",
    "PriorityMatrix",
    "HistoricalTicket",
    "ResolutionSuggestionRequest",
    "ResolutionStep",
    "ResolutionSuggestion",
    "KnowledgeBaseArticle",
    "SimilarityMatch",
    "ResolutionSuggestionResponse",
    "EmbeddingRequest",
    "EmbeddingResponse"
]