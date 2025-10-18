import logging
import time
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config import settings
from clients.gemini_client import gemini_client
try:
    from cache.redis_cache import redis_cache
    cache = redis_cache
except ImportError:
    from cache.mock_cache import mock_cache
    cache = mock_cache
from middleware.rate_limiter import rate_limit_middleware

# Configure logging
logging.basicConfig(
    level=logging.INFO if not settings.debug else logging.DEBUG,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    # Startup
    logger.info("Starting AI Processing Service...")
    
    # Initialize cache connection
    await cache.connect()
    
    # Verify Gemini client
    try:
        health_ok = await gemini_client.health_check()
        if health_ok:
            logger.info("Gemini client initialized successfully")
        else:
            logger.warning("Gemini client health check failed")
    except Exception as e:
        logger.error(f"Gemini client initialization failed: {str(e)}")
    
    logger.info("AI Processing Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("Shutting down AI Processing Service...")
    await cache.disconnect()
    logger.info("AI Processing Service shutdown complete")


app = FastAPI(
    title="AI Ticket Management - AI Service",
    description="AI processing service for ticket triage and predictions",
    version="1.0.0",
    lifespan=lifespan
)

# Add rate limiting middleware
app.middleware("http")(rate_limit_middleware)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
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
    """Comprehensive health check for all service dependencies."""
    health_status = {
        "status": "healthy",
        "service": "ai-processing",
        "version": "1.0.0",
        "dependencies": {}
    }
    
    # Check Gemini client
    try:
        gemini_healthy = await gemini_client.health_check()
        health_status["dependencies"]["gemini"] = {
            "status": "healthy" if gemini_healthy else "unhealthy",
            "model": settings.gemini_model
        }
    except Exception as e:
        health_status["dependencies"]["gemini"] = {
            "status": "error",
            "error": str(e)
        }
    
    # Check cache
    try:
        cache_healthy = await cache.health_check()
        health_status["dependencies"]["cache"] = {
            "status": "healthy" if cache_healthy else "unhealthy",
            "type": "redis" if hasattr(cache, 'redis_client') else "mock"
        }
    except Exception as e:
        health_status["dependencies"]["cache"] = {
            "status": "error",
            "error": str(e)
        }
    
    # Determine overall health
    all_healthy = all(
        dep.get("status") == "healthy" 
        for dep in health_status["dependencies"].values()
    )
    
    if not all_healthy:
        health_status["status"] = "degraded"
    
    return health_status

# Import models and services
try:
    from models.ticket_models import TicketTriageRequest, TriageResponse
    from models.resolution_models import ResolutionSuggestionRequest, ResolutionSuggestionResponse
    from models.sla_models import SLAPredictionRequest, SLAPredictionResponse
    from services.triage_service import triage_service
    from services.resolution_service import resolution_service
    from services.embedding_service import embedding_service
except ImportError:
    # Use mock models and services for demo
    from services.mock_services import mock_triage_service as triage_service
    from services.mock_services import mock_resolution_service as resolution_service
    from services.mock_services import mock_embedding_service as embedding_service
    
    # Simple mock models
    from pydantic import BaseModel
    from typing import Optional, List, Any
    
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
        current_time: Any
    
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

# AI Processing endpoints
@app.post("/ai/triage", response_model=TriageResponse)
async def triage_ticket(request: TicketTriageRequest):
    """
    Classify and prioritize a support ticket using AI.
    
    This endpoint analyzes ticket content to determine:
    - Category (hardware, software, network, etc.)
    - Priority level based on urgency and impact
    - Suggested technician skills required
    - Estimated resolution time
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing triage request for ticket {request.ticket_id}")
        
        # Perform ticket triage
        result = await triage_service.triage_ticket(request)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return TriageResponse(
            success=True,
            result=result,
            processing_time_ms=processing_time,
            cached=False  # Will be updated by service if cached
        )
        
    except ValueError as e:
        # Client error (bad input)
        logger.warning(f"Triage validation error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return TriageResponse(
            success=False,
            error=f"Invalid input: {str(e)}",
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        # Server error
        logger.error(f"Triage processing error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return TriageResponse(
            success=False,
            error="Internal processing error",
            processing_time_ms=processing_time
        )

@app.post("/ai/predict-sla", response_model=SLAPredictionResponse)
async def predict_sla(request: SLAPredictionRequest):
    """
    Predict SLA breach probability for a support ticket.
    
    This endpoint analyzes ticket data to provide:
    - Probability of SLA breach (0-1)
    - Risk level classification (low/medium/high/critical)
    - Estimated completion time
    - Risk factors and mitigation recommendations
    - Confidence score for the prediction
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing SLA prediction request for ticket {request.ticket_id}")
        
        # Check cache first
        cache_key = f"sla_prediction:{request.ticket_id}:{int(request.current_time.timestamp())}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            logger.info(f"Returning cached SLA prediction for ticket {request.ticket_id}")
            processing_time = int((time.time() - start_time) * 1000)
            return SLAPredictionResponse(
                success=True,
                result=cached_result,
                processing_time_ms=processing_time,
                cached=True,
                model_version="demo-1.0"
            )
        
        # Perform SLA prediction (mock for demo)
        result = {
            "breach_probability": 0.25,
            "risk_level": "medium",
            "estimated_completion_hours": 4.5,
            "confidence_score": 0.85
        }
        
        # Cache result for 5 minutes
        await cache.set(cache_key, result, expire=300)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return SLAPredictionResponse(
            success=True,
            result=result,
            processing_time_ms=processing_time,
            cached=False,
            model_version="demo-1.0"
        )
        
    except ValueError as e:
        # Client error (bad input)
        logger.warning(f"SLA prediction validation error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return SLAPredictionResponse(
            success=False,
            error=f"Invalid input: {str(e)}",
            processing_time_ms=processing_time,
            model_version="demo-1.0"
        )
        
    except Exception as e:
        # Server error
        logger.error(f"SLA prediction processing error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return SLAPredictionResponse(
            success=False,
            error="Internal processing error",
            processing_time_ms=processing_time,
            model_version="demo-1.0"
        )

@app.post("/ai/suggest-resolution", response_model=ResolutionSuggestionResponse)
async def suggest_resolution(request: ResolutionSuggestionRequest):
    """
    Generate AI-powered resolution suggestions for a support ticket.
    
    This endpoint analyzes ticket content and provides:
    - Similar historical ticket resolutions
    - AI-generated step-by-step solutions
    - Relevant knowledge base articles
    - Confidence scores and estimated resolution times
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing resolution suggestion request for ticket {request.ticket_id}")
        
        # Get resolution suggestions
        suggestions = await resolution_service.get_resolution_suggestions(request)
        
        # Find similar tickets for additional context
        query_text = f"{request.title} {request.description}"
        similar_tickets = await embedding_service.find_similar_tickets(
            query_text, 
            max_results=5,
            min_similarity=0.6
        )
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return ResolutionSuggestionResponse(
            success=True,
            ticket_id=request.ticket_id,
            suggestions=suggestions,
            similar_tickets=similar_tickets,
            processing_time_ms=processing_time,
            cached=False  # Will be updated by service if cached
        )
        
    except ValueError as e:
        # Client error (bad input)
        logger.warning(f"Resolution suggestion validation error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return ResolutionSuggestionResponse(
            success=False,
            ticket_id=request.ticket_id,
            error=f"Invalid input: {str(e)}",
            processing_time_ms=processing_time
        )
        
    except Exception as e:
        # Server error
        logger.error(f"Resolution suggestion processing error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return ResolutionSuggestionResponse(
            success=False,
            ticket_id=request.ticket_id,
            error="Internal processing error",
            processing_time_ms=processing_time
        )

@app.post("/ai/optimize-workload")
async def optimize_workload(request: Request):
    """
    Optimize workload distribution across technicians.
    
    This endpoint analyzes technician capacity and ticket requirements to provide:
    - Optimal ticket assignments based on skills and availability
    - Workload balance recommendations
    - Capacity planning insights
    - Technician utilization analysis
    """
    start_time = time.time()
    
    try:
        request_data = await request.json()
        logger.info("Processing workload optimization request")
        
        technicians = request_data.get('technicians', [])
        pending_tickets = request_data.get('pending_tickets', [])
        
        if not technicians or not pending_tickets:
            processing_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "error": "Both technicians and pending_tickets are required",
                "processing_time_ms": processing_time
            }
        
        # Mock workload optimization logic
        recommendations = []
        workload_analysis = {
            "overutilized_technicians": [],
            "underutilized_technicians": [],
            "capacity_recommendations": []
        }
        
        # Simple assignment logic for demo
        for i, ticket in enumerate(pending_tickets):
            # Find technician with matching skills and lowest workload
            best_technician = None
            best_score = -1
            
            for tech in technicians:
                # Calculate match score based on skills and workload
                skill_match = 0
                required_skills = ticket.get('required_skills', [])
                tech_skills = tech.get('skills', [])
                
                if required_skills:
                    matching_skills = set(required_skills) & set(tech_skills)
                    skill_match = len(matching_skills) / len(required_skills)
                else:
                    skill_match = 0.5  # Default if no specific skills required
                
                # Consider workload (lower is better)
                workload_factor = 1 - (tech.get('current_workload', 0) / tech.get('max_capacity', 40))
                
                # Combined score
                score = (skill_match * 0.7) + (workload_factor * 0.3)
                
                if score > best_score:
                    best_score = score
                    best_technician = tech
            
            if best_technician:
                recommendations.append({
                    "ticket_id": ticket['ticket_id'],
                    "recommended_technician_id": best_technician['technician_id'],
                    "confidence_score": min(0.95, best_score),
                    "reasoning": f"Best skill match ({int(skill_match * 100)}%) with optimal workload balance"
                })
        
        # Analyze technician utilization
        for tech in technicians:
            utilization = (tech.get('current_workload', 0) / tech.get('max_capacity', 40)) * 100
            
            if utilization > 90:
                workload_analysis["overutilized_technicians"].append(tech['technician_id'])
                workload_analysis["capacity_recommendations"].append({
                    "technician_id": tech['technician_id'],
                    "recommended_action": "reduce_workload",
                    "impact": "high"
                })
            elif utilization < 60:
                workload_analysis["underutilized_technicians"].append(tech['technician_id'])
                workload_analysis["capacity_recommendations"].append({
                    "technician_id": tech['technician_id'],
                    "recommended_action": "assign_more_tickets",
                    "impact": "medium"
                })
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": True,
            "recommendations": recommendations,
            "workload_analysis": workload_analysis,
            "processing_time_ms": processing_time,
            "metadata": {
                "technicians_analyzed": len(technicians),
                "tickets_processed": len(pending_tickets),
                "assignments_made": len(recommendations)
            }
        }
        
    except ValueError as e:
        # Client error (bad input)
        logger.warning(f"Workload optimization validation error: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": False,
            "error": f"Invalid input: {str(e)}",
            "processing_time_ms": processing_time
        }
        
    except Exception as e:
        # Server error
        logger.error(f"Workload optimization processing error: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": False,
            "error": "Internal processing error",
            "processing_time_ms": processing_time
        }


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=settings.debug,
        log_level="info" if not settings.debug else "debug"
    )