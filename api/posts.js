// ============================================================
// CoreNull | api/posts.js
// GET: 메시지 목록 / POST: 메시지 등록 / DELETE: 메시지 삭제
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.SUPABASE_URL;

  const headers = {
    'apikey':          key,
    'Authorization':   `Bearer ${key}`,
    'Content-Type':    'application/json',
    'Accept-Profile':  'corenull',
    'Content-Profile': 'corenull'
  };

  if (req.method === 'GET') {
    const { house_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id 필수' });

    const dbRes = await fetch(
      `${baseUrl}/rest/v1/event_posts?house_id=eq.${house_id}&order=created_at.desc`,
      { headers }
    );
    const data = await dbRes.json();
    if (!dbRes.ok) return res.status(500).json({ error: '조회 실패', detail: data });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { house_id, author_name, content, lang, media_url, media_type } = req.body;
    if (!house_id || !author_name || !content)
      return res.status(400).json({ error: 'house_id, author_name, content 필수' });

    const dbRes = await fetch(
      `${baseUrl}/rest/v1/event_posts`,
      {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          house_id,
          author_name,
          content,
          lang:       lang       || 'ko',
          media_url:  media_url  || null,
          media_type: media_type || 'text'
        })
      }
    );
    const data = await dbRes.json();
    if (!dbRes.ok) return res.status(500).json({ error: '등록 실패', detail: data });
    return res.status(200).json({ success: true, data });
  }

  if (req.method === 'DELETE') {
    const { post_id, house_id } = req.body;
    if (!post_id || !house_id)
      return res.status(400).json({ error: 'post_id, house_id 필수' });

    const dbRes = await fetch(
      `${baseUrl}/rest/v1/event_posts?id=eq.${post_id}&house_id=eq.${house_id}`,
      { method: 'DELETE', headers }
    );
    if (!dbRes.ok) {
      const err = await dbRes.text();
      return res.status(500).json({ error: '삭제 실패', detail: err });
    }
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}