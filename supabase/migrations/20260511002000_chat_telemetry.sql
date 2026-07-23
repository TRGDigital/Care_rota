-- ============================================================
-- Sprint 9: add telemetry + citation columns to chat_messages;
-- add policy_documents table for RAG uploads.
-- ============================================================

-- Telemetry columns the planner/verifier loop needs to log
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS citations_json jsonb,
  ADD COLUMN IF NOT EXISTS tools_used     text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cost_pence     integer,
  ADD COLUMN IF NOT EXISTS latency_ms     integer,
  ADD COLUMN IF NOT EXISTS tokens_in      integer,
  ADD COLUMN IF NOT EXISTS tokens_out     integer;

-- ============================================================
-- policy_documents — metadata for manager-uploaded HR/policy docs
-- The actual file lives in Supabase Storage; this row tracks indexing state.
-- ============================================================

CREATE TABLE policy_documents (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id          uuid        NOT NULL,
  home_id            uuid        NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  filename           text        NOT NULL,
  storage_path       text        NOT NULL,
  mime_type          text        NOT NULL DEFAULT 'application/octet-stream',
  file_size_bytes    bigint,
  status             text        NOT NULL DEFAULT 'processing'
                                 CHECK (status IN ('processing', 'indexed', 'error')),
  chunk_count        integer,
  error_text         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid        REFERENCES users(id),
  updated_by_user_id uuid        REFERENCES users(id)
);

CREATE TRIGGER policy_documents_updated_at
  BEFORE UPDATE ON policy_documents FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_policy_documents_home ON policy_documents(home_id);

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY policy_documents_isolation ON policy_documents
  USING (home_id = (auth.jwt() ->> 'active_home_id')::uuid);

CREATE POLICY policy_documents_super_admin ON policy_documents
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');
