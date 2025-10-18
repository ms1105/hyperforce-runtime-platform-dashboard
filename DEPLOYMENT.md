# 🚀 Production Deployment Guide

This guide covers multiple deployment options for the Hyperforce Runtime Platform Dashboard.

## 📋 Pre-Deployment Checklist

- [ ] Application builds successfully (`npm run build`)
- [ ] All tests pass
- [ ] Environment variables configured
- [ ] CSV data files included in deployment
- [ ] Health check endpoint working (`/api/health`)

## 🎯 Deployment Options

### Option 1: Railway (Recommended - Easiest)

**⚡ One-click deployment:**

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Deploy using script:**
   ```bash
   ./deploy-railway.sh
   ```

3. **Manual deployment:**
   ```bash
   railway login
   railway init
   railway up
   ```

**🔧 Railway Configuration:**
- Build Command: `npm run build`
- Start Command: `npm run server`
- Port: `3001` (auto-detected)
- Health Check: `/api/health`

### Option 2: Heroku

1. **Install Heroku CLI:**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Or download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Deploy:**
   ```bash
   heroku create your-dashboard-name
   git add .
   git commit -m "Deploy to production"
   git push heroku main
   ```

3. **Set environment variables:**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set PORT=3001
   ```

### Option 3: Docker Deployment

1. **Build Docker image:**
   ```bash
   docker build -t hyperforce-dashboard .
   ```

2. **Run container:**
   ```bash
   docker run -p 3001:3001 hyperforce-dashboard
   ```

3. **Deploy to container registry:**
   ```bash
   # AWS ECR
   aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin YOUR_ACCOUNT.dkr.ecr.us-west-2.amazonaws.com
   docker tag hyperforce-dashboard:latest YOUR_ACCOUNT.dkr.ecr.us-west-2.amazonaws.com/hyperforce-dashboard:latest
   docker push YOUR_ACCOUNT.dkr.ecr.us-west-2.amazonaws.com/hyperforce-dashboard:latest
   ```

### Option 4: Vercel (Frontend-only)

⚠️ **Note:** This deploys only the frontend. You'll need separate backend deployment.

```bash
npm install -g vercel
vercel
```

### Option 5: Netlify (Frontend-only)

1. **Build the app:**
   ```bash
   npm run build
   ```

2. **Deploy:**
   ```bash
   npm install -g netlify-cli
   netlify deploy --prod --dir=dist
   ```

### Option 6: AWS/GCP/Azure

#### AWS (using Elastic Beanstalk)
```bash
# Install EB CLI
pip install awsebcli

# Initialize and deploy
eb init
eb create production
eb deploy
```

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# Production settings
NODE_ENV=production
PORT=3001

# Optional: Custom data sources
CSV_DATA_PATH=/app/data/
API_BASE_URL=https://your-api.com
```

### CSV Data Files
Ensure these files are included in your deployment:
- `Summary_ Gaps by Exec_Svc.csv`
- `fkp_adoption.csv`
- `Karpenter Enable vs Disable.csv`
- `karpenter enabled cluster list.csv`
- Jupyter notebook files (`.ipynb`)

## 🔍 Health Checks & Monitoring

### Health Check Endpoint
```
GET /api/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

### Monitoring Setup

1. **Set up uptime monitoring:**
   - UptimeRobot: `https://your-domain.com/api/health`
   - Pingdom
   - StatusPage

2. **Application Performance Monitoring:**
   - New Relic
   - DataDog
   - Sentry

## 🔐 Security Considerations

### HTTPS Setup
```javascript
// In server.js for HTTPS redirect
if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
  res.redirect(`https://${req.header('host')}${req.url}`);
}
```

### CORS Configuration
```javascript
// Update CORS for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : '*'
}));
```

## 🚀 Quick Start Commands

### Railway (Recommended)
```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

### Docker
```bash
docker build -t hyperforce-dashboard .
docker run -p 3001:3001 hyperforce-dashboard
```

### Local Production Test
```bash
NODE_ENV=production npm run start
```

## 📈 Performance Optimization

### Production Optimizations Applied
- ✅ React production build
- ✅ TypeScript compilation
- ✅ Tailwind CSS purging
- ✅ Asset compression (Vite)
- ✅ Express.js with gzip compression

### Additional Optimizations
```javascript
// Add to server.js
import compression from 'compression';
app.use(compression());
```

## 🔧 Troubleshooting

### Common Issues

1. **Port binding error:**
   ```bash
   # Make sure PORT environment variable is set
   export PORT=3001
   ```

2. **CSV files not found:**
   ```bash
   # Ensure CSV files are in the correct directory
   ls -la *.csv
   ```

3. **Build failures:**
   ```bash
   # Clear cache and rebuild
   rm -rf node_modules dist
   npm install
   npm run build
   ```

### Debug Mode
```bash
DEBUG=* npm run server
```

## 📞 Support

- **Application Health:** `https://your-domain.com/api/health`
- **Dashboard:** `https://your-domain.com`
- **API Docs:** `https://your-domain.com/api/dashboard-data`

---

## 🎉 Post-Deployment

After successful deployment:

1. ✅ Test all dashboard sections
2. ✅ Verify data loading correctly
3. ✅ Check mobile responsiveness
4. ✅ Set up monitoring alerts
5. ✅ Configure domain (if using custom domain)
6. ✅ Set up SSL certificate
7. ✅ Add to team bookmarks

**🌐 Your dashboard is now live!**
