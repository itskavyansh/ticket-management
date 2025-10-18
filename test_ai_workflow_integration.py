#!/usr/bin/env python3
"""
Comprehensive End-to-End AI Workflow Integration Test

This script tests the complete AI ticket management workflow:
1. Ticket creation with AI triage
2. SLA prediction and monitoring
3. Resolution suggestions
4. Workload optimization
5. Error handling and graceful degradation
"""

import asyncio
import aiohttp
import json
import time
import sys
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from datetime import datetime, timedelta

@dataclass
class TestResult:
    test_name: str
    success: bool
    duration_ms: int
    error_message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class AIWorkflowIntegrationTester:
    def __init__(self, backend_url: str = "http://localhost:3000", ai_service_url: str = "http://localhost:8001"):
        self.backend_url = backend_url
        self.ai_service_url = ai_service_url
        self.session: Optional[aiohttp.ClientSession] = None
        self.auth_token = "mock-jwt-token"  # For testing
        self.test_results: List[TestResult] = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    def get_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.auth_token}"
        }

    async def make_request(self, method: str, url: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request with error handling"""
        try:
            async with self.session.request(method, url, **kwargs) as response:
                if response.content_type == 'application/json':
                    return await response.json()
                else:
                    return {"status": response.status, "text": await response.text()}
        except Exception as e:
            return {"error": str(e), "status": 0}

    async def test_service_health(self) -> TestResult:
        """Test that all services are healthy and responding"""
        start_time = time.time()
        
        try:
            # Test backend health
            backend_health = await self.make_request("GET", f"{self.backend_url}/health")
            if backend_health.get("status") != "healthy":
                return TestResult(
                    "service_health",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Backend unhealthy: {backend_health}"
                )

            # Test AI service health
            ai_health = await self.make_request("GET", f"{self.ai_service_url}/health")
            if ai_health.get("status") != "healthy":
                return TestResult(
                    "service_health",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"AI service unhealthy: {ai_health}"
                )

            return TestResult(
                "service_health",
                True,
                int((time.time() - start_time) * 1000),
                details={"backend": backend_health, "ai_service": ai_health}
            )
            
        except Exception as e:
            return TestResult(
                "service_health",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_ticket_creation_with_ai_triage(self) -> TestResult:
        """Test ticket creation with AI triage integration"""
        start_time = time.time()
        
        try:
            ticket_data = {
                "title": "Email server down affecting multiple offices",
                "description": "The Exchange email server is completely down. Users cannot send or receive emails. Error message: 'Cannot connect to server'. This is affecting our Bangalore and Mumbai offices with approximately 500 users impacted.",
                "customerId": "test-customer-001",
                "reportedBy": "john.doe@company.com",
                "customerTier": "enterprise",
                "affectedSystems": ["Exchange Server", "Outlook"],
                "errorMessages": ["Cannot connect to server", "Connection timeout"],
                "category": "software",
                "priority": "high"
            }

            response = await self.make_request(
                "POST",
                f"{self.backend_url}/api/tickets",
                headers=self.get_headers(),
                json=ticket_data
            )

            if not response.get("success"):
                return TestResult(
                    "ticket_creation_with_ai_triage",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Ticket creation failed: {response.get('error', 'Unknown error')}"
                )

            ticket = response.get("data", {})
            ticket_id = ticket.get("id")
            
            if not ticket_id:
                return TestResult(
                    "ticket_creation_with_ai_triage",
                    False,
                    int((time.time() - start_time) * 1000),
                    "No ticket ID returned"
                )

            # Verify AI insights were applied (if AI service is working)
            ai_insights = ticket.get("aiInsights")
            
            return TestResult(
                "ticket_creation_with_ai_triage",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "ticket_id": ticket_id,
                    "ai_insights_applied": ai_insights is not None,
                    "ai_confidence": ai_insights.get("triageConfidence") if ai_insights else None,
                    "suggested_category": ai_insights.get("suggestedCategory") if ai_insights else None
                }
            )
            
        except Exception as e:
            return TestResult(
                "ticket_creation_with_ai_triage",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_sla_prediction(self, ticket_id: str) -> TestResult:
        """Test SLA prediction for a ticket"""
        start_time = time.time()
        
        try:
            response = await self.make_request(
                "GET",
                f"{self.backend_url}/api/tickets/{ticket_id}/sla-prediction",
                headers=self.get_headers()
            )

            if not response.get("success"):
                return TestResult(
                    "sla_prediction",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"SLA prediction failed: {response.get('error', 'Unknown error')}"
                )

            result = response.get("result", {})
            breach_probability = result.get("breach_probability")
            risk_level = result.get("risk_level")
            
            if breach_probability is None or risk_level is None:
                return TestResult(
                    "sla_prediction",
                    False,
                    int((time.time() - start_time) * 1000),
                    "Missing required SLA prediction fields"
                )

            return TestResult(
                "sla_prediction",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "breach_probability": breach_probability,
                    "risk_level": risk_level,
                    "estimated_completion_hours": result.get("estimated_completion_hours"),
                    "confidence_score": result.get("confidence_score")
                }
            )
            
        except Exception as e:
            return TestResult(
                "sla_prediction",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_resolution_suggestions(self, ticket_id: str) -> TestResult:
        """Test AI resolution suggestions for a ticket"""
        start_time = time.time()
        
        try:
            response = await self.make_request(
                "GET",
                f"{self.backend_url}/api/tickets/{ticket_id}/resolution-suggestions",
                headers=self.get_headers()
            )

            if not response.get("success"):
                return TestResult(
                    "resolution_suggestions",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Resolution suggestions failed: {response.get('error', 'Unknown error')}"
                )

            suggestions = response.get("suggestions", [])
            similar_tickets = response.get("similar_tickets", [])
            
            return TestResult(
                "resolution_suggestions",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "suggestion_count": len(suggestions),
                    "similar_ticket_count": len(similar_tickets),
                    "top_suggestion": suggestions[0] if suggestions else None,
                    "processing_time_ms": response.get("processing_time_ms")
                }
            )
            
        except Exception as e:
            return TestResult(
                "resolution_suggestions",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_assignment_recommendations(self, ticket_id: str) -> TestResult:
        """Test AI-powered assignment recommendations"""
        start_time = time.time()
        
        try:
            available_technicians = ["tech-001", "tech-002", "tech-003"]
            
            response = await self.make_request(
                "POST",
                f"{self.backend_url}/api/tickets/{ticket_id}/assignment-recommendations",
                headers=self.get_headers(),
                json={"availableTechnicianIds": available_technicians}
            )

            if not response.get("primary_recommendation"):
                return TestResult(
                    "assignment_recommendations",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Assignment recommendations failed: {response.get('error', 'No primary recommendation')}"
                )

            primary = response.get("primary_recommendation", {})
            alternatives = response.get("alternative_recommendations", [])
            routing_factors = response.get("routing_factors", {})
            
            return TestResult(
                "assignment_recommendations",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "recommended_technician": primary.get("technician_id"),
                    "confidence_score": primary.get("confidence_score"),
                    "alternative_count": len(alternatives),
                    "routing_factors": routing_factors
                }
            )
            
        except Exception as e:
            return TestResult(
                "assignment_recommendations",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_ticket_assignment_and_workload_analysis(self, ticket_id: str) -> TestResult:
        """Test ticket assignment with workload analysis"""
        start_time = time.time()
        
        try:
            assignment_data = {
                "technicianId": "tech-001",
                "assignedBy": "manager-001"
            }
            
            response = await self.make_request(
                "PUT",
                f"{self.backend_url}/api/tickets/{ticket_id}/assign",
                headers=self.get_headers(),
                json=assignment_data
            )

            if not response.get("success"):
                return TestResult(
                    "ticket_assignment_workload_analysis",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Ticket assignment failed: {response.get('error', 'Unknown error')}"
                )

            ticket = response.get("data", {})
            assigned_technician = ticket.get("assignedTechnicianId")
            
            if assigned_technician != "tech-001":
                return TestResult(
                    "ticket_assignment_workload_analysis",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Incorrect technician assigned: {assigned_technician}"
                )

            return TestResult(
                "ticket_assignment_workload_analysis",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "assigned_technician": assigned_technician,
                    "ticket_status": ticket.get("status")
                }
            )
            
        except Exception as e:
            return TestResult(
                "ticket_assignment_workload_analysis",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_ai_service_error_handling(self) -> TestResult:
        """Test graceful degradation when AI service fails"""
        start_time = time.time()
        
        try:
            # Create ticket when AI service might be unavailable
            ticket_data = {
                "title": "Network connectivity issues",
                "description": "Users unable to access internal applications",
                "customerId": "test-customer-001",
                "reportedBy": "jane.doe@company.com",
                "category": "network",
                "priority": "medium"
            }

            response = await self.make_request(
                "POST",
                f"{self.backend_url}/api/tickets",
                headers=self.get_headers(),
                json=ticket_data
            )

            # Ticket creation should succeed even if AI fails
            if not response.get("success"):
                return TestResult(
                    "ai_service_error_handling",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Ticket creation failed when AI unavailable: {response.get('error')}"
                )

            ticket = response.get("data", {})
            
            # Verify fallback behavior
            return TestResult(
                "ai_service_error_handling",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "ticket_created": True,
                    "ai_insights_present": "aiInsights" in ticket,
                    "fallback_category": ticket.get("category"),
                    "fallback_priority": ticket.get("priority")
                }
            )
            
        except Exception as e:
            return TestResult(
                "ai_service_error_handling",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_concurrent_ai_processing(self) -> TestResult:
        """Test concurrent AI processing performance"""
        start_time = time.time()
        
        try:
            # Create multiple tickets concurrently
            tasks = []
            for i in range(3):
                ticket_data = {
                    "title": f"Concurrent test ticket {i + 1}",
                    "description": f"Test ticket for concurrent AI processing - {i + 1}",
                    "customerId": "test-customer-001",
                    "reportedBy": f"user{i + 1}@company.com",
                    "category": "software",
                    "priority": "medium"
                }
                
                task = self.make_request(
                    "POST",
                    f"{self.backend_url}/api/tickets",
                    headers=self.get_headers(),
                    json=ticket_data
                )
                tasks.append(task)

            # Wait for all tickets to be created
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            successful_creations = 0
            for result in results:
                if isinstance(result, dict) and result.get("success"):
                    successful_creations += 1

            if successful_creations != 3:
                return TestResult(
                    "concurrent_ai_processing",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"Only {successful_creations}/3 tickets created successfully"
                )

            return TestResult(
                "concurrent_ai_processing",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "tickets_created": successful_creations,
                    "total_processing_time_ms": int((time.time() - start_time) * 1000)
                }
            )
            
        except Exception as e:
            return TestResult(
                "concurrent_ai_processing",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def test_ai_service_connectivity(self) -> TestResult:
        """Test AI service connectivity and functionality"""
        start_time = time.time()
        
        try:
            response = await self.make_request(
                "POST",
                f"{self.backend_url}/api/ai/test",
                headers=self.get_headers()
            )

            overall_status = response.get("overall_status")
            test_results = response.get("test_results", {})
            
            if overall_status not in ["all_services_operational", "partial_functionality"]:
                return TestResult(
                    "ai_service_connectivity",
                    False,
                    int((time.time() - start_time) * 1000),
                    f"AI service connectivity test failed: {overall_status}"
                )

            return TestResult(
                "ai_service_connectivity",
                True,
                int((time.time() - start_time) * 1000),
                details={
                    "overall_status": overall_status,
                    "connectivity": test_results.get("connectivity"),
                    "triage_service": test_results.get("triage_service"),
                    "sla_prediction_service": test_results.get("sla_prediction_service"),
                    "resolution_service": test_results.get("resolution_service"),
                    "response_times": test_results.get("response_times")
                }
            )
            
        except Exception as e:
            return TestResult(
                "ai_service_connectivity",
                False,
                int((time.time() - start_time) * 1000),
                str(e)
            )

    async def run_all_tests(self) -> List[TestResult]:
        """Run all integration tests"""
        print("🚀 Starting AI Workflow Integration Tests...")
        print("=" * 60)
        
        # Test 1: Service Health
        print("1️⃣  Testing service health...")
        health_result = await self.test_service_health()
        self.test_results.append(health_result)
        print(f"   {'✅' if health_result.success else '❌'} {health_result.test_name}: {health_result.duration_ms}ms")
        if not health_result.success:
            print(f"   Error: {health_result.error_message}")
            return self.test_results

        # Test 2: AI Service Connectivity
        print("2️⃣  Testing AI service connectivity...")
        connectivity_result = await self.test_ai_service_connectivity()
        self.test_results.append(connectivity_result)
        print(f"   {'✅' if connectivity_result.success else '❌'} {connectivity_result.test_name}: {connectivity_result.duration_ms}ms")

        # Test 3: Ticket Creation with AI Triage
        print("3️⃣  Testing ticket creation with AI triage...")
        creation_result = await self.test_ticket_creation_with_ai_triage()
        self.test_results.append(creation_result)
        print(f"   {'✅' if creation_result.success else '❌'} {creation_result.test_name}: {creation_result.duration_ms}ms")
        
        if not creation_result.success:
            print(f"   Error: {creation_result.error_message}")
            return self.test_results

        ticket_id = creation_result.details.get("ticket_id") if creation_result.details else None
        if not ticket_id:
            print("   ⚠️  No ticket ID available for subsequent tests")
            return self.test_results

        # Test 4: SLA Prediction
        print("4️⃣  Testing SLA prediction...")
        sla_result = await self.test_sla_prediction(ticket_id)
        self.test_results.append(sla_result)
        print(f"   {'✅' if sla_result.success else '❌'} {sla_result.test_name}: {sla_result.duration_ms}ms")

        # Test 5: Resolution Suggestions
        print("5️⃣  Testing resolution suggestions...")
        resolution_result = await self.test_resolution_suggestions(ticket_id)
        self.test_results.append(resolution_result)
        print(f"   {'✅' if resolution_result.success else '❌'} {resolution_result.test_name}: {resolution_result.duration_ms}ms")

        # Test 6: Assignment Recommendations
        print("6️⃣  Testing assignment recommendations...")
        assignment_result = await self.test_assignment_recommendations(ticket_id)
        self.test_results.append(assignment_result)
        print(f"   {'✅' if assignment_result.success else '❌'} {assignment_result.test_name}: {assignment_result.duration_ms}ms")

        # Test 7: Ticket Assignment and Workload Analysis
        print("7️⃣  Testing ticket assignment and workload analysis...")
        workload_result = await self.test_ticket_assignment_and_workload_analysis(ticket_id)
        self.test_results.append(workload_result)
        print(f"   {'✅' if workload_result.success else '❌'} {workload_result.test_name}: {workload_result.duration_ms}ms")

        # Test 8: Error Handling
        print("8️⃣  Testing AI service error handling...")
        error_handling_result = await self.test_ai_service_error_handling()
        self.test_results.append(error_handling_result)
        print(f"   {'✅' if error_handling_result.success else '❌'} {error_handling_result.test_name}: {error_handling_result.duration_ms}ms")

        # Test 9: Concurrent Processing
        print("9️⃣  Testing concurrent AI processing...")
        concurrent_result = await self.test_concurrent_ai_processing()
        self.test_results.append(concurrent_result)
        print(f"   {'✅' if concurrent_result.success else '❌'} {concurrent_result.test_name}: {concurrent_result.duration_ms}ms")

        return self.test_results

    def print_summary(self):
        """Print test summary"""
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result.success)
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        total_duration = sum(result.duration_ms for result in self.test_results)
        print(f"Total Duration: {total_duration}ms")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result.success:
                    print(f"  • {result.test_name}: {result.error_message}")
        
        print("\n🔍 DETAILED RESULTS:")
        for result in self.test_results:
            status = "✅ PASS" if result.success else "❌ FAIL"
            print(f"  {status} {result.test_name} ({result.duration_ms}ms)")
            if result.details:
                for key, value in result.details.items():
                    print(f"    - {key}: {value}")

async def main():
    """Main test runner"""
    backend_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3000"
    ai_service_url = sys.argv[2] if len(sys.argv) > 2 else "http://localhost:8001"
    
    print(f"Backend URL: {backend_url}")
    print(f"AI Service URL: {ai_service_url}")
    print()
    
    async with AIWorkflowIntegrationTester(backend_url, ai_service_url) as tester:
        results = await tester.run_all_tests()
        tester.print_summary()
        
        # Exit with error code if any tests failed
        failed_count = sum(1 for result in results if not result.success)
        sys.exit(failed_count)

if __name__ == "__main__":
    asyncio.run(main())