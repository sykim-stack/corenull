// /api/rooms.js v3.1 — category 자동생성/삭제 제거

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const db = (path, method, body) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Accept-Profile': 'corenull',
        'Content-Profile': 'corenull',
        Prefer: 'return=representation',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  if (req.method === 'GET') {
    const { room_id } = req.query;
    if (!room_id) return res.status(400).json({ error: 'room_id 필요' });

    const rRes = await db(`rooms?id=eq.${room_id}&select=info_title,info_body,info_account`, 'GET');
    if (!rRes.ok) return res.status(500).json({ error: '조회 실패' });

    const rows = await rRes.json();
    const room = rows?.[0];
    if (!room) return res.status(404).json({ error: 'room 없음' });

    return res.status(200).json({
      info_title: room.info_title || '',
      info_body: room.info_body || '',
      info_account: room.info_account || '',
    });
  }

  if (req.method === 'POST') {
    const { house_id, owner_key, room_name, event_date } = req.body;
    if (!house_id || !owner_key || !room_name)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) {
      const detail = await hRes.text();
      return res.status(500).json({ error: 'house 조회 실패', detail });
    }

    const houses = await hRes.json();
    const house = houses?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const oRes = await db(`rooms?house_id=eq.${house_id}&select=order_num&order=order_num.desc&limit=1`, 'GET');
    const lastArr = await oRes.json();
    const order_num = (lastArr?.[0]?.order_num || 0) + 1;

    const rRes = await db('rooms', 'POST', {
      house_id,
      room_name,
      room_type: 'event',
      event_date: event_date || null,
      order_num,
      is_hidden: false,
    });

    if (!rRes.ok) {
      const detail = await rRes.json();
      return res.status(500).json({ error: '방 생성 실패', detail });
    }

    const [room] = await rRes.json();
    return res.status(200).json({ success: true, room });
  }

  if (req.method === 'PATCH') {
    const { room_id, house_id, owner_key, room_name, event_date, info_title, info_body, info_account } = req.body;
    if (!room_id || !house_id || !owner_key)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });

    const houses = await hRes.json();
    const house = houses?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const update = {};
    if (room_name !== undefined) update.room_name = room_name;
    if (event_date !== undefined) update.event_date = event_date || null;
    if (info_title !== undefined) update.info_title = info_title;
    if (info_body !== undefined) update.info_body = info_body;
    if (info_account !== undefined) update.info_account = info_account;

    if (!Object.keys(update).length)
      return res.status(400).json({ error: '수정할 항목 없음' });

    const rCheck = await db(`rooms?id=eq.${room_id}&house_id=eq.${house_id}&select=id`, 'GET');
    const rCheckArr = await rCheck.json();
    if (!rCheckArr?.length)
      return res.status(404).json({ error: 'room 없음' });

    const rRes = await db(`rooms?id=eq.${room_id}&house_id=eq.${house_id}`, 'PATCH', update);
    if (!rRes.ok) {
      const err = await rRes.json();
      return res.status(500).json({ error: err.message || '수정 실패' });
    }

    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { room_id, house_id, owner_key } = req.body;
    if (!room_id || !house_id || !owner_key)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });

    const houses = await hRes.json();
    const house = houses?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    await db(`media?room_id=eq.${room_id}`, 'PATCH', { room_id: null });

    const rRes = await db(`rooms?id=eq.${room_id}&house_id=eq.${house_id}`, 'DELETE');
    if (!rRes.ok) {
      const err = await rRes.json();
      return res.status(500).json({ error: err.message || '삭제 실패' });
    }

    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}