// api/reaction.js
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const device_id = req.headers['x-device-id'] || 'anon';

  // ── GET: 포스트 reaction 수 + 내가 눌렀는지 ──────────────────────────────
  if (req.method === 'GET') {
    const { post_ids, house_id } = req.query;
    if (!post_ids) return res.status(400).json({ error: 'post_ids required' });

    const ids = post_ids.split(',').filter(Boolean);

    const { data, error } = await supabase
      .schema('corenull')
      .from('reactions')
      .select('target_id, device_id, action_type')
      .in('target_id', ids)
      .eq('target_type', 'post');

    if (error) return res.status(500).json({ error: error.message });

    // post_id별로 집계
    const map = {};
    ids.forEach(id => { map[id] = { count: 0, liked: false }; });
    (data || []).forEach(r => {
      if (!map[r.target_id]) map[r.target_id] = { count: 0, liked: false };
      map[r.target_id].count++;
      if (r.device_id === device_id) map[r.target_id].liked = true;
    });

    const reactions = ids.map(id => ({ post_id: id, ...map[id] }));
    return res.status(200).json({ reactions });
  }

  // ── POST: 관심 토글 ───────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { post_id, house_id, action_type = 'like' } = req.body;
    if (!post_id || !house_id) return res.status(400).json({ error: 'post_id, house_id required' });

    // 이미 눌렀으면 삭제 (토글)
    const { data: existing } = await supabase
      .schema('corenull')
      .from('reactions')
      .select('id')
      .eq('target_id', post_id)
      .eq('target_type', 'post')
      .eq('device_id', device_id)
      .eq('action_type', action_type)
      .single();

    if (existing) {
      await supabase.schema('corenull').from('reactions').delete().eq('id', existing.id);
    } else {
      await supabase.schema('corenull').from('reactions').insert({
        house_id,
        target_id: post_id,
        target_type: 'post',
        device_id,
        action_type,
        emoji: action_type === 'like' ? '❤️' : action_type === 'save' ? '📌' : '👀',
      });
    }

    // 최신 카운트 반환
    const { count } = await supabase
      .schema('corenull')
      .from('reactions')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', post_id)
      .eq('target_type', 'post');

    return res.status(200).json({ success: true, reacted: !existing, count: count || 0 });
  }

  return res.status(405).end();
}