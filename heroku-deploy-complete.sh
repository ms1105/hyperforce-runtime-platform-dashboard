#!/bin/bash

set -e  # Exit on any error

echo "🚀 Complete Heroku Deployment for Hyperforce Runtime Platform Dashboard"
echo "=================================================================="

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Installing..."
    curl https://cli-assets.heroku.com/install.sh | sh
    echo "✅ Heroku CLI installed"
fi

# Check if logged in
echo "🔐 Checking Heroku authentication..."
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged into Heroku"
    echo "🌐 Opening browser for Heroku login..."
    heroku login
    
    # Verify login worked
    if ! heroku auth:whoami &> /dev/null; then
        echo "❌ Login failed. Please try again."
        exit 1
    fi
fi

echo "✅ Logged in as: $(heroku auth:whoami)"

# Generate unique app name
APP_NAME="hyperforce-dashboard-$(date +%Y%m%d-%H%M%S)"
echo "📱 Creating Heroku app: $APP_NAME"

# Create Heroku app
heroku create $APP_NAME

if [ $? -ne 0 ]; then
    echo "❌ Failed to create Heroku app. Trying with different name..."
    APP_NAME="hrp-dashboard-$(openssl rand -hex 4)"
    heroku create $APP_NAME
fi

echo "✅ Created Heroku app: $APP_NAME"

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set NPM_CONFIG_PRODUCTION=false --app $APP_NAME
heroku config:set PORT=\$PORT --app $APP_NAME

# Set buildpack
echo "🔨 Setting Node.js buildpack..."
heroku buildpacks:set heroku/nodejs --app $APP_NAME

# Deploy
echo "🚀 Deploying to Heroku..."
echo "This may take 2-3 minutes..."

git push heroku main

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "=================================================================="
    echo "📊 Dashboard URL: https://$APP_NAME.herokuapp.com"
    echo "🔍 Health Check: https://$APP_NAME.herokuapp.com/api/health"
    echo "📡 API Endpoint: https://$APP_NAME.herokuapp.com/api/dashboard-data"
    echo ""
    echo "📝 Useful commands:"
    echo "   heroku logs --tail --app $APP_NAME    # View logs"
    echo "   heroku restart --app $APP_NAME        # Restart app"
    echo "   heroku ps --app $APP_NAME             # Check status"
    echo "   heroku dashboard --app $APP_NAME      # Open dashboard"
    echo ""
    
    # Test the deployment
    echo "🧪 Testing deployment..."
    sleep 10  # Wait for app to start
    
    if curl -s -f "https://$APP_NAME.herokuapp.com/api/health" > /dev/null; then
        echo "✅ Health check passed!"
        echo "🌐 Opening your deployed dashboard..."
        heroku open --app $APP_NAME
    else
        echo "⚠️  Health check failed. Checking logs..."
        heroku logs --tail --app $APP_NAME
    fi
    
else
    echo "❌ Deployment failed. Checking logs..."
    heroku logs --tail --app $APP_NAME
    exit 1
fi
