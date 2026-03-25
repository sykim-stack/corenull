// api/posts.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
    'Prefer': 'return=representation',
  };

  // GET
  if (req.method === 'GET') {
  const { house_id, room_id, category_id, slug } = req.query;

  // slug → house_id 조회
  let houseId = house_id;
  if (!houseId && slug) {
    const hRes = await fetch(`${baseUrl}/rest/v1/houses?slug=eq.${slug}&select=id&limit=1`, { headers });
    const h = await hRes.json();
    houseId = h[0]?.id;
  }
  if (!houseId && !room_id) return res.status(400).json({ error: 'house_id or room_id required' });

  const filter = room_id ? `room_id=eq.${room_id}` : `house_id=eq.${houseId}`;
  const r = await fetch(`${baseUrl}/rest/v1/posts?${filter}&order=created_at.desc&limit=100`, { headers });
  const posts = await r.json();
  if (!Array.isArray(posts)) return res.status(500).json({ error: 'fetch failed', raw: posts });

  let result = posts;
  if (posts.length > 0) {
    const postIds = posts.map(p => `post_id=eq.${p.id}`).join(',');
    const pcRes = await fetch(`${baseUrl}/rest/v1/post_categories?or=(${postIds})&select=post_id,category_id`, { headers });
    const pc = await pcRes.json();
    result = posts.map(p => ({
      ...p,
      category_ids: Array.isArray(pc) ? pc.filter(x => x.post_id === p.id).map(x => x.category_id) : []
    }));
  }

  // category_id 필터
  if (category_id) {
    result = result.filter(p => p.category_ids.includes(category_id));
  }

  return res.status(200).json(result);
}

  // POST
  if (req.method === 'POST') {
    const { house_id, room_id, content, media_urls, category_ids, owner_key } = req.body;
    if (!house_id) return res.status(400).json({ error: 'house_id required' });

    if (owner_key) {
      const hRes = await fetch(`${baseUrl}/rest/v1/houses?id=eq.${house_id}&owner_key=eq.${owner_key}&limit=1`, { headers });
      const h = await hRes.json();
      if (!h[0]) return res.status(403).json({ error: '권한 없음' });
    }

    const body = {
      house_id,
      content: content ? content.trim() : null,
      media_urls: Array.isArray(media_urls) ? media_urls : [],
    };
    if (room_id) body.room_id = room_id;

    const pRes = await fetch(`${baseUrl}/rest/v1/posts`, {
      method: 'POST', headers, body: JSON.stringify(body)
    });
    const pText = await pRes.text();
    let pData;
    try { pData = JSON.parse(pText); } catch(e) { return res.status(500).json({ error: 'parse error', raw: pText }); }
    const post = Array.isArray(pData) ? pData[0] : pData;
    if (!post?.id) return res.status(500).json({ error: '글 생성 실패', raw: pData });

    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const pcRows = category_ids.map(cid => ({ post_id: post.id, category_id: cid }));
      await fetch(`${baseUrl}/rest/v1/post_categories`, {
        method: 'POST', headers, body: JSON.stringify(pcRows)
      });
    }

    return res.status(200).json({ ...post, category_ids: category_ids || [] });
  }

  // PUT
  if (req.method === 'PUT') {
    const { post_id, house_id, content, media_urls, category_ids, owner_key } = req.body;
    if (!post_id || !house_id) return res.status(400).json({ error: 'post_id, house_id required' });

    const hRes = await fetch(`${baseUrl}/rest/v1/houses?id=eq.${house_id}&owner_key=eq.${owner_key}&limit=1`, { headers });
    const h = await hRes.json();
    if (!h[0]) return res.status(403).json({ error: '권한 없음' });

    const updateBody = { updated_at: new Date().toISOString() };
    if (content)    updateBody.content    = content.trim();
    if (media_urls) updateBody.media_urls = media_urls;

    await fetch(`${baseUrl}/rest/v1/posts?id=eq.${post_id}&house_id=eq.${house_id}`, {
      method: 'PATCH', headers, body: JSON.stringify(updateBody)
    });

    if (Array.isArray(category_ids)) {
      await fetch(`${baseUrl}/rest/v1/post_categories?post_id=eq.${post_id}`, { method: 'DELETE', headers });
      if (category_ids.length > 0) {
        const pcRows = category_ids.map(cid => ({ post_id, category_id: cid }));
        await fetch(`${baseUrl}/rest/v1/post_categories`, {
          method: 'POST', headers, body: JSON.stringify(pcRows)
        });
      }
    }
    return res.status(200).json({ success: true });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { post_id, house_id, owner_key } = req.body;
    if (!post_id || !house_id) return res.status(400).json({ error: 'post_id, house_id required' });

    const hRes = await fetch(`${baseUrl}/rest/v1/houses?id=eq.${house_id}&owner_key=eq.${owner_key}&limit=1`, { headers });
    const h = await hRes.json();
    if (!h[0]) return res.status(403).json({ error: '권한 없음' });

    await fetch(`${baseUrl}/rest/v1/posts?id=eq.${post_id}&house_id=eq.${house_id}`, {
      method: 'DELETE', headers
    });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}