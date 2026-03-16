export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const baseUrl = process.env.SUPABASE_URL;
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept-Profile': 'corenull',
    'Content-Profile': 'corenull',
  };

  // GET — 방별 글 목록
  if (req.method === 'GET') {
    const { house_id, room_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id required' });

    let url = `${baseUrl}/rest/v1/posts?house_id=eq.${house_id}&order=created_at.desc&limit=50`;
    if (room_id) url += `&room_id=eq.${room_id}`;

    const postsRes = await fetch(url, { headers });
    const posts    = await postsRes.json();
    if (!Array.isArray(posts)) return res.status(200).json([]);

    // post_categories 조회
    if (posts.length === 0) return res.status(200).json([]);
    const postIds = posts.map(p => `post_id=eq.${p.id}`).join(',');
    const pcRes   = await fetch(
      `${baseUrl}/rest/v1/post_categories?or=(${postIds})&select=post_id,category_id`,
      { headers }
    );
    const pcData = await pcRes.json();
    const pc     = Array.isArray(pcData) ? pcData : [];

    const result = posts.map(p => ({
      ...p,
      category_ids: pc.filter(x => x.post_id === p.id).map(x => x.category_id)
    }));

    return res.status(200).json(result);
  }

  // POST — 글 작성
  if (req.method === 'POST') {
    const { house_id, room_id, content, media_urls, category_ids } = req.body;
    if (!house_id || !room_id) return res.status(400).json({ error: 'house_id, room_id required' });

    // posts INSERT
    const insertRes = await fetch(`${baseUrl}/rest/v1/posts`, {
      method: 'POST',
      headers: { ...headers, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        house_id,
        room_id,
        content:    content || null,
        media_urls: media_urls || [],
      })
    });
    const inserted = await insertRes.json();
    const post     = Array.isArray(inserted) ? inserted[0] : inserted;

    if (!post || !post.id) {
      return res.status(500).json({ error: '글 저장 실패', detail: inserted });
    }

    // post_categories INSERT (멀티 분류)
    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const pcRows = category_ids.map(cid => ({ post_id: post.id, category_id: cid }));
      await fetch(`${baseUrl}/rest/v1/post_categories`, {
        method: 'POST',
        headers,
        body: JSON.stringify(pcRows)
      });
    }

    return res.status(200).json({ success: true, post });
  }

  // DELETE — 글 삭제
  if (req.method === 'DELETE') {
    const { post_id, house_id } = req.body;
    if (!post_id || !house_id) return res.status(400).json({ error: 'post_id, house_id required' });

    // post_categories 먼저 삭제
    await fetch(`${baseUrl}/rest/v1/post_categories?post_id=eq.${post_id}`, {
      method: 'DELETE', headers
    });

    // post 삭제
    await fetch(`${baseUrl}/rest/v1/posts?id=eq.${post_id}&house_id=eq.${house_id}`, {
      method: 'DELETE', headers
    });

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}