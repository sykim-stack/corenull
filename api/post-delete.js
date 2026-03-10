// ============================================================
// CoreNull | api/post-delete.js
// 메시지 삭제 (오너 전용)
// ============================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'DELETE') return res.status(405).end();
  
    const { post_id, house_id } = req.body;
    if (!post_id || !house_id) {
      return res.status(400).json({ error: 'post_id, house_id 필수' });
    }
  
    const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const baseUrl = process.env.SUPABASE_URL;
  
    const dbRes = await fetch(
      `${baseUrl}/rest/v1/event_posts?id=eq.${post_id}&house_id=eq.${house_id}`,
      {
        method: 'DELETE',
        headers: {
          'apikey':          key,
          'Authorization':   `Bearer ${key}`,
          'Content-Type':    'application/json',
          'Accept-Profile':  'corenull',
          'Content-Profile': 'corenull'
        }
      }
    );
  
    if (!dbRes.ok) {
      const err = await dbRes.text();
      return res.status(500).json({ error: 'DB 삭제 실패', detail: err });
    }
  
    return res.status(200).json({ success: true });
  }