import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import RSSParser from 'rss-parser';
import { EPub } from 'epub-gen-memory';

export interface ChapterInfo {
  url: string;
  title: string;
  content?: string;
  order: number;
}

export class WebWeaverService {
  private rssParser = new RSSParser();

  async discoverChapters(startUrl: string, onLog?: (msg: string) => void): Promise<ChapterInfo[]> {
    const log = (msg: string) => {
      console.log(msg);
      if (onLog) onLog(msg);
    };

    log(`Discovering chapters from: ${startUrl}`);
    
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Referer': startUrl,
      'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1'
    };

    const seenUrls = new Set<string>();
    let chapters: ChapterInfo[] = [];

    // 1. Try RSS feed first (only on startUrl)
    let rssUrl = '';
    try {
      const response = await axios.get(startUrl, { headers, timeout: 10000 });
      const $ = cheerio.load(response.data);
      rssUrl = $('link[type="application/rss+xml"]').attr('href') || 
               $('link[type="application/atom+xml"]').attr('href') || '';
    } catch (e) {
      console.error(`Failed to fetch start URL: ${startUrl}`, e);
      return [{ url: startUrl, title: "Start Page", order: 0 }];
    }

    if (!rssUrl) {
      const urlObj = new URL(startUrl);
      rssUrl = `${urlObj.origin}${urlObj.pathname.endsWith('/') ? urlObj.pathname : urlObj.pathname + '/'}feed/`;
    }

    if (rssUrl) {
      try {
        log(`Checking RSS feed: ${rssUrl}`);
        const feed = await this.rssParser.parseURL(rssUrl);
        if (feed.items && feed.items.length > 0) {
          log(`Found ${feed.items.length} items in RSS feed`);
          const rssChapters = feed.items
            .filter(item => item.link)
            .map((item, index) => ({
              url: item.link!,
              title: item.title || `Chapter ${index + 1}`,
              order: index
            }))
            .reverse(); // Oldest first
          
          rssChapters.forEach(ch => {
            if (!seenUrls.has(ch.url)) {
              seenUrls.add(ch.url);
              chapters.push(ch);
            }
          });
        }
      } catch (e) {
        log("RSS feed discovery failed or empty");
      }
    }

    // 2. Spider Crawling (Pagination / Next Links)
    const MAX_PAGES = 100;
    const BATCH_SIZE = 5;
    const visitedPages = new Set<string>();
    let pagesToVisit: string[] = [startUrl];
    const heuristicChapters: ChapterInfo[] = [];
    let pagesFetched = 0;

    const ignoreSelectors = 'nav, header, footer, aside, .sidebar, .menu, .related, .popular, .widget, .nav-links, .entry-meta, .comments-area, .site-header, .site-footer, #sidebar, #header, #footer, .navbar, .dropdown, .recommendations, .post-nav, .next-post, .prev-post';

