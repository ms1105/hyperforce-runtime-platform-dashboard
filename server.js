import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Karpenter monthly data: serve from this folder (absolute path; override with KARPENTER_MONTHLY_DIR env)
const KARPENTER_MONTHLY_DIR = process.env.KARPENTER_MONTHLY_DIR || path.join(__dirname, 'Cpu allocation rate monthly files');

// Enable CORS
app.use(cors());

// Proxy API requests to bin-packing server (port 3001)
// IMPORTANT: API routes must be BEFORE static file serving
const binPackingServerUrl = process.env.BINPACKING_SERVER_URL || 'http://localhost:3001';

// Cost to Serve Dashboard server URL (port 3001)
const costToServeServerUrl = process.env.COST_TO_SERVE_SERVER_URL || 'http://localhost:3001';

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'hyperforce-runtime-platform',
    port: PORT,
    timestamp: new Date().toISOString(),
    binPackingServer: binPackingServerUrl
  });
});

// Proxy middleware for all /api routes except /api/health
// When using app.use('/api', ...), req.path is relative to /api
// So we need to prepend /api back when forwarding to the target server
const apiProxy = createProxyMiddleware({
  target: binPackingServerUrl,
  changeOrigin: true,
  logLevel: 'debug',
  pathRewrite: (path, req) => {
    // path is relative to /api, so /hcp-cts-forecast-actuals becomes /api/hcp-cts-forecast-actuals
    const newPath = '/api' + path;
    console.log(`[PathRewrite] ${path} -> ${newPath}`);
    return newPath;
  },
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Proxy] ${req.method} ${req.url} -> ${binPackingServerUrl}/api${req.path}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Proxy Response] ${req.url} -> ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error(`[Proxy Error] ${req.url}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Proxy error', 
        message: 'Failed to connect to bin-packing server',
        details: err.message 
      });
    }
  }
});

// Serve Karpenter monthly CSV files from KARPENTER_MONTHLY_DIR (before generic /api proxy)
app.get('/api/karpenter-monthly/:filename', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  if (!filename || filename.includes('..')) {
    return res.status(400).send('Invalid filename');
  }
  const filepath = path.join(KARPENTER_MONTHLY_DIR, filename);
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) {
    return res.status(404).send('File not found');
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.sendFile(filepath);
});

// Apply proxy to /api routes, but skip /api/health and /api/karpenter-monthly
app.use('/api', (req, res, next) => {
  console.log(`[Route Handler] ${req.method} ${req.url}, path: ${req.path}`);
  if (req.path === '/health') {
    console.log(`[Route Handler] Skipping proxy for /health`);
    return next(); // Let the /api/health route handler above handle it
  }
  if (req.path.startsWith('/karpenter-monthly/')) {
    return next(); // Already handled above
  }
  console.log(`[Route Handler] Proxying ${req.url}`);
  apiProxy(req, res, next);
});

// Proxy Cost to Serve Dashboard requests to port 3001
// This allows accessing the Cost to Serve Dashboard at http://localhost:8080/
const costToServeProxy = createProxyMiddleware({
  target: costToServeServerUrl,
  changeOrigin: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(`[Cost to Serve Proxy] ${req.method} ${req.url} -> ${costToServeServerUrl}${req.url}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`[Cost to Serve Proxy Response] ${req.url} -> ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error(`[Cost to Serve Proxy Error] ${req.url}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Proxy error', 
        message: 'Failed to connect to Cost to Serve Dashboard server',
        details: err.message 
      });
    }
  }
});

// Since port 3001 shows the Cost to Serve Dashboard (as user mentioned),
// we need to proxy to port 3001, but also ensure API calls work correctly
// The Cost to Serve Dashboard on port 3001 needs API access to bin-packing server

// Serve static files from current directory FIRST (for Hyperforce Runtime Platform dashboard)
// This includes index.html, assets/, etc.
app.use(express.static(__dirname));

// Proxy Cost to Serve Dashboard requests ONLY for specific paths
// Only proxy if the request is specifically for Cost to Serve Dashboard routes
// For now, we'll serve the local Hyperforce Runtime Platform dashboard at root
// If you need Cost to Serve Dashboard, access it directly at http://localhost:3001

// Note: The Cost to Serve Dashboard proxy is commented out because we want to serve
// the local Hyperforce Runtime Platform dashboard instead
// Uncomment below if you need to proxy Cost to Serve Dashboard:
/*
app.get(['/cost-to-serve', '/cost-to-serve/*'], (req, res, next) => {
  console.log(`[Cost to Serve] Proxying ${req.url} to Cost to Serve Dashboard at ${costToServeServerUrl}`);
  costToServeProxy(req, res, next);
});
*/

// Error handling
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 Hyperforce Runtime Platform Server running on port', PORT);
  console.log('📊 Dashboard available at: http://localhost:' + PORT);
  console.log('🔧 API proxy configured to: ' + binPackingServerUrl);
  console.log('📁 Karpenter monthly data: ' + KARPENTER_MONTHLY_DIR);
  console.log('💻 Environment:', process.env.NODE_ENV || 'development');
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   GET  / - Main dashboard');
  console.log('   GET  /api/karpenter-monthly/:filename - Karpenter monthly CSVs from ' + KARPENTER_MONTHLY_DIR);
  console.log('   GET  /api/* - Proxied to bin-packing server');
  console.log('   GET  /api/health - Server health check');
});
