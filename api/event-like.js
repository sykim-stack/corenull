// ============================================================
// CoreNull | api/event-like.js
// 이벤트 포스트 좋아요
// ============================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();
  
    const { post_id, author_name, emoji } = req.body;
    if (!post_id) return res.status(400).json({ error: 'post_id 필수' });
  
    const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const baseUrl = process.env.SUPABASE_URL;
  
    const dbRes = await fetch(`${baseUrl}/rest/v1/event_likes`, {
      method: 'POST',
      headers: {
        'apikey':           key,
        'Authorization':    `Bearer ${key}`,
        'Content-Type':     'application/json',
        'Accept-Profile':   'corenull',
        'Content-Profile':  'corenull'
      },
      body: JSON.stringify({
        post_id,
        author_name: author_name || '익명',
        emoji:       emoji || '❤️'
      })
    });
  
    return res.status(200).json({ success: true });
  }