// api/comment.js
import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET
  if (req.method === 'GET') {
    const { house_id, room_id } = req.query;
    if (!house_id) return res.status(400).json({ error: 'house_id required' });

    let query = supabase
      .schema('corenull')
      .from('comments')
      .select('*')
      .eq('house_id', house_id)
      .order('created_at', { ascending: false });

    // room_id 있으면 해당 방 댓글만
    if (room_id) query = query.eq('room_id', room_id);
    // room_id 없으면 집 전체 방명록 (room_id가 null인 것만)
    else query = query.is('room_id', null);

    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ comments: data });
  }

  // POST
  if (req.method === 'POST') {
    let { house_id, slug, author_name, content, media_url, room_id } = req.body;

    // slug로 house_id 조회
    if (!house_id && slug) {
      const { data: houses, error: hErr } = await supabase
        .schema('corenull')
        .from('houses')
        .select('id')
        .eq('slug', slug)
        .single();
      if (hErr || !houses) return res.status(404).json({ error: '집을 찾을 수 없어요' });
      house_id = houses.id;
    }

    if (!house_id || !author_name || !content)
      return res.status(400).json({ error: 'house_id(또는 slug), author_name, content required' });

    if (content.length > 500)
      return res.status(400).json({ error: '댓글은 500자 이내로 작성해주세요' });

    const isKorean = /[ㄱ-ㅎ가-힣]/.test(content);
    const isVietnamese = /[àáảãạăắặằẳẵâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(content);
    const lang = isKorean ? 'ko' : isVietnamese ? 'vi' : 'other';

    const { data, error } = await supabase
      .schema('corenull')
      .from('comments')
      .insert({
        house_id,
        author_name,
        content_original: content,
        lang,
        media_url: media_url || null,
        room_id: room_id || null,  // 이벤트 방명록이면 room_id 저장
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true, comment: data });
  }

  // DELETE
  if (req.method === 'DELETE') {
    const { comment_id, house_id } = req.body;
    if (!comment_id || !house_id)
      return res.status(400).json({ error: 'comment_id, house_id required' });

    const { error } = await supabase
      .schema('corenull')
      .from('comments')
      .delete()
      .eq('id', comment_id)
      .eq('house_id', house_id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).end();
}