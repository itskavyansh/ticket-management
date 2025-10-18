#!/usr/bin/env python3
"""
Simple script to start the AI Ticket Management Platform services
"""
import subprocess
import sys
import os
import time
import threading
from pathlib import Path

def run_command(command, cwd=None, name="Process"):
    """Run a command and stream output"""
    try:
        print(f"🚀 Starting {name}...")
        process = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Stream output
        for line in iter(process.stdout.readline, ''):
            if line.strip():
                print(f"[{name}] {line.strip()}")
        
        process.wait()
        if process.returncode == 0:
            print(f"✅ {name} completed successfully")
        else:
            print(f"❌ {name} failed with code {process.returncode}")
            
    except KeyboardInterrupt:
        print(f"\n⏹️  Stopping {name}...")
        process.terminate()
    except Exception as e:
        print(f"❌ Error running {name}: {str(e)}")

def start_ai_service():
    """Start the AI service"""
    ai_service_path = Path("ai-service")
    if ai_service_path.exists():
        run_command("python simple_main.py", cwd=str(ai_service_path), name="AI Service")
    else:
        print("❌ AI service directory not found")

def start_backend():
    """Start the backend service"""
    backend_path = Path("backend")
    if backend_path.exists():
        # Check if node_modules exists
        if not (backend_path / "node_modules").exists():
            print("📦 Installing backend dependencies...")
            run_command("npm install", cwd=str(backend_path), name="Backend Install")
        
        run_command("npm run dev", cwd=str(backend_path), name="Backend API")
    else:
        print("❌ Backend directory not found")

def start_frontend():
    """Start the frontend service"""
    frontend_path = Path("frontend")
    if frontend_path.exists():
        # Check if node_modules exists
        if not (frontend_path / "node_modules").exists():
            print("📦 Installing frontend dependencies...")
            run_command("npm install", cwd=str(frontend_path), name="Frontend Install")
        
        run_command("npm run dev", cwd=str(frontend_path), name="Frontend App")
    else:
        print("❌ Frontend directory not found")

def check_dependencies():
    """Check if required dependencies are available"""
    print("🔍 Checking dependencies...")
    
    # Check Node.js
    try:
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"   ✅ Node.js: {result.stdout.strip()}")
        else:
            print("   ❌ Node.js not found")
            return False
    except FileNotFoundError:
        print("   ❌ Node.js not found")
        return False
    
    # Check Python
    try:
        result = subprocess.run([sys.executable, "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"   ✅ Python: {result.stdout.strip()}")
        else:
            print("   ❌ Python not found")
            return False
    except FileNotFoundError:
        print("   ❌ Python not found")
        return False
    
    return True

def main():
    """Main function"""
    print("🎯 AI Ticket Management Platform - Service Starter")
    print("=" * 60)
    
    if not check_dependencies():
        print("\n❌ Missing required dependencies. Please install Node.js and Python.")
        return False
    
    print("\n📋 Available options:")
    print("   1. Start AI Service only")
    print("   2. Start Backend API only") 
    print("   3. Start Frontend only")
    print("   4. Start All Services (recommended)")
    print("   5. Run setup verification")
    print("   0. Exit")
    
    try:
        choice = input("\n🤔 Choose an option (1-5, 0 to exit): ").strip()
        
        if choice == "0":
            print("👋 Goodbye!")
            return True
        elif choice == "1":
            start_ai_service()
        elif choice == "2":
            start_backend()
        elif choice == "3":
            start_frontend()
        elif choice == "4":
            print("\n🚀 Starting all services...")
            print("💡 Tip: Open multiple terminals to see individual service logs")
            print("   Terminal 1: python start_services.py -> option 1 (AI Service)")
            print("   Terminal 2: python start_services.py -> option 2 (Backend)")
            print("   Terminal 3: python start_services.py -> option 3 (Frontend)")
            print("\n⏳ Starting AI Service first...")
            
            # Start AI service in a thread
            ai_thread = threading.Thread(target=start_ai_service, daemon=True)
            ai_thread.start()
            
            time.sleep(3)  # Give AI service time to start
            
            print("\n⏳ Starting Backend API...")
            start_backend()
            
        elif choice == "5":
            print("\n🔍 Running setup verification...")
            run_command("python test_setup.py", name="Setup Verification")
        else:
            print("❌ Invalid choice. Please try again.")
            return main()
            
    except KeyboardInterrupt:
        print("\n\n⏹️  Stopping services...")
        return True
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)