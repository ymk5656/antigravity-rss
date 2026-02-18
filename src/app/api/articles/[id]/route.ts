import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const { data: article } = await supabase
    .from('articles')
    .select('feed_id')
    .eq('id', id)
    .single();

  if (!article) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { data: feed } = await supabase
    .from('feeds')
    .select('user_id')
    .eq('id', article.feed_id)
    .single();

  if (!feed || feed.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  
  if (body.is_read !== undefined) {
    updates.is_read = body.is_read;
    updates.read_at = body.is_read ? new Date().toISOString() : null;
  }
  if (body.is_starred !== undefined) {
    updates.is_starred = body.is_starred;
  }

  const { data, error } = await supabase
    .from('articles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ article: data });
}
