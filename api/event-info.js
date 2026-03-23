// api/event-info.js

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

  // ── GET: 이벤트 정보 조회 ─────────────────────────
  if (req.method === 'GET') {
    const { room_id } = req.query;
    if (!room_id) return res.status(400).json({ error: 'room_id 필수' });

    const r = await db(`event_info?room_id=eq.${room_id}&order=order_num.asc`, 'GET');
    if (!r.ok) return res.status(500).json({ error: '조회 실패' });
    return res.status(200).json(await r.json());
  }

  // ── POST: 항목 추가 ───────────────────────────────
  if (req.method === 'POST') {
    const { house_id, room_id, owner_key, label, value, type, order_num } = req.body;
    if (!house_id || !room_id || !owner_key || !label || !value)
      return res.status(400).json({ error: '필수값 누락' });

    // owner 검증
    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });
    const house = (await hRes.json())?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const r = await db('event_info', 'POST', {
      house_id,
      room_id,
      label,
      value,
      type: type || 'text',
      order_num: order_num || 0,
    });
    if (!r.ok) return res.status(500).json({ error: '저장 실패' });
    return res.status(200).json({ success: true, data: (await r.json())[0] });
  }

  // ── PATCH: 항목 수정 ──────────────────────────────
  if (req.method === 'PATCH') {
    const { id, house_id, owner_key, label, value, type, order_num } = req.body;
    if (!id || !house_id || !owner_key)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });
    const house = (await hRes.json())?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const update = {};
    if (label !== undefined) update.label = label;
    if (value !== undefined) update.value = value;
    if (type !== undefined) update.type = type;
    if (order_num !== undefined) update.order_num = order_num;

    const r = await db(`event_info?id=eq.${id}`, 'PATCH', update);
    if (!r.ok) return res.status(500).json({ error: '수정 실패' });
    return res.status(200).json({ success: true });
  }

  // ── DELETE: 항목 삭제 ─────────────────────────────
  if (req.method === 'DELETE') {
    const { id, house_id, owner_key } = req.body;
    if (!id || !house_id || !owner_key)
      return res.status(400).json({ error: '필수값 누락' });

    const hRes = await db(`houses?id=eq.${house_id}&select=owner_key`, 'GET');
    if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });
    const house = (await hRes.json())?.[0];
    if (!house || house.owner_key !== owner_key)
      return res.status(403).json({ error: '권한 없음' });

    const r = await db(`event_info?id=eq.${id}`, 'DELETE');
    if (!r.ok) return res.status(500).json({ error: '삭제 실패' });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}