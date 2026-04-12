import fs from 'fs';

const content = fs.readFileSync('src/pages/MangaScript.tsx', 'utf-8');
const newContent = content
  .replace(/MangaScript/g, 'StoryToVN')
  .replace(/manga_projects/g, 'vn_projects')
  .replace(/MangaImage/g, 'VisualNovelEditor')
  .replace(/manga-image/g, 'visual-novels')
  .replace(/manga_image_projects/g, 'visual_novels')
  .replace(/MangaScript Studio/g, 'Story to VN Studio')
  .replace(/AI-powered EPUB translation and proofreading workflow/g, 'AI-powered EPUB to Visual Novel conversion workflow')
  .replace(/Translating and proofreading/g, 'Converting to RenPy script')
  .replace(/translatedContent/g, 'scriptContent')
  .replace(/startAITranslation/g, 'startAIConversion')
  .replace(/AI Translation/g, 'AI Conversion')
  .replace(/AI translated and proofread content/g, 'AI generated RenPy script')
  .replace(/Transfer to VisualNovelEditor/g, 'Transfer to VN Editor')
  .replace(/Transferring to VisualNovelEditor/g, 'Transferring to VN Editor');

fs.writeFileSync('src/pages/StoryToVN.tsx', newContent);
console.log('Done');
