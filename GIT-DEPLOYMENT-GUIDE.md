# 🚀 Git-Based Deployment Guide

## 📋 Available Git Deployment Options

Your Hyperforce Runtime Platform Dashboard can be deployed using various Git-based platforms:

| Platform | Type | Cost | Best For | Auto-Deploy |
|----------|------|------|----------|-------------|
| **GitHub Pages** | Static | Free | Open source projects | ✅ |
| **Netlify** | Full-stack | Free tier | Modern web apps | ✅ |
| **Vercel** | Full-stack | Free tier | React/Next.js apps | ✅ |
| **GitLab Pages** | Static | Free | GitLab projects | ✅ |

## 🎯 Quick Deploy Commands

### Option 1: GitHub + GitHub Pages
```bash
./deploy-github.sh
```
**Features:**
- ✅ Version control on GitHub
- ✅ GitHub Pages hosting
- ✅ GitHub Actions CI/CD
- ✅ Free for public repos

### Option 2: Netlify (Recommended for Full-stack)
```bash
./deploy-netlify.sh
```
**Features:**
- ✅ Full-stack hosting (frontend + API)
- ✅ Continuous deployment from Git
- ✅ Custom domains
- ✅ Built-in CDN

### Option 3: Vercel (Recommended for React)
```bash
./deploy-vercel.sh
```
**Features:**
- ✅ Optimized for React/Node.js
- ✅ Automatic Git integration
- ✅ Edge functions
- ✅ Built-in analytics

## 📝 Manual Git Setup

### 1. Push to GitHub
```bash
# Install GitHub CLI if needed
brew install gh

# Login to GitHub
gh auth login

# Create repository and push
gh repo create hyperforce-runtime-platform-dashboard --public
git remote add origin https://github.com/USERNAME/hyperforce-runtime-platform-dashboard.git
git push -u origin main
```

### 2. Push to GitLab
```bash
# Create new project on GitLab.com
# Then push to GitLab
git remote add gitlab https://gitlab.com/USERNAME/hyperforce-runtime-platform-dashboard.git
git push -u gitlab main
```

### 3. Push to Bitbucket
```bash
# Create new repository on Bitbucket
# Then push to Bitbucket
git remote add bitbucket https://bitbucket.org/USERNAME/hyperforce-runtime-platform-dashboard.git
git push -u bitbucket main
```

## 🔄 Continuous Deployment Setup

### GitHub Actions (Auto-deploy to any platform)
```yaml
# .github/workflows/deploy.yml
name: Deploy Dashboard

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - uses: actions/setup-node@v3
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run build
    - run: npm run test --if-present
    
    # Deploy to multiple platforms
    - name: Deploy to Netlify
      run: npx netlify-cli deploy --prod --dir=dist
      env:
        NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
        NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### GitLab CI/CD
```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

variables:
  NODE_VERSION: "18"

build:
  stage: build
  image: node:18
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - echo "Deploying to production"
  only:
    - main
```

## 🏗️ Build Configuration

### For Static Hosting (GitHub Pages)
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "build:static": "tsc && vite build --base=./",
    "preview": "vite preview"
  }
}
```

### For Full-stack Hosting (Netlify/Vercel)
```json
{
  "scripts": {
    "build": "tsc && vite build",
    "start": "node server.js",
    "dev": "vite"
  }
}
```

## 🔧 Platform-Specific Configurations

### Netlify Configuration (`netlify.toml`)
```toml
[build]
  publish = "dist"
  command = "npm run build"

[[redirects]]
  from = "/api/*"
  to = "https://your-backend.herokuapp.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Vercel Configuration (`vercel.json`)
```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/node"
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
  ]
}
```

## 🌐 Custom Domain Setup

### GitHub Pages
1. Go to Settings → Pages
2. Add custom domain
3. Enable HTTPS

### Netlify
```bash
netlify domains:add yourdomain.com
```

### Vercel
```bash
vercel domains add yourdomain.com
```

## 📊 Monitoring & Analytics

### GitHub Actions Status
```bash
gh run list
gh run view [run-id]
```

### Netlify Analytics
- Built-in analytics dashboard
- Real-time deployment logs
- Performance monitoring

### Vercel Analytics
```bash
vercel logs
vercel list
```

## 🔒 Environment Variables

### For Production Deployments
```bash
# Netlify
netlify env:set NODE_ENV production
netlify env:set API_BASE_URL https://api.yourdomain.com

# Vercel
vercel env add NODE_ENV production
vercel env add API_BASE_URL https://api.yourdomain.com

# GitHub Actions
# Add secrets in repository settings
```

## 🚨 Troubleshooting

### Common Issues

1. **Build fails on deployment platform:**
   ```bash
   # Check Node.js version
   node --version
   # Update package.json engines field
   ```

2. **API routes not working:**
   - Check platform-specific routing configuration
   - Verify environment variables
   - Check CORS settings

3. **Static assets not loading:**
   - Update Vite base path for static hosting
   - Check build output directory

### Debug Commands
```bash
# Local build test
npm run build && npm run preview

# Check deployment logs
netlify logs
vercel logs
gh run view --log
```

## 📈 Best Practices

1. **Branch Protection:**
   ```bash
   gh api repos/{owner}/{repo}/branches/main/protection \
     --method PUT \
     --field required_status_checks='{}' \
     --field enforce_admins=true
   ```

2. **Semantic Versioning:**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

3. **Automated Testing:**
   - Add tests to CI/CD pipeline
   - Use staging deployments
   - Monitor deployment health

## 🎉 Quick Start Summary

**To deploy to Git right now:**

1. **GitHub (Easiest):**
   ```bash
   ./deploy-github.sh
   ```

2. **Netlify (Full-stack):**
   ```bash
   ./deploy-netlify.sh
   ```

3. **Vercel (React-optimized):**
   ```bash
   ./deploy-vercel.sh
   ```

Each script handles authentication, repository creation, and deployment automatically! 🚀
