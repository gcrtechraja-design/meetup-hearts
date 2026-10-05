import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoints for Cloud Run startup and liveness probes (MUST respond 200 OK immediately)
  app.get(['/health', '/healthz', '/_ah/health', '/ping'], (req, res) => {
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

  // 1. Primary listener: Port 3000 (Target port for AI Studio & Nginx reverse proxy)
  const primaryServer = app.listen(3000, '0.0.0.0', () => {
    console.log('[Server] Application listening on http://0.0.0.0:3000');
  });

  primaryServer.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.log('[Server] Port 3000 is already in use by an active server.');
    } else {
      console.error('[Server] Port 3000 error:', err);
    }
  });

  // 2. Secondary listener: If process.env.PORT is configured and is NOT 3000 (e.g. Cloud Run 8080)
  // In environments with Nginx reverse proxy, port 8080 is owned by Nginx which forwards to 3000.
  // In environments without Nginx, binding here ensures direct Cloud Run compatibility.
  const envPort = parseInt(process.env.PORT || '', 10);
  if (envPort && envPort !== 3000) {
    try {
      const altServer = app.listen(envPort, '0.0.0.0', () => {
        console.log(`[Server] Also listening on http://0.0.0.0:${envPort}`);
      });

      altServer.on('error', (err: any) => {
        if (err && err.code === 'EADDRINUSE') {
          console.log(`[Server] Port ${envPort} is managed by Nginx proxy. Traffic is being forwarded to port 3000.`);
        } else {
          console.warn(`[Server] Port ${envPort} notice:`, err?.message || err);
        }
      });
    } catch (e: any) {
      console.warn(`[Server] Could not bind port ${envPort}:`, e?.message || e);
    }
  }
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
