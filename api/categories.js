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
      'Prefer': 'return=representation',
    };
  
    // GET — 분류 목록
    if (req.method === 'GET') {
      const { house_id } = req.query;
      if (!house_id) return res.status(400).json({ error: 'house_id required' });
      const r    = await fetch(`${baseUrl}/rest/v1/categories?house_id=eq.${house_id}&order=order_num.asc`, { headers });
      const text = await r.text();
      try {
        const data = JSON.parse(text);
        return res.status(r.status).json(Array.isArray(data) ? data : []);
      } catch(e) {
        return res.status(500).json({ error: 'parse error', raw: text });
      }
    }
  
// POST — 분류 생성
if (req.method === 'POST') {
  const { house_id, name, color, is_event, event_date } = req.body;
  if (!house_id || !name) return res.status(400).json({ error: 'house_id, name required' });
  const CAT_COLORS = ['#8FBFAB','#E8A0A8','#C9A84C','#8B5E3C','#7BA7BC','#D4956A'];
  const autoColor  = color || CAT_COLORS[Math.floor(Math.random() * CAT_COLORS.length)];
  const r    = await fetch(`${baseUrl}/rest/v1/categories`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      house_id,
      name: name.trim(),
      color: autoColor,
      order_num: 99,
      is_event: is_event === true || is_event === 'true' ? true : false,
      event_date: is_event && event_date ? event_date : null,
    })
  });
  const text = await r.text();
  try {
    const data = JSON.parse(text);
    const cat  = Array.isArray(data) ? data[0] : data;
    if (!cat?.id) return res.status(500).json({ error: '분류 생성 실패', raw: text, status: r.status });
    return res.status(200).json(cat);
  } catch(e) {
    return res.status(500).json({ error: 'parse error', raw: text, status: r.status });
  }
}
// PATCH — 분류 수정
if (req.method === 'PATCH') {
  const { category_id, house_id, name, event_date } = req.body;
  if (!category_id || !house_id || !name)
    return res.status(400).json({ error: 'category_id, house_id, name required' });
  const updateBody = { name: name.trim() };
  if (event_date !== undefined) updateBody.event_date = event_date || null;
  const r = await fetch(
    `${baseUrl}/rest/v1/categories?id=eq.${category_id}&house_id=eq.${house_id}`,
    { method: 'PATCH', headers, body: JSON.stringify(updateBody) }
  );
  if (!r.ok) return res.status(500).json({ error: '수정 실패', status: r.status });
  return res.status(200).json({ success: true });
}  

    // DELETE
    if (req.method === 'DELETE') {
      const { category_id, house_id } = req.body;
      if (!category_id || !house_id) return res.status(400).json({ error: 'category_id, house_id required' });
      await fetch(`${baseUrl}/rest/v1/categories?id=eq.${category_id}&house_id=eq.${house_id}`, { method: 'DELETE', headers });
      return res.status(200).json({ success: true });
    }
  
    return res.status(405).json({ error: 'Method not allowed' });
  }