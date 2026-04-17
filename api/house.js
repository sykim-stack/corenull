// api/house.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const baseUrl = process.env.SUPABASE_URL;
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey'         : key,
    'Authorization'  : `Bearer ${key}`,
    'Content-Type'   : 'application/json',
    'Accept-Profile' : 'corenull',
    'Content-Profile': 'corenull',
  };

  // ── GET ──────────────────────────────────────────
  if (req.method === 'GET') {
    const { slug, owner, action, house_id } = req.query;

    // ── action=stories ──
    if (action === 'stories') {
      if (!house_id) return res.status(400).json({ error: 'house_id required' });
      const r = await fetch(
        `${baseUrl}/rest/v1/posts?house_id=eq.${house_id}&ai_generated=eq.true&type=eq.story&order=created_at.desc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json({ stories: Array.isArray(data) ? data : [] });
    }

    // ── action=random ──
    if (action === 'random') {
      const r = await fetch(
        `${baseUrl}/rest/v1/houses?is_public=eq.true&select=slug&limit=50`,
        { headers }
      );
      const data = await r.json();
      const list = Array.isArray(data) ? data : [];
      if (list.length === 0) return res.status(200).json({ slug: null });
      const pick = list[Math.floor(Math.random() * list.length)];
      return res.status(200).json({ slug: pick.slug });
    }

    if (!slug) return res.status(400).json({ error: 'slug required' });

    // ── 하우스 조회 ──
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

    // ── categories + posts(type=story) 병렬 fetch ──
    const [categoriesRes, postsRes] = await Promise.all([
      fetch(
        `${baseUrl}/rest/v1/categories?house_id=eq.${house.id}&order=order_num.asc`,
        { headers }
      ),
      fetch(
        `${baseUrl}/rest/v1/posts?house_id=eq.${house.id}&type=eq.story&ai_generated=neq.true&order=created_at.desc&limit=50`,
        { headers }
      ),
    ]);

    const [categoriesRaw, postsRaw] = await Promise.all([
      categoriesRes.json(),
      postsRes.json(),
    ]);

    const categories = Array.isArray(categoriesRaw) ? categoriesRaw : [];
    let posts        = Array.isArray(postsRaw)      ? postsRaw      : [];

    // ── post_categories + comments 병렬 fetch ──
    if (posts.length > 0) {
      const postIds = posts.map(p => p.id).join(',');

      const [pcRes, commentsRes] = await Promise.all([
        fetch(
          `${baseUrl}/rest/v1/post_categories?post_id=in.(${postIds})&select=post_id,category_id`,
          { headers }
        ),
        fetch(
          `${baseUrl}/rest/v1/posts?house_id=eq.${house.id}&type=eq.comment&parent_id=in.(${postIds})&order=created_at.asc`,
          { headers }
        ),
      ]);

      const [pcData, commentsRaw] = await Promise.all([
        pcRes.json(),
        commentsRes.json(),
      ]);

      const pc       = Array.isArray(pcData)      ? pcData      : [];
      const comments = Array.isArray(commentsRaw) ? commentsRaw : [];

      // category 객체 맵
      const catMap = {};
      categories.forEach(c => { catMap[c.id] = c; });

      // post_id → category 객체[] 맵
      const pcMap = {};
      pc.forEach(row => {
        if (!pcMap[row.post_id]) pcMap[row.post_id] = [];
        const cat = catMap[row.category_id];
        if (cat) pcMap[row.post_id].push(cat);
      });

      // parent_id → comment[] 맵
      const cmMap = {};
      comments.forEach(c => {
        if (!cmMap[c.parent_id]) cmMap[c.parent_id] = [];
        cmMap[c.parent_id].push(c);
      });

      posts = posts.map(p => ({
        ...p,
        categories: pcMap[p.id] || [],
        comments  : cmMap[p.id] || [],
      }));
    } else {
      posts = posts.map(p => ({ ...p, categories: [], comments: [] }));
    }

    return res.status(200).json({
      house     : houseSafe,
      categories,
      posts,
    });
  }

  // ── POST ─────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, house_id, owner_key } = req.body;

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
        method : 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body   : JSON.stringify({
          house_id,
          type        : 'story',
          content     : `## ${title}\n\n${content}`,
          media_urls  : [],
          ai_generated: true,
          is_public,
        }),
      });
      const data = await r.json();
      const post = Array.isArray(data) ? data[0] : data;
      if (!post?.id) return res.status(500).json({ error: '스토리 저장 실패' });

      if (category_id) {
        await fetch(`${baseUrl}/rest/v1/post_categories`, {
          method : 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body   : JSON.stringify([{ post_id: post.id, category_id }]),
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

    // ── action=add_comment ──
    if (action === 'add_comment') {
      const { parent_id, content, author_name } = req.body;
      if (!house_id || !parent_id || !content)
        return res.status(400).json({ error: 'house_id, parent_id, content 필수' });

      const r = await fetch(`${baseUrl}/rest/v1/posts`, {
        method : 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body   : JSON.stringify({
          house_id,
          type       : 'comment',
          parent_id,
          content,
          author_name: author_name || '익명',
          media_urls : [],
        }),
      });
      const data    = await r.json();
      const comment = Array.isArray(data) ? data[0] : data;
      if (!comment?.id) return res.status(500).json({ error: '댓글 저장 실패' });
      return res.status(200).json({ success: true, comment });
    }

    // ── 방문 로그 ──
    const { room_id, ref, invited_by } = req.body;
    if (!house_id) return res.status(400).json({ error: 'house_id 필요' });

    let device_id = req.headers['x-device-id'] || `anon_${Math.random().toString(36).substring(2, 12)}`;
    if (device_id.length > 50) device_id = device_id.substring(0, 50);

    try {
      await fetch(`${baseUrl}/rest/v1/visit_logs`, {
        method : 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body   : JSON.stringify({
          house_id,
          room_id   : room_id    || null,
          ref       : ref        || 'direct',
          invited_by: invited_by || null,
          device_id,
        }),
      });
    } catch (_) {}

    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
}