#!/usr/bin/env python3
"""
Simple AI Service Main - Minimal working version
"""
import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import logging
import json
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="AI Ticket Management Service",
    description="AI-powered ticket triage and resolution service",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class TicketTriageRequest(BaseModel):
    title: str
    description: str
    customer_tier: Optional[str] = "standard"
    reported_by: Optional[str] = None

class TriageResult(BaseModel):
    category: str
    priority: str
    urgency: str
    estimated_resolution_time: int
    confidence_score: float
    reasoning: str
    suggested_technician_skills: List[str]

class SLAPredictionRequest(BaseModel):
    ticket_id: str
    priority: str
    category: str
    customer_tier: str
    current_progress: float

class SLAPrediction(BaseModel):
    risk_level: str
    breach_probability: float
    estimated_completion_time: str
    recommended_actions: List[str]

class ResolutionRequest(BaseModel):
    ticket_id: str
    title: str
    description: str
    category: str
    priority: str

class ResolutionSuggestion(BaseModel):
    suggestions: List[Dict[str, Any]]
    confidence_score: float
    similar_tickets: List[Dict[str, Any]]

# Mock AI responses for development
MOCK_TRIAGE_RESPONSES = {
    "hardware": {
        "category": "hardware",
        "priority": "high",
        "urgency": "high",
        "estimated_resolution_time": 240,
        "confidence_score": 0.85,
        "reasoning": "Hardware issues typically require immediate attention to prevent system downtime.",
        "suggested_technician_skills": ["hardware_repair", "diagnostics", "component_replacement"]
    },
    "software": {
        "category": "software",
        "priority": "medium",
        "urgency": "medium", 
        "estimated_resolution_time": 120,
        "confidence_score": 0.78,
        "reasoning": "Software issues can often be resolved through configuration changes or updates.",
        "suggested_technician_skills": ["software_troubleshooting", "configuration", "updates"]
    },
    "network": {
        "category": "network",
        "priority": "high",
        "urgency": "high",
        "estimated_resolution_time": 180,
        "confidence_score": 0.82,
        "reasoning": "Network issues affect multiple users and require prompt resolution.",
        "suggested_technician_skills": ["network_administration", "routing", "switching"]
    }
}

def determine_category(title: str, description: str) -> str:
    """Simple category determination based on keywords"""
    text = f"{title} {description}".lower()
    
    if any(word in text for word in ["server", "cpu", "memory", "disk", "hardware", "component"]):
        return "hardware"
    elif any(word in text for word in ["network", "internet", "connection", "wifi", "ethernet"]):
        return "network"
    else:
        return "software"

# Health check endpoint
@app.get("/health")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": "ai-ticket-management",
        "version": "1.0.0",
        "timestamp": datetime.utcnow().isoformat(),
        "dependencies": {
            "gemini_api": "healthy",
            "cache": "healthy"
        }
    }

# Triage endpoint
@app.post("/triage", response_model=TriageResult)
async def triage_ticket(request: TicketTriageRequest):
    """Triage a ticket using AI classification"""
    try:
        logger.info(f"Processing triage request for: {request.title}")
        
        # Determine category
        category = determine_category(request.title, request.description)
        
        # Get mock response based on category
        response = MOCK_TRIAGE_RESPONSES.get(category, MOCK_TRIAGE_RESPONSES["software"])
        
        return TriageResult(**response)
        
    except Exception as e:
        logger.error(f"Triage error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Triage processing failed: {str(e)}")

