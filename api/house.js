// ============================================================
// CoreNull | api/house.js
// slug 기반 집 조회 + 미디어 + 댓글 + 마일스톤
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'slug required' });

  // ✅ 디버그 추가
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('KEY prefix:', process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 20));

  const { data: house, error } = await supabase
    .schema('corenull')
    .from('houses')
    .select('*')
    .eq('slug', slug)
    .eq('is_public', true)
    .single();

  // ✅ 디버그 추가
  console.log('house:', house);
  console.log('error:', error);

  if (error || !house) {
    return res.status(404).json({ error: '존재하지 않는 집입니다', debug: error });
  }

  // 미디어 (approved만)
  const { data: media } = await supabase
    .schema('corenull')
    .from('media')
    .select('id, media_type, file_url, thumbnail_url, content, event_tag, event_date, uploaded_by, is_owner, video_url, video_platform, created_at')
    .eq('house_id', house.id)
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  // 댓글 (방명록) - 최근 20개
  const { data: comments } = await supabase
    .schema('corenull')
    .from('comments')
    .select('id, author_name, content, lang, created_at')
    .eq('house_id', house.id)
    .order('created_at', { ascending: false })
    .limit(20);

  // 마일스톤
  const { data: milestones } = await supabase
    .schema('corenull')
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
