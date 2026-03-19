// api/interests.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const device_id = req.headers['x-device-id'];
  if (!device_id) return res.status(400).json({ error: 'x-device-id 헤더 필요' });

  // GET — 전체 관심사 목록 + 내가 선택한 것
  if (req.method === 'GET') {
    const [allRes, myRes] = await Promise.all([
      supabase.schema('corenull').from('interests').select('*').order('created_at'),
      supabase.schema('corenull').from('user_interests').select('interest_id').eq('device_id', device_id)
    ]);

    if (allRes.error) return res.status(500).json({ error: allRes.error.message });

    const myIds = (myRes.data || []).map(r => r.interest_id);
    const result = (allRes.data || []).map(i => ({ ...i, selected: myIds.includes(i.id) }));

    return res.status(200).json(result);
  }

  // POST — 관심사 선택 (복수)
  if (req.method === 'POST') {
    const { interest_ids } = req.body;
    if (!Array.isArray(interest_ids)) return res.status(400).json({ error: 'interest_ids 배열 필요' });

    // 기존 삭제 후 새로 삽입
    await supabase.schema('corenull').from('user_interests').delete().eq('device_id', device_id);

    if (interest_ids.length > 0) {
      const rows = interest_ids.map(id => ({ device_id, interest_id: id }));
      const { error } = await supabase.schema('corenull').from('user_interests').insert(rows);
      if (error) return res.status(500).json({ error: error.message });
    }

    // 온보딩 상태 업데이트
    await supabase.schema('corenull').from('user_onboarding')
      .upsert({ device_id, has_interest: true, step: 'CREATE_OR_JOIN_HOUSE', updated_at: new Date().toISOString() }, { onConflict: 'device_id' });

    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}