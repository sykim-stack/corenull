// ============================================================
// CoreNull | api/event-posts.js
// 이벤트 방 피드 조회
// ============================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
  
    const { house_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id 필수' });
  
    const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const baseUrl = process.env.SUPABASE_URL;
    const headers = {
      'apikey':          key,
      'Authorization':   `Bearer ${key}`,
      'Accept-Profile':  'corenull'
    };
  
    // 피드 조회
    const postsRes = await fetch(
      `${baseUrl}/rest/v1/event_posts?house_id=eq.${house_id}&order=created_at.desc`,
      { headers }
    );
    const posts = await postsRes.json();
  
    if (!Array.isArray(posts)) return res.status(500).json({ error: posts });
  
    // 좋아요 수 조회
    const likesRes = await fetch(
      `${baseUrl}/rest/v1/event_likes?select=post_id`,
      { headers }
    );
    const likes = await likesRes.json();
  
    const likeMap = {};
    if (Array.isArray(likes)) {
      likes.forEach(l => {
        likeMap[l.post_id] = (likeMap[l.post_id] || 0) + 1;
      });
    }
  
    const result = posts.map(p => ({
      ...p,
      like_count: likeMap[p.id] || 0
    }));
  
    return res.status(200).json(result);
  }