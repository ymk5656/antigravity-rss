import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const feedId = searchParams.get('feed_id');
  const isRead = searchParams.get('is_read');
  const isStarred = searchParams.get('is_starred');
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  const { data: userFeeds } = await supabase
    .from('feeds')
    .select('id')
    .eq('user_id', user.id);

  if (!userFeeds || userFeeds.length === 0) {
    return NextResponse.json({ articles: [] });
  }

  const feedIds = userFeeds.map(f => f.id);
  
  let query = supabase
    .from('articles')
    .select(`
      *,
      feeds:feed_id (title, favicon, url, site_url)
    `)
    .in('feed_id', feedIds);

  if (feedId) {
    query = query.eq('feed_id', feedId);
  }
  if (isRead !== null) {
    query = query.eq('is_read', isRead === 'true');
  }
  if (isStarred !== null) {
    query = query.eq('is_starred', isStarred === 'true');
  }

  const { data: articles, error } = await query
    .order('pub_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ articles });
}
