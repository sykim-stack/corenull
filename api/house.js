export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'slug required' });

  const baseUrl = process.env.SUPABASE_URL;
  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept-Profile': 'corenull'
  };

  // 집 조회
  const houseRes = await fetch(
    `${baseUrl}/rest/v1/houses?slug=eq.${slug}&limit=1`,
    { headers }
  );
  const houses = await houseRes.json();
  const house  = houses[0];

  if (!house) {
    return res.status(404).json({ error: '존재하지 않는 집입니다' });
  }

  if (!house.is_public) {
    return res.status(403).json({ error: '비공개 집입니다' });
  }

  // 병렬 조회
  const [mediaRes, milestonesRes, roomsRes, categoriesRes, postsRes] = await Promise.all([
    fetch(`${baseUrl}/rest/v1/media?house_id=eq.${house.id}&status=eq.approved&order=created_at.desc`, { headers }),
    fetch(`${baseUrl}/rest/v1/milestones?house_id=eq.${house.id}&order=milestone_date.asc`, { headers }),
    fetch(`${baseUrl}/rest/v1/rooms?house_id=eq.${house.id}&is_hidden=eq.false&order=order_num.asc`, { headers }),
    fetch(`${baseUrl}/rest/v1/categories?house_id=eq.${house.id}&order=order_num.asc`, { headers }),
    fetch(`${baseUrl}/rest/v1/posts?house_id=eq.${house.id}&order=created_at.desc&limit=50`, { headers }),
  ]);

  const [media, milestones, rooms, categories, posts] = await Promise.all([
    mediaRes.json(),
    milestonesRes.json(),
    roomsRes.json(),
    categoriesRes.json(),
    postsRes.json(),
  ]);

  // posts에 category 연결
  let postCategories = [];
  if (Array.isArray(posts) && posts.length > 0) {
    const postIds = posts.map(p => `post_id=eq.${p.id}`).join(',');
    // post_categories는 OR 쿼리로 조회
    const pcRes = await fetch(
      `${baseUrl}/rest/v1/post_categories?or=(${postIds})&select=post_id,category_id`,
      { headers }
    );
    const pcData = await pcRes.json();
    postCategories = Array.isArray(pcData) ? pcData : [];
  }

  // posts에 category_ids 붙이기
  const postsWithCategories = Array.isArray(posts) ? posts.map(p => ({
    ...p,
    category_ids: postCategories
      .filter(pc => pc.post_id === p.id)
      .map(pc => pc.category_id)
  })) : [];

  // 방명록 (event_posts에서 조회)
  const commentsRes = await fetch(
    `${baseUrl}/rest/v1/event_posts?house_id=eq.${house.id}&order=created_at.desc&limit=20`,
    { headers }
  );
  const comments = await commentsRes.json();

  return res.status(200).json({
    house,
    media:      Array.isArray(media)      ? media      : [],
    milestones: Array.isArray(milestones) ? milestones : [],
    rooms:      Array.isArray(rooms)      ? rooms      : [],
    categories: Array.isArray(categories) ? categories : [],
    posts:      postsWithCategories,
    comments:   Array.isArray(comments)   ? comments   : [],
  });
}