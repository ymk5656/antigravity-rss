import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: feeds, error } = await supabase
    .from('feeds')
    .select('title, url, category')
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const opml = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>RSS Reader Subscriptions</title>
    <dateCreated>${new Date().toISOString()}</dateCreated>
  </head>
  <body>
${feeds?.map(feed => `    <outline text="${escapeXml(feed.title || feed.url)}" title="${escapeXml(feed.title || feed.url)}" type="rss" xmlUrl="${escapeXml(feed.url)}" htmlUrl=""/>`).join('\n')}
  </body>
</opml>`;

  return new NextResponse(opml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': 'attachment; filename="subscriptions.opml"',
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const text = await file.text();
    const urls = extractFeedUrls(text);

    if (urls.length === 0) {
      return NextResponse.json({ error: 'No feed URLs found in OPML' }, { status: 400 });
    }

    const results = { imported: 0, failed: 0, errors: [] as string[] };
    
    for (const url of urls) {
      try {
        const { data: existingFeed } = await supabase
          .from('feeds')
          .select('id')
          .eq('user_id', user.id)
          .eq('url', url.url)
          .single();

        if (!existingFeed) {
          const { error: insertError } = await supabase
            .from('feeds')
            .insert({
              user_id: user.id,
              url: url.url,
              title: url.title,
            });

          if (insertError) {
            results.failed++;
            results.errors.push(`Failed to import ${url.url}: ${insertError.message}`);
          } else {
            results.imported++;
          }
        }
      } catch (e) {
        results.failed++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to parse OPML file' }, { status: 400 });
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractFeedUrls(opml: string): { url: string; title: string }[] {
  const urls: { url: string; title: string }[] = [];
  const xmlUrlRegex = /xmlUrl="([^"]+)"/g;
  const textRegex = /text="([^"]+)"/g;
  
  const xmlUrls = [...opml.matchAll(xmlUrlRegex)].map(m => m[1]);
  const texts = [...opml.matchAll(textRegex)].map(m => m[1]);
  
  xmlUrls.forEach((url, index) => {
    urls.push({ url, title: texts[index] || '' });
  });
  
  return urls;
}
