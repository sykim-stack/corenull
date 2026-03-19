// api/_middleware/device.js
const { createClient } = require('@supabase/supabase-js');

function getSupabaseWithDevice(req) {
  const device_id = req.headers['x-device-id'] || null;

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  return { supabase, device_id };
}

module.exports = { getSupabaseWithDevice };