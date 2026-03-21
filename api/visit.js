export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
  
    const { house_id, room_id } = req.body;
    const params = new URL(req.headers.referer || 'http://x').searchParams;
    // 클라이언트에서 ref, invited_by 직접 전달
    const { ref, invited_by } = req.body;
  
    await fetch(process.env.SUPABASE_URL + '/rest/v1/visit_logs', {
      method: 'POST',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({
        house_id,
        room_id,
        ref: ref || 'direct',
        invited_by: invited_by || null,
        device_id: req.headers['x-device-id'] || null
      })
    });
  
    res.status(200).json({ ok: true });
  }