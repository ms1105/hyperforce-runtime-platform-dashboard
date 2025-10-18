#!/bin/bash

set -e  # Exit on any error

echo "🚀 GitHub Deployment Setup for Hyperforce Runtime Platform Dashboard"
echo "====================================================================="

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "📦 GitHub CLI not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install gh
    else
        echo "❌ Homebrew not found. Please install GitHub CLI manually:"
        echo "   https://cli.github.com/"
        exit 1
    fi
fi

# Check if logged into GitHub
echo "🔐 Checking GitHub authentication..."
if ! gh auth status &> /dev/null; then
    echo "🌐 Logging into GitHub..."
    gh auth login
fi

echo "✅ GitHub authentication successful"

# Get repository name
REPO_NAME="hyperforce-runtime-platform-dashboard"
echo "📁 Repository name: $REPO_NAME"

# Create GitHub repository
echo "🆕 Creating GitHub repository..."
if gh repo create $REPO_NAME --public --description "Hyperforce Runtime Platform Dashboard - Comprehensive monitoring for platform costs, scaling, and operational intelligence" --confirm; then
    echo "✅ GitHub repository created successfully"
else
    echo "ℹ️  Repository might already exist, continuing..."
fi

# Add GitHub as remote origin
echo "🔗 Adding GitHub remote..."
git remote remove origin 2>/dev/null || true  # Remove if exists
gh repo set-default

# Push to GitHub
echo "⬆️  Pushing code to GitHub..."
git push -u origin main

echo ""
echo "🎉 GITHUB DEPLOYMENT SUCCESSFUL!"
echo "====================================================================="
echo "📂 Repository: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
echo "🌐 GitHub Pages: Will be available at https://$(gh api user --jq .login).github.io/$REPO_NAME"
echo ""

# Offer to set up GitHub Pages
read -p "🌐 Set up GitHub Pages for static hosting? (y/n): " setup_pages

if [ "$setup_pages" = "y" ]; then
    echo "📄 Setting up GitHub Pages..."
    
    # Enable GitHub Pages
    gh api repos/{owner}/{repo}/pages -X POST -f source.branch=main -f source.path=/dist 2>/dev/null || echo "ℹ️  Pages might already be enabled"
    
    echo "✅ GitHub Pages setup initiated"
    echo "🌐 Your dashboard will be available at: https://$(gh api user --jq .login).github.io/$REPO_NAME"
    echo "⏱️  Note: It may take a few minutes to become available"
fi

# Offer to set up GitHub Actions for auto-deployment
read -p "🔄 Set up GitHub Actions for automatic deployment? (y/n): " setup_actions

if [ "$setup_actions" = "y" ]; then
    mkdir -p .github/workflows
    cat > .github/workflows/deploy.yml << 'EOF'
name: Deploy Dashboard

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Build application
      run: npm run build
      
    - name: Deploy to GitHub Pages
      if: github.ref == 'refs/heads/main'
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
EOF
    
    git add .github/workflows/deploy.yml
    git commit -m "Add GitHub Actions workflow for automatic deployment"
    git push origin main
    
    echo "✅ GitHub Actions workflow created"
    echo "🔄 Your dashboard will now auto-deploy on every push to main branch"
fi

echo ""
echo "📝 Next Steps:"
echo "   1. View repository: gh repo view --web"
echo "   2. Clone elsewhere: git clone https://github.com/$(gh api user --jq .login)/$REPO_NAME.git"
echo "   3. Create issues: gh issue create"
echo "   4. View actions: gh run list"
echo ""
echo "🎯 Git commands for ongoing development:"
echo "   git add ."
echo "   git commit -m 'Your commit message'"
echo "   git push origin main"
