# AI Ticket Management Platform - Frontend

A modern, responsive React application for managing IT support tickets with AI-powered insights.

## Features

### 🎯 Core Functionality
- **Dashboard**: Real-time KPIs, charts, and SLA alerts
- **Ticket Management**: Full CRUD operations with advanced filtering
- **Technician Management**: Team overview and workload tracking
- **Analytics**: Comprehensive performance insights and trends
- **SLA Monitoring**: Risk alerts and compliance tracking
- **Workload Management**: Resource optimization and utilization

### 🚀 Advanced Features
- **Global Search**: Cmd/Ctrl+K to search across all entities
- **Real-time Updates**: Live data via WebSocket connections
- **Bulk Operations**: Multi-ticket actions and assignments
- **AI Insights**: Smart suggestions and triage recommendations
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Notification Center**: Real-time alerts and updates

### 🎨 UI/UX Features
- **Modern Design**: Clean, professional interface
- **Dark/Light Theme**: System preference support
- **Keyboard Shortcuts**: Power user friendly
- **Loading States**: Smooth user experience
- **Error Handling**: Graceful error boundaries
- **Accessibility**: WCAG compliant components

## Tech Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **React Query** - Server state management
- **Recharts** - Data visualization
- **Socket.io** - Real-time communication
- **Date-fns** - Date manipulation
- **Lucide React** - Icon library

## Project Structure

```
src/
├── components/           # Reusable UI components
│   ├── common/          # Shared components
│   ├── dashboard/       # Dashboard-specific components
│   └── tickets/         # Ticket-related components
├── hooks/               # Custom React hooks
├── pages/               # Route components
├── services/            # API and external services
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues

## Environment Variables

```env
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=ws://localhost:3001
```

## Key Components

### Dashboard
- **KPIWidget**: Displays key performance indicators
- **TicketTrendsChart**: Shows ticket volume trends
- **SLAAlertPanel**: Critical SLA risk alerts
- **CategoryDistributionChart**: Ticket category breakdown
- **RealTimeIndicator**: Connection status indicator

### Tickets
- **TicketList**: Paginated ticket listing with filters
- **TicketDetail**: Comprehensive ticket view with comments
- **BulkOperations**: Multi-ticket management modal

### Layout
- **GlobalSearch**: Universal search with keyboard shortcuts
- **NotificationCenter**: Real-time notification system
- **Navigation**: Responsive sidebar navigation

## State Management

The application uses React Query for server state management:

- **Queries**: Data fetching with caching and background updates
- **Mutations**: Optimistic updates for better UX
- **Real-time**: WebSocket integration for live updates

## Styling

Tailwind CSS with custom component classes:

```css
.btn-primary     /* Primary button style */
.btn-secondary   /* Secondary button style */
.card           /* Card container */
.badge          /* Status badges */
.status-*       /* Status-specific styles */
.priority-*     /* Priority-specific styles */
```

## API Integration

The frontend integrates with the backend API:

- **REST API**: Standard CRUD operations
- **WebSocket**: Real-time updates
- **Mock Data**: Development fallback

## Testing

- **Vitest**: Fast unit testing
- **Testing Library**: Component testing
- **MSW**: API mocking for tests

## Performance

- **Code Splitting**: Route-based lazy loading
- **Image Optimization**: Responsive images
- **Bundle Analysis**: Webpack bundle analyzer
- **Caching**: React Query caching strategies

## Accessibility

- **ARIA Labels**: Screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Color Contrast**: WCAG AA compliance
- **Focus Management**: Proper focus handling

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style
2. Add TypeScript types for new features
3. Include tests for new components
4. Update documentation as needed

## Deployment

Build the application:
```bash
npm run build
```

The `dist/` folder contains the production build ready for deployment.

## License

MIT License - see LICENSE file for details