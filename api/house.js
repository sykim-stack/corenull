// api/house.js
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug, owner, action } = req.query;

  const baseUrl = process.env.SUPABASE_URL;
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey':           key,
    'Authorization':    `Bearer ${key}`,
    'Content-Type':     'application/json',
    'Accept-Profile':   'corenull',
    'Content-Profile':  'corenull',
  };

  // ── POST /api/house?action=add_post ──────────────────────────────────────
  if (req.method === 'POST' && action === 'add_post') {
    const { house_id, content, category_ids } = req.body;
    if (!house_id || !content)
      return res.status(400).json({ error: 'house_id, content required' });

    // 1. story 삽입
    const insertRes = await fetch(
      `${baseUrl}/rest/v1/posts`,
      {
        method:  'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          house_id,
          type:    'story',
          content,
        }),
      }
    );
    const inserted = await insertRes.json();
    if (!insertRes.ok) return res.status(500).json({ error: inserted });

    const post = Array.isArray(inserted) ? inserted[0] : inserted;

    // 2. category_ids 있으면 post_categories 연결
    if (Array.isArray(category_ids) && category_ids.length > 0) {
      const pcRows = category_ids.map(cid => ({ post_id: post.id, category_id: cid }));
      await fetch(
        `${baseUrl}/rest/v1/post_categories`,
        {
          method:  'POST',
          headers: { ...headers, 'Prefer': 'return=minimal' },
          body:    JSON.stringify(pcRows),
        }
      );
    }

    return res.status(200).json({ success: true, post });
  }

  // ── POST /api/house?action=add_comment ───────────────────────────────────
  if (req.method === 'POST' && action === 'add_comment') {
    const { house_id, post_id, content } = req.body;
    if (!house_id || !post_id || !content)
      return res.status(400).json({ error: 'house_id, post_id, content required' });

    if (content.length > 500)
      return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });

    const insertRes = await fetch(
      `${baseUrl}/rest/v1/posts`,
      {
        method:  'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({
          house_id,
          type:      'comment',
          parent_id: post_id,
          content,
        }),
      }
    );
    const inserted = await insertRes.json();
    if (!insertRes.ok) return res.status(500).json({ error: inserted });

    const comment = Array.isArray(inserted) ? inserted[0] : inserted;
    return res.status(200).json({ success: true, comment });
  }
  // 랜덤 집 이동
if (slug === '__random__') {
  const randRes = await fetch(
    `${baseUrl}/rest/v1/houses?is_public=eq.true&order=random()&limit=1`,
    { headers }
  );
  const randHouses = await randRes.json();
  const randHouse  = randHouses[0];
  if (!randHouse) return res.status(404).json({ error: '없음' });
  return res.status(200).json({ house: { slug: randHouse.slug } });
}
  // ── GET /api/house?slug=... ───────────────────────────────────────────────
  if (req.method === 'GET') {
    if (!slug) return res.status(400).json({ error: 'slug required' });

    // 집 조회
    const houseRes = await fetch(
      `${baseUrl}/rest/v1/houses?slug=eq.${slug}&limit=1`,
      { headers }
    );
    const houses = await houseRes.json();
    const house  = houses[0];
    if (!house)           return res.status(404).json({ error: '존재하지 않는 집입니다' });
    if (!house.is_public) return res.status(403).json({ error: '비공개 집입니다' });

    const is_owner = !!(owner && house.owner_key && owner === house.owner_key);
    const { owner_key: _removed, ...houseSafe } = house;
    houseSafe.is_owner = is_owner;

    // 병렬 조회
    const [
      mediaRes, milestonesRes, roomsRes,
      categoriesRes, allPostsRes, commentsRes,
    ] = await Promise.all([
      fetch(`${baseUrl}/rest/v1/media?house_id=eq.${house.id}&status=eq.approved&order=created_at.desc`, { headers }),
      fetch(`${baseUrl}/rest/v1/milestones?house_id=eq.${house.id}&order=milestone_date.asc`, { headers }),
      fetch(`${baseUrl}/rest/v1/rooms?house_id=eq.${house.id}&is_hidden=eq.false&order=order_num.asc`, { headers }),
      fetch(`${baseUrl}/rest/v1/categories?house_id=eq.${house.id}&order=order_num.asc`, { headers }),
      // stories + comments 한 번에 조회 (type 무관)
      fetch(`${baseUrl}/rest/v1/posts?house_id=eq.${house.id}&order=created_at.desc&limit=200`, { headers }),
      fetch(`${baseUrl}/rest/v1/comments?house_id=eq.${house.id}&order=created_at.desc&limit=20`, { headers }),
    ]);

    const [
      media, milestones, rooms,
      categories, allPosts, comments,
    ] = await Promise.all([
      mediaRes.json(),
      milestonesRes.json(),
      roomsRes.json(),
      categoriesRes.json(),
      allPostsRes.json(),
      commentsRes.json(),
    ]);

    const catArr   = Array.isArray(categories) ? categories : [];
    const postArr  = Array.isArray(allPosts)   ? allPosts   : [];

    // post_categories 조회
    let pcData = [];
    if (postArr.length > 0) {
      const postIds = postArr.map(p => p.id).join(',');
      const pcRes   = await fetch(
        `${baseUrl}/rest/v1/post_categories?post_id=in.(${postIds})&select=post_id,category_id`,
        { headers }
      );
      const pcJson = await pcRes.json();
      pcData = Array.isArray(pcJson) ? pcJson : [];
    }

    // 분리: stories / comment-posts
    const stories      = postArr.filter(p => p.type !== 'comment');
    const commentPosts = postArr.filter(p => p.type === 'comment');

    // comment-posts를 parent_id로 인덱싱 (created_at ASC)
    const commentsByParent = {};
    [...commentPosts]
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .forEach(c => {
        if (!commentsByParent[c.parent_id]) commentsByParent[c.parent_id] = [];
        commentsByParent[c.parent_id].push(c);
      });

    // category_id → category 객체 맵
    const catMap = Object.fromEntries(catArr.map(c => [String(c.id), c]));

    // stories 비정규화: categories 객체 배열 + comments 내장
    const postsNormalized = stories.map(p => {
      const catIds  = pcData
        .filter(x => x.post_id === p.id)
        .map(x => x.category_id);

      const catObjs = catIds
        .map(id => catMap[String(id)])
        .filter(Boolean);

      return {
        ...p,
        category_ids: catIds,        // 기존 필드 호환성 유지
        categories:   catObjs,       // 신규: 객체 배열
        comments:     commentsByParent[p.id] || [],
      };
    });

    return res.status(200).json({
      house:      houseSafe,
      media:      Array.isArray(media)      ? media      : [],
      milestones: Array.isArray(milestones) ? milestones : [],
      rooms:      Array.isArray(rooms)      ? rooms      : [],
      categories: catArr,
      posts:      postsNormalized,
      comments:   Array.isArray(comments)   ? comments   : [],
    });
  }

  return res.status(405).end();
}