import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers (apply to all responses)
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', `
    default-src 'self';
    script-src 'self' https://cdn.jsdelivr.net 'wasm-unsafe-eval';
    style-src 'self' https://fonts.googleapis.com 'unsafe-inline';
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob:;
    connect-src 'self' https://flutevision-api-2aeac29f3245.herokuapp.com http://localhost:8000 https://cdn.jsdelivr.net;
    media-src 'self' blob:;
    worker-src 'self' blob:;
  `.replace(/\s{2,}/g, ' ').trim());
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=()');
  next();
});

// Serve static files from the dist directory with proper caching
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1d',
  etag: false
}));

// SPA routing: If a file doesn't exist, check if it's a route or a missing asset
app.get('*', (req, res, next) => {
  // Don't fall back to index.html for file extensions (except .html)
  // This prevents serving index.html for missing .js, .css, .png, etc.
  if (req.url.includes('.') && !req.url.endsWith('.html')) {
    res.status(404).send('Not Found');
    return;
  }

  // For routes without extensions (/, /game, /practice), serve index.html
  const indexPath = path.join(__dirname, 'dist', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not Found');
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

