-- ============================================================
-- CONVERSATIONAL AI / RAG
-- All tables home-scoped: tenant_id = home_id
-- ============================================================

CREATE TABLE chat_sessions (
  id             uuid                PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id      uuid                NOT NULL,
  home_id        uuid                NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  user_id        uuid                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          text,               -- auto-generated from first message
  status         chat_session_status NOT NULL DEFAULT 'active',
  started_at     timestamptz         NOT NULL DEFAULT now(),
  last_message_at timestamptz,
  created_at     timestamptz         NOT NULL DEFAULT now(),
  updated_at     timestamptz         NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_chat_sessions_home ON chat_sessions(home_id, last_message_at DESC);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);

-- ============================================================

CREATE TABLE chat_messages (
  id              uuid      PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id       uuid      NOT NULL,
  home_id         uuid      NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  session_id      uuid      NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role            chat_role NOT NULL,
  content         text,
  -- Tool call fields (populated when role = 'tool')
  tool_name       text,
  tool_input      jsonb,
  tool_output     jsonb,
  -- Row-level citations: array of UUIDs from the underlying tables
  cited_row_ids   uuid[]    NOT NULL DEFAULT '{}',
  tokens_used     integer,
  model_id        text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER chat_messages_updated_at
  BEFORE UPDATE ON chat_messages FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ============================================================
-- RAG chunks: embeddings over home policy documents.
-- Dimension 1536 is compatible with most embedding providers.
-- Vector index uses ivfflat; tune lists= at scale.
-- ============================================================

CREATE TABLE rag_chunks (
  id           uuid    PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id    uuid    NOT NULL,
  home_id      uuid    NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
  content      text    NOT NULL,
  embedding    vector(1536),
  source_type  text    NOT NULL, -- e.g. 'policy_document', 'training_material'
  source_id    text    NOT NULL, -- file name or document ID in storage
  chunk_index  integer NOT NULL DEFAULT 0,
  token_count  integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by_user_id uuid REFERENCES users(id),
  updated_by_user_id uuid REFERENCES users(id)
);

CREATE TRIGGER rag_chunks_updated_at
  BEFORE UPDATE ON rag_chunks FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_rag_chunks_home ON rag_chunks(home_id);

-- Vector similarity index (cosine distance).
-- Requires at least a small number of rows before it is useful.
CREATE INDEX idx_rag_chunks_embedding ON rag_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
