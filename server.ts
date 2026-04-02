import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure storage directories exist
const storageDir = path.join(process.cwd(), 'storage');
const uploadsDir = path.join(storageDir, 'uploads');
if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir);
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const upload = multer({ dest: 'storage/uploads/' });

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // MangaScript AI Routing Engine Logic
  const providerCategories = {
    'A': { name: 'Enterprise Cloud', tier: 1 },
    'B': { name: 'Open Model Hosting', tier: 2 },
    'D': { name: 'Regional Cloud', tier: 2 },
    'E': { name: 'Local/Self-Hosted', tier: 3 }
  };

  const models = [
    { id: 'gemini-3.1-pro-preview', provider: 'google', category: 'A', tier: 'massive' },
    { id: 'gemini-3-flash-preview', provider: 'google', category: 'A', tier: 'long' },
    { id: 'gemini-3-flash-preview', provider: 'google', category: 'A', tier: 'medium' },
    { id: 'gemini-3-flash-preview', provider: 'google', category: 'A', tier: 'short' },
    { id: 'gpt-4o', provider: 'openai', category: 'A', tier: 'long' },
    { id: 'claude-3-5-sonnet', provider: 'anthropic', category: 'A', tier: 'long' }
  ];

  app.post('/api/mangascript/route', (req, res) => {
    const { category, tier } = req.body;
    const matchedModels = models.filter(m => m.category === category && m.tier === tier);
    const selectedModel = matchedModels.length > 0 ? matchedModels[0] : models.find(m => m.category === 'A' && m.tier === 'medium');

    res.json({
      success: true,
      routing: {
        category: providerCategories[category as keyof typeof providerCategories] || providerCategories['A'],
        tier,
        model: selectedModel
      }
    });
  });

  // EPUB Font Changer Logic
  app.post('/api/epub/transform', upload.single('file'), (req, res) => {
    const file = (req as any).file;
    const fontId = req.body.font;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      
      // Define the font override CSS
      // In a production app, we would host the actual font files and use @font-face
      // For this implementation, we'll use system fallbacks that match the "vibe" of the requested font
      const fontMap: Record<string, string> = {
        'merriweather': '"Merriweather", serif',
        'opendyslexic': '"OpenDyslexic", sans-serif',
        'fira-sans': '"Fira Sans", sans-serif',
        'roboto': '"Roboto", sans-serif',
        'lato': '"Lato", sans-serif',
        'montserrat': '"Montserrat", sans-serif',
        'playfair': '"Playfair Display", serif'
      };

      const targetFont = fontMap[fontId] || 'serif';
      const overrideCss = `
/* DGLab Font Override */
* { 
  font-family: ${targetFont} !important; 
}
`;

      let modifiedCount = 0;

      // Iterate through all entries to find CSS files
      zipEntries.forEach((entry) => {
        if (entry.entryName.endsWith('.css')) {
          const originalContent = entry.getData().toString('utf8');
          const newContent = originalContent + overrideCss;
          zip.updateFile(entry, Buffer.from(newContent, 'utf8'));
          modifiedCount++;
        }
      });

      // If no CSS files found, try to inject into HTML files directly
      if (modifiedCount === 0) {
        zipEntries.forEach((entry) => {
          if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
            let htmlContent = entry.getData().toString('utf8');
            const styleTag = `<style>${overrideCss}</style>`;
            
            if (htmlContent.includes('</head>')) {
              htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);
            } else if (htmlContent.includes('<body>')) {
              htmlContent = htmlContent.replace('<body>', `<body>${styleTag}`);
            } else {
              htmlContent = styleTag + htmlContent;
            }
            
            zip.updateFile(entry, Buffer.from(htmlContent, 'utf8'));
            modifiedCount++;
          }
        });
      }

      zip.addFile("dglab-audit.txt", Buffer.from(`DGLab Transformation Report\nStatus: Success\nFont Applied: ${fontId}\nFiles Modified: ${modifiedCount}\nTimestamp: ${new Date().toISOString()}`));
      
      const outputFilename = `transformed-${file.originalname}`;
      const outputPath = path.join(uploadsDir, outputFilename);
      zip.writeZip(outputPath);

      res.json({
        success: true,
        downloadUrl: `/api/download/${outputFilename}`,
        filename: outputFilename,
        modifiedCount
      });
    } catch (error) {
      console.error("EPUB transformation failed:", error);
      res.status(500).json({ error: 'Failed to process EPUB' });
    }
  });

  app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // Global Error Handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      success: false
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DGLab Server running on http://localhost:${PORT}`);
  });
}

startServer();
