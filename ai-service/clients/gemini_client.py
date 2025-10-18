"""Gemini API client for AI processing."""
import logging
import asyncio
from typing import Optional, Dict, Any
import google.generativeai as genai
from config import settings

logger = logging.getLogger(__name__)


class GeminiClient:
    """Client for Google Gemini API."""
    
    def __init__(self):
        """Initialize Gemini client."""
        self.api_key = settings.gemini_api_key
        self.model_name = settings.gemini_model
        self.max_tokens = settings.gemini_max_tokens
        self.temperature = settings.gemini_temperature
        self.model = None
        
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            try:
                genai.configure(api_key=self.api_key)
                self.model = genai.GenerativeModel(self.model_name)
                logger.info(f"Gemini client initialized with model: {self.model_name}")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini client: {str(e)}")
                self.model = None
        else:
            logger.warning("Gemini API key not configured, using mock responses")
    
    async def health_check(self) -> bool:
        """Check if Gemini API is accessible."""
        if not self.model:
            return False
        
        try:
            # Simple test request
            response = await self.generate_text("Hello", max_tokens=10)
            return response is not None
        except Exception as e:
            logger.error(f"Gemini health check failed: {str(e)}")
            return False
    
    async def generate_text(
        self,
        prompt: str,
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None
    ) -> Optional[str]:
        """Generate text using Gemini API."""
        if not self.model:
            logger.warning("Gemini model not available, returning mock response")
            return self._get_mock_response(prompt)
        
        try:
            # Configure generation parameters
            generation_config = genai.types.GenerationConfig(
                max_output_tokens=max_tokens or self.max_tokens,
                temperature=temperature or self.temperature,
            )
            
            # Generate response
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=generation_config
            )
            
            if response and response.text:
                return response.text.strip()
            else:
                logger.warning("Empty response from Gemini API")
                return None
                
        except Exception as e:
            logger.error(f"Gemini API error: {str(e)}")
            return None
    
    async def classify_ticket(
        self,
        title: str,
        description: str,
        customer_tier: str = "standard"
    ) -> Optional[Dict[str, Any]]:
        """Classify ticket using Gemini API."""
        prompt = f"""
        Analyze this support ticket and provide classification in JSON format:
        
        Title: {title}
        Description: {description}
        Customer Tier: {customer_tier}
        
        Please classify this ticket and respond with ONLY a JSON object containing:
        {{
            "category": "one of: hardware, software, network, security, email, database, general",
            "priority": "one of: low, medium, high, critical",
            "urgency": "one of: low, medium, high, critical",
            "impact": "one of: low, medium, high, critical",
            "confidence_score": "float between 0.0 and 1.0",
            "reasoning": "brief explanation of classification",
            "suggested_technician_skills": ["list", "of", "required", "skills"],
            "estimated_resolution_hours": "float estimate"
        }}
        """
        
        response = await self.generate_text(prompt, max_tokens=500)
        if response:
            try:
                import json
                # Extract JSON from response (in case there's extra text)
                start = response.find('{')
                end = response.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = response[start:end]
                    return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini JSON response: {str(e)}")
        
        return None
    
    async def predict_sla_risk(
        self,
        ticket_data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Predict SLA risk using Gemini API."""
        prompt = f"""
        Analyze this ticket data and predict SLA breach risk in JSON format:
        
        Ticket Data: {ticket_data}
        
        Please analyze the SLA risk and respond with ONLY a JSON object containing:
        {{
            "breach_probability": "float between 0.0 and 1.0",
            "risk_level": "one of: low, medium, high, critical",
            "estimated_completion_hours": "float estimate",
            "confidence_score": "float between 0.0 and 1.0",
            "risk_factors": ["list", "of", "risk", "factors"],
            "recommended_actions": ["list", "of", "recommended", "actions"]
        }}
        """
        
        response = await self.generate_text(prompt, max_tokens=400)
        if response:
            try:
                import json
                start = response.find('{')
                end = response.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = response[start:end]
                    return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini JSON response: {str(e)}")
        
        return None
    
    async def suggest_resolution(
        self,
        title: str,
        description: str,
        category: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Generate resolution suggestions using Gemini API."""
        prompt = f"""
        Provide resolution suggestions for this support ticket in JSON format:
        
        Title: {title}
        Description: {description}
        Category: {category or "unknown"}
        
        Please provide resolution suggestions and respond with ONLY a JSON object containing:
        {{
            "suggestions": [
                {{
                    "suggestion": "description of solution",
                    "confidence_score": "float between 0.0 and 1.0",
                    "estimated_time_minutes": "integer estimate",
                    "steps": ["step 1", "step 2", "step 3"]
                }}
            ],
            "similar_issues": [
                {{
                    "issue": "description of similar issue",
                    "resolution": "how it was resolved",
                    "similarity_score": "float between 0.0 and 1.0"
                }}
            ]
        }}
        """
        
        response = await self.generate_text(prompt, max_tokens=800)
        if response:
            try:
                import json
                start = response.find('{')
                end = response.rfind('}') + 1
                if start >= 0 and end > start:
                    json_str = response[start:end]
                    return json.loads(json_str)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini JSON response: {str(e)}")
        
        return None
    
    def _get_mock_response(self, prompt: str) -> str:
        """Generate mock response when Gemini API is not available."""
        if "classify" in prompt.lower() or "category" in prompt.lower():
            return '''
            {
                "category": "software",
                "priority": "medium",
                "urgency": "medium",
                "impact": "medium",
                "confidence_score": 0.75,
                "reasoning": "Mock classification response",
                "suggested_technician_skills": ["troubleshooting", "software_support"],
                "estimated_resolution_hours": 2.5
            }
            '''
        elif "sla" in prompt.lower() or "risk" in prompt.lower():
            return '''
            {
                "breach_probability": 0.3,
                "risk_level": "medium",
                "estimated_completion_hours": 4.0,
                "confidence_score": 0.8,
                "risk_factors": ["moderate_complexity", "standard_priority"],
                "recommended_actions": ["assign_to_available_technician", "monitor_progress"]
            }
            '''
        elif "resolution" in prompt.lower() or "suggest" in prompt.lower():
            return '''
            {
                "suggestions": [
                    {
                        "suggestion": "Restart the service and check logs",
                        "confidence_score": 0.85,
                        "estimated_time_minutes": 15,
                        "steps": ["Stop service", "Check logs", "Restart service", "Verify functionality"]
                    }
                ],
                "similar_issues": [
                    {
                        "issue": "Service not responding",
                        "resolution": "Service restart resolved the issue",
                        "similarity_score": 0.9
                    }
                ]
            }
            '''
        else:
            return "Mock response for general query"


# Global client instance
gemini_client = GeminiClient()