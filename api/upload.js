// api/upload.js
// 미디어 메타데이터 Supabase 저장
// (실제 파일 업로드는 브라우저 → Cloudinary 직접)

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const {
    house_id,
    media_type,     // photo | video
    file_url,       // Cloudinary URL
    thumbnail_url,
    video_url,      // YouTube/TikTok URL
    video_platform, // youtube | tiktok | facebook
    event_tag,      // daily | birth | hundred_days | first_step 등
    event_date,
    uploaded_by,    // 방문자 이름
    is_owner        // true: 집주인, false: 방문자
  } = req.body;

  if (!house_id || !media_type) {
    return res.status(400).json({ error: 'house_id, media_type required' });
  }

  // 집주인이면 approved, 방문자면 pending
  const status = is_owner ? 'approved' : 'pending';

  const { data, error } = await supabase
    .schema('corenull')
    .from('media')
    .insert({
      house_id,
      media_type,
      file_url:       file_url       || null,
      thumbnail_url:  thumbnail_url  || null,
      video_url:      video_url      || null,
      video_platform: video_platform || null,
      event_tag:      event_tag      || 'daily',
      event_date:     event_date     || null,
      uploaded_by:    uploaded_by    || null,
      is_owner:       is_owner       ?? true,
      status
    })
    .select()
    .single();

  if (error) {
    console.error('upload error:', error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true, media: data });
}