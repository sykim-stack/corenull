import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { slug } = req.query;
  if (!slug) return res.status(400).json({ error: 'slug required' });

  const baseUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Accept-Profile': 'corenull'
  };

  // ① is_public 조건 없이 먼저 조회 (디버그)
  const houseRes = await fetch(
    `${baseUrl}/rest/v1/houses?slug=eq.${slug}&limit=1`,
    { headers }
  );

  const houseStatus = houseRes.status;
  const houses = await houseRes.json();
  const house = houses[0];

  if (!house) {
    return res.status(404).json({ 
      error: '존재하지 않는 집입니다', 
      debug: { houseStatus, houses, slug, url: `${baseUrl}/rest/v1/houses?slug=eq.${slug}&limit=1` }
    });
  }

  // ② is_public 체크는 코드에서
  if (!house.is_public) {
    return res.status(403).json({ error: '비공개 집입니다' });
  }

  const [mediaRes, commentsRes, milestonesRes] = await Promise.all([
    fetch(`${baseUrl}/rest/v1/media?house_id=eq.${house.id}&status=eq.approved&order=created_at.desc`, { headers }),
    fetch(`${baseUrl}/rest/v1/comments?house_id=eq.${house.id}&order=created_at.desc&limit=20`, { headers }),
    fetch(`${baseUrl}/rest/v1/milestones?house_id=eq.${house.id}&order=milestone_date.asc`, { headers })
  ]);

  const [media, comments, milestones] = await Promise.all([
    mediaRes.json(),
    commentsRes.json(),
    milestonesRes.json()
  ]);

  return res.status(200).json({
    house,
    media:      Array.isArray(media)      ? media      : [],
    comments:   Array.isArray(comments)   ? comments   : [],
    milestones: Array.isArray(milestones) ? milestones : []
  });
}