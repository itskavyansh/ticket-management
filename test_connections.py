#!/usr/bin/env python3
"""
Connection test script to verify all services are properly connected
"""

import requests
import json
import time
from datetime import datetime

def test_backend_connection():
    """Test backend API connection"""
    try:
        response = requests.get('http://localhost:3000/health', timeout=5)
        if response.status_code == 200:
            print("✅ Backend API: Connected")
            return True
        else:
            print(f"❌ Backend API: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend API: Connection failed - {e}")
        return False

def test_ai_service_connection():
    """Test AI service connection"""
    try:
        response = requests.get('http://localhost:8001/health', timeout=5)
        if response.status_code == 200:
            print("✅ AI Service: Connected")
            return True
        else:
            print(f"❌ AI Service: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ AI Service: Connection failed - {e}")
        return False

def test_frontend_connection():
    """Test frontend connection"""
    try:
        response = requests.get('http://localhost:3001', timeout=5)
        if response.status_code == 200:
            print("✅ Frontend: Connected")
            return True
        else:
            print(f"❌ Frontend: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Frontend: Connection failed - {e}")
        return False

def test_ai_triage():
    """Test AI triage functionality"""
    try:
        payload = {
            "ticket_id": "test-001",
            "title": "Email server not responding",
            "description": "Users cannot send or receive emails since this morning",
            "customer_tier": "premium"
        }
        
        response = requests.post(
            'http://localhost:8001/ai/triage',
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if result.get('success'):
                print("✅ AI Triage: Working")
                return True
            else:
                print(f"❌ AI Triage: Failed - {result.get('error', 'Unknown error')}")
                return False
        else:
            print(f"❌ AI Triage: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ AI Triage: Connection failed - {e}")
        return False

def test_chatbot_api():
    """Test chatbot API"""
    try:
        payload = {
            "message": "Hello, can you help me with ticket management?",
            "timestamp": datetime.now().isoformat()
        }
        
        # Note: This will fail without auth token, but we can check if endpoint exists
        response = requests.post(
            'http://localhost:3000/api/ai-chatbot/message',
            json=payload,
            timeout=10
        )
        
        # 401 is expected without auth, 404 means endpoint doesn't exist
        if response.status_code in [200, 401]:
            print("✅ Chatbot API: Endpoint available")
            return True
        elif response.status_code == 404:
            print("❌ Chatbot API: Endpoint not found")
            return False
        else:
            print(f"❌ Chatbot API: HTTP {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Chatbot API: Connection failed - {e}")
        return False

def main():
    """Run all connection tests"""
    print("🔍 Testing AI Ticket Management Platform Connections")
    print("=" * 60)
    
    tests = [
        ("Backend API", test_backend_connection),
        ("AI Service", test_ai_service_connection),
        ("Frontend", test_frontend_connection),
        ("AI Triage", test_ai_triage),
        ("Chatbot API", test_chatbot_api),
    ]
    
    results = []
    for test_name, test_func in tests:
        print(f"\n🧪 Testing {test_name}...")
        result = test_func()
        results.append((test_name, result))
        time.sleep(1)  # Brief pause between tests
    
    print("\n" + "=" * 60)
    print("📊 Test Results Summary:")
    print("=" * 60)
    
    passed = 0
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name:<20} {status}")
        if result:
            passed += 1
    
    print(f"\n📈 Overall: {passed}/{len(results)} tests passed")
    
    if passed == len(results):
        print("🎉 All services are connected and working!")
    else:
        print("⚠️  Some services need attention. Check the logs above.")
        print("\n💡 Quick troubleshooting:")
        print("   • Make sure all services are running (run.py)")
        print("   • Check if ports 3000, 3001, and 8001 are available")
        print("   • Verify environment variables are set correctly")

if __name__ == "__main__":
    main()