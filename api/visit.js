// ============================================================
// CoreNull | api/visit.js
// 방문 기록 저장 (발자국)
// POST /api/visit { house_id, visitor_name? }
// ============================================================

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { house_id, visitor_name } = req.body;

  if (!house_id) {
    return res.status(400).json({ error: 'house_id required' });
  }

  try {
    const { data, error } = await supabase
      .schema('corenull')
      .from('visits')
      .insert({
        house_id,
        visitor_name: visitor_name || null,
        is_hidden: true   // 발자국 기본 비공개
      })
      .select('id')
      .single();

    if (error) throw error;

    return res.status(200).json({ ok: true, id: data.id });

  } catch (e) {
    console.error('visit error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}