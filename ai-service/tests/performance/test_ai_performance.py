"""
AI Service Performance Testing
Tests AI model inference performance and optimization under load
"""

import asyncio
import time
import statistics
import pytest
import httpx
from concurrent.futures import ThreadPoolExecutor
from typing import List, Dict, Any
import psutil
import json
from memory_profiler import profile

class AIPerformanceTest:
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.client = httpx.AsyncClient(base_url=base_url, timeout=30.0)
        
    async def cleanup(self):
        await self.client.aclose()

@pytest.fixture
async def ai_client():
    client = AIPerformanceTest()
    yield client
    await client.cleanup()

class TestAIInferencePerformance:
    """Test AI model inference performance under various conditions"""
    
    @pytest.mark.asyncio
    async def test_ticket_triage_performance(self, ai_client):
        """Test ticket triage AI performance with realistic payloads"""
        
        test_tickets = [
            {
                "title": "Server not responding to ping requests",
                "description": "Production web server (192.168.1.100) stopped responding to ping requests at 2:30 PM. Users cannot access the company website. Server appears to be running but network connectivity seems to be the issue.",
                "customer_tier": "enterprise"
            },
            {
                "title": "Email delivery delays",
                "description": "Customers reporting significant delays in email delivery. Some emails taking 2-3 hours to arrive. Exchange server logs show queue buildup. This is affecting business communications.",
                "customer_tier": "business"
            },
            {
                "title": "Database query timeout errors",
                "description": "Application users experiencing timeout errors when running reports. Database performance monitor shows high CPU usage and slow query execution times. Affects daily operations.",
                "customer_tier": "standard"
            },
            {
                "title": "Security alert - suspicious login attempts",
                "description": "Multiple failed login attempts detected from IP address 203.0.113.45. Attempts targeting admin accounts. Firewall logs show repeated connection attempts. Potential security breach.",
                "customer_tier": "enterprise"
            },
            {
                "title": "Backup job failure",
                "description": "Nightly backup job failed with error code 0x80070005. Backup storage shows sufficient space. Previous backups completed successfully. Need to investigate cause.",
                "customer_tier": "business"
            }
        ]
        
        response_times = []
        successful_requests = 0
        failed_requests = 0
        
        # Test individual requests
        for ticket in test_tickets:
            start_time = time.time()
            
            try:
                response = await ai_client.client.post("/ai/triage", json=ticket)
                response_time = (time.time() - start_time) * 1000  # Convert to ms
                
                if response.status_code == 200:
                    successful_requests += 1
                    response_times.append(response_time)
                    
                    # Validate response structure
                    result = response.json()
                    assert "category" in result
                    assert "priority" in result
                    assert "confidence" in result
                    assert "suggested_technician" in result
                    
                    print(f"Triage result: {result['category']} - {result['priority']} ({response_time:.2f}ms)")
                else:
                    failed_requests += 1
                    
            except Exception as e:
                failed_requests += 1
                print(f"Request failed: {e}")
        
        # Performance assertions
        if response_times:
            avg_response_time = statistics.mean(response_times)
            p95_response_time = statistics.quantiles(response_times, n=20)[18]  # 95th percentile
            
            print(f"Triage Performance: avg={avg_response_time:.2f}ms, p95={p95_response_time:.2f}ms")
            
            assert avg_response_time < 3000, f"Average response time too high: {avg_response_time}ms"
            assert p95_response_time < 5000, f"95th percentile too high: {p95_response_time}ms"
            assert successful_requests > 0, "No successful requests"
            assert failed_requests == 0, f"Failed requests: {failed_requests}"

    @pytest.mark.asyncio
    async def test_concurrent_triage_requests(self, ai_client):
        """Test AI triage performance under concurrent load"""
        
        test_ticket = {
            "title": "Network connectivity issues in office",
            "description": "Multiple users reporting intermittent network connectivity issues. WiFi appears to be working but wired connections are dropping frequently. Started this morning around 9 AM.",
            "customer_tier": "business"
        }
        
        concurrent_requests = 20
        response_times = []
        successful_requests = 0
        failed_requests = 0
        
        async def make_request():
            nonlocal successful_requests, failed_requests
            start_time = time.time()
            
            try:
                response = await ai_client.client.post("/ai/triage", json=test_ticket)
                response_time = (time.time() - start_time) * 1000
                
                if response.status_code == 200:
                    successful_requests += 1
                    response_times.append(response_time)
                else:
                    failed_requests += 1
                    
            except Exception as e:
                failed_requests += 1
                print(f"Concurrent request failed: {e}")
        
        # Execute concurrent requests
        start_time = time.time()
        tasks = [make_request() for _ in range(concurrent_requests)]
        await asyncio.gather(*tasks)
        total_time = time.time() - start_time
        
        # Analyze results
        if response_times:
            avg_response_time = statistics.mean(response_times)
            throughput = successful_requests / total_time
            
            print(f"Concurrent Performance: {successful_requests}/{concurrent_requests} successful")
            print(f"Average response time: {avg_response_time:.2f}ms")
            print(f"Throughput: {throughput:.2f} requests/second")
            
            assert successful_requests >= concurrent_requests * 0.9, "Too many failed requests"
            assert avg_response_time < 5000, "Average response time too high under load"
            assert throughput > 2, "Throughput too low"

    @pytest.mark.asyncio
    async def test_resolution_suggestion_performance(self, ai_client):
        """Test resolution suggestion AI performance"""
        
        test_cases = [
            {
                "ticket_description": "Server blue screen error 0x0000007E. System crashes randomly during high CPU usage periods. Event logs show driver issues.",
                "error_logs": ["DRIVER_IRQL_NOT_LESS_OR_EQUAL", "System crash dump created"],
                "system_info": {"os": "Windows Server 2019", "cpu": "Intel Xeon", "ram": "32GB"}
            },
            {
                "ticket_description": "Email server running out of disk space. Exchange database growing rapidly. Users cannot send emails.",
                "error_logs": ["Insufficient disk space", "Database size: 95% of allocated space"],
                "system_info": {"os": "Windows Server 2016", "service": "Exchange 2016", "disk": "500GB"}
            },
            {
                "ticket_description": "Network printer not responding. Users cannot print documents. Printer shows online in device manager but jobs queue indefinitely.",
                "error_logs": ["Print spooler service stopped", "Communication timeout"],
                "system_info": {"printer": "HP LaserJet Pro", "network": "192.168.1.0/24", "driver": "PCL6"}
            }
        ]
        
        response_times = []
        
        for test_case in test_cases:
            start_time = time.time()
            
            try:
                response = await ai_client.client.post("/ai/suggest-resolution", json=test_case)
                response_time = (time.time() - start_time) * 1000
                
                if response.status_code == 200:
                    response_times.append(response_time)
                    result = response.json()
                    
                    # Validate response structure
                    assert "suggestions" in result
                    assert len(result["suggestions"]) > 0
                    assert "confidence_scores" in result
                    
                    print(f"Resolution suggestions generated in {response_time:.2f}ms")
                    print(f"Top suggestion: {result['suggestions'][0][:100]}...")
                    
            except Exception as e:
                print(f"Resolution suggestion failed: {e}")
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            assert avg_response_time < 8000, f"Resolution suggestion too slow: {avg_response_time}ms"

    @pytest.mark.asyncio
    async def test_sla_prediction_performance(self, ai_client):
        """Test SLA prediction model performance"""
        
        test_predictions = [
            {
                "ticket_id": "ticket-001",
                "priority": "high",
                "category": "hardware",
                "technician_workload": 0.7,
                "customer_tier": "enterprise",
                "complexity_score": 0.6,
                "time_since_creation": 2.5
            },
            {
                "ticket_id": "ticket-002", 
                "priority": "medium",
                "category": "software",
                "technician_workload": 0.4,
                "customer_tier": "business",
                "complexity_score": 0.3,
                "time_since_creation": 1.0
            },
            {
                "ticket_id": "ticket-003",
                "priority": "critical",
                "category": "security",
                "technician_workload": 0.9,
                "customer_tier": "enterprise", 
                "complexity_score": 0.8,
                "time_since_creation": 0.5
            }
        ]
        
        response_times = []
        
        for prediction_data in test_predictions:
            start_time = time.time()
            
            try:
                response = await ai_client.client.post("/ai/predict-sla", json=prediction_data)
                response_time = (time.time() - start_time) * 1000
                
                if response.status_code == 200:
                    response_times.append(response_time)
                    result = response.json()
                    
                    # Validate response
                    assert "breach_probability" in result
                    assert "estimated_completion_time" in result
                    assert "risk_factors" in result
                    assert 0 <= result["breach_probability"] <= 1
                    
                    print(f"SLA prediction: {result['breach_probability']:.2%} breach risk ({response_time:.2f}ms)")
                    
            except Exception as e:
                print(f"SLA prediction failed: {e}")
        
        if response_times:
            avg_response_time = statistics.mean(response_times)
            assert avg_response_time < 2000, f"SLA prediction too slow: {avg_response_time}ms"

