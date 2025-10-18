#!/bin/bash

# Deploy to Railway.app
echo "🚀 Deploying Hyperforce Runtime Platform Dashboard to Railway..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

# Login to Railway (if not already logged in)
echo "🔐 Logging into Railway..."
railway login

# Initialize project (if not already initialized)
if [ ! -f "railway.json" ]; then
    echo "📦 Initializing Railway project..."
    railway init
fi

# Deploy
echo "🚀 Deploying..."
railway up

echo "✅ Deployment complete!"
echo "🌐 Your dashboard should be live at: https://your-app.railway.app"
echo "📊 Check deployment status: railway status"
