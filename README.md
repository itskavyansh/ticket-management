# 🎯 AI Ticket Management Platform

**Smart IT support with AI automation - Get tickets resolved faster with intelligent assistance**

## What is this?

An AI-powered help desk system that makes IT support teams more efficient by:

- **🤖 Automatically sorting tickets** - AI reads descriptions and assigns categories/priorities instantly
- **⚠️ Preventing SLA breaches** - Early warnings before deadlines are missed
- **💡 Suggesting solutions** - AI recommends fixes from past similar tickets
- **👥 Smart technician matching** - Assigns tickets to the best available person
- **📊 Real-time insights** - Live dashboard showing team performance and workload

## 🚀 Get Started in 30 Seconds

**What you need:** Python 3.11+ and Node.js 18+

```bash
# 1. Download the code
git clone <this-repo>
cd ai-ticket-management-platform

# 2. Start everything with one command
python run.py
```

**That's it!** 🎉 Open your browser to:
- **Main App**: http://localhost:3001
- **API Docs**: http://localhost:3000/api
- **AI Service**: http://localhost:8001/health

## 📱 What You'll See

### Dashboard
- Live ticket counts and status updates
- SLA compliance tracking
- Team workload distribution
- Performance metrics and trends

### Ticket Management
- Create, view, and manage all tickets
- AI automatically categorizes new tickets
- Bulk operations for multiple tickets
- Real-time status updates

### AI Features
- **Smart Triage**: AI reads ticket content and assigns category/priority
- **SLA Predictions**: Get warnings before tickets breach deadlines
- **Solution Suggestions**: AI recommends fixes based on similar past tickets
- **Workload Optimization**: Automatically assign tickets to best technician

### Analytics
- Team performance insights
- Resolution time trends
- Category distribution analysis
- Productivity recommendations

## 🛠️ How It Works

```
📁 Simple Architecture
├── 🌐 Frontend (React)     → What users interact with
├── 🔧 Backend (Node.js)    → Handles data and business logic
├── 🤖 AI Service (Python)  → Processes tickets with AI
└── 🗄️ Database (MongoDB)   → Stores all your data
```

**The AI Magic:**
1. **New ticket created** → AI reads title/description
2. **Auto-categorization** → Assigns category, priority, technician
3. **SLA monitoring** → Tracks deadlines and predicts risks
4. **Solution suggestions** → Recommends fixes from knowledge base
5. **Performance tracking** → Analyzes team efficiency

## ⚙️ Configuration (Optional)

The system works immediately, but you can enhance it:

### Enable Advanced AI Features
Add your Google Gemini API key to `ai-service/.env`:
```env
GEMINI_API_KEY=your_api_key_here
```

### Connect Your Database
Update `backend/.env` with your MongoDB connection:
```env
MONGODB_URI=your_mongodb_connection_string
```

### Integrate with Your Tools
Configure Slack/Teams notifications in `backend/.env`:
```env
SLACK_BOT_TOKEN=your_slack_token
TEAMS_WEBHOOK_URL=your_teams_webhook
```

## 🔧 Alternative Setup Methods

### Using Docker (Easiest)
```bash
docker-compose up
```

### Manual Setup (More Control)
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend  
cd frontend && npm install && npm run dev

# AI Service
cd ai-service && pip install -r requirements.txt && python main.py
```

### Platform-Specific
- **Windows**: Double-click `run.bat`
- **Mac/Linux**: Run `./run.sh`

## 🆘 Common Issues

**"Services won't start"**
- Check ports 3000, 3001, 8001 are available
- Ensure Python 3.11+ and Node.js 18+ are installed
- Try running `python run.py` again

**"AI features not working"**
- Add your Gemini API key to `ai-service/.env`
- System works without AI, just with basic functionality

**"Database connection failed"**
- MongoDB will auto-connect to cloud database
- For local setup, install MongoDB locally

**"Port already in use"**
- Close other applications using ports 3000, 3001, 8001
- Or modify ports in the configuration files

## 🎯 Key Features in Detail

### 🤖 AI Ticket Triage
- **Automatic categorization**: Hardware, Software, Network, Security, etc.
- **Priority assignment**: Critical, High, Medium, Low based on content
- **Technician matching**: Assigns based on skills and current workload
- **Confidence scoring**: Shows how certain the AI is about its decisions

### ⚠️ SLA Management
- **Breach prediction**: AI predicts which tickets might miss deadlines
- **Risk scoring**: Color-coded alerts (Green, Yellow, Red)
- **Automatic escalation**: Escalates high-risk tickets to managers
- **Real-time monitoring**: Live updates on all SLA statuses

### 💡 Smart Suggestions
- **Solution recommendations**: Based on similar resolved tickets
- **Knowledge base integration**: Pulls relevant documentation
- **Step-by-step guides**: Detailed resolution instructions
- **Success probability**: Shows likelihood of suggested solutions working

### 📊 Analytics & Insights
- **Performance metrics**: Resolution times, ticket volumes, success rates
- **Team analytics**: Individual and group performance tracking
- **Trend analysis**: Identify patterns and bottlenecks
- **Predictive insights**: Forecast workload and capacity needs

## 🚀 What's Next?

This platform is built to scale with your team:

- **Add integrations**: Connect to ServiceNow, Jira, Zendesk
- **Custom AI models**: Train on your specific data
- **Mobile app**: iOS/Android apps for technicians
- **Advanced analytics**: Machine learning insights
- **Multi-tenant**: Support multiple organizations

## 🏗️ Built With

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB
- **AI**: Python, FastAPI, Google Gemini
- **Infrastructure**: Docker, AWS-ready

## 📞 Support

- **Documentation**: Check the code comments and API docs
- **Issues**: Create a GitHub issue for bugs or questions
- **Community**: Join our discussions for tips and best practices

---

**🎉 Ready to transform your IT support? Start with `python run.py` and see the magic happen!**