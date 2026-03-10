// ============================================================
// CoreNull | api/gemini.js
// Gemini 2.5 Flash - 문구 자동생성 (사진설명 / 메시지 제안)
// ============================================================

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).end();
  
    const { type, context } = req.body;
    if (!type) return res.status(400).json({ error: 'type 필수' });
  
    let prompt = '';
  
    if (type === 'caption') {
      prompt = `당신은 갓 태어난 아기 김하준(Mango)의 100일 기념 앨범 작성자입니다.
  사진 ${context?.count || 1}장을 업로드할 때 쓸 짧고 따뜻한 설명 문구를 3가지 제안해주세요.
  날짜: ${context?.date || '오늘'}
  조건:
  - 한국어로 작성
  - 각 문구는 1~2문장, 이모지 포함
  - 아기의 성장과 가족의 사랑이 느껴지게
  - 반드시 JSON 배열만 반환 (다른 텍스트 없이): ["문구1", "문구2", "문구3"]`;
  
    } else if (type === 'message') {
      const lang = context?.lang || 'ko';
      if (lang === 'vi') {
        prompt = `Bạn đang giúp viết lời chúc mừng 100 ngày tuổi cho bé Kim Ha Jun (Mango).
  Hãy đề xuất 3 lời chúc ngắn gọn, ấm áp bằng tiếng Việt.
  Điều kiện:
  - Mỗi lời chúc 1-2 câu, có emoji
  - Thể hiện tình yêu thương gia đình
  - Chỉ trả về JSON array (không có text khác): ["lời chúc 1", "lời chúc 2", "lời chúc 3"]`;
      } else {
        prompt = `당신은 아기 김하준(Mango) 100일을 축하하는 메시지 작성을 돕습니다.
  따뜻하고 짧은 축하 메시지 3가지를 제안해주세요.
  조건:
  - 한국어로 작성
  - 각 메시지 1~2문장, 이모지 포함
  - 가족의 사랑과 축하가 담기게
  - 반드시 JSON 배열만 반환 (다른 텍스트 없이): ["메시지1", "메시지2", "메시지3"]`;
      }
    } else {
      return res.status(400).json({ error: 'type은 caption 또는 message' });
    }
  
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.8, maxOutputTokens: 1024 }
        })
      }
    );
  
    const data = await apiRes.json();
  
    if (!apiRes.ok) {
      return res.status(500).json({ error: 'Gemini API 오류', detail: data });
    }
  
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  
    try {
      // 1단계: 코드블록 제거
      let clean = raw.replace(/```json|```/gi, '').trim();
      // 2단계: 배열 추출
      const match = clean.match(/\[[\s\S]*?\]/);
      if (match) {
        const suggestions = JSON.parse(match[0]);
        return res.status(200).json({ suggestions });
      }
      // 3단계: 줄 기반 fallback
      const lines = raw.split('\n')
        .map(l => l.replace(/^[\s\d\.\-\*\"]+|[\s\"\,]+$/g, '').trim())
        .filter(l => l.length > 5);
      if (lines.length >= 1) {
        return res.status(200).json({ suggestions: lines.slice(0, 3) });
      }
      throw new Error('파싱 불가');
    } catch(e) {
      return res.status(500).json({ error: 'Gemini 응답 파싱 실패', raw });
    }
  }