// api/cover.js v1.2
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { file_base64, house_id } = req.body; // file_base64 = Cloudinary secure_url
  if (!file_base64 || !house_id) {
    return res.status(400).json({ error: 'file_base64, house_id 필수' });
  }

  const dbRes = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/houses?id=eq.${house_id}`,
    {
      method: 'PATCH',
      headers: {
        'apikey':          process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization':   `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type':    'application/json',
        'Accept-Profile':  'corenull',
        'Content-Profile': 'corenull',
        'Prefer':          'return=representation'
      },
      body: JSON.stringify({ cover_url: file_base64 })
    }
  );

  if (!dbRes.ok) {
    const detail = await dbRes.text();
    return res.status(500).json({ error: 'DB 저장 실패', detail });
  }

  return res.status(200).json({ success: true, cover_url: file_base64 });
}