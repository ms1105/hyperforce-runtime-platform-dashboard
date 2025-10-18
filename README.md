# Hyperforce Runtime Platform Dashboard

A comprehensive dashboard for monitoring platform costs, realized savings, optimization opportunities, and operational intelligence for the Hyperforce Runtime Platform.

## Features

### Cost to Serve Dashboard
- **Platform Cost Growth**: Monitor current platform costs with growth trends
- **Actual Cost Savings**: Track realized monthly and yearly savings from various optimization sources
- **Potential Cost Savings**: Identify opportunities for additional cost reduction
- **Projected Cost Savings**: View confidence-based projections for future savings initiatives
- **Projected Cost Increase**: Understand expected cost growth drivers

### HRP 360 Dashboard
- **Autoscaling Effectiveness**: Monitor CPU/memory utilization, response times, and scaling events
- **VPA Adoption**: Track Vertical Pod Autoscaler adoption across services
- **Karpenter Rollout Coverage**: Monitor Karpenter deployment progress across clusters
- **Bin-Packing Posture**: Optimize resource utilization and reduce waste
- **3AZ Posture**: Ensure multi-availability zone coverage for high availability

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite
- **Backend**: Node.js with Express
- **Development**: Hot reload and live data updates

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the project directory:
   ```bash
   cd "Hyperforce Runtime Platform"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the React application:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm run server
   ```

   Or for development with hot reload:
   ```bash
   # Terminal 1 - Start the backend server
   npm run server

   # Terminal 2 - Start the frontend dev server
   npm run dev
   ```

5. Open your browser and navigate to:
   - Production: `http://localhost:3001`
   - Development: `http://localhost:3000` (frontend) + `http://localhost:3001` (backend)

## API Endpoints

- `GET /api/dashboard-data` - Returns all dashboard metrics and data
- `GET /api/health` - Health check endpoint

## Dashboard Sections

### Cost Metrics
- Platform cost growth with month-over-month trends
- Actual savings from VPA optimization, spot instances, and right-sizing
- Potential savings from unused resources and over-provisioning
- Projected savings from AI-driven scaling and storage tiering
- Cost increase projections from traffic growth and new features

### Runtime Scale & Availability
- **Autoscaling**: CPU/memory utilization, response times, scaling events
- **VPA Adoption**: Opt-in rates and service coverage
- **Karpenter**: Rollout progress across Kubernetes clusters
- **Bin-Packing**: Resource efficiency and waste reduction
- **Multi-AZ**: Service distribution across availability zones

## Development

### Project Structure

```
src/
├── components/
│   ├── MetricCard.tsx    # Reusable metric display component
│   └── ProgressBar.tsx   # Progress bar component
├── App.tsx               # Main application component
├── main.tsx             # Application entry point
└── index.css            # Global styles and Tailwind imports
```

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build production bundle
- `npm run preview` - Preview production build
- `npm run server` - Start Express server
- `npm run lint` - Run ESLint

### Customization

The dashboard uses mock data by default. To integrate with real data sources:

1. Update the API endpoints in `server.js`
2. Modify the data structure in `src/App.tsx` to match your data source
3. Adjust the dashboard layout and metrics as needed

## Features

- **Real-time Updates**: Data refreshes every 30 seconds
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Interactive Metrics**: Hover effects and progress indicators
- **Live Data**: Simulated live data with realistic variations
- **Modern UI**: Clean, professional interface with Tailwind CSS

## Deployment

The application is production-ready and can be deployed to:

- Heroku
- Vercel
- Railway
- AWS, GCP, or Azure
- Docker containers

For production deployment, ensure you:
1. Set the appropriate `PORT` environment variable
2. Configure your data sources
3. Set up proper monitoring and logging
4. Enable HTTPS

## License

This project is part of the AI Projects workspace.