    while (pagesToVisit.length > 0 && pagesFetched < MAX_PAGES) {
      const batch = pagesToVisit.splice(0, BATCH_SIZE).filter(url => !visitedPages.has(url));
      if (batch.length === 0) continue;

      batch.forEach(url => visitedPages.add(url));
      pagesFetched += batch.length;
      log(`Fetching batch of ${batch.length} pages... (Total: ${pagesFetched}/${MAX_PAGES})`);

      const promises = batch.map(async (currentUrl) => {
        try {
          const response = await axios.get(currentUrl, { headers, timeout: 10000 });
          return { url: currentUrl, html: response.data };
        } catch (e) {
          console.error(`Failed to fetch URL: ${currentUrl}`);
          return null;
        }
      });

      const results = await Promise.all(promises);

      for (const res of results) {
        if (!res) continue;
        const $ = cheerio.load(res.html);
        
        $('a').each((_, el) => {
          const inIgnoredContainer = $(el).closest(ignoreSelectors).length > 0;
          let href = $(el).attr('href');
          const text = $(el).text().trim().toLowerCase();
          
          if (!href) return;

          try {
            href = new URL(href, res.url).toString();
          } catch (e) {
            return;
          }

          if (href.split('#')[0] === res.url.split('#')[0]) return;

          const startUrlObj = new URL(startUrl);
          const hrefObj = new URL(href);
          if (startUrlObj.hostname !== hrefObj.hostname) return;

          // Path restriction: If the start URL has multiple path segments (e.g., /spellbound/chapter-1),
          // assume the first segment is the series folder and restrict links to that folder.
          const startParts = startUrlObj.pathname.split('/').filter(Boolean);
          if (startParts.length > 1) {
            const seriesPrefix = '/' + startParts[0] + '/';
            // Allow if it starts with the series prefix, OR if it's exactly the series root (e.g., /spellbound)
            if (!hrefObj.pathname.startsWith(seriesPrefix) && hrefObj.pathname !== '/' + startParts[0]) {
              return; // Skip links that belong to different stories (e.g., /the-crimson-crown)
            }
          }

          // 1. Check if it's a chapter link
          if (!inIgnoredContainer) {
            const isChapterLink = 
              /chapter|ch-|episode|part/i.test(href) || 
              /chapter|ch\.|episode|part/i.test(text) ||
              /^\d+$/.test(text);

            if (isChapterLink && !seenUrls.has(href)) {
              seenUrls.add(href);
              heuristicChapters.push({
                url: href,
                title: $(el).text().trim() || `Chapter ${chapters.length + heuristicChapters.length + 1}`,
                order: chapters.length + heuristicChapters.length
              });
            }
          }

          // 2. Check if it's a pagination or navigation link
          const isNav = 
            $(el).attr('rel') === 'next' || 
            $(el).attr('rel') === 'prev' ||
            $(el).closest('.nav-previous, .nav-next, .pagination, .page-numbers, .post-navigation').length > 0 ||
            ['next', 'previous', 'older', 'newer', '<<', '>>', 'next chapter', 'previous chapter'].some(t => text.includes(t)) ||
            /^page\s*\d+$/i.test(text) ||
            /^\d+$/.test(text);

          if (isNav && !visitedPages.has(href) && !pagesToVisit.includes(href)) {
            pagesToVisit.push(href);
          }
        });
      }
    }

    // Merge RSS and Heuristics
    if (heuristicChapters.length > 0) {
      log(`Found ${heuristicChapters.length} additional chapters via heuristics across ${pagesFetched} pages`);
      chapters = [...chapters, ...heuristicChapters];
    }

    if (chapters.length > 0) {
      // Sort chapters by extracting numbers from title or URL
      const getChapterNum = (ch: ChapterInfo) => {
        const titleMatch = ch.title.match(/(\d+)/);
        if (titleMatch) return parseInt(titleMatch[1], 10);
        const urlMatch = ch.url.match(/(\d+)/);
        if (urlMatch) return parseInt(urlMatch[1], 10);
        return ch.order;
      };

      chapters.sort((a, b) => getChapterNum(a) - getChapterNum(b));

      // Re-assign order
      return chapters.map((ch, i) => ({ ...ch, order: i }));
    }

    // 3. Fallback: Just the start URL itself
    return [{
      url: startUrl,
      title: "Start Page",
      order: 0
    }];
  }

  async extractChapterContent(url: string): Promise<{ title: string; content: string }> {
    console.log(`Extracting content from: ${url}`);
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': url,
    };
    try {
      const response = await axios.get(url, { headers });
      
      const dom = new JSDOM(response.data, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      if (!article) {
        throw new Error("Readability failed to parse content");
      }

      // Basic cleanup of the extracted HTML
      const $ = cheerio.load(article.content);
      
      // Remove unwanted elements that Readability might miss
      $('script, style, iframe, ads, .ads, .comments, #comments').remove();
      
      // Ensure images have absolute URLs
      $('img').each((_, img) => {
        const src = $(img).attr('src');
        if (src && !src.startsWith('http')) {
          try {
            $(img).attr('src', new URL(src, url).toString());
          } catch (e) {
            // Ignore invalid URLs
          }
        }
      });

      return {
        title: article.title || "Untitled Chapter",
        content: $.html()
      };
    } catch (e) {
      console.error(`Failed to extract content from ${url}:`, e);
      throw e;
    }
  }

  async createEpub(title: string, author: string, chapters: { title: string; content: string }[]): Promise<Buffer> {
    console.log(`Building EPUB: ${title} by ${author}`);
    
    const options = {
      title: title,
      author: author,
      publisher: "WebWeaver"
    };

    const content = chapters.map(ch => ({
      title: ch.title,
      content: ch.content
    }));

    try {
      const epub = new EPub(options, content);
      const buffer = await epub.genEpub();
      return buffer;
    } catch (e) {
      console.error("EPUB generation failed:", e);
      throw e;
    }
  }
}
