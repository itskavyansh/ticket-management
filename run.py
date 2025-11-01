#!/usr/bin/env python3
"""
🚀 AI Ticket Management Platform - ONE COMMAND RUNNER
Run the entire project with: python run.py
"""
import subprocess
import sys
import os
import time
import threading
import signal
from pathlib import Path

# Global process list for cleanup
processes = []
stop_event = threading.Event()

def print_banner():
    """Print startup banner"""
    print("""
🎯 AI TICKET MANAGEMENT PLATFORM
================================
🤖 AI Service (Gemini)    → http://localhost:8001
🔧 Backend API (Node.js)  → http://localhost:3000  
⚛️  Frontend (React)      → http://localhost:3001
🗄️  MongoDB               → localhost:27017
🔴 Redis                  → localhost:6379

Starting all services... 🚀
""")

def run_service(command, cwd, name, color_code="37"):
    """Run a service in a separate process"""
    try:
        print(f"\033[{color_code}m🚀 Starting {name}...\033[0m")
        
        process = subprocess.Popen(
            command,
            shell=True,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        processes.append(process)
        
        # Stream output with color coding
        for line in iter(process.stdout.readline, ''):
            if stop_event.is_set():
                break
            if line.strip():
                print(f"\033[{color_code}m[{name}]\033[0m {line.strip()}")
        
        process.wait()
        
    except Exception as e:
        print(f"\033[91m❌ Error in {name}: {str(e)}\033[0m")

def install_dependencies():
    """Install all dependencies"""
    print("📦 Installing dependencies...")
    
    # Backend dependencies
    backend_path = Path("backend")
    if backend_path.exists() and not (backend_path / "node_modules").exists():
        print("   📦 Installing backend dependencies...")
        subprocess.run(["npm", "install"], cwd=str(backend_path), check=True)
        print("   ✅ Backend dependencies installed")
    
    # Frontend dependencies  
    frontend_path = Path("frontend")
    if frontend_path.exists() and not (frontend_path / "node_modules").exists():
        print("   📦 Installing frontend dependencies...")
        subprocess.run(["npm", "install"], cwd=str(frontend_path), check=True)
        print("   ✅ Frontend dependencies installed")
    
    # AI service dependencies
    ai_service_path = Path("ai-service")
    if ai_service_path.exists():
        try:
            subprocess.run([sys.executable, "-c", "import google.generativeai"], check=True)
            print("   ✅ AI service dependencies already installed")
        except subprocess.CalledProcessError:
            print("   📦 Installing AI service dependencies...")
            subprocess.run([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"], 
                         cwd=str(ai_service_path), check=True)
            print("   ✅ AI service dependencies installed")

def find_available_port(start_port, service_name):
    """Find an available port starting from start_port"""
    import socket
    
    for port in range(start_port, start_port + 10):
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        
        if result != 0:  # Port is available
            if port != start_port:
                print(f"🔄 {service_name} moved to port {port} (original port {start_port} was busy)")
            return port
    
    return None

def check_and_assign_ports():
    """Check ports and assign alternatives if needed"""
    ports = {
        "ai_service": find_available_port(8001, "AI Service"),
        "backend": find_available_port(3000, "Backend API"),
        "frontend": find_available_port(3001, "Frontend")
    }
    
    for service, port in ports.items():
        if port is None:
            print(f"❌ Could not find available port for {service}")
            return None
    
    return ports

def cleanup():
    """Clean up all processes"""
    print("\n🛑 Shutting down services...")
    stop_event.set()
    
    for process in processes:
        try:
            process.terminate()
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
        except:
            pass
    
    print("✅ All services stopped")

def signal_handler(signum, frame):
    """Handle Ctrl+C gracefully"""
    cleanup()
    sys.exit(0)

def main():
    """Main function to run everything"""
    # Set up signal handler
    signal.signal(signal.SIGINT, signal_handler)
    
    print_banner()
    
    # Check and assign available ports
    ports = check_and_assign_ports()
    if not ports:
        print("❌ Could not find available ports for all services.")
        return False
    
    try:
        # Install dependencies
        install_dependencies()
        
        print("\n🚀 Starting all services...")
        
        # Start services in separate threads with dynamic ports
        services = [
            {
                "command": f"python main.py --port {ports['ai_service']}" if ports['ai_service'] != 8001 else "python main.py",
                "cwd": "ai-service",
                "name": "AI-Service",
                "color": "36",  # Cyan
                "port": ports['ai_service']
            },
            {
                "command": f"npm run dev -- --port {ports['backend']}" if ports['backend'] != 3000 else "npm run dev",
                "cwd": "backend", 
                "name": "Backend-API",
                "color": "32",  # Green
                "port": ports['backend']
            },
            {
                "command": f"npm run dev -- --port {ports['frontend']}" if ports['frontend'] != 3001 else "npm run dev",
                "cwd": "frontend",
                "name": "Frontend-App", 
                "color": "35",  # Magenta
                "port": ports['frontend']
            }
        ]
        
        threads = []
        for service in services:
            if Path(service["cwd"]).exists():
                thread = threading.Thread(
                    target=run_service,
                    args=(service["command"], service["cwd"], service["name"], service["color"]),
                    daemon=True
                )
                thread.start()
                threads.append(thread)
                time.sleep(2)  # Stagger startup
        
        print(f"""
🎉 ALL SERVICES STARTED!

📱 Access your application:
   Frontend:  http://localhost:3001
   Backend:   http://localhost:3000/api
   AI Service: http://localhost:8001/health

💡 Tips:
   - Press Ctrl+C to stop all services
   - Check logs above for any errors

""")
        
        # Keep main thread alive
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass
            
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