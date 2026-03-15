// ============================================================
// CoreNull | api/invite.js
// 집 생성 + CoreChat 방 자동생성 + owner_key 발급
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, category, birth_date, description, device_id } = req.body;
  if (!name || !category || !device_id)
    return res.status(400).json({ error: 'name, category, device_id 필수' });

  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.SUPABASE_URL;
  const headers = {
    'apikey':          key,
    'Authorization':   `Bearer ${key}`,
    'Content-Type':    'application/json',
    'Accept-Profile':  'corenull',
    'Content-Profile': 'corenull',
    'Prefer':          'return=representation'
  };

  // ── 1. slug 생성 (이름 기반 + 랜덤 4자리) ──
  const slugBase = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]/g, '')
    .slice(0, 10);
  const slugSuffix = Math.random().toString(36).slice(2, 6);
  const slug = `${slugBase}-${slugSuffix}`;

  // ── 2. owner_key 생성 (관리자 접근용) ──
  const owner_key = Math.random().toString(36).slice(2, 10) +
                    Math.random().toString(36).slice(2, 10);

  // ── 3. 백일 계산 (baby 카테고리) ──
  let hundred_date = null;
  if (category === 'baby' && birth_date) {
    const bd = new Date(birth_date);
    bd.setDate(bd.getDate() + 99); // 태어난 날 포함 100일
    hundred_date = bd.toISOString().split('T')[0];
  }

  // ── 4. houses INSERT ──
  let house;
  try {
    const houseRes = await fetch(`${baseUrl}/rest/v1/houses`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        slug,
        category,
        description:  description || null,
        birth_date:   birth_date  || null,
        hundred_date,
        owner_key,
        is_public:    true,
        house_type:   category === 'baby' ? 'baby' : 'personal',
      })
    });
    const houseData = await houseRes.json();
    if (!houseRes.ok) throw new Error(JSON.stringify(houseData));
    house = Array.isArray(houseData) ? houseData[0] : houseData;
  } catch (e) {
    console.error('[invite] house INSERT 실패:', e);
    return res.status(500).json({ error: '집 생성 실패', detail: e.message });
  }

  // ── 5. CoreChat 방 자동생성 ──
  let chatRoom = null;
  try {
    const invite_code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const chatRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/chat_rooms`,
      {
        method: 'POST',
        headers: {
          'apikey':        key,
          'Authorization': `Bearer ${key}`,
          'Content-Type':  'application/json',
          'Prefer':        'return=representation'
        },
        body: JSON.stringify({
          invite_code,
          room_type:        'family',
          owner_device_id:  device_id,
          space_id:         house.id,
        })
      }
    );
    const chatData = await chatRes.json();
    if (chatRes.ok) {
      chatRoom = Array.isArray(chatData) ? chatData[0] : chatData;

      // ── 6. houses.space_id 연결 ──
      await fetch(`${baseUrl}/rest/v1/houses?id=eq.${house.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ space_id: chatRoom.id })
      });
    }
  } catch (e) {
    console.error('[invite] CoreChat 방 생성 실패 (무시):', e);
    // 집은 생성됐으니 실패해도 계속 진행
  }

  return res.status(200).json({
    success:    true,
    house_id:   house.id,
    slug,
    owner_key,
    house_url:  `/${slug}`,
    admin_url:  `/${slug}?owner=${owner_key}`,
    invite_code: chatRoom?.invite_code || null,
    chat_url:   chatRoom ? `https://corering.vercel.app/?room=${chatRoom.invite_code}` : null,
  });
}