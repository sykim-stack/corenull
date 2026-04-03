// api/share.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // POST: invite_code 생성
  // body: { post_id, house_id, owner_key }
  if (req.method === 'POST') {
    const { post_id, house_id, owner_key } = req.body;
    if (!post_id || !house_id || !owner_key)
      return res.status(400).json({ error: 'post_id, house_id, owner_key required' });

    // owner 검증
    const hRes = await fetch(`${baseUrl}/rest/v1/houses?id=eq.${house_id}&owner_key=eq.${owner_key}&limit=1`, { headers });
    const h = await hRes.json();
    if (!h[0]) return res.status(403).json({ error: '권한 없음' });

    // 이미 invite_code 있으면 그대로 반환
    const pRes = await fetch(`${baseUrl}/rest/v1/posts?id=eq.${post_id}&select=invite_code`, { headers });
    const p = await pRes.json();
    if (p[0]?.invite_code) return res.status(200).json({ invite_code: p[0].invite_code });

    // 신규 코드 생성 (6자리)
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    await fetch(`${baseUrl}/rest/v1/posts?id=eq.${post_id}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ invite_code: code, is_shared: true })
    });

    return res.status(200).json({ invite_code: code });
  }

  // GET: invite_code로 포스트 + 집 + 댓글 조회
  // query: ?code=XXXXXX
  if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) return res.status(400).json({ error: 'code required' });

    // 포스트 조회
    const pRes = await fetch(`${baseUrl}/rest/v1/posts?invite_code=eq.${code}&select=*&limit=1`, { headers });
    const posts = await pRes.json();
    const post = posts[0];
    if (!post) return res.status(404).json({ error: '존재하지 않는 초대 코드예요' });

    // 집 정보
    const hRes = await fetch(`${baseUrl}/rest/v1/houses?id=eq.${post.house_id}&select=id,name,slug,profile_url,cover_url&limit=1`, { headers });
    const houses = await hRes.json();
    const house = houses[0];

    // 방 정보
    let room = null;
    if (post.room_id) {
      const rRes = await fetch(`${baseUrl}/rest/v1/rooms?id=eq.${post.room_id}&select=id,room_name&limit=1`, { headers });
      const rooms = await rRes.json();
      room = rooms[0] || null;
    }

    // 댓글 최대 3개
    const cRes = await fetch(`${baseUrl}/rest/v1/comments?post_id=eq.${post.id}&order=created_at.asc&limit=3`, { headers });
    const comments = await cRes.json();

    return res.status(200).json({ post, house, room, comments: Array.isArray(comments) ? comments : [] });
  }

  return res.status(405).end();
}