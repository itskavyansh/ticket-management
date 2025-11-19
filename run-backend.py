#!/usr/bin/env python3
"""
🚀 AI Ticket Management Platform - BACKEND ONLY RUNNER
Run only the backend with: python run-backend.py
"""
import subprocess
import sys
import os
import signal
from pathlib import Path

process = None

def print_banner():
    """Print startup banner"""
    print("""
🎯 AI TICKET MANAGEMENT PLATFORM - BACKEND
==========================================
🔧 Backend API (Node.js)  → http://localhost:3000  

Starting backend service... 🚀
""")

def install_backend_dependencies():
    """Install backend dependencies if needed"""
    backend_path = Path("backend")
    if backend_path.exists() and not (backend_path / "node_modules").exists():
        print("📦 Installing backend dependencies...")
        subprocess.run(["npm", "install"], cwd=str(backend_path), check=True)
        print("✅ Backend dependencies installed")
    else:
        print("✅ Backend dependencies already installed")

def cleanup():
    """Clean up process"""
    global process
    print("\n🛑 Shutting down backend...")
    if process:
        try:
            process.terminate()
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        except:
            pass
    print("✅ Backend stopped")

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    cleanup()
    sys.exit(0)

def main():
    """Main function to run backend"""
    global process
    
    # Set up signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    print_banner()
    
    try:
        # Install dependencies
        install_backend_dependencies()
        
        print("\n🚀 Starting backend service...")
        
        backend_path = Path("backend")
        if not backend_path.exists():
            print("❌ Backend directory not found!")
            return False
        
        # Start backend
        process = subprocess.Popen(
            ["npm", "run", "dev"],
            cwd=str(backend_path),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        print(f"""
🎉 BACKEND STARTED!

📱 Access your backend:
   Backend API: http://localhost:3000/api
   Health Check: http://localhost:3000/health

💡 Tips:
   - Press Ctrl+C to stop the backend
   - Check logs below for any errors
   - Frontend should be running separately on port 3001

""")
        
        # Stream output
        for line in iter(process.stdout.readline, ''):
            if line.strip():
                print(f"\033[32m[Backend-API]\033[0m {line.strip()}")
        
        process.wait()
            
    except KeyboardInterrupt:
        pass
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False
    finally:
        cleanup()
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
