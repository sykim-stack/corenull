// ============================================================
// CoreNull | api/invite.js v1.1
// 집 생성 + CoreChat 방 자동생성 + 임시 아이디 연동
// ============================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name, description, is_public, device_id, nickname } = req.body;
  if (!name || !device_id)
    return res.status(400).json({ error: 'name, device_id 필수' });

  const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = process.env.SUPABASE_URL;

  const headers = {
    'apikey':          key,
    'Authorization':   `Bearer ${key}`,
    'Content-Type':    'application/json',
    'Prefer':          'return=representation'
  };
  const cnHeaders = {
    ...headers,
    'Accept-Profile':  'corenull',
    'Content-Profile': 'corenull',
  };

  // ── 1. core_users 닉네임 업데이트 ──
  if (nickname) {
    try {
      await fetch(`${baseUrl}/rest/v1/core_users?device_id=eq.${device_id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ nickname })
      });
    } catch(e) {
      console.error('[invite] nickname 업데이트 실패 (무시):', e);
    }
  }

  // ── 2. slug 생성 ──
  const slugBase   = name.toLowerCase().replace(/[^a-z0-9가-힣]/g, '').slice(0, 10);
  const slugSuffix = Math.random().toString(36).slice(2, 6);
  const slug       = `${slugBase}-${slugSuffix}`;

  // ── 3. owner_key 생성 ──
  const owner_key = Math.random().toString(36).slice(2, 10) +
                    Math.random().toString(36).slice(2, 10);

  // ── 4. houses INSERT ──
  let house;
  try {
    const houseRes = await fetch(`${baseUrl}/rest/v1/houses`, {
      method: 'POST',
      headers: cnHeaders,
      body: JSON.stringify({
        name,
        slug,
        description:  description || null,
        owner_key,
        is_public:    is_public !== false,
        house_type:   'family',
        category:     'daily',
      })
    });
    const houseData = await houseRes.json();
    if (!houseRes.ok) throw new Error(JSON.stringify(houseData));
    house = Array.isArray(houseData) ? houseData[0] : houseData;
  } catch(e) {
    console.error('[invite] house INSERT 실패:', e);
    return res.status(500).json({ error: '집 생성 실패', detail: e.message });
  }
// ── 5. 기본 rooms + categories 자동생성 ──
try {
  await fetch(`${baseUrl}/rest/v1/rooms`, {
    method: 'POST',
    headers: cnHeaders,
    body: JSON.stringify([
      { house_id: house.id, room_name: '마당', room_type: 'yard',    order_num: 1,  is_hidden: true  },
      { house_id: house.id, room_name: '거실', room_type: 'living',  order_num: 2,  is_hidden: false },
      { house_id: house.id, room_name: '방',   room_type: 'room',    order_num: 3,  is_hidden: false },
      { house_id: house.id, room_name: '서재', room_type: 'library', order_num: 4,  is_hidden: false },
      { house_id: house.id, room_name: '창고', room_type: 'storage', order_num: 99, is_hidden: true  },
    ])
  });
} catch(e) { console.error('[invite] rooms 생성 실패:', e); }

try {
  await fetch(`${baseUrl}/rest/v1/categories`, {
    method: 'POST',
    headers: cnHeaders,
    body: JSON.stringify([
      { house_id: house.id, name: '일상', color: '#8FBFAB', order_num: 1 }
    ])
  });
} catch(e) { console.error('[invite] categories 생성 실패:', e); }

// ── 6. CoreChat 방 자동생성 ──

  let chatRoom = null;
  try {
    const invite_code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const chatRes = await fetch(`${baseUrl}/rest/v1/chat_rooms`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        invite_code,
        room_type:       'family',
        owner_device_id: device_id,
        space_id:        house.id,
      })
    });
    const chatData = await chatRes.json();
    if (chatRes.ok) {
      chatRoom = Array.isArray(chatData) ? chatData[0] : chatData;
      // houses.space_id 연결
      await fetch(`${baseUrl}/rest/v1/houses?id=eq.${house.id}`, {
        method: 'PATCH',
        headers: cnHeaders,
        body: JSON.stringify({ space_id: chatRoom.id })
      });
    }
  } catch(e) {
    console.error('[invite] CoreChat 방 생성 실패 (무시):', e);
  }

  return res.status(200).json({
    success:     true,
    house_id:    house.id,
    slug,
    owner_key,
    house_url:   `/${slug}`,
    admin_url:   `/${slug}?owner=${owner_key}`,
    invite_code: chatRoom?.invite_code || null,
    chat_url:    chatRoom ? `https://corering.vercel.app/?room=${chatRoom.invite_code}` : null,
  });
}