import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    db: { schema: 'corenull' }  // ← 클라이언트 생성 시 스키마 지정
  }
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'slug required' });

  const { data: house, error } = await supabase
    .from('houses')          // ← .schema() 제거
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  if (error || !house) {
    return res.status(404).json({ error: '존재하지 않는 집입니다', debug: error });
  }

  const { data: media } = await supabase
    .from('media')
    .select('id, media_type, file_url, thumbnail_url, content, event_tag, event_date, uploaded_by, is_owner, video_url, video_platform, created_at')
    .eq('house_id', house.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const { data: comments } = await supabase
    .from('comments')
    .select('id, author_name, content, lang, created_at')
    .eq('house_id', house.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const { data: milestones } = await supabase
    .from('milestones')
    .select('id, title, memo, milestone_date, category')
    .eq('house_id', house.id)
    .order('milestone_date', { ascending: true, nullsFirst: false });

  return res.status(200).json({
    house,
    media:      media      || [],
    comments:   comments   || [],
    milestones: milestones || []
  });
}
