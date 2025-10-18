#!/bin/bash

set -e  # Exit on any error

echo "🚀 Heroku SSO Deployment for Hyperforce Runtime Platform Dashboard"
echo "=================================================================="

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Installing..."
    curl https://cli-assets.heroku.com/install.sh | sh
    echo "✅ Heroku CLI installed"
fi

echo "🔐 Heroku SSO Authentication Options:"
echo "1. Browser SSO Login (Recommended)"
echo "2. API Token Authentication"
echo "3. Interactive Login"
echo ""

# Check if already authenticated
if heroku auth:whoami &> /dev/null; then
    echo "✅ Already logged in as: $(heroku auth:whoami)"
    read -p "Continue with current user? (y/n): " continue_current
    if [ "$continue_current" != "y" ]; then
        heroku auth:logout
    fi
fi

# If not authenticated, provide options
if ! heroku auth:whoami &> /dev/null; then
    echo "Choose authentication method:"
    echo "1) Browser SSO Login (opens browser for SSO)"
    echo "2) API Token (if you have a token from dashboard)"
    echo "3) Interactive Login"
    read -p "Enter choice (1-3): " auth_choice
    
    case $auth_choice in
        1)
            echo "🌐 Opening browser for SSO login..."
            heroku login
            ;;
        2)
            echo "📝 To get your API token:"
            echo "   1. Login to https://dashboard.heroku.com via SSO"
            echo "   2. Go to Account Settings → API Key"
            echo "   3. Copy the token"
            echo ""
            read -p "Enter your API token: " api_token
            export HEROKU_API_KEY=$api_token
            ;;
        3)
            echo "📧 Enter your SSO email when prompted..."
            heroku login -i
            ;;
        *)
            echo "Invalid choice. Using browser SSO login..."
            heroku login
            ;;
    esac
    
    # Verify login worked
    if ! heroku auth:whoami &> /dev/null; then
        echo "❌ Authentication failed. Please try again."
        echo "💡 Try: heroku login --browser=chrome"
        exit 1
    fi
fi

echo "✅ Authenticated as: $(heroku auth:whoami)"

# Check if user is part of an enterprise/team
HEROKU_USER=$(heroku auth:whoami)
if [[ $HEROKU_USER == *"@salesforce.com"* ]] || [[ $HEROKU_USER == *"@heroku.com"* ]]; then
    echo "🏢 Enterprise user detected. Checking team access..."
    heroku teams --json 2>/dev/null || echo "ℹ️  No team access or personal account"
fi

# Generate unique app name
APP_NAME="hyperforce-dashboard-$(date +%Y%m%d-%H%M%S)"
echo "📱 Creating Heroku app: $APP_NAME"

# Create Heroku app
if heroku create $APP_NAME; then
    echo "✅ Created Heroku app: $APP_NAME"
else
    echo "❌ Failed to create app. Trying with random suffix..."
    APP_NAME="hrp-dashboard-$(openssl rand -hex 4)"
    heroku create $APP_NAME
    echo "✅ Created Heroku app: $APP_NAME"
fi

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set NODE_ENV=production --app $APP_NAME
heroku config:set NPM_CONFIG_PRODUCTION=false --app $APP_NAME

# Set buildpack
echo "🔨 Setting Node.js buildpack..."
heroku buildpacks:set heroku/nodejs --app $APP_NAME

# Show what will be deployed
echo "📦 Files to be deployed:"
echo "   ✅ React Dashboard (TypeScript)"
echo "   ✅ Express.js API Server"
echo "   ✅ CSV Data Files: $(ls -1 *.csv | wc -l | tr -d ' ') files"
echo "   ✅ Jupyter Notebooks: $(ls -1 *.ipynb 2>/dev/null | wc -l | tr -d ' ') files"

# Deploy
echo ""
echo "🚀 Deploying to Heroku..."
echo "⏱️  This typically takes 60-120 seconds..."
echo ""

if git push heroku main; then
    echo ""
    echo "🎉 DEPLOYMENT SUCCESSFUL!"
    echo "=================================================================="
    echo "👤 Deployed by: $(heroku auth:whoami)"
    echo "📊 Dashboard: https://$APP_NAME.herokuapp.com"
    echo "🔍 Health Check: https://$APP_NAME.herokuapp.com/api/health"
    echo "📡 API Endpoint: https://$APP_NAME.herokuapp.com/api/dashboard-data"
    echo ""
    
    # Test the deployment
    echo "🧪 Testing deployment..."
    sleep 15  # Wait for app to fully start
    
    if curl -s -f "https://$APP_NAME.herokuapp.com/api/health" > /dev/null; then
        echo "✅ Health check passed!"
        echo ""
        echo "🌐 Opening your dashboard..."
        heroku open --app $APP_NAME
        
        echo ""
        echo "📝 Management Commands:"
        echo "   heroku logs --tail --app $APP_NAME     # View logs"
        echo "   heroku restart --app $APP_NAME         # Restart app"
        echo "   heroku ps --app $APP_NAME              # Check status"
        echo "   heroku config --app $APP_NAME          # View config"
        echo "   heroku dashboard --app $APP_NAME       # Open dashboard"
        
    else
        echo "⚠️  Health check failed. Checking logs..."
        heroku logs --tail --app $APP_NAME
    fi
    
else
    echo "❌ Deployment failed. Checking logs..."
    heroku logs --app $APP_NAME
    exit 1
fi
