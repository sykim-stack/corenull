// ============================================================
// CoreNull | api/upload.js
// Cloudinary URL 받아서 Supabase media 저장
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { file_url, media_type, content, event_tag, event_date, room_id, house_id } = req.body;

  if (!file_url || !house_id) {
    return res.status(400).json({ error: 'file_url, house_id 필수' });
  }

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
        room_id:       room_id    || null,
        media_type:    media_type || 'photo',
        file_url,
        content:       content    || null,
        event_tag:     event_tag  || null,
        event_date:    event_date || null,
        is_owner:      true,
        status:        'approved'
      })
    }
  );

  const db = await dbRes.json();

  if (!dbRes.ok) {
    return res.status(500).json({ error: 'DB 저장 실패', detail: db });
  }

  return res.status(200).json({ success: true, data: db });
}
