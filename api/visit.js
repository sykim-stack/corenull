// /api/visit.js
export default async function handler(req, res) {
    if (req.method !== 'POST')
      return res.status(405).json({ error: 'Method not allowed' });
  
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
    const { house_id, room_id, ref, invited_by } = req.body;
  
    if (!house_id) return res.status(400).json({ error: 'house_id 필요' });
  
    // CHANGE START - device_id 정리 (없으면 생성)
    let device_id = req.headers['x-device-id'] || null;
  
    if (!device_id) {
      device_id = `anon_${Math.random().toString(36).substring(2, 12)}`;
    }
  
    // 너무 긴 값 방지 (DB 쓰레기 방지)
    if (device_id.length > 50) {
      device_id = device_id.substring(0, 50);
    }
    // CHANGE END
  
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/corenull.visit_logs`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          house_id,
          room_id: room_id || null,
          ref: ref || 'direct',
          invited_by: invited_by || null,
          device_id,
        }),
      });
  
      return res.status(200).json({ ok: true });
    } catch (e) {
      // 로그 실패 무조건 통과 (좋은 판단)
      return res.status(200).json({ ok: true });
    }
  }