import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { syncFeed, syncAllUserFeeds } from '@/lib/rss/sync';

export const maxDuration = 60;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { feedId } = await request.json().catch(() => ({}));

  if (feedId) {
    // 특정 피드만 sync
    const { data: feed } = await supabase
      .from('feeds')
      .select('id')
      .eq('id', feedId)
      .eq('user_id', user.id)
      .single();

    if (!feed) {
      return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
    }

    const result = await syncFeed(feedId);
    return NextResponse.json({ results: [{ feedId, ...result }] });
  }

  // 전체 피드 sync
  const results = await syncAllUserFeeds(user.id);
  return NextResponse.json({ results });
}
