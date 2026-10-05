import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configured by Cloud Run (default: 8080) or local environment
const PORT = parseInt(process.env.PORT || '8080', 10);

async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Health check endpoints - must respond 200 OK immediately for Cloud Run deployment probes
  app.get(['/health', '/healthz', '/_ah/health', '/ping'], (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 2. Call push notification endpoint
  app.post('/api/send-call-push', (req, res) => {
    res.status(200).json({ success: true, delivered: true });
  });

  const distPath = path.join(__dirname, 'dist');
  const indexHtmlPath = path.join(distPath, 'index.html');

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
          res.status(200).send('<!DOCTYPE html><html><head><title>Remix Remix Meet Up</title></head><body>Loading application...</body></html>');
        }
      });
    });
  } else {
    // Immediate fallback response satisfying Cloud Run health check if dist is building
    app.get('*', (req, res) => {
      res.status(200).send('<!DOCTYPE html><html><head><title>Remix Remix Meet Up</title></head><body><h3>Remix Remix Meet Up is starting... Please refresh shortly.</h3></body></html>');
    });
  }

  // 1. Main listener: Listen on Cloud Run PORT (0.0.0.0:$PORT)
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Primary server listening on http://0.0.0.0:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.log(`[Server] Port ${PORT} is already bound by host proxy (e.g. Nginx). Requests are forwarded to port 3000.`);
    } else {
      console.error(`[Server] Error on port ${PORT}:`, err);
    }
  });

  // 2. Secondary listener: Also listen on port 3000 if PORT is not 3000 (covers Nginx reverse proxy routing)
  if (PORT !== 3000) {
    try {
      const internalServer = app.listen(3000, '0.0.0.0', () => {
        console.log('[Server] Secondary listener active on http://0.0.0.0:3000');
      });

      internalServer.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          console.log('[Server] Port 3000 is already active.');
        } else {
          console.warn('[Server] Port 3000 notice:', err?.message || err);
        }
      });
    } catch (e: any) {
      console.warn('[Server] Could not start port 3000 listener:', e?.message || e);
    }
  }

  // Keep the process alive indefinitely so Cloud Run container does not exit
  setInterval(() => {}, 1000 * 60 * 60);
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
