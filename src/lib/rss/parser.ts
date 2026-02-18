import Parser from 'rss-parser';
import * as cheerio from 'cheerio';

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
  const $ = cheerio.load(html);

  // Remove unwanted elements
  REMOVE_ELEMENTS.forEach(tag => $(tag).remove());

  // Remove disallowed tags but keep their text content
  const allowedAttrs = ['href', 'src', 'alt', 'title', 'class', 'target'];
  $('*').each((_i, el) => {
    const node = el as cheerio.TagElement;
    if (!node.tagName) return;
    const tagName = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.includes(tagName) && tagName !== 'html' && tagName !== 'head' && tagName !== 'body') {
      $(el).replaceWith($(el).html() || '');
    }
  });

  // Remove disallowed attributes
  $('*').each((_i, el) => {
    const node = el as cheerio.TagElement;
    const attribs = node.attribs || {};
    Object.keys(attribs).forEach(attr => {
      if (!allowedAttrs.includes(attr)) {
        $(el).removeAttr(attr);
      }
    });
  });

  return $('body').html() || '';
}

function extractSummary(content: string, maxLength: number = 200): string {
  const $ = cheerio.load(content);
  const text = $.root().text().trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}

function looksLikeFeedUrl(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  return /\.(xml|rss|atom)$/.test(path) || /\/(feed|rss|atom)(\/|$)/i.test(path);
}

interface DiscoverResult {
  url: string;
  /** Pre-fetched XML body to avoid re-fetching */
  body?: string;
}

async function discoverFeedUrl(url: string): Promise<DiscoverResult> {
  // Skip discovery if URL already looks like a feed
  if (looksLikeFeedUrl(url)) return { url };

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Antigravity-RSS/1.0',
        'Accept': 'text/html, application/xhtml+xml, application/xml',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('xml') || contentType.includes('rss') || contentType.includes('atom')) {
      // Return pre-fetched body to avoid a second request
      const body = await res.text();
      return { url, body };
    }
    if (contentType.includes('html')) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const feedLink = $('link[type="application/rss+xml"]').attr('href')
        || $('link[type="application/atom+xml"]').attr('href');
      if (feedLink) {
        try {
          return { url: new URL(feedLink, url).toString() };
        } catch {
          return { url: feedLink };
        }
      }
    }
  } catch {
    // Fall through to try common paths
  }

  // Only try 2 most common paths to avoid rate limiting
  const commonPaths = ['/feed', '/rss.xml'];
  const base = new URL(url);
  for (const path of commonPaths) {
    try {
      const testUrl = new URL(path, base.origin).toString();
      const res = await fetch(testUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'Antigravity-RSS/1.0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('xml') || ct.includes('rss') || ct.includes('atom')) {
          return { url: testUrl };
        }
      }
    } catch {
      continue;
    }
  }

  return { url };
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const discovered = await discoverFeedUrl(url);
  const feedUrl = discovered.url;

  const parser = new Parser({
    timeout: 15000,
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

  // Use pre-fetched body if available to avoid duplicate requests
  const feed = discovered.body
    ? await parser.parseString(discovered.body)
    : await parser.parseURL(feedUrl);
  
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
    const msg = String(error);
    let userError = 'Failed to parse feed';
    if (msg.includes('404')) {
      userError = 'No RSS feed found at this URL. Try using the direct feed URL (e.g. .../feed or .../rss.xml)';
    } else if (msg.includes('429')) {
      userError = 'Too many requests. Please wait a moment and try again';
    } else if (msg.includes('timeout') || msg.includes('abort')) {
      userError = 'Request timed out. The server may be slow or unreachable';
    }
    return { feed: { title: '', description: '', link: '', favicon: '', articles: [] }, error: userError };
  }
}
