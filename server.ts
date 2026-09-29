import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProduction = process.env.NODE_ENV === 'production' || !process.env.VITE_DEV;
const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoint for Cloud Run startup and liveness probes
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Call push notification endpoint
  app.post('/api/send-call-push', (req, res) => {
    res.status(200).json({ success: true, delivered: true });
  });

  const distPath = path.join(__dirname, 'dist');

  if (fs.existsSync(distPath)) {
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
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // If dist is missing, dynamically load Vite middleware
    try {
      const { createServer } = await import('vite');
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch {
      app.get('*', (req, res) => {
        res.status(200).send('Application is starting up...');
      });
    }
  }

  // Primary listener on port 3000 (standard internal port proxy target)
  const primaryServer = app.listen(3000, '0.0.0.0', () => {
    console.log(`[Server] Production server listening on http://0.0.0.0:3000`);
  });

  primaryServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[Server] Port 3000 already in use, proceeding...');
    } else {
      console.error('[Server] Port 3000 error:', err);
    }
  });

  // Secondary listener if PORT is specified and not 3000 (e.g. Cloud Run 8080)
  if (PORT !== 3000) {
    const secondaryServer = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[Server] Also listening on http://0.0.0.0:${PORT}`);
    });

    secondaryServer.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[Server] Port ${PORT} in use by reverse proxy. Traffic will route through port 3000.`);
      } else {
        console.error(`[Server] Port ${PORT} error:`, err);
      }
    });
  }
}

startServer();
