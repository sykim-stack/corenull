// ============================================================
// CoreNull | api/media-update.js
// 갤러리 사진 설명 수정 (오너 전용)
// ============================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'PATCH') return res.status(405).end();
  
    const { media_id, house_id, content } = req.body;
    if (!media_id || !house_id) {
      return res.status(400).json({ error: 'media_id, house_id 필수' });
    }
  
    const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const baseUrl = process.env.SUPABASE_URL;
  
    const dbRes = await fetch(
      `${baseUrl}/rest/v1/media?id=eq.${media_id}&house_id=eq.${house_id}`,
      {
        method: 'PATCH',
        headers: {
          'apikey':          key,
          'Authorization':   `Bearer ${key}`,
          'Content-Type':    'application/json',
          'Accept-Profile':  'corenull',
          'Content-Profile': 'corenull',
          'Prefer':          'return=representation'
        },
        body: JSON.stringify({ content })
      }
    );
  
    const db = await dbRes.json();
    if (!dbRes.ok) {
      return res.status(500).json({ error: 'DB 수정 실패', detail: db });
    }
  
    return res.status(200).json({ success: true, data: db });
  }