import { createClient } from '@/lib/supabase/server';
import { parseFeed } from './parser';

export async function syncFeed(feedId: string): Promise<{ inserted: number; errors: string[] }> {
  const supabase = await createClient();
  
  const { data: feed, error: feedError } = await supabase
    .from('feeds')
    .select('*')
    .eq('id', feedId)
    .single();
  
  if (feedError || !feed) {
    return { inserted: 0, errors: ['Feed not found'] };
  }

  const parsed = await parseFeed(feed.url);
  
  if (!parsed.articles.length) {
    await supabase
      .from('feeds')
      .update({ 
        last_fetched: new Date().toISOString(),
        error_count: (feed.error_count || 0) + 1,
        last_error: 'No articles found'
      })
      .eq('id', feedId);
    return { inserted: 0, errors: ['No articles found'] };
  }

  const { data: existingArticles } = await supabase
    .from('articles')
    .select('guid')
    .eq('feed_id', feedId);
  
  const existingGuids = new Set(existingArticles?.map(a => a.guid) || []);
  
  const newArticles = parsed.articles
    .filter(article => !existingGuids.has(article.guid))
    .map(article => ({
      feed_id: feedId,
      guid: article.guid,
      title: article.title,
      content: article.content,
      content_html: article.contentHtml,
      summary: article.summary,
      author: article.author,
      link: article.link,
      image_url: article.imageUrl,
      pub_date: article.pubDate?.toISOString() || null,
    }));

  let inserted = 0;
  const errors: string[] = [];

  if (newArticles.length > 0) {
    const { data, error } = await supabase
      .from('articles')
      .insert(newArticles)
      .select();
    
    if (error) {
      errors.push(error.message);
    } else {
      inserted = data?.length || 0;
    }
  }

  await supabase
    .from('feeds')
    .update({
      title: parsed.title || feed.title,
      description: parsed.description || feed.description,
      site_url: parsed.link || feed.site_url,
      favicon: parsed.favicon || feed.favicon,
      last_fetched: new Date().toISOString(),
      error_count: 0,
      last_error: null,
    })
    .eq('id', feedId);

  return { inserted, errors };
}

export async function syncAllUserFeeds(userId: string): Promise<{ feedId: string; inserted: number }[]> {
  const supabase = await createClient();
  
  const { data: feeds } = await supabase
    .from('feeds')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (!feeds) return [];

  const results = await Promise.all(
    feeds.map(async (feed) => {
      const result = await syncFeed(feed.id);
      return { feedId: feed.id, inserted: result.inserted };
    })
  );

  return results;
}
