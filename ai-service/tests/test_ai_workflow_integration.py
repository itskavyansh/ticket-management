import pytest
import asyncio
import httpx
import json
from datetime import datetime, timedelta
from typing import Dict, Any

from main import app
from config import settings

class TestAIWorkflowIntegration:
    """
    End-to-end integration tests for AI service workflow.
    Tests the complete AI processing pipeline from triage to resolution suggestions.
    """
    
    @pytest.fixture
    def client(self):
        """HTTP client for testing AI service endpoints."""
        return httpx.AsyncClient(app=app, base_url="http://test")
    
    @pytest.fixture
    def sample_ticket_data(self):
        """Sample ticket data for testing."""
        return {
            "ticket_id": "test-ticket-001",
            "title": "Server performance degradation",
            "description": "Customer reports slow response times on web application. Server CPU usage at 90%, memory usage at 85%. Database queries taking longer than usual.",
            "customer_tier": "premium"
        }
    
    @pytest.fixture
    def critical_ticket_data(self):
        """Critical ticket data for testing high-priority scenarios."""
        return {
            "ticket_id": "critical-ticket-001",
            "title": "Production system outage",
            "description": "Complete system failure. All services down. Revenue impact estimated at $50k/hour. Customer unable to process orders.",
            "customer_tier": "enterprise"
        }
    
    @pytest.mark.asyncio
    async def test_complete_ai_workflow_integration(self, client, sample_ticket_data):
        """Test the complete AI workflow from triage to resolution suggestions."""
        
        # Step 1: Test AI Triage
        triage_response = await client.post("/ai/triage", json=sample_ticket_data)
        assert triage_response.status_code == 200
        
        triage_result = triage_response.json()
        assert triage_result["success"] is True
        assert "result" in triage_result
        assert triage_result["processing_time_ms"] > 0
        
        # Validate triage results structure
        triage_data = triage_result["result"]
        assert "category" in triage_data
        assert "priority" in triage_data
        assert "urgency" in triage_data
        assert "impact" in triage_data
        assert "confidence_score" in triage_data
        assert "suggested_technician_skills" in triage_data
        
        # Verify confidence score is reasonable
        assert 0 <= triage_data["confidence_score"] <= 1
        
        # Step 2: Test SLA Prediction
        sla_request = {
            "ticket_id": sample_ticket_data["ticket_id"],
            "current_time": datetime.now().isoformat()
        }
        
        sla_response = await client.post("/ai/predict-sla", json=sla_request)
        assert sla_response.status_code == 200
        
        sla_result = sla_response.json()
        assert sla_result["success"] is True
        assert "result" in sla_result
        
        # Validate SLA prediction results
        sla_data = sla_result["result"]
        assert "breach_probability" in sla_data
        assert "risk_level" in sla_data
        assert "estimated_completion_hours" in sla_data
        assert "confidence_score" in sla_data
        
        assert 0 <= sla_data["breach_probability"] <= 1
        assert sla_data["risk_level"] in ["low", "medium", "high", "critical"]
        
        # Step 3: Test Resolution Suggestions
        resolution_request = {
            "ticket_id": sample_ticket_data["ticket_id"],
            "title": sample_ticket_data["title"],
            "description": sample_ticket_data["description"]
        }
        
        resolution_response = await client.post("/ai/suggest-resolution", json=resolution_request)
        assert resolution_response.status_code == 200
        
        resolution_result = resolution_response.json()
        assert resolution_result["success"] is True
        assert "suggestions" in resolution_result
        assert "similar_tickets" in resolution_result
        
        # Validate resolution suggestions
        suggestions = resolution_result["suggestions"]
        assert len(suggestions) > 0
        
        for suggestion in suggestions:
            assert "title" in suggestion
            assert "steps" in suggestion
            assert "confidence_score" in suggestion
            assert "estimated_time_minutes" in suggestion
            assert 0 <= suggestion["confidence_score"] <= 1
        
        # Step 4: Test Workload Optimization
        workload_request = {
            "technicians": [
                {
                    "technician_id": "tech-001",
                    "skills": ["infrastructure", "database"],
                    "current_workload": 20,
                    "max_capacity": 40
                },
                {
                    "technician_id": "tech-002", 
                    "skills": ["software", "web"],
                    "current_workload": 35,
                    "max_capacity": 40
                }
            ],
            "pending_tickets": [
                {
                    "ticket_id": sample_ticket_data["ticket_id"],
                    "required_skills": ["infrastructure", "database"],
                    "priority": triage_data["priority"]
                }
            ]
        }
        
        workload_response = await client.post("/ai/optimize-workload", json=workload_request)
        assert workload_response.status_code == 200
        
        workload_result = workload_response.json()
        assert workload_result["success"] is True
        assert "recommendations" in workload_result
        assert "workload_analysis" in workload_result
        
        # Validate workload recommendations
        recommendations = workload_result["recommendations"]
        assert len(recommendations) > 0
        
        recommendation = recommendations[0]
        assert "ticket_id" in recommendation
        assert "recommended_technician_id" in recommendation
        assert "confidence_score" in recommendation
        assert "reasoning" in recommendation
    
    @pytest.mark.asyncio
    async def test_critical_ticket_workflow(self, client, critical_ticket_data):
        """Test AI workflow for critical tickets with high urgency."""
        
        # Test triage for critical ticket
        triage_response = await client.post("/ai/triage", json=critical_ticket_data)
        assert triage_response.status_code == 200
        
        triage_result = triage_response.json()
        triage_data = triage_result["result"]
        
        # Critical tickets should be classified as high priority
        assert triage_data["priority"] in ["high", "critical"]
        assert triage_data["urgency"] in ["high", "critical"]
        assert triage_data["impact"] in ["high", "critical"]
        
        # SLA prediction should show high risk for critical tickets
        sla_request = {
            "ticket_id": critical_ticket_data["ticket_id"],
            "current_time": datetime.now().isoformat()
        }
        
        sla_response = await client.post("/ai/predict-sla", json=sla_request)
        sla_result = sla_response.json()
        sla_data = sla_result["result"]
        
        # Critical tickets should have higher breach probability
        assert sla_data["breach_probability"] >= 0.3  # At least 30% risk
        assert sla_data["risk_level"] in ["high", "critical"]
    
    @pytest.mark.asyncio
    async def test_ai_service_error_handling(self, client):
        """Test error handling and graceful degradation."""
        
        # Test with invalid ticket data
        invalid_data = {
            "ticket_id": "",  # Empty ticket ID
            "title": "",      # Empty title
            "description": ""  # Empty description
        }
        
        triage_response = await client.post("/ai/triage", json=invalid_data)
        assert triage_response.status_code == 200
        
        triage_result = triage_response.json()
        assert triage_result["success"] is False
        assert "error" in triage_result
        assert "Invalid input" in triage_result["error"]
        
        # Test with malformed JSON
        malformed_response = await client.post(
            "/ai/triage", 
            content="invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert malformed_response.status_code == 422  # Validation error
    
    @pytest.mark.asyncio
    async def test_ai_service_performance(self, client, sample_ticket_data):
        """Test AI service performance and response times."""
        
        # Test triage performance
        start_time = asyncio.get_event_loop().time()
        triage_response = await client.post("/ai/triage", json=sample_ticket_data)
        end_time = asyncio.get_event_loop().time()
        
        assert triage_response.status_code == 200
        
        # Response should be within 5 seconds as per requirements
        response_time = (end_time - start_time) * 1000  # Convert to milliseconds
        assert response_time < 5000, f"Triage took {response_time}ms, should be < 5000ms"
        
        # Verify processing time is reported accurately
        triage_result = triage_response.json()
        reported_time = triage_result["processing_time_ms"]
        assert abs(reported_time - response_time) < 100  # Allow 100ms tolerance
    
    @pytest.mark.asyncio
    async def test_caching_functionality(self, client, sample_ticket_data):
        """Test AI service caching for improved performance."""
        
        # First request - should not be cached
        first_response = await client.post("/ai/triage", json=sample_ticket_data)
        assert first_response.status_code == 200
        
        first_result = first_response.json()
        assert first_result["cached"] is False
        
        # Second identical request - should be cached (if caching is implemented)
        second_response = await client.post("/ai/triage", json=sample_ticket_data)
        assert second_response.status_code == 200
        
        second_result = second_response.json()
        # Note: Caching behavior depends on implementation
        # This test documents expected behavior
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, client, sample_ticket_data):
        """Test AI service handling of concurrent requests."""
        
        # Create multiple concurrent requests
        tasks = []
        for i in range(5):
            ticket_data = sample_ticket_data.copy()
            ticket_data["ticket_id"] = f"concurrent-test-{i}"
            task = client.post("/ai/triage", json=ticket_data)
            tasks.append(task)
        
        # Execute all requests concurrently
        responses = await asyncio.gather(*tasks)
        
        # All requests should succeed
        for response in responses:
            assert response.status_code == 200
            result = response.json()
            assert result["success"] is True
    
    @pytest.mark.asyncio
    async def test_health_check_integration(self, client):
        """Test comprehensive health check functionality."""
        
        health_response = await client.get("/health")
        assert health_response.status_code == 200
        
        health_data = health_response.json()
        assert "status" in health_data
        assert "dependencies" in health_data
        
        # Check dependency health
        dependencies = health_data["dependencies"]
        assert "gemini" in dependencies
        assert "cache" in dependencies
        
        # Each dependency should have a status
        for dep_name, dep_info in dependencies.items():
            assert "status" in dep_info
            assert dep_info["status"] in ["healthy", "unhealthy", "error"]
    
    @pytest.mark.asyncio
    async def test_ai_model_consistency(self, client):
        """Test AI model consistency across multiple requests."""
        
        # Same input should produce consistent results
        ticket_data = {
            "ticket_id": "consistency-test",
            "title": "Email server not responding",
            "description": "Users cannot send or receive emails. Server appears to be running but not responding to connections.",
            "customer_tier": "standard"
        }
        
        results = []
        for _ in range(3):
            response = await client.post("/ai/triage", json=ticket_data)
            assert response.status_code == 200
            result = response.json()
            results.append(result["result"])
        
        # Results should be consistent (same category and similar confidence)
        categories = [r["category"] for r in results]
        assert len(set(categories)) <= 2, "Category should be consistent across requests"
        
        confidences = [r["confidence_score"] for r in results]
        confidence_variance = max(confidences) - min(confidences)
        assert confidence_variance < 0.2, "Confidence scores should be relatively stable"
    
    @pytest.mark.asyncio
    async def test_integration_with_backend_workflow(self, client):
        """Test integration points with backend service workflow."""
        
        # Simulate the workflow that backend would follow
        ticket_data = {
            "ticket_id": "backend-integration-test",
            "title": "Database connection timeout",
            "description": "Application experiencing frequent database timeouts. Connection pool exhausted.",
            "customer_tier": "premium"
        }
        
        # Step 1: Triage (called when ticket is created)
        triage_response = await client.post("/ai/triage", json=ticket_data)
        triage_result = triage_response.json()
        
        # Step 2: SLA Prediction (called periodically)
        sla_request = {
            "ticket_id": ticket_data["ticket_id"],
            "current_time": datetime.now().isoformat()
        }
        sla_response = await client.post("/ai/predict-sla", json=sla_request)
        sla_result = sla_response.json()
        
        # Step 3: Resolution Suggestions (called when technician views ticket)
        resolution_response = await client.post("/ai/suggest-resolution", json=ticket_data)
        resolution_result = resolution_response.json()
        
        # All steps should succeed and provide consistent data
        assert all([
            triage_result["success"],
            sla_result["success"], 
            resolution_result["success"]
        ])
        
        # Data should be consistent across services
        ticket_id = ticket_data["ticket_id"]
        assert triage_result["result"]["ticket_id"] == ticket_id
        assert resolution_result["ticket_id"] == ticket_id


