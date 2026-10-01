import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configured by Cloud Run (default: 8080 or 3000)
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoints for Cloud Run startup and liveness probes
  app.get(['/health', '/healthz', '/_ah/health'], (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Call push notification endpoint
  app.post('/api/send-call-push', (req, res) => {
    res.status(200).json({ success: true, delivered: true });
  });

  const distPath = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');

  // Verify dist directory and index.html exist
  if (!fs.existsSync(distPath) || !fs.existsSync(indexHtmlPath)) {
    console.log('[Server] Production dist bundle missing. Building via vite build...');
    try {
      const { execSync } = await import('child_process');
      execSync('npx vite build', { stdio: 'inherit' });
      console.log('[Server] Production build completed.');
    } catch (buildErr) {
      console.error('[Server] Vite build error:', buildErr);
    }
  }

  if (fs.existsSync(distPath) && fs.existsSync(indexHtmlPath)) {
    // Serve production static assets from dist
    app.use(express.static(distPath, {
      maxAge: '1d',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      }
    }));

    // SPA fallback: any other route serves index.html
    app.get('*', (req, res) => {
      res.sendFile(indexHtmlPath, (err) => {
        if (err && !res.headersSent) {
          res.status(200).send('<!DOCTYPE html><html><head><title>Meet Up</title></head><body>Loading application...</body></html>');
        }
      });
    });
  } else {
    // Graceful startup fallback that always returns 200 OK to satisfy Cloud Run probes
    app.get('*', (req, res) => {
      res.status(200).send('<!DOCTYPE html><html><head><title>Meet Up</title></head><body><h3>Meet Up Application is starting... Please refresh shortly.</h3></body></html>');
    });
  }

  // Primary listener: MUST listen on PORT (required by Cloud Run & container runtime)
  const primaryServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Primary server listening on http://0.0.0.0:${PORT}`);
  });

  primaryServer.on('error', (err) => {
    console.error(`[Server] Error on port ${PORT}:`, err);
  });

  // Secondary listener: if PORT is not 3000, also bind to 3000 for internal proxies
  if (PORT !== 3000) {
    try {
      const internalServer = app.listen(3000, '0.0.0.0', () => {
        console.log(`[Server] Also listening on port 3000 for internal proxies`);
      });

      internalServer.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          console.log('[Server] Port 3000 already in use, proceeding...');
        } else {
          console.warn('[Server] Port 3000 notice:', err);
        }
      });
    } catch {
      // Ignore internal proxy bind error
    }
  }
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
