// api/rooms.js
// POST   → 이벤트 방 생성
// PATCH  → 방 이름/날짜 수정
// DELETE → 방 삭제

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
  
    const baseUrl = process.env.SUPABASE_URL;
    const key     = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const headers = {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'corenull',
      'Content-Profile': 'corenull',
      'Prefer': 'return=representation'
    };
  
    // ── GET: 집의 방 목록 조회 ──
    if (req.method === 'GET') {
      const { house_id } = req.query;
      if (!house_id) return res.status(400).json({ error: 'house_id required' });
  
      const r = await fetch(
        `${baseUrl}/rest/v1/rooms?house_id=eq.${house_id}&order=order_num.asc`,
        { headers }
      );
      const data = await r.json();
      return res.status(200).json(Array.isArray(data) ? data : []);
    }
  
    // ── POST: 이벤트 방 생성 ──
    if (req.method === 'POST') {
      const { house_id, owner_key, room_name, event_date } = req.body;
      if (!house_id || !owner_key || !room_name) {
        return res.status(400).json({ error: 'house_id, owner_key, room_name required' });
      }
  
      // owner_key 검증
      const hRes = await fetch(
        `${baseUrl}/rest/v1/houses?id=eq.${house_id}&select=owner_key`,
        { headers }
      );
      const houses = await hRes.json();
      if (!houses[0] || houses[0].owner_key !== owner_key) {
        return res.status(403).json({ error: '권한 없음' });
      }
  
      // order_num 계산 (기존 최대값 + 1)
      const orRes = await fetch(
        `${baseUrl}/rest/v1/rooms?house_id=eq.${house_id}&select=order_num&order=order_num.desc&limit=1`,
        { headers }
      );
      const orData = await orRes.json();
      const nextOrder = orData[0] ? orData[0].order_num + 1 : 1;
  
      const r = await fetch(`${baseUrl}/rest/v1/rooms`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          house_id,
          room_name,
          room_type: 'event',
          event_date: event_date || null,
          order_num: nextOrder,
          is_hidden: false
        })
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data.message || '생성 실패' });
      return res.status(200).json({ success: true, room: data[0] });
    }
  
    // ── PATCH: 방 수정 (이름/날짜) ──
    if (req.method === 'PATCH') {
      const { room_id, house_id, owner_key, room_name, event_date } = req.body;
      if (!room_id || !house_id || !owner_key) {
        return res.status(400).json({ error: 'room_id, house_id, owner_key required' });
      }
  
      // owner_key 검증
      const hRes = await fetch(
        `${baseUrl}/rest/v1/houses?id=eq.${house_id}&select=owner_key`,
        { headers }
      );
      const houses = await hRes.json();
      if (!houses[0] || houses[0].owner_key !== owner_key) {
        return res.status(403).json({ error: '권한 없음' });
      }
  
      const body = {};
      if (room_name !== undefined) body.room_name = room_name;
      if (event_date !== undefined) body.event_date = event_date || null;
  
      const r = await fetch(
        `${baseUrl}/rest/v1/rooms?id=eq.${room_id}&house_id=eq.${house_id}`,
        { method: 'PATCH', headers, body: JSON.stringify(body) }
      );
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data.message || '수정 실패' });
      return res.status(200).json({ success: true, room: data[0] });
    }
  
    // ── DELETE: 방 삭제 ──
    if (req.method === 'DELETE') {
      const { room_id, house_id, owner_key } = req.body;
      if (!room_id || !house_id || !owner_key) {
        return res.status(400).json({ error: 'room_id, house_id, owner_key required' });
      }
  
      // owner_key 검증
      const hRes = await fetch(
        `${baseUrl}/rest/v1/houses?id=eq.${house_id}&select=owner_key`,
        { headers }
      );
      const houses = await hRes.json();
      if (!houses[0] || houses[0].owner_key !== owner_key) {
        return res.status(403).json({ error: '권한 없음' });
      }
  
      // living/room/library 타입은 삭제 금지
      const rRes = await fetch(
        `${baseUrl}/rest/v1/rooms?id=eq.${room_id}&select=room_type`,
        { headers }
      );
      const rooms = await rRes.json();
      if (rooms[0] && ['living', 'room', 'library'].includes(rooms[0].room_type)) {
        return res.status(400).json({ error: '기본 방은 삭제할 수 없어요' });
      }
  
      const r = await fetch(
        `${baseUrl}/rest/v1/rooms?id=eq.${room_id}&house_id=eq.${house_id}`,
        { method: 'DELETE', headers }
      );
      if (!r.ok) return res.status(500).json({ error: '삭제 실패' });
      return res.status(200).json({ success: true });
    }
  
    return res.status(405).json({ error: 'Method not allowed' });
  }