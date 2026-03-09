// ============================================================
// CoreNull | api/cover.js
// 커버 사진 Cloudinary 업로드 + houses.cover_url 업데이트
// ============================================================

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { file_base64, house_id } = req.body;
  if (!file_base64 || !house_id) {
    return res.status(400).json({ error: 'file_base64, house_id 필수' });
  }

  // 1. Cloudinary 업로드 (FormData 방식)
  const formData = new URLSearchParams();
  formData.append('file', file_base64);
  formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET);

  const cloudRes = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    {
      method: 'POST',
      body: formData
    }
  );
  const cloud = await cloudRes.json();
  console.log('[cover] Cloudinary:', cloud.secure_url || JSON.stringify(cloud.error));

  if (!cloud.secure_url) {
    return res.status(500).json({ error: 'Cloudinary 실패', detail: cloud });
  }

  // 2. houses.cover_url 업데이트
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
      body: JSON.stringify({ cover_url: cloud.secure_url })
    }
  );

  const dbText = await dbRes.text();
  console.log('[cover] DB 상태:', dbRes.status, dbText);

  if (!dbRes.ok) {
    return res.status(500).json({ error: 'DB 저장 실패', status: dbRes.status, detail: dbText });
  }

  return res.status(200).json({ success: true, cover_url: cloud.secure_url });
}
