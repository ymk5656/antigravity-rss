import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const { data: feed, error: feedError } = await supabase
    .from('feeds')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (feedError || !feed) {
    return NextResponse.json({ error: 'Feed not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('feeds')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
