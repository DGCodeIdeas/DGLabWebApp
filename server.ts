import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import multer from 'multer';
import AdmZip from 'adm-zip';
import fs from 'fs';
import { fileURLToPath } from 'url';
import axios from 'axios';
import os from 'os';
import { google } from 'googleapis';
import cookieSession from 'cookie-session';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google OAuth Setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  // This will be constructed dynamically in the routes
  '' 
);

const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Use /tmp for uploads - more reliable in cloud environments
const uploadsDir = path.join(os.tmpdir(), 'mangascript-uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.error("Failed to create uploads dir:", err);
  }
}

const upload = multer({ 
  dest: uploadsDir,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_SECRET || 'mangascript-secret'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,
    sameSite: 'none'
  }));

  // Helper to get redirect URI
  const getRedirectUri = (req: express.Request) => {
    // Priority 1: APP_URL environment variable (standard in this environment)
    if (process.env.APP_URL) {
      return `${process.env.APP_URL.replace(/\/$/, '')}/auth/google/callback`;
    }

    // Priority 2: X-Forwarded headers from proxy
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    
    // If host is localhost but we are likely behind a proxy, 
    // we might need to be careful. But in this environment, 
    // APP_URL is the source of truth.
    return `${protocol}://${host}/auth/google/callback`;
  };

  // Google Auth Routes
  app.get('/api/auth/google/url', (req, res) => {
    const redirectUri = getRedirectUri(req);
    const url = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: DRIVE_SCOPES,
      redirect_uri: redirectUri,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
    const { code } = req.query;
    if (!code) return res.status(400).send('No code provided');

    try {
      const redirectUri = getRedirectUri(req);
      const { tokens } = await oauth2Client.getToken({
        code: code as string,
        redirect_uri: redirectUri
      });
      
      (req.session as any).tokens = tokens;

      res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                window.close();
              } else {
                window.location.href = '/';
              }
            </script>
            <p>Authentication successful. This window should close automatically.</p>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      res.status(500).send('Authentication failed');
    }
  });

  app.get('/api/auth/google/status', (req, res) => {
    const tokens = (req.session as any).tokens;
    res.json({ connected: !!tokens });
  });

  app.post('/api/auth/google/disconnect', (req, res) => {
    (req.session as any).tokens = null;
    res.json({ success: true });
  });

  // Helper to upload to Google Drive
  async function uploadToDrive(tokens: any, filePath: string, fileName: string) {
    const auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    auth.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth });

    // 1. Find or create "MangaScript" folder
    let folderId = '';
    const folderResponse = await drive.files.list({
      q: "name = 'MangaScript' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id)',
      spaces: 'drive'
    });

    if (folderResponse.data.files && folderResponse.data.files.length > 0) {
      folderId = folderResponse.data.files[0].id!;
    } else {
      const newFolder = await drive.files.create({
        requestBody: {
          name: 'MangaScript',
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      folderId = newFolder.data.id!;
    }

    // 2. Upload file
    const fileMetadata = {
      name: fileName,
      parents: [folderId]
    };
    const media = {
      mimeType: 'application/epub+zip',
      body: fs.createReadStream(filePath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink'
    });

    return response.data;
  }

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

  // MangaScript EPUB Parsing Logic
  app.post('/api/mangascript/parse', upload.single('file'), async (req, res) => {
    const file = (req as any).file;
    if (!file) {
      console.error("No file in request");
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Parsing EPUB: ${file.originalname} (${file.size} bytes)`);

    try {
      if (!fs.existsSync(file.path)) {
        throw new Error(`Uploaded file not found at ${file.path}`);
      }

      // Handle Google Drive Upload if connected
      const tokens = (req.session as any).tokens;
      let driveFileId = null;
      let driveLink = null;

      if (tokens) {
        try {
          console.log("Uploading to Google Drive...");
          const driveData = await uploadToDrive(tokens, file.path, file.originalname);
          driveFileId = driveData.id;
          driveLink = driveData.webViewLink;
          console.log(`Uploaded to Drive: ${driveFileId}`);
        } catch (driveError) {
          console.error("Error uploading to Google Drive:", driveError);
          // Continue with parsing even if drive upload fails
        }
      }

      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      console.log(`Found ${zipEntries.length} entries in ZIP`);
      
      // Find OPF file
      const opfEntry = zipEntries.find(e => e.entryName.endsWith('.opf'));
      if (!opfEntry) {
        console.error("No OPF file found in EPUB");
        return res.status(400).json({ error: 'Invalid EPUB: No OPF file found' });
      }

      console.log(`Found OPF: ${opfEntry.entryName}`);
      const opfContent = opfEntry.getData().toString('utf8');
      
      // Very basic XML parsing using regex (for simplicity in this environment)
      const manifestMatch = opfContent.match(/<manifest>([\s\S]*?)<\/manifest>/);
      const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
      
      if (!manifestMatch) {
        console.error("Manifest not found in OPF");
        return res.status(400).json({ error: 'Invalid EPUB: Missing manifest' });
      }
      if (!spineMatch) {
        console.error("Spine not found in OPF");
        return res.status(400).json({ error: 'Invalid EPUB: Missing spine' });
      }

      console.log(`Manifest and Spine found. Parsing items...`);

      const manifestItems = [...manifestMatch[1].matchAll(/<item[^>]+id="([^"]+)"[^>]+href="([^"]+)"/g)];
      const manifestMap: Record<string, string> = {};
      manifestItems.forEach(m => {
        manifestMap[m[1]] = m[2];
      });

      const spineItems = [...spineMatch[1].matchAll(/<itemref[^>]+idref="([^"]+)"/g)];
      
      const chapters = [];
      let order = 0;

      // Determine base path of OPF to resolve relative hrefs
      const opfBasePath = opfEntry.entryName.includes('/') ? opfEntry.entryName.substring(0, opfEntry.entryName.lastIndexOf('/') + 1) : '';

      for (const s of spineItems) {
        const idref = s[1];
        const href = manifestMap[idref];
        if (href) {
          // Decode URI component because hrefs might be URL-encoded
          const decodedHref = decodeURIComponent(href);
          const fullPath = opfBasePath + decodedHref;
          
          const entry = zipEntries.find(e => e.entryName === fullPath || e.entryName.endsWith(decodedHref));
          if (entry && (fullPath.endsWith('.html') || fullPath.endsWith('.xhtml'))) {
            const htmlContent = entry.getData().toString('utf8');
            
            // Extract a title (very basic)
            let title = `Chapter ${order + 1}`;
            const titleMatch = htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
            if (titleMatch && titleMatch[1].trim()) {
              title = titleMatch[1].trim();
            } else {
              const h1Match = htmlContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
              if (h1Match && h1Match[1].trim()) {
                title = h1Match[1].replace(/<[^>]+>/g, '').trim();
              }
            }

            // Determine type
            let type = 'chapter';
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes('prologue')) type = 'prologue';
            else if (lowerTitle.includes('interlude')) type = 'interlude';
            else if (lowerTitle.includes('epilogue')) type = 'epilogue';

            // Extract text content (strip HTML tags for the 'content' field)
            // We keep the raw HTML in a separate field if needed, but for translation, text is often easier.
            // Actually, we should probably translate the HTML to preserve formatting.
            // For now, let's just pass the raw HTML as content.
            
            chapters.push({
              title,
              type,
              order,
              content: htmlContent,
              entryName: entry.entryName
            });
            order++;
          }
        }
      }

      console.log(`Found ${chapters.length} chapters in spine`);

      // Cleanup uploaded file
      fs.unlinkSync(file.path);

      res.json({ 
        success: true, 
        chapters,
        driveFileId,
        driveLink
      });
    } catch (error) {
      console.error("EPUB parse failed:", error);
      res.status(500).json({ error: 'Failed to parse EPUB' });
    }
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
