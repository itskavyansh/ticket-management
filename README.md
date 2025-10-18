# 🎯 AI Ticket Management Platform

> Smart ticket management with AI-powered automation for IT support teams

## What does this do?

This platform helps IT support teams manage tickets more efficiently by using AI to:

- **🤖 Auto-categorize tickets** - AI reads ticket descriptions and assigns the right category/priority
- **⚠️ Predict SLA risks** - Get early warnings before tickets breach their deadlines  
- **💡 Suggest solutions** - AI recommends fixes based on similar past tickets
- **👥 Smart assignments** - Automatically assign tickets to the best available technician

## 🚀 Quick Start (One Command!)

**Prerequisites:** Make sure you have Python and Node.js installed

```bash
# 1. Get the code
git clone <this-repo>
cd ai-ticket-management-platform

# 2. Start everything (this installs dependencies and starts all services)
python run.py
```

That's it! 🎉

**Access your app:**
- 🌐 **Main App**: http://localhost:3001
- 🔧 **API**: http://localhost:3000  
- 🤖 **AI Service**: http://localhost:8001

## What's included?

```
📁 Project Structure
├── 🌐 frontend/          # React web app (what users see)
├── 🔧 backend/           # API server (handles data)  
├── 🤖 ai-service/        # AI processing (the smart stuff)
├── 🐳 docker-compose.yml # Run everything with Docker
└── 🚀 run.py            # One-command startup script
```

## Manual Setup (if you prefer)

### Option 1: Docker (Recommended)
```bash
docker-compose up
```

### Option 2: Run each service separately

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash  
cd frontend
npm install
npm run dev
```

**AI Service:**
```bash
cd ai-service
pip install -r requirements.txt
python main.py
```

## Configuration

The system works out of the box, but you can customize it:

**For AI features** - Add your Google Gemini API key to `ai-service/.env`:
```
GEMINI_API_KEY=your_api_key_here
```

**For production** - Update `backend/.env` with real database URLs

## Key Features Explained

### 🤖 AI Ticket Triage
When someone creates a ticket, AI automatically:
- Reads the title and description
- Assigns category (Hardware, Software, Network, etc.)
- Sets priority (Low, Medium, High, Critical)
- Suggests which technician should handle it

### ⚠️ SLA Risk Prediction  
The system monitors all open tickets and warns you when:
- A ticket is likely to miss its deadline
- Workload is getting too high for a technician
- Priority tickets need immediate attention

### 💡 Smart Resolution Suggestions
For each ticket, AI provides:
- Step-by-step solution guides
- Links to similar resolved tickets
- Relevant knowledge base articles
- Estimated time to resolve

### 📊 Real-time Dashboard
See at a glance:
- Total tickets and their status
- SLA compliance rates
- Technician workload
- Performance trends

## Troubleshooting

**Services won't start?**
- Make sure ports 3000, 3001, and 8001 are free
- Check you have Node.js 18+ and Python 3.11+

**AI features not working?**
- Add your Gemini API key to `ai-service/.env`
- The system works without AI, just with reduced functionality

**Need help?**
- Check the logs in your terminal
- Create an issue in this repository

## Development

**Run tests:**
```bash
# Backend
cd backend && npm test

# Frontend  
cd frontend && npm test

# AI Service
cd ai-service && pytest
```

**Code structure:**
- Frontend: React + TypeScript + Tailwind CSS
- Backend: Node.js + Express + MongoDB
- AI Service: FastAPI + Python + Google Gemini

## What's Next?

This platform is designed to grow with your needs. You can:
- Add more AI models for better predictions
- Integrate with your existing tools (Slack, Teams, etc.)
- Deploy to cloud platforms (AWS, Azure, GCP)
- Customize the UI for your brand

---

**Made with ❤️ for IT support teams who want to work smarter, not harder.**