// ============================================================
// CoreNull | api/upload.js v2.0
// action=cover  → houses.cover_url 업데이트
// action=media  → media 테이블 저장 (기본값)
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { action, file_url, file_base64, house_id,
          media_type, content, event_tag, event_date, room_id } = req.body;

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const HEADERS = {
    'apikey':          SERVICE_KEY,
    'Authorization':   `Bearer ${SERVICE_KEY}`,
    'Content-Type':    'application/json',
    'Accept-Profile':  'corenull',
    'Content-Profile': 'corenull',
    'Prefer':          'return=representation'
  };

  // ── action=cover : houses.cover_url 업데이트
  if (action === 'cover') {
    const coverUrl = file_url || file_base64; // 둘 다 허용
    if (!coverUrl || !house_id) {
      return res.status(400).json({ error: 'file_url(또는 file_base64), house_id 필수' });
    }

    const dbRes = await fetch(
      `${SUPABASE_URL}/rest/v1/houses?id=eq.${house_id}`,
      { method: 'PATCH', headers: HEADERS, body: JSON.stringify({ cover_url: coverUrl }) }
    );

    if (!dbRes.ok) {
      const detail = await dbRes.text();
      return res.status(500).json({ error: 'DB 저장 실패', detail });
    }
    return res.status(200).json({ success: true, cover_url: coverUrl });
  }

  // ── action=media (기본값) : media 테이블 저장
  const mediaUrl = file_url || file_base64;
  if (!mediaUrl || !house_id) {
    return res.status(400).json({ error: 'file_url, house_id 필수' });
  }

  const dbRes = await fetch(
    `${SUPABASE_URL}/rest/v1/media`,
    {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        house_id,
        room_id:    room_id    || null,
        media_type: media_type || 'photo',
        file_url:   mediaUrl,
        content:    content    || null,
        event_tag:  event_tag  || null,
        event_date: event_date || null,
        is_owner:   true,
        status:     'approved'
      })
    }
  );

  const db = await dbRes.json();
  if (!dbRes.ok) {
    return res.status(500).json({ error: 'DB 저장 실패', detail: db });
  }
  return res.status(200).json({ success: true, data: db });
}