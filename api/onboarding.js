// api/onboarding.js
// interests.js + onboarding.js 통합
// /api/onboarding         → 온보딩 상태 조회/업데이트
// /api/onboarding?type=interests → 관심사 목록/선택

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const device_id = req.headers['x-device-id'] || null;
  if (!device_id) return res.status(200).json({ has_interest: true });

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const type   = req.query.type   || null;
  const action = req.query.action || req.body?.action || null;

  // ── 관심사 (type=interests) ──
  if (type === 'interests') {
    if (req.method === 'GET') {
      const [allRes, myRes] = await Promise.all([
        supabase.schema('corenull').from('interests').select('*').order('created_at'),
        supabase.schema('corenull').from('user_interests').select('interest_id').eq('device_id', device_id)
      ]);
      if (allRes.error) return res.status(500).json({ error: allRes.error.message });
      const myIds = (myRes.data || []).map(r => r.interest_id);
      return res.status(200).json((allRes.data || []).map(i => ({ ...i, selected: myIds.includes(i.id) })));
    }

    if (req.method === 'POST') {
      const { interest_ids } = req.body;
      if (!Array.isArray(interest_ids)) return res.status(400).json({ error: 'interest_ids 배열 필요' });
      await supabase.schema('corenull').from('user_interests').delete().eq('device_id', device_id);
      if (interest_ids.length > 0) {
        const { error } = await supabase.schema('corenull').from('user_interests')
          .insert(interest_ids.map(id => ({ device_id, interest_id: id })));
        if (error) return res.status(500).json({ error: error.message });
      }
      await supabase.schema('corenull').from('user_onboarding')
        .upsert({ device_id, has_interest: true, step: 'CREATE_OR_JOIN_HOUSE', updated_at: new Date().toISOString() }, { onConflict: 'device_id' });
      return res.status(200).json({ success: true });
    }
  }

  // ── 온보딩 상태 조회/업데이트 ──
  if (!action || action === 'status') {
    if (req.method === 'GET') {
      const { data, error } = await supabase.schema('corenull').from('user_onboarding')
        .select('*').eq('device_id', device_id).single();
      if (error && error.code === 'PGRST116') {
        const { data: created, error: createErr } = await supabase.schema('corenull')
          .from('user_onboarding').insert({ device_id, step: 'INIT' }).select().single();
        if (createErr) return res.status(500).json({ error: createErr.message });
        return res.status(200).json(created);
      }
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
    if (req.method === 'POST') {
      const { step, has_house, has_interest } = req.body;
      const updateData = { updated_at: new Date().toISOString() };
      if (step !== undefined)         updateData.step         = step;
      if (has_house !== undefined)    updateData.has_house    = has_house;
      if (has_interest !== undefined) updateData.has_interest = has_interest;
      const { data, error } = await supabase.schema('corenull').from('user_onboarding')
        .upsert({ device_id, ...updateData }, { onConflict: 'device_id' }).select().single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json(data);
    }
  }

  // ── 집 멤버 조회 ──
  if (action === 'my-houses') {
    const { data, error } = await supabase.schema('corenull').from('house_members')
      .select('*, houses(*)').eq('device_id', device_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // ── 집 입장 ──
  if (action === 'join-house') {
    const { house_id, role = 'member' } = req.body;
    if (!house_id) return res.status(400).json({ error: 'house_id 필요' });
    const { data: house, error: houseErr } = await supabase.schema('corenull')
      .from('houses').select('id').eq('id', house_id).single();
    if (houseErr || !house) return res.status(404).json({ error: '집을 찾을 수 없어요' });
    const { data: existing } = await supabase.schema('corenull').from('house_members')
      .select('id').eq('house_id', house_id).eq('device_id', device_id).single();
    if (existing) return res.status(200).json({ success: true, already: true });
    const { data, error } = await supabase.schema('corenull').from('house_members')
      .insert({ house_id, device_id, role }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await supabase.schema('corenull').from('user_onboarding')
      .upsert({ device_id, has_house: true, updated_at: new Date().toISOString() }, { onConflict: 'device_id' });
    return res.status(200).json({ success: true, data });
  }

  // ── 집 나가기 ──
  if (action === 'leave-house') {
    const { house_id } = req.body;
    if (!house_id) return res.status(400).json({ error: 'house_id 필요' });
    const { error } = await supabase.schema('corenull').from('house_members')
      .delete().eq('house_id', house_id).eq('device_id', device_id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}