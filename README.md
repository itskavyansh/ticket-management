# AI-Powered Ticket Management Platform

An intelligent ticket management system that leverages AI to automate ticket triage, predict SLA risks, optimize technician workloads, and provide proactive resolution suggestions for Managed Service Providers (MSPs).

## Features

- **AI Ticket Triage**: Automatic categorization and prioritization using machine learning
- **SLA Risk Prediction**: Proactive alerts for potential SLA breaches
- **Smart Workload Management**: Optimize technician assignments and capacity
- **Resolution Suggestions**: AI-powered recommendations based on historical data
- **Real-time Analytics**: Comprehensive performance dashboards and insights
- **Multi-platform Integration**: Seamless integration with SuperOps, Slack, and MS Teams

## Architecture

The platform follows a microservices architecture with:

- **Frontend**: React.js with TypeScript and Tailwind CSS
- **Backend API**: Node.js with Express and TypeScript
- **AI Service**: FastAPI with Python and Google Gemini API for ML processing
- **Database**: MongoDB for all data storage
- **Infrastructure**: AWS serverless architecture with CDK
- **Caching**: Redis for performance optimization

## 🚀 ONE COMMAND START

### Prerequisites

- Node.js 18+
- Python 3.11+
- Git

### 🔥 Super Quick Start

```bash
# 1. Clone the repository**
   ```bash
   git clone <repository-url>
   cd ai-ticket-management-platform
   ```

2. **Start with Docker Compose**
   ```bash
   # Copy environment variables
   cp backend/.env.example backend/.env
   
   # Start all services
   docker-compose up -d
   ```

3. **Access the application**
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - AI Service: http://localhost:8001
   - MongoDB: localhost:27017
   - Redis: localhost:6379

### Manual Setup

#### Backend Setup
```bash
cd backend
npm install
npm run dev
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

#### AI Service Setup
```bash
cd ai-service
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

## Project Structure

```
├── backend/                 # Node.js API server
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── frontend/               # React.js application
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── ai-service/            # FastAPI AI processing service
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
├── infrastructure/        # AWS CDK infrastructure code
│   ├── lib/
│   ├── bin/
│   └── cdk.json
├── database/             # Database initialization scripts
├── .github/workflows/    # CI/CD pipeline configuration
└── docker-compose.yml   # Local development environment
```

## Environment Variables

### Backend (.env)
```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://username:password@localhost:27017/ai_ticket_management
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_key
SUPEROPS_API_KEY=your_superops_api_key
GEMINI_API_KEY=your_gemini_api_key
SLACK_BOT_TOKEN=your_slack_bot_token
```

### AI Service
```
GEMINI_API_KEY=your_gemini_api_key
REDIS_URL=redis://localhost:6379
```

## Development Workflow

1. **Feature Development**: Create feature branches from `develop`
2. **Testing**: All tests must pass before merging
3. **Code Review**: Pull requests require approval
4. **Staging**: Merge to `develop` triggers staging deployment
5. **Production**: Merge to `main` triggers production deployment

## Testing

### Run All Tests
```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# AI service tests
cd ai-service && pytest
```

### Linting
```bash
# Backend linting
cd backend && npm run lint

# Frontend linting
cd frontend && npm run lint
```

## Deployment

### Infrastructure Deployment
```bash
cd infrastructure
npm install
npm run build
npx cdk deploy
```

### Application Deployment
The CI/CD pipeline automatically deploys:
- **Staging**: On push to `develop` branch
- **Production**: On push to `main` branch

## API Documentation

### Backend API
- Base URL: `http://localhost:3000/api`
- Health Check: `GET /health`
- API Documentation: Available after implementation

### AI Service API
- Base URL: `http://localhost:8001`
- Health Check: `GET /health`
- Endpoints: `/ai/triage`, `/ai/predict-sla`, `/ai/suggest-resolution`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions, please contact the development team or create an issue in the repository.