// Message = 모든 행동의 중심
// type으로만 구분

Message {
  // posts 테이블 → type: "post"
  // comments 테이블 → type: "comment", relations.post_id 있음
}

Message.create(type, payload)   // post or comment
Message.update(id, payload)
Message.delete(id, type)
Message.fetch(filters)          // house_id, room_id, type 등