#!/bin/bash

set -e  # Exit on any error

echo "🚀 Netlify Git Deployment for Hyperforce Runtime Platform Dashboard"
echo "=================================================================="

# Check if Netlify CLI is installed
if ! command -v netlify &> /dev/null; then
    echo "📦 Netlify CLI not found. Installing..."
    npm install -g netlify-cli
    echo "✅ Netlify CLI installed"
fi

# Login to Netlify
echo "🔐 Logging into Netlify..."
if ! netlify status &> /dev/null; then
    netlify login
fi

echo "✅ Netlify authentication successful"

# Build the application
echo "🔨 Building application for production..."
npm run build

# Check if this is a new site or existing
if [ ! -f ".netlify/state.json" ]; then
    echo "🆕 Creating new Netlify site..."
    
    # Create new site
    netlify init --manual
    
    echo "⚙️  Configuring build settings..."
    
    # Create netlify.toml for configuration
    cat > netlify.toml << 'EOF'
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"
  NPM_VERSION = "8"

[[headers]]
  for = "/api/*"
  [headers.values]
    Access-Control-Allow-Origin = "*"
    Access-Control-Allow-Methods = "GET, POST, PUT, DELETE, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type, Authorization"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    X-Content-Type-Options = "nosniff"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend-url.herokuapp.com/api/:splat"
  status = 200
  force = true

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[functions]
  directory = "netlify/functions"
EOF

    echo "✅ Netlify configuration created"
    
else
    echo "🔄 Updating existing Netlify site..."
fi

# Deploy to Netlify
echo "🚀 Deploying to Netlify..."
netlify deploy --prod --dir=dist

# Get the site URL
SITE_URL=$(netlify status --json | jq -r '.siteUrl')

echo ""
echo "🎉 NETLIFY DEPLOYMENT SUCCESSFUL!"
echo "=================================================================="
echo "🌐 Live URL: $SITE_URL"
echo "⚙️  Admin Panel: $(netlify status --json | jq -r '.adminUrl')"
echo "📊 Dashboard: $SITE_URL"
echo ""

# Setup GitHub integration if available
if git remote get-url origin &> /dev/null; then
    echo "🔗 GitHub repository detected"
    read -p "🔄 Set up continuous deployment from GitHub? (y/n): " setup_cd
    
    if [ "$setup_cd" = "y" ]; then
        echo "📝 To enable continuous deployment:"
        echo "   1. Go to: $(netlify status --json | jq -r '.adminUrl')"
        echo "   2. Go to Site Settings → Build & Deploy"
        echo "   3. Connect to GitHub repository"
        echo "   4. Set build command: npm run build"
        echo "   5. Set publish directory: dist"
        echo ""
        echo "✅ After setup, every push to main will auto-deploy!"
    fi
fi

echo "📝 Useful Netlify commands:"
echo "   netlify status              # Check site status"
echo "   netlify open               # Open site in browser"
echo "   netlify open:admin         # Open admin panel"
echo "   netlify deploy --prod      # Manual deploy"
echo "   netlify functions:list     # List functions"
echo "   netlify logs               # View logs"