class TestAIServiceResourceUsage:
    """Test AI service resource usage and optimization"""
    
    @pytest.mark.asyncio
    async def test_memory_usage_under_load(self, ai_client):
        """Test memory usage during sustained AI processing"""
        
        initial_memory = psutil.Process().memory_info().rss / 1024 / 1024  # MB
        
        # Generate load
        test_ticket = {
            "title": "Performance test ticket",
            "description": "This is a test ticket for memory usage analysis during AI processing load testing.",
            "customer_tier": "business"
        }
        
        memory_samples = []
        
        for i in range(50):  # 50 requests to build up memory usage
            try:
                response = await ai_client.client.post("/ai/triage", json=test_ticket)
                
                # Sample memory usage every 10 requests
                if i % 10 == 0:
                    current_memory = psutil.Process().memory_info().rss / 1024 / 1024
                    memory_samples.append(current_memory)
                    
            except Exception as e:
                print(f"Memory test request failed: {e}")
        
        final_memory = psutil.Process().memory_info().rss / 1024 / 1024
        memory_increase = final_memory - initial_memory
        
        print(f"Memory usage: initial={initial_memory:.2f}MB, final={final_memory:.2f}MB")
        print(f"Memory increase: {memory_increase:.2f}MB")
        
        # Memory should not increase excessively (allow for some caching)
        assert memory_increase < 500, f"Excessive memory usage increase: {memory_increase}MB"

    @pytest.mark.asyncio 
    async def test_response_caching_effectiveness(self, ai_client):
        """Test AI response caching to improve performance"""
        
        test_ticket = {
            "title": "Identical test ticket for caching",
            "description": "This exact ticket should be cached after first request to test caching effectiveness.",
            "customer_tier": "standard"
        }
        
        # First request (cache miss)
        start_time = time.time()
        response1 = await ai_client.client.post("/ai/triage", json=test_ticket)
        first_response_time = (time.time() - start_time) * 1000
        
        # Second identical request (should be cache hit)
        start_time = time.time()
        response2 = await ai_client.client.post("/ai/triage", json=test_ticket)
        second_response_time = (time.time() - start_time) * 1000
        
        assert response1.status_code == 200
        assert response2.status_code == 200
        
        # Results should be identical
        result1 = response1.json()
        result2 = response2.json()
        assert result1["category"] == result2["category"]
        assert result1["priority"] == result2["priority"]
        
        print(f"Cache test: first={first_response_time:.2f}ms, second={second_response_time:.2f}ms")
        
        # Second request should be significantly faster (cached)
        cache_speedup = first_response_time / second_response_time
        assert cache_speedup > 2, f"Insufficient cache speedup: {cache_speedup:.2f}x"

    @pytest.mark.asyncio
    async def test_ai_service_health_under_stress(self, ai_client):
        """Test AI service health monitoring under stress conditions"""
        
        # Stress test with rapid requests
        stress_duration = 30  # seconds
        request_interval = 0.1  # 10 requests per second
        
        test_ticket = {
            "title": "Stress test ticket",
            "description": "High frequency stress test to validate service stability and health monitoring.",
            "customer_tier": "enterprise"
        }
        
        start_time = time.time()
        request_count = 0
        error_count = 0
        response_times = []
        
        while time.time() - start_time < stress_duration:
            try:
                req_start = time.time()
                response = await ai_client.client.post("/ai/triage", json=test_ticket)
                req_time = (time.time() - req_start) * 1000
                
                request_count += 1
                
                if response.status_code == 200:
                    response_times.append(req_time)
                else:
                    error_count += 1
                    
                await asyncio.sleep(request_interval)
                
            except Exception as e:
                error_count += 1
                print(f"Stress test error: {e}")
        
        # Check health endpoint
        health_response = await ai_client.client.get("/health")
        assert health_response.status_code == 200
        
        health_data = health_response.json()
        assert health_data["status"] == "healthy"
        
        # Analyze stress test results
        error_rate = error_count / request_count if request_count > 0 else 1
        avg_response_time = statistics.mean(response_times) if response_times else float('inf')
        
        print(f"Stress test results:")
        print(f"  Requests: {request_count}")
        print(f"  Errors: {error_count}")
        print(f"  Error rate: {error_rate:.2%}")
        print(f"  Avg response time: {avg_response_time:.2f}ms")
        
        assert error_rate < 0.05, f"High error rate under stress: {error_rate:.2%}"
        assert avg_response_time < 10000, f"Response time degraded too much: {avg_response_time:.2f}ms"

