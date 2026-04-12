# BRAINPOOL CORE

> 변경 빈도: 낮음 | 모든 프로젝트 공통 적용

---

## 1. 핵심 단위 — Message

시스템 전체는 단 하나의 구조로 동작한다.

```
Message = { id, type, content, meta, relations, created_at }
```

| type | 설명 |
|------|------|
| post | 공간 기록 |
| comment | 포스트 관계 |
| chat | 실시간 흐름 |
| event | 날짜 메타 포함 |

Post, Comment, Chat, Event는 별도 시스템이 아니다. 모두 Message의 type 변형이다.

---

## 2. 서비스 역할 (혼용 금지)

| 서비스 | 역할 | 금지 |
|--------|------|------|
| CoreNull | View Layer — Message 표시 | 비즈니스 로직 |
| CoreChat | Flow Layer — Message 전달 | 렌더링 |
| CoreRing | Interpretation Layer — 번역/분석 | 저장 |

---

## 3. 구조 규칙

- Container(House) = 레이아웃 + 라우팅만
- Message = 모든 행동(생성/수정/삭제/반응)
- View = 렌더링만, 로직 없음

View는 Message의 필터일 뿐이다:
- Plaza = 전체 Message
- Living = house 범위 Message
- Library = 저장된 Message

---

## 4. 절대 금지

- 이벤트 시스템 별도 생성 ❌
- 댓글 시스템 별도 생성 ❌
- 유사 기능 로직 중복 ❌
- Container 레이어에 비즈니스 로직 ❌
- Message 없이 존재하는 기능 ❌

---

## 5. 검증 체크리스트 (코드 작성 전)

1. 이 기능이 Message 없이 존재할 수 있나? → YES면 거부
2. 중복 로직이 있나? → YES면 리팩토링
3. 로직이 Container에 있나? → YES면 Message로 이동

---

## 6. 인프라 공통

| 항목 | 내용 |
|------|------|
| 배포 | Vercel (Hobby — API 12개 한도) |
| DB | Supabase PostgreSQL (`corenull` 스키마) |
| 미디어 | Cloudinary (preset: corenull) |
| 인증 | device_id (localStorage: cn_device_id) |
| 프론트 | Vanilla JS ES Modules |
| AI | Gemini 2.0 Flash |

### DB 필수 규칙
- 모든 요청: `Accept-Profile: corenull`, `Content-Profile: corenull` 헤더
- category_ids 조회: `post_id=in.(id1,id2)` 방식 (`or=` 금지)
- 새 테이블: `GRANT ALL ON corenull.[table] TO service_role` 필수
- Vercel env 변경 → 수동 Redeploy 필수

### 코드 규칙
- `"type": "module"` 필수 (CommonJS require 사용 금지)
- BOM 문자 주의 (GitHub 웹 에디터 금지)
- GitHub raw fetch: `raw.githubusercontent.com/sykim-stack/corenull/refs/heads/main/[파일]`
- 풀소스 교체 선호 (부분 패치 비선호)
