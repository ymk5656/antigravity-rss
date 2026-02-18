import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import DOMPurify from 'isomorphic-dompurify';

export interface ParsedArticle {
  guid: string;
  title: string;
  content: string;
  contentHtml: string;
  summary: string;
  author: string;
  link: string;
  imageUrl: string;
  pubDate: Date | null;
}

export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  favicon: string;
  articles: ParsedArticle[];
}

const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'fbclid', 'gclid', 'ref', 'source', 'mc_cid', 'mc_eid', 'yclid'
];

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'pre', 'code', 'figure', 'figcaption'
];

const REMOVE_ELEMENTS = ['script', 'style', 'iframe', 'form', 'object', 'embed', 'noscript'];

function cleanUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    TRACKING_PARAMS.forEach(param => urlObj.searchParams.delete(param));
    return urlObj.toString();
  } catch {
    return url;
  }
}

function extractImage(html: string): string | null {
  const $ = cheerio.load(html);
  const img = $('img').first();
  return img.attr('src') || null;
}

function sanitizeContent(html: string): string {
  // Remove unwanted elements
  const $ = cheerio.load(html);
  REMOVE_ELEMENTS.forEach(tag => $(tag).remove());
  
  // Get cleaned HTML
  let cleaned = $.html();
  
  // Sanitize with DOMPurify
  cleaned = DOMPurify.sanitize(cleaned, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'target'],
  });
  
  return cleaned;
}

function extractSummary(content: string, maxLength: number = 200): string {
  const $ = cheerio.load(content);
  const text = $.root().text().trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const parser = new Parser({
    timeout: 10000,
    headers: {
      'User-Agent': 'Antigravity-RSS/1.0',
      'Accept': 'application/rss+xml, application/xml, application/atom+xml, text/xml',
    },
    customFields: {
      item: [
        ['media:content', 'mediaContent', { keepArray: false }],
        ['media:thumbnail', 'mediaThumbnail', { keepArray: false }],
        ['content:encoded', 'contentEncoded'],
      ],
    },
  });

  const feed = await parser.parseURL(url);
  
  const articles: ParsedArticle[] = (feed.items || []).map((item: any) => {
    const content = item.contentEncoded || item['content:encoded'] || item.content || item.description || '';
    const contentHtml = sanitizeContent(content);
    
    return {
      guid: item.guid || item.link || item.title || Math.random().toString(36),
      title: item.title || 'Untitled',
      content: extractSummary(content),
      contentHtml,
      summary: extractSummary(item.contentSnippet || item.summary || item.description || ''),
      author: item.creator || item.author || '',
      link: cleanUrl(item.link || ''),
      imageUrl: item['mediaContent']?.['$']?.url || item['mediaThumbnail']?.['$']?.url || extractImage(content),
      pubDate: item.pubDate ? new Date(item.pubDate) : null,
    };
  });

  return {
    title: feed.title || '',
    description: feed.description || '',
    link: feed.link || '',
    favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`,
    articles,
  };
}

export async function fetchAndParseFeed(url: string): Promise<{ feed: ParsedFeed; error?: string }> {
  try {
    const feed = await parseFeed(url);
    return { feed };
  } catch (error) {
    return { feed: { title: '', description: '', link: '', favicon: '', articles: [] }, error: String(error) };
  }
}
