import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

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

