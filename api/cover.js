// ============================================================
// CoreNull | api/cover.js v1.1
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

  // ── 1. Cloudinary 업로드 (base64 직접 방식 — FormData 대신) ──
  // base64 prefix 제거: "data:image/jpeg;base64,xxxx" → "xxxx"
  const base64Data = file_base64.includes(',')
    ? file_base64.split(',')[1]
    : file_base64;

  let cloud;
  try {
    const cloudRes = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file:           `data:image/jpeg;base64,${base64Data}`,
          upload_preset:  process.env.CLOUDINARY_UPLOAD_PRESET,
          folder:         'corenull/covers'
        })
      }
    );
    cloud = await cloudRes.json();
    console.log('[cover] Cloudinary:', cloud.secure_url || JSON.stringify(cloud.error));
  } catch (e) {
    console.error('[cover] Cloudinary fetch 예외:', e);
    return res.status(500).json({ error: 'Cloudinary 요청 실패', detail: e.message });
  }

  if (!cloud.secure_url) {
    return res.status(500).json({ error: 'Cloudinary 실패', detail: cloud.error || cloud });
  }

  // ── 2. houses.cover_url 업데이트 ──────────────────────────
  let dbRes, dbText;
  try {
    dbRes = await fetch(
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
    dbText = await dbRes.text();
    console.log('[cover] DB 상태:', dbRes.status, dbText);
  } catch (e) {
    console.error('[cover] DB fetch 예외:', e);
    return res.status(500).json({ error: 'DB 요청 실패', detail: e.message });
  }

  if (!dbRes.ok) {
    return res.status(500).json({ error: 'DB 저장 실패', status: dbRes.status, detail: dbText });
  }

  return res.status(200).json({ success: true, cover_url: cloud.secure_url });
}