import fs from 'fs';

let content = fs.readFileSync('src/pages/MangaImage.tsx', 'utf-8');

content = content.replace(/MangaScript/g, 'MangaImage');
content = content.replace(/manga_projects/g, 'manga_image_projects');
content = content.replace(/mangascript/g, 'mangaimage');
content = content.replace(/startAITranslation/g, 'startMangaGeneration');
content = content.replace(/EPUB translation and proofreading/g, 'EPUB to Manga generation');
content = content.replace(/AI Transformation/g, 'Manga Generation');

fs.writeFileSync('src/pages/MangaImage.tsx', content);
