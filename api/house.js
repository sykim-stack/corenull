// api/house.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
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

  // ── POST: 방문 로그 ──────────────────────────────
  if (req.method === 'POST') {
    const { house_id, room_id, ref, invited_by } = req.body;
    if (!house_id) return res.status(400).json({ error: 'house_id 필요' });

    let device_id = req.headers['x-device-id'] || `anon_${Math.random().toString(36).substring(2, 12)}`;
    if (device_id.length > 50) device_id = device_id.substring(0, 50);

    try {
      await fetch(`${baseUrl}/rest/v1/visit_logs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          house_id,
          room_id: room_id || null,
          ref: ref || 'direct',
          invited_by: invited_by || null,
          device_id,
        }),
      });
    } catch (e) {}

    return res.status(200).json({ ok: true });
  }

  // ── GET: 집 전체 조회 ────────────────────────────
  if (req.method === 'GET') {
    const { slug, owner } = req.query;
    if (!slug) return res.status(400).json({ error: 'slug required' });

    const houseRes = await fetch(
      `${baseUrl}/rest/v1/houses?slug=eq.${slug}&limit=1`,
      { headers }
    );
    const houses = await houseRes.json();
    const house  = houses[0];

    if (!house) return res.status(404).json({ error: '존재하지 않는 집입니다' });
    if (!house.is_public) return res.status(403).json({ error: '비공개 집입니다' });

    const is_owner = !!(owner && house.owner_key && owner === house.owner_key);
    const { owner_key: _removed, ...houseSafe } = house;
    houseSafe.is_owner = is_owner;

    const [mediaRes, milestonesRes, roomsRes, categoriesRes, postsRes, commentsRes] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/media?house_id=eq.${house.id}&status=eq.approved&order=created_at.desc`, { headers }),
      fetch(`${baseUrl}/rest/v1/milestones?house_id=eq.${house.id}&order=milestone_date.asc`, { headers }),
      fetch(`${baseUrl}/rest/v1/rooms?house_id=eq.${house.id}&is_hidden=eq.false&order=order_num.asc`, { headers }),
      fetch(`${baseUrl}/rest/v1/categories?house_id=eq.${house.id}&order=order_num.asc`, { headers }),
      fetch(`${baseUrl}/rest/v1/posts?house_id=eq.${house.id}&order=created_at.desc&limit=50`, { headers }),
      fetch(`${baseUrl}/rest/v1/comments?house_id=eq.${house.id}&order=created_at.desc&limit=20`, { headers }),
    ]);

    const [media, milestones, rooms, categories, posts, comments] = await Promise.all([
      mediaRes.json(),
      milestonesRes.json(),
      roomsRes.json(),
      categoriesRes.json(),
      postsRes.json(),
      commentsRes.json(),
    ]);

    let postsWithCategories = Array.isArray(posts) ? posts : [];
    if (postsWithCategories.length > 0) {
      const postIds = postsWithCategories.map(p => p.id).join(',');
      const pcRes = await fetch(
        `${baseUrl}/rest/v1/post_categories?post_id=in.(${postIds})&select=post_id,category_id`,
        { headers }
      );
      const pcData = await pcRes.json();
      const pc = Array.isArray(pcData) ? pcData : [];
      postsWithCategories = postsWithCategories.map(p => ({
        ...p,
        category_ids: pc.filter(x => x.post_id === p.id).map(x => x.category_id)
      }));
    }

    return res.status(200).json({
      house:      houseSafe,
      media:      Array.isArray(media)      ? media      : [],
      milestones: Array.isArray(milestones) ? milestones : [],
      rooms:      Array.isArray(rooms)      ? rooms      : [],
      categories: Array.isArray(categories) ? categories : [],
      posts:      postsWithCategories,
      comments:   Array.isArray(comments)   ? comments   : [],
    });
  }

  return res.status(405).end();
}