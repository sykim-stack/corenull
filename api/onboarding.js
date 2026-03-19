// api/onboarding.js
const { createClient } = require('@supabase/supabase-js');

function getSupabaseWithDevice(req) {
  const device_id = req.headers['x-device-id'] || null;
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  return { supabase, device_id };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { supabase, device_id } = getSupabaseWithDevice(req);
  if (!device_id) return res.status(400).json({ error: 'x-device-id 헤더 필요' });

  await supabase.rpc('set_device', { p_device_id: device_id });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .schema('corenull')
      .from('user_onboarding')
      .select('*')
      .eq('device_id', device_id)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: created, error: createErr } = await supabase
        .schema('corenull')
        .from('user_onboarding')
        .insert({ device_id, step: 'INIT' })
        .select()
        .single();
      if (createErr) return res.status(500).json({ error: createErr.message });
      return res.status(200).json(created);
    }

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  if (req.method === 'POST') {
    const { step, has_house, has_interest } = req.body;
    const updateData = { updated_at: new Date().toISOString() };
    if (step !== undefined)          updateData.step         = step;
    if (has_house !== undefined)     updateData.has_house    = has_house;
    if (has_interest !== undefined)  updateData.has_interest = has_interest;

    const { data, error } = await supabase
      .schema('corenull')
      .from('user_onboarding')
      .upsert({ device_id, ...updateData }, { onConflict: 'device_id' })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).end();
};