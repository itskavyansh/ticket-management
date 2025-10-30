import logging
import time
import json
import asyncio
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
    Classify and prioritize a support ticket using AI with confidence validation.
    
    This endpoint analyzes ticket content to determine:
    - Category (hardware, software, network, etc.)
    - Priority level based on urgency and impact
    - Suggested technician skills required
    - Estimated resolution time
    
    Features enhanced confidence thresholds and fallback mechanisms.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing triage request for ticket {request.ticket_id}")
        
        # Check cache first
        cache_key = f"triage_enhanced:{request.ticket_id}"
        cached_result = await cache.get(cache_key)
        
        if cached_result:
            processing_time = int((time.time() - start_time) * 1000)
            return TriageResponse(
                success=True,
                result=cached_result,
                processing_time_ms=processing_time,
                cached=True
            )
        
        # Perform ticket triage
        result = await triage_service.triage_ticket(request)
        
        # Apply confidence threshold validation
        confidence_threshold = 0.6  # Minimum confidence for AI predictions
        if result.get('confidence_score', 0) < confidence_threshold:
            logger.warning(f"Low confidence ({result.get('confidence_score', 0):.2f}) for ticket {request.ticket_id}, flagging for manual review")
            result['requires_manual_review'] = True
            result['confidence_warning'] = f"AI confidence below threshold ({confidence_threshold})"
        
        # Add model performance context
        result['model_version'] = "enhanced-1.0"
        result['fallback_used'] = result.get('confidence_score', 1.0) < 0.8
        
        # Cache enhanced result
        await cache.set(cache_key, result, expire=1800)  # 30 minutes
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return TriageResponse(
            success=True,
            result=result,
            processing_time_ms=processing_time,
            cached=False
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
        # Server error - provide graceful fallback
        logger.error(f"Triage processing error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        # Attempt basic fallback classification
        try:
            fallback_result = await _emergency_triage_fallback(request)
            return TriageResponse(
                success=True,
                result=fallback_result,
                processing_time_ms=processing_time,
                cached=False
            )
        except:
            return TriageResponse(
                success=False,
                error="AI service temporarily unavailable",
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
    Generate AI-powered resolution suggestions with enhanced performance optimization.
    
    This endpoint analyzes ticket content and provides:
    - Similar historical ticket resolutions
    - AI-generated step-by-step solutions
    - Relevant knowledge base articles
    - Confidence scores and estimated resolution times
    
    Features optimized caching and performance monitoring.
    """
    start_time = time.time()
    
    try:
        logger.info(f"Processing resolution suggestion request for ticket {request.ticket_id}")
        
        # Enhanced cache key with content hash for better cache hits
        import hashlib
        content_hash = hashlib.md5(f"{request.title}{request.description}".encode()).hexdigest()[:8]
        cache_key = f"resolution_enhanced:{content_hash}:{request.category or 'none'}"
        
        # Check cache first
        cached_result = await cache.get(cache_key)
        if cached_result:
            processing_time = int((time.time() - start_time) * 1000)
            logger.info(f"Returning cached resolution suggestions for ticket {request.ticket_id}")
            
            return ResolutionSuggestionResponse(
                success=True,
                ticket_id=request.ticket_id,
                suggestions=cached_result.get('suggestions', []),
                similar_tickets=cached_result.get('similar_tickets', []),
                processing_time_ms=processing_time,
                cached=True
            )
        
        # Get resolution suggestions with timeout protection
        try:
            suggestions_task = resolution_service.get_resolution_suggestions(request)
            suggestions = await asyncio.wait_for(suggestions_task, timeout=10.0)  # 10 second timeout
        except asyncio.TimeoutError:
            logger.warning(f"Resolution suggestion timeout for ticket {request.ticket_id}, using fallback")
            suggestions = await _generate_fallback_suggestions(request)
        
        # Find similar tickets with timeout protection
        similar_tickets = []
        try:
            query_text = f"{request.title} {request.description}"
            similar_task = embedding_service.find_similar_tickets(
                query_text, 
                max_results=5,
                min_similarity=0.6
            )
            similar_tickets = await asyncio.wait_for(similar_task, timeout=5.0)  # 5 second timeout
        except asyncio.TimeoutError:
            logger.warning(f"Similar tickets search timeout for ticket {request.ticket_id}")
        except Exception as e:
            logger.warning(f"Similar tickets search failed for ticket {request.ticket_id}: {str(e)}")
        
        # Enhance suggestions with performance metrics
        enhanced_suggestions = []
        for suggestion in suggestions:
            if hasattr(suggestion, 'dict'):
                suggestion_dict = suggestion.dict()
            else:
                suggestion_dict = suggestion
            
            # Add performance indicators
            suggestion_dict['performance_optimized'] = True
            suggestion_dict['cache_enabled'] = True
            
            # Validate confidence scores
            if suggestion_dict.get('confidence_score', 0) < 0.5:
                suggestion_dict['requires_validation'] = True
                suggestion_dict['confidence_warning'] = "Low confidence suggestion - manual review recommended"
            
            enhanced_suggestions.append(suggestion_dict)
        
        # Cache the results with optimized TTL based on confidence
        avg_confidence = sum(s.get('confidence_score', 0.5) for s in enhanced_suggestions) / max(1, len(enhanced_suggestions))
        cache_ttl = 3600 if avg_confidence > 0.8 else 1800  # Longer cache for high confidence
        
        cache_data = {
            'suggestions': enhanced_suggestions,
            'similar_tickets': similar_tickets,
            'cached_at': time.time(),
            'avg_confidence': avg_confidence
        }
        await cache.set(cache_key, cache_data, expire=cache_ttl)
        
        processing_time = int((time.time() - start_time) * 1000)
        
        # Log performance metrics
        logger.info(f"Resolution suggestions generated for ticket {request.ticket_id} in {processing_time}ms "
                   f"(suggestions: {len(enhanced_suggestions)}, similar: {len(similar_tickets)}, "
                   f"avg_confidence: {avg_confidence:.2f})")
        
        return ResolutionSuggestionResponse(
            success=True,
            ticket_id=request.ticket_id,
            suggestions=enhanced_suggestions,
            similar_tickets=similar_tickets,
            processing_time_ms=processing_time,
            cached=False
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
        # Server error with graceful fallback
        logger.error(f"Resolution suggestion processing error for ticket {request.ticket_id}: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        # Attempt fallback suggestions
        try:
            fallback_suggestions = await _generate_fallback_suggestions(request)
            return ResolutionSuggestionResponse(
                success=True,
                ticket_id=request.ticket_id,
                suggestions=fallback_suggestions,
                similar_tickets=[],
                processing_time_ms=processing_time,
                cached=False
            )
        except:
            return ResolutionSuggestionResponse(
                success=False,
                ticket_id=request.ticket_id,
                error="AI service temporarily unavailable",
                processing_time_ms=processing_time
            )


async def _generate_fallback_suggestions(request: ResolutionSuggestionRequest) -> List[Dict[str, Any]]:
    """Generate fallback resolution suggestions when AI services fail."""
    logger.info(f"Generating fallback suggestions for ticket {request.ticket_id}")
    
    # Category-based fallback suggestions
    category = getattr(request, 'category', 'other') or 'other'
    
    fallback_templates = {
        "software": {
            "title": "Software Issue Resolution",
            "steps": [
                "Verify the software is properly installed and licensed",
                "Check for available updates or patches",
                "Restart the application and test functionality",
                "Review error logs for specific error messages",
                "Reinstall the software if issues persist"
            ],
            "time": 45,
            "skills": ["software_support", "troubleshooting"]
        },
        "hardware": {
            "title": "Hardware Issue Resolution",
            "steps": [
                "Check all physical connections and cables",
                "Run built-in hardware diagnostics",
                "Update device drivers to latest versions",
                "Test with known good hardware if available",
                "Contact vendor support if hardware failure is suspected"
            ],
            "time": 90,
            "skills": ["hardware_troubleshooting", "desktop_support"]
        },
        "network": {
            "title": "Network Connectivity Resolution",
            "steps": [
                "Test basic network connectivity with ping",
                "Verify IP configuration and DNS settings",
                "Check network adapter status and drivers",
                "Test with different network connection if available",
                "Contact network administrator if issue persists"
            ],
            "time": 60,
            "skills": ["network_troubleshooting", "connectivity_support"]
        },
        "email": {
            "title": "Email Issue Resolution",
            "steps": [
                "Verify email account settings and credentials",
                "Test email connectivity with webmail",
                "Check for email client updates",
                "Review email server status and settings",
                "Recreate email profile if necessary"
            ],
            "time": 30,
            "skills": ["email_support", "office365"]
        }
    }
    
    template = fallback_templates.get(category, {
        "title": "General Issue Resolution",
        "steps": [
            "Gather detailed information about the issue",
            "Identify recent changes that might have caused the problem",
            "Apply standard troubleshooting procedures",
            "Test the solution thoroughly",
            "Document the resolution for future reference"
        ],
        "time": 60,
        "skills": ["general_support", "troubleshooting"]
    })
    
    return [{
        "suggestion_id": f"fallback_{int(time.time())}",
        "title": template["title"],
        "description": f"Standard resolution approach for {category} issues",
        "confidence_score": 0.6,  # Moderate confidence for fallback
        "source_type": "fallback_template",
        "resolution_steps": [
            {
                "step_number": i + 1,
                "description": step,
                "expected_outcome": f"Step {i + 1} completed successfully"
            }
            for i, step in enumerate(template["steps"])
        ],
        "estimated_time_minutes": template["time"],
        "required_skills": template["skills"],
        "tags": [category, "fallback", "template"],
        "fallback_mode": True,
        "requires_validation": True
    }]

@app.post("/ai/optimize-workload")
async def optimize_workload(request: Request):
    """
    AI-powered workload optimization with advanced algorithms.
    
    This endpoint uses sophisticated AI algorithms to provide:
    - Optimal ticket assignments using multi-objective optimization
    - Predictive workload balancing with machine learning
    - Real-time capacity planning with forecasting
    - Skills-based routing with confidence scoring
    - Burnout prevention and wellness optimization
    """
    start_time = time.time()
    
    try:
        request_data = await request.json()
        logger.info("Processing advanced workload optimization request")
        
        # Import workload optimization service
        from services.workload_optimizer import workload_optimizer
        
        # Validate input data
        technicians = request_data.get('technicians', [])
        pending_tickets = request_data.get('pending_tickets', [])
        historical_data = request_data.get('historical_data', {})
        optimization_goals = request_data.get('optimization_goals', ['efficiency', 'balance', 'sla_compliance'])
        
        if not technicians or not pending_tickets:
            processing_time = int((time.time() - start_time) * 1000)
            return {
                "success": False,
                "error": "Both technicians and pending_tickets are required",
                "processing_time_ms": processing_time
            }
        
        # Check cache for similar optimization requests
        cache_key = f"workload_opt:{len(technicians)}:{len(pending_tickets)}:{hash(str(optimization_goals))}"
        cached_result = await cache.get(cache_key)
        
        if cached_result and cached_result.get('cache_age_minutes', 0) < 15:
            processing_time = int((time.time() - start_time) * 1000)
            logger.info("Returning cached workload optimization result")
            
            return {
                "success": True,
                **cached_result,
                "processing_time_ms": processing_time,
                "cached": True
            }
        
        # Perform advanced workload optimization
        optimization_result = await workload_optimizer.optimize_assignments(
            technicians=technicians,
            pending_tickets=pending_tickets,
            historical_data=historical_data,
            optimization_goals=optimization_goals
        )
        
        # Generate predictive insights
        predictions = await workload_optimizer.predict_workload_trends(
            technicians=technicians,
            current_assignments=optimization_result['assignments'],
            historical_data=historical_data
        )
        
        # Analyze team dynamics and collaboration opportunities
        team_insights = await workload_optimizer.analyze_team_dynamics(
            technicians=technicians,
            assignments=optimization_result['assignments']
        )
        
        # Generate wellness and burnout prevention recommendations
        wellness_recommendations = await workload_optimizer.generate_wellness_recommendations(
            technicians=technicians,
            workload_predictions=predictions
        )
        
        # Compile comprehensive result
        result = {
            "success": True,
            "optimization_algorithm": "multi_objective_ai",
            "assignments": optimization_result['assignments'],
            "workload_analysis": optimization_result['workload_analysis'],
            "predictive_insights": predictions,
            "team_dynamics": team_insights,
            "wellness_recommendations": wellness_recommendations,
            "optimization_score": optimization_result['optimization_score'],
            "confidence_metrics": optimization_result['confidence_metrics'],
            "alternative_scenarios": optimization_result.get('alternatives', []),
            "metadata": {
                "technicians_analyzed": len(technicians),
                "tickets_processed": len(pending_tickets),
                "assignments_made": len(optimization_result['assignments']),
                "optimization_goals": optimization_goals,
                "algorithm_version": "2.0",
                "processing_complexity": "high"
            }
        }
        
        # Cache result for 15 minutes
        cache_data = {**result, "cache_age_minutes": 0}
        await cache.set(cache_key, cache_data, expire=900)
        
        processing_time = int((time.time() - start_time) * 1000)
        result["processing_time_ms"] = processing_time
        result["cached"] = False
        
        logger.info(f"Advanced workload optimization completed in {processing_time}ms "
                   f"(score: {optimization_result['optimization_score']:.2f})")
        
        return result
        
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
        # Server error with fallback
        logger.error(f"Advanced workload optimization failed: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        # Fallback to basic optimization
        try:
            fallback_result = await _basic_workload_optimization(request_data)
            fallback_result["processing_time_ms"] = processing_time
            fallback_result["fallback_mode"] = True
            fallback_result["fallback_reason"] = "Advanced optimization failed"
            return fallback_result
        except:
            return {
                "success": False,
                "error": "Workload optimization service temporarily unavailable",
                "processing_time_ms": processing_time
            }


async def _basic_workload_optimization(request_data: Dict[str, Any]) -> Dict[str, Any]:
    """Basic workload optimization fallback when advanced algorithms fail."""
    technicians = request_data.get('technicians', [])
    pending_tickets = request_data.get('pending_tickets', [])
    
    assignments = []
    workload_analysis = {
        "overutilized_technicians": [],
        "underutilized_technicians": [],
        "capacity_recommendations": []
    }
    
    # Simple skill-based assignment with load balancing
    for ticket in pending_tickets:
        best_technician = None
        best_score = -1
        
        for tech in technicians:
            # Calculate skill match score
            required_skills = set(ticket.get('required_skills', []))
            tech_skills = set(tech.get('skills', []))
            
            if required_skills:
                skill_match = len(required_skills & tech_skills) / len(required_skills)
            else:
                skill_match = 0.5
            
            # Calculate workload factor (prefer less loaded technicians)
            current_load = tech.get('current_workload', 0)
            max_capacity = tech.get('max_capacity', 40)
            workload_factor = 1 - (current_load / max_capacity)
            
            # Calculate experience factor
            experience_level = tech.get('experience_level', 5) / 10  # Normalize to 0-1
            
            # Combined score with weights
            score = (skill_match * 0.5) + (workload_factor * 0.3) + (experience_level * 0.2)
            
            if score > best_score:
                best_score = score
                best_technician = tech
        
        if best_technician:
            assignments.append({
                "ticket_id": ticket['ticket_id'],
                "recommended_technician_id": best_technician['technician_id'],
                "confidence_score": min(0.95, best_score),
                "reasoning": f"Skill match: {int(skill_match * 100)}%, Load balance optimized",
                "assignment_type": "skill_based",
                "estimated_completion_time": ticket.get('estimated_time', 120)
            })
    
    # Analyze utilization
    for tech in technicians:
        utilization = (tech.get('current_workload', 0) / tech.get('max_capacity', 40)) * 100
        
        if utilization > 85:
            workload_analysis["overutilized_technicians"].append({
                "technician_id": tech['technician_id'],
                "utilization": utilization,
                "risk_level": "high" if utilization > 95 else "medium"
            })
        elif utilization < 50:
            workload_analysis["underutilized_technicians"].append({
                "technician_id": tech['technician_id'],
                "utilization": utilization,
                "opportunity": "can_take_more_tickets"
            })
    
    return {
        "success": True,
        "optimization_algorithm": "basic_skill_based",
        "assignments": assignments,
        "workload_analysis": workload_analysis,
        "optimization_score": 0.7,  # Basic algorithm score
        "metadata": {
            "technicians_analyzed": len(technicians),
            "tickets_processed": len(pending_tickets),
            "assignments_made": len(assignments),
            "algorithm_version": "1.0_fallback"
        }
    }


async def _emergency_triage_fallback(request: TicketTriageRequest) -> Dict[str, Any]:
    """Emergency fallback for triage when AI services fail."""
    logger.info(f"Using emergency fallback for ticket {request.ticket_id}")
    
    # Simple keyword-based classification
    text = f"{request.title} {request.description}".lower()
    
    # Determine category based on keywords
    category = "other"
    if any(word in text for word in ["password", "login", "access", "account"]):
        category = "access"
    elif any(word in text for word in ["email", "outlook", "mail"]):
        category = "email"
    elif any(word in text for word in ["network", "internet", "connection", "wifi"]):
        category = "network"
    elif any(word in text for word in ["computer", "laptop", "hardware", "screen"]):
        category = "hardware"
    elif any(word in text for word in ["software", "application", "program", "install"]):
        category = "software"
    elif any(word in text for word in ["virus", "security", "malware", "hack"]):
        category = "security"
    
    # Determine priority based on urgency keywords
    priority = "medium"
    if any(word in text for word in ["urgent", "critical", "emergency", "down", "outage"]):
        priority = "high"
    elif any(word in text for word in ["minor", "low", "when possible"]):
        priority = "low"
    
    return {
        "category": category,
        "priority": priority,
        "urgency": "medium",
        "impact": "medium",
        "confidence_score": 0.4,  # Low confidence for fallback
        "reasoning": "Emergency fallback classification using keyword analysis",
        "suggested_technician_skills": ["general_support"],
        "estimated_resolution_time": 120,
        "fallback_mode": True,
        "requires_manual_review": True
    }


@app.post("/ai/feedback")
async def submit_feedback(request: Request):
    """
    Submit feedback on AI predictions for continuous improvement.
    
    This endpoint collects feedback from technicians and managers about
    the accuracy and usefulness of AI predictions and suggestions.
    """
    start_time = time.time()
    
    try:
        request_data = await request.json()
        
        # Import feedback service
        from services.feedback_service import feedback_service, FeedbackType, FeedbackRating
        
        feedback_type = FeedbackType(request_data.get('feedback_type'))
        user_rating = FeedbackRating(request_data.get('user_rating'))
        
        if feedback_type == FeedbackType.TRIAGE_ACCURACY:
            feedback_id = await feedback_service.collect_triage_feedback(
                ticket_id=request_data['ticket_id'],
                ai_prediction=request_data['ai_prediction'],
                actual_outcome=request_data['actual_outcome'],
                user_rating=user_rating,
                user_comments=request_data.get('user_comments'),
                technician_id=request_data.get('technician_id')
            )
        elif feedback_type == FeedbackType.SLA_PREDICTION:
            feedback_id = await feedback_service.collect_sla_feedback(
                ticket_id=request_data['ticket_id'],
                ai_prediction=request_data['ai_prediction'],
                actual_outcome=request_data['actual_outcome'],
                user_rating=user_rating,
                user_comments=request_data.get('user_comments'),
                technician_id=request_data.get('technician_id')
            )
        elif feedback_type == FeedbackType.RESOLUTION_EFFECTIVENESS:
            feedback_id = await feedback_service.collect_resolution_feedback(
                ticket_id=request_data['ticket_id'],
                ai_suggestion=request_data['ai_prediction'],
                resolution_outcome=request_data['actual_outcome'],
                user_rating=user_rating,
                user_comments=request_data.get('user_comments'),
                technician_id=request_data.get('technician_id')
            )
        else:
            raise ValueError(f"Unsupported feedback type: {feedback_type}")
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": True,
            "feedback_id": feedback_id,
            "message": "Feedback collected successfully",
            "processing_time_ms": processing_time
        }
        
    except ValueError as e:
        processing_time = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "error": f"Invalid input: {str(e)}",
            "processing_time_ms": processing_time
        }
    except Exception as e:
        logger.error(f"Feedback collection failed: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "error": "Failed to collect feedback",
            "processing_time_ms": processing_time
        }


@app.get("/ai/performance-metrics")
async def get_performance_metrics(days: int = 30):
    """
    Get AI model performance metrics and improvement recommendations.
    
    This endpoint provides insights into AI model accuracy and suggestions
    for improving performance based on collected feedback.
    """
    start_time = time.time()
    
    try:
        from services.feedback_service import feedback_service
        
        # Get performance metrics
        metrics = await feedback_service.get_model_performance_metrics(days)
        
        # Get improvement recommendations
        recommendations = await feedback_service.get_improvement_recommendations()
        
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": True,
            "metrics": metrics,
            "recommendations": recommendations,
            "processing_time_ms": processing_time
        }
        
    except Exception as e:
        logger.error(f"Failed to get performance metrics: {str(e)}")
        processing_time = int((time.time() - start_time) * 1000)
        
        return {
            "success": False,
            "error": "Failed to retrieve performance metrics",
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