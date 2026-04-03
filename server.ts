import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';

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

  // EPUB Search Logic
  app.post('/api/epub/search', upload.single('file'), async (req, res) => {
    const file = (req as any).file;
    const findText = req.body.findText;
    const useRegex = req.body.useRegex === 'true';
    const caseSensitive = req.body.caseSensitive === 'true';
    const wholeWord = req.body.wholeWord === 'true';

    if (!file || !findText) {
      return res.status(400).json({ error: 'File and findText are required' });
    }

    try {
      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      
      let matchCount = 0;

      let flags = 'g';
      if (!caseSensitive) flags += 'i';
      
      let searchPattern = findText;
      if (!useRegex) {
        searchPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      
      if (wholeWord) {
        searchPattern = `\\b${searchPattern}\\b`;
      }

      const regex = new RegExp(searchPattern, flags);

      zipEntries.forEach((entry) => {
        if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
          const htmlContent = entry.getData().toString('utf8');
          const matches = [...htmlContent.matchAll(regex)];
          matchCount += matches.length;
        }
      });

      res.json({ success: true, matchCount });
    } catch (error) {
      console.error("EPUB search failed:", error);
      res.status(500).json({ error: 'Failed to search EPUB' });
    }
  });

  // EPUB Font Changer Logic
  app.post('/api/epub/transform', upload.single('file'), async (req, res) => {
    const file = (req as any).file;
    const fontId = req.body.font;
    const findText = req.body.findText;
    const replaceText = req.body.replaceText || '';
    const useRegex = req.body.useRegex === 'true';
    const caseSensitive = req.body.caseSensitive === 'true';
    const wholeWord = req.body.wholeWord === 'true';

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      
      const fontMap: Record<string, string> = {
        'merriweather': 'Merriweather',
        'opendyslexic': 'OpenDyslexic',
        'fira-sans': 'Fira Sans',
        'roboto': 'Roboto',
        'lato': 'Lato',
        'montserrat': 'Montserrat',
        'playfair': 'Playfair Display'
      };

      const targetFontName = fontMap[fontId] || fontId;
      const isOriginalFont = fontId === 'original';
      let fontFileName = '';
      let fontData: Buffer | null = null;
      let fontMimeType = 'font/ttf';

      // Attempt to download font for offline support
      if (!isOriginalFont) {
        try {
          const fontNameForUrl = targetFontName.replace(/\s+/g, '+');
          const googleFontsUrl = `https://fonts.googleapis.com/css2?family=${fontNameForUrl}:wght@400;700&display=swap`;
          
          const cssResponse = await axios.get(googleFontsUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });

          const cssContent = cssResponse.data;
          const fontUrlMatch = cssContent.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/);
          
          if (fontUrlMatch) {
            const fontUrl = fontUrlMatch[1];
            const fontResponse = await axios.get(fontUrl, { responseType: 'arraybuffer' });
            fontData = Buffer.from(fontResponse.data);
            
            const ext = fontUrl.split('.').pop() || 'ttf';
            fontFileName = `DGLabFont_${targetFontName.replace(/\s+/g, '_')}.${ext}`;
            fontMimeType = ext === 'woff2' ? 'font/woff2' : 'font/ttf';
            
            zip.addFile(`OEBPS/Fonts/${fontFileName}`, fontData);
          }
        } catch (fontError) {
          console.error("Failed to bundle font for offline use:", fontError);
        }
      }

      const fontFaceCss = fontData ? `
@font-face {
  font-family: '${targetFontName}';
  src: url('../Fonts/${fontFileName}');
  font-weight: normal;
  font-style: normal;
}
` : `@import url('https://fonts.googleapis.com/css2?family=${targetFontName.replace(/\s+/g, '+')}:wght@400;700&display=swap');\n`;

      const overrideCss = `
${fontFaceCss}
/* DGLab Font Override */
* { 
  font-family: '${targetFontName}', serif !important; 
}
`;

      let modifiedCount = 0;
      let textReplacedCount = 0;

      // Update content.opf if it exists to include the new font
      const opfEntry = zipEntries.find(e => e.entryName.endsWith('.opf'));
      if (opfEntry && fontData) {
        let opfContent = opfEntry.getData().toString('utf8');
        const fontIdInOpf = `dglab-font-${targetFontName.replace(/\s+/g, '-').toLowerCase()}`;
        const manifestItem = `<item id="${fontIdInOpf}" href="Fonts/${fontFileName}" media-type="${fontMimeType}"/>`;
        
        if (opfContent.includes('<manifest>')) {
          opfContent = opfContent.replace('<manifest>', `<manifest>\n    ${manifestItem}`);
          zip.updateFile(opfEntry, Buffer.from(opfContent, 'utf8'));
        }
      }

      // Iterate through all entries to find CSS files
      if (!isOriginalFont) {
        zipEntries.forEach((entry) => {
          if (entry.entryName.endsWith('.css')) {
            const originalContent = entry.getData().toString('utf8');
            const newContent = overrideCss + originalContent;
            zip.updateFile(entry, Buffer.from(newContent, 'utf8'));
            modifiedCount++;
          }
        });
      }

      // Process HTML files for Find/Replace and Style Injection
      zipEntries.forEach((entry) => {
        if (entry.entryName.endsWith('.xhtml') || entry.entryName.endsWith('.html')) {
          let htmlContent = entry.getData().toString('utf8');
          let changed = false;

          // 1. Find and Replace (Calibre-style)
          if (findText) {
            try {
              let flags = 'g';
              if (!caseSensitive) flags += 'i';
              
              let searchPattern = findText;
              if (!useRegex) {
                searchPattern = searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
              }
              
              if (wholeWord) {
                searchPattern = `\\b${searchPattern}\\b`;
              }

              const regex = new RegExp(searchPattern, flags);
              const originalContent = htmlContent;
              htmlContent = htmlContent.replace(regex, replaceText);
              
              if (htmlContent !== originalContent) {
                textReplacedCount++;
                changed = true;
              }
            } catch (reError) {
              console.error("Regex error:", reError);
            }
          }

          // 2. Style Injection (if no CSS files were found or as a safety measure)
          if (!isOriginalFont && modifiedCount === 0) {
            const styleTag = `<style>${overrideCss}</style>`;
            if (htmlContent.includes('</head>')) {
              htmlContent = htmlContent.replace('</head>', `${styleTag}</head>`);
            } else if (htmlContent.includes('<body>')) {
              htmlContent = htmlContent.replace('<body>', `<body>${styleTag}`);
            } else {
              htmlContent = styleTag + htmlContent;
            }
            changed = true;
          }

          if (changed) {
            zip.updateFile(entry, Buffer.from(htmlContent, 'utf8'));
            if (!isOriginalFont && modifiedCount === 0) modifiedCount++;
          }
        }
      });

      zip.addFile("dglab-audit.txt", Buffer.from(`DGLab Transformation Report\nStatus: Success\nFont Applied: ${isOriginalFont ? 'None (Original)' : targetFontName}\nOffline Support: ${fontData ? 'Yes' : 'No'}\nFiles Modified: ${modifiedCount}\nText Replacements: ${textReplacedCount}\nTimestamp: ${new Date().toISOString()}`));
      
      const outputFilename = `transformed-${file.originalname}`;
      const outputPath = path.join(uploadsDir, outputFilename);
      zip.writeZip(outputPath);

      res.json({
        success: true,
        downloadUrl: `/api/download/${outputFilename}`,
        filename: outputFilename,
        modifiedCount,
        textReplacedCount,
        offlineSupport: !!fontData
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
