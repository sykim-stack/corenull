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

  // ── GET ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { slug, owner, action, house_id } = req.query;

    // ── GET action=stories ──
    if (action === 'stories') {
      if (!house_id) return res.status(400).json({ error: 'house_id required' });
      const r = await fetch(
        `${baseUrl}/rest/v1/posts?house_id=eq.${house_id}&ai_generated=eq.true&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ stories: Array.isArray(data) ? data : [] });
    }

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
      fetch(`${baseUrl}/rest/v1/posts?house_id=eq.${house.id}&ai_generated=neq.true&order=created_at.desc&limit=50`, { headers }),
      fetch(`${baseUrl}/rest/v1/comments?house_id=eq.${house.id}&post_id=is.null&order=created_at.desc&limit=20`, { headers }),
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

  // ── POST ─────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, house_id, owner_key } = req.body;

    // owner 검증 공통
    const verifyOwner = async () => {
      if (!house_id || !owner_key) return false;
      const r = await fetch(
        `${baseUrl}/rest/v1/houses?id=eq.${house_id}&owner_key=eq.${owner_key}&select=id&limit=1`,
        { headers }
      );
      const d = await r.json();
      return !!(d[0]);
    };

    // ── action=create_story ──
    if (action === 'create_story') {
      if (!(await verifyOwner())) return res.status(403).json({ error: '권한 없음' });
      const { category_id, title, content, is_public = false } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'title, content 필수' });

      const r = await fetch(`${baseUrl}/rest/v1/posts`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({
          house_id,
          content     : `## ${title}\n\n${content}`,
          media_urls  : [],
          ai_generated: true,
          is_public,
        })
      });
      const data = await r.json();
      const post = Array.isArray(data) ? data[0] : data;
      if (!post?.id) return res.status(500).json({ error: '스토리 저장 실패' });

      if (category_id) {
        await fetch(`${baseUrl}/rest/v1/post_categories`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify([{ post_id: post.id, category_id }])
        });
      }

      return res.status(200).json({ success: true, post });
    }

    // ── action=update_story ──
    if (action === 'update_story') {
      if (!(await verifyOwner())) return res.status(403).json({ error: '권한 없음' });
      const { story_id, title, content, is_public } = req.body;
      if (!story_id) return res.status(400).json({ error: 'story_id 필수' });

      const update = {};
      if (title && content) update.content = `## ${title}\n\n${content}`;
      if (is_public !== undefined) update.is_public = is_public;

      await fetch(
        `${baseUrl}/rest/v1/posts?id=eq.${story_id}&house_id=eq.${house_id}`,
        { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(update) }
      );
      return res.status(200).json({ success: true });
    }

    // ── action=delete_story ──
    if (action === 'delete_story') {
      if (!(await verifyOwner())) return res.status(403).json({ error: '권한 없음' });
      const { story_id } = req.body;
      if (!story_id) return res.status(400).json({ error: 'story_id 필수' });

      await fetch(
        `${baseUrl}/rest/v1/posts?id=eq.${story_id}&house_id=eq.${house_id}`,
        { method: 'DELETE', headers }
      );
      return res.status(200).json({ success: true });
    }

    // ── 방문 로그 (기존) ──
    const { room_id, ref, invited_by } = req.body;
    if (!house_id) return res.status(400).json({ error: 'house_id 필요' });

    let device_id = req.headers['x-device-id'] || `anon_${Math.random().toString(36).substring(2, 12)}`;
    if (device_id.length > 50) device_id = device_id.substring(0, 50);

    try {
      await fetch(`${baseUrl}/rest/v1/visit_logs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ house_id, room_id: room_id || null, ref: ref || 'direct', invited_by: invited_by || null, device_id }),
      });
    } catch (e) {}

    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}