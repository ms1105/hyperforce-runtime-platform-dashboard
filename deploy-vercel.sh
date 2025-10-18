#!/bin/bash

set -e  # Exit on any error

echo "🚀 Vercel Git Deployment for Hyperforce Runtime Platform Dashboard"
echo "================================================================="

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Vercel CLI not found. Installing..."
    npm install -g vercel
    echo "✅ Vercel CLI installed"
fi

# Login to Vercel
echo "🔐 Logging into Vercel..."
vercel login

echo "✅ Vercel authentication successful"

# Create vercel.json configuration
echo "⚙️  Creating Vercel configuration..."
cat > vercel.json << 'EOF'
{
  "version": 2,
  "name": "hyperforce-runtime-platform-dashboard",
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node",
      "config": {
        "includeFiles": [
          "dist/**",
          "*.csv",
          "*.ipynb"
        ]
      }
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/server.js"
    },
    {
      "src": "/(.*)",
      "dest": "/dist/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "build": {
    "env": {
      "NODE_ENV": "production"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/((?!api/.*).*)",
      "destination": "/index.html"
    }
  ]
}
EOF

# Update package.json for Vercel
echo "📝 Updating package.json for Vercel compatibility..."
npm pkg set scripts.vercel-build="npm run build"

# Build the application
echo "🔨 Building application..."
npm run build

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

# Get deployment URL
VERCEL_URL=$(vercel --prod 2>&1 | grep -E "https://.*\.vercel\.app" | tail -1 | awk '{print $NF}')

echo ""
echo "🎉 VERCEL DEPLOYMENT SUCCESSFUL!"
echo "================================================================="
echo "🌐 Live URL: $VERCEL_URL"
echo "📊 Dashboard: $VERCEL_URL"
echo "🔍 Health Check: $VERCEL_URL/api/health"
echo "📡 API Endpoint: $VERCEL_URL/api/dashboard-data"
echo ""

# Setup Git integration
if git remote get-url origin &> /dev/null; then
    echo "🔗 Git repository detected"
    echo "✅ Vercel automatically enables continuous deployment from Git!"
    echo "🔄 Every push to main branch will trigger a new deployment"
    echo ""
    echo "📝 To manage deployments:"
    echo "   1. Visit: https://vercel.com/dashboard"
    echo "   2. Select your project"
    echo "   3. Configure domains, env vars, etc."
fi

echo ""
echo "📝 Useful Vercel commands:"
echo "   vercel                     # Deploy preview"
echo "   vercel --prod              # Deploy to production"
echo "   vercel ls                  # List deployments"
echo "   vercel logs                # View logs"
echo "   vercel env ls              # List environment variables"
echo "   vercel domains             # Manage domains"
echo "   vercel alias               # Manage aliases"
