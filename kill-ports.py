#!/usr/bin/env python3
"""
Kill processes running on specific ports
"""
import subprocess
import sys
import os

def kill_port(port):
    """Kill process running on a specific port"""
    try:
        if os.name == 'nt':  # Windows
            # Find process using the port
            result = subprocess.run(
                f'netstat -ano | findstr :{port}',
                shell=True,
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                lines = result.stdout.strip().split('\n')
                for line in lines:
                    if f':{port}' in line and 'LISTENING' in line:
                        parts = line.split()
                        if len(parts) >= 5:
                            pid = parts[-1]
                            print(f"🔪 Killing process {pid} on port {port}")
                            subprocess.run(f'taskkill /F /PID {pid}', shell=True)
                            return True
        else:  # Unix/Linux/Mac
            result = subprocess.run(
                f'lsof -ti:{port}',
                shell=True,
                capture_output=True,
                text=True
            )
            
            if result.stdout:
                pid = result.stdout.strip()
                print(f"🔪 Killing process {pid} on port {port}")
                subprocess.run(f'kill -9 {pid}', shell=True)
                return True
                
    except Exception as e:
        print(f"❌ Error killing port {port}: {e}")
    
    return False

def main():
    """Kill common development ports"""
    ports = [3000, 3001, 8001]
    
    print("🔪 KILLING DEVELOPMENT PORTS")
    print("=" * 30)
    
    killed_any = False
    for port in ports:
        if kill_port(port):
            killed_any = True
        else:
            print(f"✅ Port {port} is free")
    
    if killed_any:
        print("\n🎉 Ports cleared! You can now run: python run.py")
    else:
        print("\n✅ All ports are already free!")

if __name__ == "__main__":
    main()