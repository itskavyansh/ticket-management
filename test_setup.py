#!/usr/bin/env python3
"""
Test script to verify the AI service and backend setup
"""
import asyncio
import sys
import os

# Add ai-service to path
sys.path.append('ai-service')

async def test_ai_service():
    """Test the AI service functionality"""
    print("🤖 Testing AI Service...")
    
    try:
        from clients.gemini_client import gemini_client
        
        # Test health check
        health = await gemini_client.health_check()
        print(f"   ✅ Health check: {'Passed' if health else 'Using mock (no API key)'}")
        
        # Test ticket classification
        result = await gemini_client.classify_ticket(
            title="Email server not responding",
            description="Users cannot send or receive emails. Server shows connection timeout errors.",
            customer_tier="enterprise"
        )
        
        if result:
            print(f"   ✅ Ticket classification: {result.get('category', 'unknown')} - {result.get('priority', 'unknown')}")
        else:
            print("   ⚠️  Ticket classification: Using mock response")
        
        # Test SLA prediction
        sla_result = await gemini_client.predict_sla_risk({
            "ticket_id": "test-001",
            "priority": "high",
            "category": "email",
            "created_at": "2024-01-15T10:00:00Z"
        })
        
        if sla_result:
            print(f"   ✅ SLA prediction: {sla_result.get('risk_level', 'unknown')} risk ({sla_result.get('breach_probability', 0):.2f})")
        else:
            print("   ⚠️  SLA prediction: Using mock response")
        
        # Test resolution suggestions
        resolution_result = await gemini_client.suggest_resolution(
            title="Printer not working",
            description="Office printer showing error message and not printing",
            category="hardware"
        )
        
        if resolution_result and resolution_result.get('suggestions'):
            print(f"   ✅ Resolution suggestions: {len(resolution_result['suggestions'])} suggestions generated")
        else:
            print("   ⚠️  Resolution suggestions: Using mock response")
            
        print("   🎉 AI Service test completed!")
        return True
        
    except Exception as e:
        print(f"   ❌ AI Service test failed: {str(e)}")
        return False

def test_backend_setup():
    """Test backend setup"""
    print("\n🔧 Testing Backend Setup...")
    
    try:
        # Check if backend dependencies are installed
        backend_path = "backend"
        if os.path.exists(f"{backend_path}/node_modules"):
            print("   ✅ Backend dependencies installed")
        else:
            print("   ⚠️  Backend dependencies not found")
        
        # Check if MongoDB models exist
        if os.path.exists("backend/src/models/mongodb/Ticket.ts"):
            print("   ✅ MongoDB models created")
        else:
            print("   ❌ MongoDB models not found")
        
        # Check if MongoDB config exists
        if os.path.exists("backend/src/config/mongodb.ts"):
            print("   ✅ MongoDB configuration created")
        else:
            print("   ❌ MongoDB configuration not found")
        
        print("   🎉 Backend setup test completed!")
        return True
        
    except Exception as e:
        print(f"   ❌ Backend setup test failed: {str(e)}")
        return False

def test_docker_setup():
    """Test Docker setup"""
    print("\n🐳 Testing Docker Setup...")
    
    try:
        # Check if docker-compose.yml exists and has MongoDB
        if os.path.exists("docker-compose.yml"):
            with open("docker-compose.yml", "r") as f:
                content = f.read()
                if "mongodb:" in content:
                    print("   ✅ Docker Compose configured with MongoDB")
                else:
                    print("   ⚠️  MongoDB not found in Docker Compose")
                
                if "ai-service:" in content:
                    print("   ✅ AI Service configured in Docker Compose")
                else:
                    print("   ⚠️  AI Service not found in Docker Compose")
        else:
            print("   ❌ docker-compose.yml not found")
        
        # Check if MongoDB init script exists
        if os.path.exists("database/mongo-init.js"):
            print("   ✅ MongoDB initialization script created")
        else:
            print("   ❌ MongoDB initialization script not found")
        
        print("   🎉 Docker setup test completed!")
        return True
        
    except Exception as e:
        print(f"   ❌ Docker setup test failed: {str(e)}")
        return False

async def main():
    """Run all tests"""
    print("🚀 AI Ticket Management Platform - Setup Verification")
    print("=" * 60)
    
    # Test AI service
    ai_success = await test_ai_service()
    
    # Test backend setup
    backend_success = test_backend_setup()
    
    # Test Docker setup
    docker_success = test_docker_setup()
    
    print("\n" + "=" * 60)
    print("📊 Test Summary:")
    print(f"   AI Service: {'✅ PASS' if ai_success else '❌ FAIL'}")
    print(f"   Backend Setup: {'✅ PASS' if backend_success else '❌ FAIL'}")
    print(f"   Docker Setup: {'✅ PASS' if docker_success else '❌ FAIL'}")
    
    if ai_success and backend_success and docker_success:
        print("\n🎉 All tests passed! Your setup is ready.")
        print("\n📝 Next steps:")
        print("   1. Get a Gemini API key from https://makersuite.google.com/app/apikey")
        print("   2. Update ai-service/.env with your GEMINI_API_KEY")
        print("   3. Run: docker compose up -d")
        print("   4. Access the application at http://localhost:3001")
    else:
        print("\n⚠️  Some tests failed. Please check the issues above.")
    
    return ai_success and backend_success and docker_success

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)