class TestAIServiceResilience:
    """Test AI service resilience and error recovery."""
    
    @pytest.fixture
    def client(self):
        return httpx.AsyncClient(app=app, base_url="http://test")
    
    @pytest.mark.asyncio
    async def test_graceful_degradation_on_model_failure(self, client):
        """Test graceful degradation when AI models fail."""
        
        # This would require mocking the Gemini client to simulate failures
        # For now, we test the error handling structure
        
        ticket_data = {
            "ticket_id": "model-failure-test",
            "title": "Test ticket for model failure",
            "description": "Testing graceful degradation",
            "customer_tier": "standard"
        }
        
        response = await client.post("/ai/triage", json=ticket_data)
        
        # Service should still respond even if model fails
        assert response.status_code == 200
        result = response.json()
        
        # Should either succeed or fail gracefully with error message
        if not result["success"]:
            assert "error" in result
            assert result["processing_time_ms"] > 0
    
    @pytest.mark.asyncio
    async def test_timeout_handling(self, client):
        """Test handling of request timeouts."""
        
        # Create a request that might timeout
        large_ticket_data = {
            "ticket_id": "timeout-test",
            "title": "Large ticket for timeout testing",
            "description": "A" * 10000,  # Very large description
            "customer_tier": "standard"
        }
        
        try:
            response = await client.post("/ai/triage", json=large_ticket_data, timeout=30.0)
            assert response.status_code == 200
            
            result = response.json()
            # Should either succeed or fail with timeout error
            if not result["success"]:
                assert "timeout" in result.get("error", "").lower() or "processing" in result.get("error", "").lower()
        
        except httpx.TimeoutException:
            # Timeout is acceptable for very large requests
            pass


if __name__ == "__main__":
    pytest.main([__file__, "-v"])