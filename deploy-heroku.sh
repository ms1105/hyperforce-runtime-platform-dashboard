#!/bin/bash

echo "🚀 Deploying Hyperforce Runtime Platform Dashboard to Heroku..."

# Check if already logged in
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged into Heroku. Please run: heroku login"
    exit 1
fi

# Create Heroku app (you can change the name)
echo "📦 Creating Heroku app..."
heroku create hyperforce-runtime-dashboard-$(date +%s)

# Set environment variables
echo "🔧 Setting environment variables..."
heroku config:set NODE_ENV=production
heroku config:set NPM_CONFIG_PRODUCTION=false

# Add Node.js buildpack
echo "🔨 Adding Node.js buildpack..."
heroku buildpacks:set heroku/nodejs

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git push heroku main

# Open the app
echo "🌐 Opening your deployed app..."
heroku open

echo "✅ Deployment complete!"
echo "📊 Dashboard URL: $(heroku info -s | grep web_url | cut -d= -f2)"
echo "📝 View logs: heroku logs --tail"
echo "⚙️  Manage app: heroku dashboard"
