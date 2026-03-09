// ============================================================
// CoreNull | api/upload.js
// Cloudinary 이미지 업로드 + Supabase media 저장
// ============================================================

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { file_base64, media_type, content, event_tag, event_date, room_id, house_id } = req.body;

  if (!file_base64 || !house_id) {
    return res.status(400).json({ error: 'file_base64, house_id 필수' });
  }

  // 1. Cloudinary 업로드
  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file:          file_base64,
        upload_preset: process.env.CLOUDINARY_UPLOAD_PRESET
      })
    }
  );
  const cloud = await cloudRes.json();
  if (!cloud.secure_url) {
    return res.status(500).json({ error: 'Cloudinary 업로드 실패', detail: cloud });
  }

  // 2. Supabase 저장
  const dbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/media`,
    {
      method: 'POST',
      headers: {
        'apikey':          process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization':   `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':    'application/json',
        'Accept-Profile':  'corenull',
        'Content-Profile': 'corenull',
        'Prefer':          'return=representation'
      },
      body: JSON.stringify({
        house_id,
        room_id:       room_id || null,
        media_type:    media_type || 'photo',
        file_url:      cloud.secure_url,
        thumbnail_url: cloud.eager?.[0]?.secure_url || null,
        content:       content || null,
        event_tag:     event_tag || null,
        event_date:    event_date || null,
        is_owner:      true,
        status:        'approved'
      })
    }
  );
  const db = await dbRes.json();

  return res.status(200).json({ success: true, file_url: cloud.secure_url, data: db });
}
