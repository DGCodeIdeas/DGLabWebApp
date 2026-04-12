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
import session from 'express-session';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import Database from 'better-sqlite3';
import { WebWeaverService } from './src/services/webweaverService.js';
import { generateVisualNovelScript, convertChapterToVNScript } from './src/services/geminiService.js';

dotenv.config();

const webweaverService = new WebWeaverService();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Database Setup (IndexedDB -> SQLite -> FreeDB) ---
const sqliteDb = new Database('local_fallback.db');
sqliteDb.exec(`
  CREATE TABLE IF NOT EXISTS visual_novels (
    id TEXT PRIMARY KEY,
    title TEXT,
    description TEXT,
    script TEXT,
    isPublic INTEGER,
    createdAt TEXT,
    updatedAt TEXT,
    userId TEXT,
    authorName TEXT,
    sync_status TEXT DEFAULT 'pending'
  )
`);

const mysqlConfig = {
  host: 'sql.freedb.tech',
  user: 'freedb_DGLab',
  password: 'XU632&eKe*J@v&4',
  database: 'freedb_DGLabWebDB',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let mysqlPool: mysql.Pool | null = null;

async function syncMysqlToSqlite() {
  if (!mysqlPool) return;
  try {
    console.log('[SYNC] Pulling latest data from MySQL to SQLite...');
    const [rows]: any = await mysqlPool.query('SELECT * FROM visual_novels');
    for (const row of rows) {
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO visual_novels 
        (id, title, description, script, isPublic, createdAt, updatedAt, userId, authorName, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')
      `).run(
        row.id, row.title, row.description, row.script, row.isPublic ? 1 : 0, 
        row.createdAt, row.updatedAt, row.userId, row.authorName
      );
    }
    console.log(`[SYNC] Successfully pulled ${rows.length} records from MySQL.`);
  } catch (error) {
    console.error('Error syncing MySQL to SQLite:', error);
  }
}

async function initMySQL() {
  try {
    mysqlPool = mysql.createPool(mysqlConfig);
    const connection = await mysqlPool.getConnection();
    await connection.query(`
      CREATE TABLE IF NOT EXISTS visual_novels (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255),
        description TEXT,
        script TEXT,
        isPublic BOOLEAN,
        createdAt VARCHAR(255),
        updatedAt VARCHAR(255),
        userId VARCHAR(255),
        authorName VARCHAR(255)
      )
    `);
    connection.release();
    console.log('Connected to FreeDB MySQL successfully.');
    
    // Initial sync
    await syncMysqlToSqlite();
    // Background sync for any pending local changes
    syncSqliteToMysql();
    
    // Periodic sync every 5 minutes
    setInterval(syncSqliteToMysql, 5 * 60 * 1000);
  } catch (error) {
    console.error('Failed to connect to FreeDB MySQL. Running in SQLite fallback mode.', error);
    mysqlPool = null;
  }
}

initMySQL();

async function syncSqliteToMysql() {
  if (!mysqlPool) return;
  try {
    const pending = sqliteDb.prepare("SELECT * FROM visual_novels WHERE sync_status = 'pending'").all();
    for (const row of pending as any[]) {
      await mysqlPool.query(
        `INSERT INTO visual_novels (id, title, description, script, isPublic, createdAt, updatedAt, userId, authorName) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE 
         title=VALUES(title), description=VALUES(description), script=VALUES(script), isPublic=VALUES(isPublic), updatedAt=VALUES(updatedAt)`,
        [row.id, row.title, row.description, row.script, row.isPublic ? true : false, row.createdAt, row.updatedAt, row.userId, row.authorName]
      );
      sqliteDb.prepare("UPDATE visual_novels SET sync_status = 'synced' WHERE id = ?").run(row.id);
    }
  } catch (error) {
    console.error('Error syncing SQLite to MySQL:', error);
  }
}
// --- End Database Setup ---

// Helper to get OAuth2 Client
const getOAuth2Client = (redirectUri?: string) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("CRITICAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment variables.");
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

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

  app.set('trust proxy', 1); // Trust the first proxy (Cloud Run/AI Studio)
  
  // Update CORS to allow credentials
  app.use(cors({
    origin: true, // Reflect the request origin
    credentials: true
  }));

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'mangascript-secret',
    name: 'mangascript.sid', // Custom session name
    resave: true, // Force session to be saved back to the session store
    saveUninitialized: true, // Force a session that is "uninitialized" to be saved to the store
    proxy: true, // Required for secure cookies behind a proxy
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
      sameSite: 'none',
      httpOnly: true
    }
  }));

  // Helper to get redirect URI
  const getRedirectUri = (req: express.Request) => {
    // Priority 1: APP_URL environment variable (standard in this environment)
    if (process.env.APP_URL) {
      if (process.env.APP_URL.includes('localhost') && !req.headers.host?.includes('localhost')) {
        console.warn("WARNING: APP_URL is set to localhost but the app is running in a cloud environment. This will cause OAuth failures.");
      }
      return `${process.env.APP_URL.replace(/\/$/, '')}/auth/google/callback`;
    }

    console.warn("WARNING: APP_URL environment variable is missing. OAuth redirect URI might be incorrect.");

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
    console.log(`Generating Auth URL with redirect_uri: ${redirectUri}`);
    
    const client = getOAuth2Client(redirectUri);
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: DRIVE_SCOPES,
      prompt: 'consent'
    });
    res.json({ url });
  });

  app.get(['/auth/google/callback', '/auth/google/callback/'], async (req, res) => {
    const { code } = req.query;
    if (!code) {
      console.error("Auth Callback: No code provided in query params");
      return res.status(400).send('No code provided');
    }

    const redirectUri = getRedirectUri(req);
    console.log(`Auth Callback: Exchanging code for tokens. redirect_uri: ${redirectUri}`);

    try {
      const client = getOAuth2Client(redirectUri);
      const { tokens } = await client.getToken(code as string);
      
      console.log("Auth Callback: Tokens received successfully");
      (req.session as any).tokens = tokens;

      // Explicitly save the session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Auth Callback: Error saving session:", err);
          return res.status(500).send('Authentication failed: Could not save session');
        }

        res.send(`
          <html>
            <body>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', tokens: ${JSON.stringify(tokens)} }, '*');
                  window.close();
                } else {
                  window.location.href = '/';
                }
              </script>
              <p>Authentication successful. This window should close automatically.</p>
            </body>
          </html>
        `);
      });
    } catch (error: any) {
      console.error('Error exchanging code for tokens:', error);
      if (error.response && error.response.data) {
        console.error('Google API Error Details:', JSON.stringify(error.response.data, null, 2));
      }
      res.status(500).send(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
  });

  app.get('/api/auth/google/status', (req, res) => {
    // Check header first (frontend will send this)
    const tokenHeader = req.headers['x-google-tokens'] as string;
    let tokens = null;
    
    if (tokenHeader) {
      try {
        tokens = JSON.parse(tokenHeader);
      } catch (e) {
        console.error("Failed to parse tokens from header");
      }
    }
    
    if (!tokens) {
      tokens = (req.session as any).tokens;
    }

    console.log(`Status Check: Session ID: ${req.sessionID}, Connected: ${!!tokens}`);
    if (!tokens) {
      console.log("Status Check: No tokens found in session or headers.");
    }
    res.json({ connected: !!tokens });
  });

  app.post('/api/auth/google/disconnect', (req, res) => {
    (req.session as any).tokens = null;
    res.json({ success: true });
  });

  // Helper to upload to Google Drive
  async function uploadToDrive(tokens: any, filePath: string, fileName: string) {
    const client = getOAuth2Client();
    client.setCredentials(tokens);
    const drive = google.drive({ version: 'v3', auth: client });

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

  // Visual Novel AI Assistant Endpoint
  app.post('/api/visual-novel/assistant', async (req, res) => {
    const { prompt, context, unfiltered } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
      const generatedScript = await generateVisualNovelScript(prompt, context || '', unfiltered);
      res.json({ success: true, script: generatedScript });
    } catch (error: any) {
      console.error("AI Assistant Error:", error);
      res.status(500).json({ error: error.message || 'Failed to generate script' });
    }
  });

  // Visual Novel Convert Endpoint
  app.post('/api/visual-novel/convert', async (req, res) => {
    const { title, source, modelId } = req.body;
    if (!title || !source) {
      return res.status(400).json({ error: 'Title and source are required' });
    }

    try {
      const generatedScript = await convertChapterToVNScript(title, source, modelId);
      res.json({ success: true, script: generatedScript });
    } catch (error: any) {
      console.error("VN Conversion Error:", error);
      res.status(500).json({ error: error.message || 'Failed to convert chapter' });
    }
  });

  // MangaScript EPUB Parsing Logic
  app.post('/api/mangascript/parse', upload.single('file'), async (req, res) => {
    const file = (req as any).file;
    if (!file) {
      console.error("No file in request");
      return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`[PARSER] Starting parse for: ${file.originalname} (${file.size} bytes)`);

    try {
      if (!fs.existsSync(file.path)) {
        throw new Error(`Uploaded file not found at ${file.path}`);
      }

      // Handle Google Drive Upload if connected
      let googleTokens = null;
      if (req.body.googleTokens) {
        try {
          googleTokens = JSON.parse(req.body.googleTokens);
        } catch (e) {
          console.error("[PARSER] Failed to parse googleTokens from body", e);
        }
      }
      const tokens = googleTokens || (req.session as any).tokens;
      let driveFileId = null;
      let driveLink = null;

      if (tokens) {
        try {
          console.log("[PARSER] Uploading to Google Drive...");
          const driveData = await uploadToDrive(tokens, file.path, file.originalname);
          driveFileId = driveData.id;
          driveLink = driveData.webViewLink;
          console.log(`[PARSER] Uploaded to Drive: ${driveFileId}`);
        } catch (driveError) {
          console.error("[PARSER] Error uploading to Google Drive:", driveError);
          // Continue with parsing even if drive upload fails
        }
      }

      console.log("[PARSER] Reading ZIP entries...");
      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      console.log(`[PARSER] Found ${zipEntries.length} entries in ZIP`);
      
      // Find OPF file
      const opfEntry = zipEntries.find(e => e.entryName.endsWith('.opf'));
      if (!opfEntry) {
        console.error("[PARSER] No OPF file found in EPUB");
        return res.status(400).json({ error: 'Invalid EPUB: No OPF file found' });
      }

      console.log(`[PARSER] Found OPF: ${opfEntry.entryName}`);
      const opfContent = opfEntry.getData().toString('utf8');
      
      // Very basic XML parsing using regex
      const manifestMatch = opfContent.match(/<manifest>([\s\S]*?)<\/manifest>/);
      const spineMatch = opfContent.match(/<spine[^>]*>([\s\S]*?)<\/spine>/);
      
      if (!manifestMatch) {
        console.error("[PARSER] Manifest not found in OPF");
        return res.status(400).json({ error: 'Invalid EPUB: Missing manifest' });
      }
      if (!spineMatch) {
        console.error("[PARSER] Spine not found in OPF");
        return res.status(400).json({ error: 'Invalid EPUB: Missing spine' });
      }

      console.log(`[PARSER] Manifest and Spine found. Parsing items...`);

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
          const decodedHref = decodeURIComponent(href);
          const fullPath = opfBasePath + decodedHref;
          
          const entry = zipEntries.find(e => e.entryName === fullPath || e.entryName.endsWith(decodedHref));
          if (entry && (fullPath.endsWith('.html') || fullPath.endsWith('.xhtml'))) {
            const htmlContent = entry.getData().toString('utf8');
            
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

            let type = 'chapter';
            const lowerTitle = title.toLowerCase();
            if (lowerTitle.includes('prologue')) type = 'prologue';
            else if (lowerTitle.includes('interlude')) type = 'interlude';
            else if (lowerTitle.includes('epilogue')) type = 'epilogue';

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

      console.log(`[PARSER] Successfully parsed ${chapters.length} chapters`);

      // Cleanup uploaded file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return res.status(200).json({ 
        success: true, 
        chapters,
        driveFileId,
        driveLink
      });
    } catch (error: any) {
      console.error("[PARSER] EPUB parse failed:", error);
      // Ensure we always return JSON even on error
      return res.status(500).json({ 
        error: 'Failed to parse EPUB: ' + (error.message || 'Unknown error'),
        success: false 
      });
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

  // WebWeaver Routes
  app.get('/api/webweaver/crawl-stream', async (req, res) => {
    const startUrl = req.query.startUrl as string;
    if (!startUrl) {
      return res.status(400).json({ error: 'startUrl is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const onLog = (msg: string) => {
      res.write(`data: ${JSON.stringify({ type: 'log', msg })}\n\n`);
    };

    try {
      const chapters = await webweaverService.discoverChapters(startUrl, onLog);
      res.write(`data: ${JSON.stringify({ type: 'result', chapters })}\n\n`);
    } catch (error) {
      console.error("WebWeaver crawl failed:", error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Failed to discover chapters' })}\n\n`);
    } finally {
      res.end();
    }
  });

  app.post('/api/webweaver/crawl', async (req, res) => {
    const { startUrl } = req.body;
    if (!startUrl) {
      return res.status(400).json({ error: 'startUrl is required' });
    }

    try {
      const chapters = await webweaverService.discoverChapters(startUrl);
      res.json({ success: true, chapters });
    } catch (error) {
      console.error("WebWeaver crawl failed:", error);
      res.status(500).json({ error: 'Failed to discover chapters' });
    }
  });

  app.post('/api/webweaver/extract', async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    try {
      const content = await webweaverService.extractChapterContent(url);
      res.json({ success: true, ...content });
    } catch (error) {
      console.error("WebWeaver extraction failed:", error);
      res.status(500).json({ error: 'Failed to extract content' });
    }
  });

  app.post('/api/webweaver/build', async (req, res) => {
    const { title, author, chapters } = req.body;
    if (!title || !chapters || !Array.isArray(chapters)) {
      return res.status(400).json({ error: 'title and chapters are required' });
    }

    try {
      const epubBuffer = await webweaverService.createEpub(title, author || 'Unknown', chapters);
      const filename = `webweaver-${Date.now()}.epub`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, epubBuffer);

      res.json({ 
        success: true, 
        downloadUrl: `/api/download/${filename}`,
        filename
      });
    } catch (error) {
      console.error("WebWeaver build failed:", error);
      res.status(500).json({ error: 'Failed to build EPUB' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // --- Visual Novels API (SQLite/MySQL) ---
  app.get('/api/novels', async (req, res) => {
    const { userId, isPublic } = req.query;
    
    try {
      if (mysqlPool) {
        let query = 'SELECT * FROM visual_novels';
        const params: any[] = [];
        if (userId) {
          query += ' WHERE userId = ?';
          params.push(userId);
        } else if (isPublic === 'true') {
          query += ' WHERE isPublic = true';
        }
        query += ' ORDER BY createdAt DESC';
        
        const [rows] = await mysqlPool.query(query, params);
        return res.json(rows);
      }
    } catch (e) {
      console.error('MySQL read failed, falling back to SQLite', e);
    }

    let query = 'SELECT * FROM visual_novels';
    const params: any[] = [];
    if (userId) {
      query += ' WHERE userId = ?';
      params.push(userId);
    } else if (isPublic === 'true') {
      query += ' WHERE isPublic = 1';
    }
    query += ' ORDER BY createdAt DESC';
    
    const rows = sqliteDb.prepare(query).all(...params);
    res.json(rows.map((r: any) => ({ ...r, isPublic: Boolean(r.isPublic) })));
  });

  app.get('/api/novels/:id', async (req, res) => {
    const { id } = req.params;
    try {
      if (mysqlPool) {
        const [rows]: any = await mysqlPool.query('SELECT * FROM visual_novels WHERE id = ?', [id]);
        if (rows.length > 0) return res.json(rows[0]);
      }
    } catch (e) {
      console.error('MySQL read failed, falling back to SQLite', e);
    }

    const row: any = sqliteDb.prepare('SELECT * FROM visual_novels WHERE id = ?').get(id);
    if (row) {
      res.json({ ...row, isPublic: Boolean(row.isPublic) });
    } else {
      res.status(404).json({ error: 'Not found' });
    }
  });

  app.post('/api/novels', async (req, res) => {
    const novel = req.body;
    const { id, updatedAt } = novel;

    try {
      // 1. Check for conflict (Existing data newer than incoming)
      let existing: any = null;
      if (mysqlPool) {
        try {
          const [rows]: any = await mysqlPool.query('SELECT * FROM visual_novels WHERE id = ?', [id]);
          if (rows.length > 0) existing = rows[0];
        } catch (e) {
          console.error('MySQL conflict check failed', e);
        }
      }

      if (!existing) {
        existing = sqliteDb.prepare('SELECT * FROM visual_novels WHERE id = ?').get(id);
      }

      if (existing && existing.updatedAt && updatedAt) {
        const existingTime = new Date(existing.updatedAt).getTime();
        const incomingTime = new Date(updatedAt).getTime();

        if (existingTime > incomingTime) {
          console.log(`[CONFLICT] Novel ${id} has newer version on server (${existing.updatedAt} > ${updatedAt})`);
          return res.status(409).json({ 
            error: 'Conflict: Server has a newer version', 
            serverNovel: { ...existing, isPublic: Boolean(existing.isPublic) } 
          });
        }
      }

      // 2. Save to SQLite (Intermediate)
      sqliteDb.prepare(`
        INSERT OR REPLACE INTO visual_novels 
        (id, title, description, script, isPublic, createdAt, updatedAt, userId, authorName, sync_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        novel.id, novel.title, novel.description || '', novel.script, novel.isPublic ? 1 : 0, 
        novel.createdAt, novel.updatedAt || novel.createdAt, novel.userId, novel.authorName || ''
      );
      
      // 3. Trigger background sync to MySQL
      syncSqliteToMysql();
      
      res.json({ success: true });
    } catch (e) {
      console.error('Save error', e);
      return res.status(500).json({ error: 'Failed to save novel' });
    }
  });

  app.delete('/api/novels/:id', async (req, res) => {
    const { id } = req.params;
    sqliteDb.prepare('DELETE FROM visual_novels WHERE id = ?').run(id);
    if (mysqlPool) {
      try {
        await mysqlPool.query('DELETE FROM visual_novels WHERE id = ?', [id]);
      } catch (e) {
        console.error('Failed to delete from MySQL', e);
      }
    }
    res.json({ success: true });
  });
  // --- End Visual Novels API ---

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
