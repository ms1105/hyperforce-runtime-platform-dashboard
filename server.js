import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

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

// Apply proxy to /api routes, but skip /api/health
app.use('/api', (req, res, next) => {
  console.log(`[Route Handler] ${req.method} ${req.url}, path: ${req.path}`);
  if (req.path === '/health') {
    console.log(`[Route Handler] Skipping proxy for /health`);
    return next(); // Let the /api/health route handler above handle it
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

// Serve static files from current directory (for index.html and assets)
// This must be AFTER API routes
app.use(express.static(__dirname));

// Proxy Cost to Serve Dashboard - check if request is for Cost to Serve Dashboard
// If the request path matches Cost to Serve Dashboard routes, proxy it
app.use((req, res, next) => {
  // Check if this is a request for Cost to Serve Dashboard
  // Cost to Serve Dashboard typically serves from root with React Router
  // We'll proxy all non-API, non-static file requests to the Cost to Serve Dashboard
  if (req.path.startsWith('/api/')) {
    return next(); // Let API routes be handled above
  }
  
  // Check if it's a static asset request (already served by express.static above)
  // If express.static didn't handle it, proxy to Cost to Serve Dashboard
  // This handles React Router routes and other Cost to Serve Dashboard routes
  costToServeProxy(req, res, next);
});

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
  console.log('💻 Environment:', process.env.NODE_ENV || 'development');
  console.log('');
  console.log('📋 Available endpoints:');
  console.log('   GET  / - Main dashboard');
  console.log('   GET  /api/* - Proxied to bin-packing server');
  console.log('   GET  /api/health - Server health check');
});
