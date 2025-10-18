"""Simple AI service for demo purposes."""
import logging
import time
import json
import asyncio
import random
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Simple in-memory cache
cache_store = {}

async def get_cache(key: str) -> Optional[Any]:
    """Get value from cache."""
    if key in cache_store:
        entry = cache_store[key]
        if time.time() < entry['expires_at']:
            return entry['value']
        else:
            del cache_store[key]
    return None

async def set_cache(key: str, value: Any, expire: int = 300) -> bool:
    """Set value in cache."""
    cache_store[key] = {
        'value': value,
        'expires_at': time.time() + expire
    }
    return True

# Pydantic models
class TicketTriageRequest(BaseModel):
    ticket_id: str
    title: str
    description: str
    customer_tier: Optional[str] = "standard"

class TriageResponse(BaseModel):
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time_ms: int
    cached: bool = False

class SLAPredictionRequest(BaseModel):
    ticket_id: str
    current_time: Optional[str] = None

class SLAPredictionResponse(BaseModel):
    success: bool
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    processing_time_ms: int
    cached: bool = False
    model_version: str

class ResolutionSuggestionRequest(BaseModel):
    ticket_id: str
    title: str
    description: str

class ResolutionSuggestionResponse(BaseModel):
    success: bool
    ticket_id: str
    suggestions: Optional[List[Dict[str, Any]]] = None
    similar_tickets: Optional[List[Dict[str, Any]]] = None
    error: Optional[str] = None
    processing_time_ms: int
    cached: bool = False

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting AI Processing Service...")
    yield
    logger.info("AI Processing Service shutdown complete")

app = FastAPI(
    title="AI Ticket Management - AI Service",
    description="AI processing service for ticket triage and predictions",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "AI Ticket Management - AI Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "ai-processing",
        "version": "1.0.0",
        "dependencies": {
            "cache": {"status": "healthy", "type": "mock"},
            "openai": {"status": "mock", "model": "demo"}
        }
    }

@app.post("/ai/triage", response_model=TriageResponse)
async def triage_ticket(request: TicketTriageRequest):
    """Mock ticket triage endpoint."""
    start_time = time.time()
    
    try:
        logger.info(f"Processing triage request for ticket {request.ticket_id}")
        
        # Check cache first
        cache_key = f"triage:{request.ticket_id}"
        cached_result = await get_cache(cache_key)
        
        if cached_result:
            processing_time = int((time.time() - start_time) * 1000)
            return TriageResponse(
                success=True,
                result=cached_result,
                processing_time_ms=processing_time,
                cached=True
            )
        
        # Simulate AI processing
        await asyncio.sleep(0.1)
        
        categories = ["hardware", "software", "network", "security", "email", "database"]
        priorities = ["low", "medium", "high", "critical"]
        
        result = {
            "category": random.choice(categories),
            "priority": random.choice(priorities),
            "confidence_score": round(random.uniform(0.7, 0.95), 2),
            "suggested_technician_skills": ["troubleshooting", "system_administration"],
            "estimated_resolution_hours": round(random.uniform(1, 8), 1)
        }
        
        # Cache result
        await set_cache(cache_key, result, expire=300)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return TriageResponse(
            success=True,
            result=result,
            processing_time_ms=processing_time,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Triage processing error: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return TriageResponse(
            success=False,
            error="Internal processing error",
            processing_time_ms=processing_time
        )

@app.post("/ai/predict-sla", response_model=SLAPredictionResponse)
async def predict_sla(request: SLAPredictionRequest):
    """Mock SLA prediction endpoint."""
    start_time = time.time()
    
    try:
        logger.info(f"Processing SLA prediction for ticket {request.ticket_id}")
        
        # Check cache first
        cache_key = f"sla_prediction:{request.ticket_id}"
        cached_result = await get_cache(cache_key)
        
        if cached_result:
            processing_time = int((time.time() - start_time) * 1000)
            return SLAPredictionResponse(
                success=True,
                result=cached_result,
                processing_time_ms=processing_time,
                cached=True,
                model_version="demo-1.0"
            )
        
        # Simulate AI processing
        await asyncio.sleep(0.2)
        
        result = {
            "breach_probability": round(random.uniform(0.1, 0.8), 2),
            "risk_level": random.choice(["low", "medium", "high", "critical"]),
            "estimated_completion_hours": round(random.uniform(1, 24), 1),
            "confidence_score": round(random.uniform(0.7, 0.95), 2),
            "risk_factors": ["high_workload", "complex_issue"]
        }
        
        # Cache result
        await set_cache(cache_key, result, expire=300)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return SLAPredictionResponse(
            success=True,
            result=result,
            processing_time_ms=processing_time,
            cached=False,
            model_version="demo-1.0"
        )
        
    except Exception as e:
        logger.error(f"SLA prediction error: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return SLAPredictionResponse(
            success=False,
            error="Internal processing error",
            processing_time_ms=processing_time,
            model_version="demo-1.0"
        )

@app.post("/ai/suggest-resolution", response_model=ResolutionSuggestionResponse)
async def suggest_resolution(request: ResolutionSuggestionRequest):
    """Mock resolution suggestion endpoint."""
    start_time = time.time()
    
    try:
        logger.info(f"Processing resolution suggestions for ticket {request.ticket_id}")
        
        # Simulate AI processing
        await asyncio.sleep(0.3)
        
        suggestions = [
            {
                "suggestion": "Restart the affected service and check system logs for errors",
                "confidence_score": round(random.uniform(0.7, 0.9), 2),
                "estimated_time_minutes": random.randint(10, 30),
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
                "confidence_score": round(random.uniform(0.6, 0.8), 2),
                "estimated_time_minutes": random.randint(20, 45),
                "steps": [
                    "Test network connectivity",
                    "Review firewall rules",
                    "Check port availability",
                    "Verify DNS resolution"
                ]
            }
        ]
        
        similar_tickets = [
            {
                "ticket_id": "TKT-001",
                "title": "Server connectivity issues",
                "similarity_score": round(random.uniform(0.7, 0.9), 2),
                "resolution": "Restarted network service and updated firewall rules"
            },
            {
                "ticket_id": "TKT-002",
                "title": "Application not responding",
                "similarity_score": round(random.uniform(0.6, 0.8), 2),
                "resolution": "Increased memory allocation and optimized database queries"
            }
        ]
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return ResolutionSuggestionResponse(
            success=True,
            ticket_id=request.ticket_id,
            suggestions=suggestions,
            similar_tickets=similar_tickets,
            processing_time_ms=processing_time,
            cached=False
        )
        
    except Exception as e:
        logger.error(f"Resolution suggestion error: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return ResolutionSuggestionResponse(
            success=False,
            ticket_id=request.ticket_id,
            error="Internal processing error",
            processing_time_ms=processing_time
        )

if __name__ == "__main__":
    uvicorn.run(
        "simple_main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )