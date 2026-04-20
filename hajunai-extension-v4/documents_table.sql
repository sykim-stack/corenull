-- ─────────────────────────────────────────────────────
-- HajunAI Chrome Extension — documents 테이블
-- Supabase SQL Editor에서 실행
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  doc_type    TEXT DEFAULT 'work_log'
              CHECK (doc_type IN ('work_log','issue','decision','memo','design','report','sql')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_anon_block ON documents
  FOR ALL TO anon USING (false);

CREATE POLICY documents_auth_all ON documents
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_documents_project_id
  ON documents(project_id);

CREATE INDEX IF NOT EXISTS idx_documents_created_at
  ON documents(created_at DESC);

-- 확인 쿼리
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'documents'
ORDER BY ordinal_position;
