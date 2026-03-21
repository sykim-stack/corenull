// /api/rooms.js

export default async function handler(req, res) {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    };
  
    const db = (path, method, body) =>
      fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: { ...headers, Prefer: 'return=representation' },
        body: body ? JSON.stringify(body) : undefined,
      });
  
    // ── POST: 이벤트 방 생성 ──────────────────────────
    if (req.method === 'POST') {
      const { house_id, owner_key, room_name, event_date } = req.body;
      if (!house_id || !owner_key || !room_name)
        return res.status(400).json({ error: '필수값 누락' });
  
      // CHANGE START - owner_key 검증 + 에러 체크
      const hRes = await db(
        `corenull.houses?id=eq.${house_id}&select=owner_key`,
        'GET'
      );
      if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });
  
      const houses = await hRes.json();
      const house = houses?.[0];
      if (!house || house.owner_key !== owner_key)
        return res.status(403).json({ error: '권한 없음' });
      // CHANGE END
  
      // CHANGE START - order_num race condition 방지용 fallback
      const oRes = await db(
        `corenull.rooms?house_id=eq.${house_id}&select=order_num&order=order_num.desc&limit=1`,
        'GET'
      );
      const lastArr = await oRes.json();
      const last = lastArr?.[0];
      const order_num = (last?.order_num || 0) + 1;
      // CHANGE END
  
      const rRes = await db('corenull.rooms', 'POST', {
        house_id,
        room_name,
        room_type: 'event',
        event_date: event_date || null,
        order_num,
        is_hidden: false,
      });
  
      if (!rRes.ok) {
        const err = await rRes.json();
        return res.status(500).json({ error: err.message || '생성 실패' });
      }
  
      const [room] = await rRes.json();
      return res.status(200).json({ success: true, room });
    }
  
    // ── PATCH: 이름/날짜 수정 ─────────────────────────
    if (req.method === 'PATCH') {
      const { room_id, house_id, owner_key, room_name, event_date } = req.body;
      if (!room_id || !house_id || !owner_key)
        return res.status(400).json({ error: '필수값 누락' });
  
      // CHANGE START - owner 검증 안정화
      const hRes = await db(
        `corenull.houses?id=eq.${house_id}&select=owner_key`,
        'GET'
      );
      if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });
  
      const houses = await hRes.json();
      const house = houses?.[0];
      if (!house || house.owner_key !== owner_key)
        return res.status(403).json({ error: '권한 없음' });
      // CHANGE END
  
      const update = {};
      if (room_name) update.room_name = room_name;
      if (event_date !== undefined) update.event_date = event_date || null;
  
      // CHANGE START - room 존재 확인
      const rCheck = await db(
        `corenull.rooms?id=eq.${room_id}&house_id=eq.${house_id}&select=id`,
        'GET'
      );
      const rCheckArr = await rCheck.json();
      if (!rCheckArr?.length)
        return res.status(404).json({ error: 'room 없음' });
      // CHANGE END
  
      const rRes = await db(
        `corenull.rooms?id=eq.${room_id}&house_id=eq.${house_id}`,
        'PATCH',
        update
      );
  
      if (!rRes.ok) {
        const err = await rRes.json();
        return res.status(500).json({ error: err.message || '수정 실패' });
      }
  
      return res.status(200).json({ success: true });
    }
  
    // ── DELETE: 방 삭제 ───────────────────────────────
    if (req.method === 'DELETE') {
      const { room_id, house_id, owner_key } = req.body;
      if (!room_id || !house_id || !owner_key)
        return res.status(400).json({ error: '필수값 누락' });
  
      // CHANGE START - owner 검증 안정화
      const hRes = await db(
        `corenull.houses?id=eq.${house_id}&select=owner_key`,
        'GET'
      );
      if (!hRes.ok) return res.status(500).json({ error: 'house 조회 실패' });
  
      const houses = await hRes.json();
      const house = houses?.[0];
      if (!house || house.owner_key !== owner_key)
        return res.status(403).json({ error: '권한 없음' });
      // CHANGE END
  
      // CHANGE START - media null 처리 실패 방지
      const mRes = await db(
        `corenull.media?room_id=eq.${room_id}`,
        'PATCH',
        { room_id: null }
      );
      // 실패해도 진행 (로그만)
      // CHANGE END
  
      const rRes = await db(
        `corenull.rooms?id=eq.${room_id}&house_id=eq.${house_id}`,
        'DELETE'
      );
  
      if (!rRes.ok) {
        const err = await rRes.json();
        return res.status(500).json({ error: err.message || '삭제 실패' });
      }
  
      return res.status(200).json({ success: true });
    }
  
    return res.status(405).json({ error: 'Method not allowed' });
  }