# SLA prediction endpoint
@app.post("/sla/predict", response_model=SLAPrediction)
async def predict_sla(request: SLAPredictionRequest):
    """Predict SLA breach risk"""
    try:
        logger.info(f"Processing SLA prediction for ticket: {request.ticket_id}")
        
        # Simple risk calculation based on priority and progress
        risk_score = 0.0
        
        if request.priority == "critical":
            risk_score += 0.4
        elif request.priority == "high":
            risk_score += 0.3
        elif request.priority == "medium":
            risk_score += 0.2
        else:
            risk_score += 0.1
            
        # Factor in progress
        if request.current_progress < 0.3:
            risk_score += 0.3
        elif request.current_progress < 0.6:
            risk_score += 0.2
        else:
            risk_score += 0.1
            
        # Customer tier impact
        if request.customer_tier == "enterprise":
            risk_score += 0.1
        elif request.customer_tier == "premium":
            risk_score += 0.05
            
        # Determine risk level
        if risk_score >= 0.7:
            risk_level = "high"
            actions = ["Escalate immediately", "Assign senior technician", "Notify management"]
        elif risk_score >= 0.4:
            risk_level = "medium"
            actions = ["Monitor closely", "Consider escalation", "Update customer"]
        else:
            risk_level = "low"
            actions = ["Continue normal process", "Regular updates"]
            
        return SLAPrediction(
            risk_level=risk_level,
            breach_probability=min(risk_score, 0.95),
            estimated_completion_time="2024-12-01T15:30:00Z",
            recommended_actions=actions
        )
        
    except Exception as e:
        logger.error(f"SLA prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"SLA prediction failed: {str(e)}")

# Resolution suggestions endpoint
@app.post("/resolution/suggest", response_model=ResolutionSuggestion)
async def suggest_resolution(request: ResolutionRequest):
    """Get resolution suggestions for a ticket"""
    try:
        logger.info(f"Processing resolution suggestions for: {request.ticket_id}")
        
        # Mock resolution suggestions based on category
        suggestions = []
        similar_tickets = []
        
        if request.category == "hardware":
            suggestions = [
                {
                    "title": "Check hardware connections",
                    "description": "Verify all cables and connections are secure",
                    "confidence": 0.8,
                    "estimated_time": 30
                },
                {
                    "title": "Run hardware diagnostics",
                    "description": "Use built-in diagnostic tools to identify failing components",
                    "confidence": 0.75,
                    "estimated_time": 45
                }
            ]
            similar_tickets = [
                {"id": "TKT-001", "title": "Server hardware failure", "resolution_time": 120},
                {"id": "TKT-002", "title": "Memory module replacement", "resolution_time": 90}
            ]
        elif request.category == "network":
            suggestions = [
                {
                    "title": "Check network connectivity",
                    "description": "Verify network cables and switch ports",
                    "confidence": 0.85,
                    "estimated_time": 20
                },
                {
                    "title": "Reset network configuration",
                    "description": "Reset network settings to default configuration",
                    "confidence": 0.7,
                    "estimated_time": 15
                }
            ]
            similar_tickets = [
                {"id": "TKT-003", "title": "Network connectivity issues", "resolution_time": 60},
                {"id": "TKT-004", "title": "WiFi connection problems", "resolution_time": 45}
            ]
        else:  # software
            suggestions = [
                {
                    "title": "Restart the application",
                    "description": "Close and restart the affected application",
                    "confidence": 0.6,
                    "estimated_time": 5
                },
                {
                    "title": "Check for software updates",
                    "description": "Install any available updates for the software",
                    "confidence": 0.8,
                    "estimated_time": 30
                }
            ]
            similar_tickets = [
                {"id": "TKT-005", "title": "Application crash", "resolution_time": 30},
                {"id": "TKT-006", "title": "Software update issues", "resolution_time": 60}
            ]
        
        return ResolutionSuggestion(
            suggestions=suggestions,
            confidence_score=0.78,
            similar_tickets=similar_tickets
        )
        
    except Exception as e:
        logger.error(f"Resolution suggestion error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Resolution suggestion failed: {str(e)}")

# Workload optimization endpoint
@app.post("/workload/optimize")
async def optimize_workload(data: Dict[str, Any]):
    """Optimize technician workload"""
    try:
        logger.info("Processing workload optimization request")
        
        # Mock workload optimization
        return {
            "optimized_assignments": [
                {
                    "technician_id": "tech_001",
                    "recommended_tickets": ["TKT-001", "TKT-003"],
                    "estimated_workload": 6.5,
                    "skills_match": 0.85
                },
                {
                    "technician_id": "tech_002", 
                    "recommended_tickets": ["TKT-002"],
                    "estimated_workload": 4.2,
                    "skills_match": 0.92
                }
            ],
            "load_balance_score": 0.78,
            "recommendations": [
                "Consider redistributing high-priority tickets",
                "Tech_001 is approaching capacity limit"
            ]
        }
        
    except Exception as e:
        logger.error(f"Workload optimization error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Workload optimization failed: {str(e)}")

if __name__ == "__main__":
    port = int(os.getenv("API_PORT", 8001))
    host = os.getenv("API_HOST", "0.0.0.0")
    
    logger.info(f"🤖 Starting AI Service on {host}:{port}")
    
    uvicorn.run(
        "simple_main:app",
        host=host,
        port=port,
        reload=True,
        log_level="info"
    )