class TestAIModelOptimization:
    """Test AI model optimization and efficiency"""
    
    @pytest.mark.asyncio
    async def test_batch_processing_efficiency(self, ai_client):
        """Test batch processing of multiple tickets for efficiency"""
        
        batch_tickets = [
            {
                "title": f"Batch test ticket {i}",
                "description": f"This is batch test ticket number {i} for testing batch processing efficiency.",
                "customer_tier": "business"
            }
            for i in range(10)
        ]
        
        # Test individual processing
        individual_start = time.time()
        individual_results = []
        
        for ticket in batch_tickets:
            response = await ai_client.client.post("/ai/triage", json=ticket)
            if response.status_code == 200:
                individual_results.append(response.json())
        
        individual_time = time.time() - individual_start
        
        # Test batch processing (if available)
        batch_start = time.time()
        try:
            batch_response = await ai_client.client.post("/ai/triage-batch", json={"tickets": batch_tickets})
            batch_time = time.time() - batch_start
            
            if batch_response.status_code == 200:
                batch_results = batch_response.json()["results"]
                
                print(f"Processing time: individual={individual_time:.2f}s, batch={batch_time:.2f}s")
                
                # Batch should be more efficient
                efficiency_gain = individual_time / batch_time
                assert efficiency_gain > 1.5, f"Insufficient batch efficiency: {efficiency_gain:.2f}x"
                
                # Results should be consistent
                assert len(batch_results) == len(individual_results)
                
        except Exception as e:
            print(f"Batch processing not available or failed: {e}")
            # This is acceptable if batch processing isn't implemented yet

    @pytest.mark.asyncio
    async def test_model_warm_up_performance(self, ai_client):
        """Test AI model warm-up and cold start performance"""
        
        # First request after service start (cold start)
        cold_start_ticket = {
            "title": "Cold start test ticket",
            "description": "This ticket tests cold start performance of AI models.",
            "customer_tier": "enterprise"
        }
        
        cold_start_time = time.time()
        cold_response = await ai_client.client.post("/ai/triage", json=cold_start_ticket)
        cold_duration = (time.time() - cold_start_time) * 1000
        
        # Subsequent requests (warm model)
        warm_times = []
        for i in range(5):
            warm_start_time = time.time()
            warm_response = await ai_client.client.post("/ai/triage", json=cold_start_ticket)
            warm_duration = (time.time() - warm_start_time) * 1000
            warm_times.append(warm_duration)
        
        avg_warm_time = statistics.mean(warm_times)
        
        print(f"Model performance: cold start={cold_duration:.2f}ms, warm avg={avg_warm_time:.2f}ms")
        
        # Warm requests should be faster than cold start
        assert avg_warm_time < cold_duration, "Warm requests should be faster than cold start"
        
        # Both should meet performance requirements
        assert cold_duration < 15000, f"Cold start too slow: {cold_duration:.2f}ms"
        assert avg_warm_time < 5000, f"Warm requests too slow: {avg_warm_time:.2f}ms"

if __name__ == "__main__":
    # Run performance tests
    pytest.main([__file__, "-v", "--tb=short"])