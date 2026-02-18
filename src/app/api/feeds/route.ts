import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchAndParseFeed } from '@/lib/rss/parser';
import { syncFeed } from '@/lib/rss/sync';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: feeds, error } = await supabase
    .from('feeds')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feeds });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { url } = await request.json();
  
  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const { feed: parsedFeed, error: parseError } = await fetchAndParseFeed(url);
  
  if (parseError) {
    return NextResponse.json({ error: `Failed to parse feed: ${parseError}` }, { status: 400 });
  }

  const { data: feed, error } = await supabase
    .from('feeds')
    .insert({
      user_id: user.id,
      url,
      title: parsedFeed.title,
      description: parsedFeed.description,
      site_url: parsedFeed.link,
      favicon: parsedFeed.favicon,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Feed already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  syncFeed(feed.id).then(({ inserted }) => {
    console.log(`Synced ${inserted} articles for feed ${feed.id}`);
  });

  return NextResponse.json({ feed }, { status: 201 });
}
