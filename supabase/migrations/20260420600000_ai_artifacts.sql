-- ============================================
-- Phase C-2: ai_artifacts + ai_artifact_versions
-- /ai-chat 의 ArtifactPanel(오른쪽 사이드 카드) 영속화 + 버전 이력.
-- 기존 zustand 단일 객체를 DB-backed 으로 승격. C-3 Canvas 편집·C-4 Citation 전제.
-- ============================================

-- ─── ai_artifacts — artifact 식별자·메타 (같은 conversation×type×subject 로 upsert) ──

CREATE TABLE ai_artifacts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  conversation_id UUID        NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  owner_user_id   UUID        NOT NULL,
  -- 렌더러 분기 키. artifactStore.ts ArtifactType union 과 일치.
  type            TEXT        NOT NULL CHECK (
    type IN ('scores', 'plan', 'analysis', 'blueprint', 'generic')
  ),
  title           TEXT        NOT NULL,
  subtitle        TEXT,
  -- Phase T-2 "원본 보기" 링크. 같은 artifact 의 모든 버전 공통.
  origin_path     TEXT,
  -- 같은 artifact 판정용 자연키. props JSON 내 studentId 또는 origin_path 추출.
  -- NULL 이면 conversation+type 만으로 upsert (예: 계산형 artifact).
  subject_key     TEXT,
  latest_version  INTEGER     NOT NULL DEFAULT 1 CHECK (latest_version >= 1),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_artifacts_conversation
  ON ai_artifacts(conversation_id, updated_at DESC);
CREATE INDEX idx_ai_artifacts_tenant
  ON ai_artifacts(tenant_id, updated_at DESC);

-- conversation × type × subject_key 유일성 — ② upsert 결정 반영.
-- subject_key NULL 은 conversation+type 단일 artifact 허용.
CREATE UNIQUE INDEX idx_ai_artifacts_upsert_key
  ON ai_artifacts(conversation_id, type, subject_key);
CREATE UNIQUE INDEX idx_ai_artifacts_upsert_nullkey
  ON ai_artifacts(conversation_id, type)
  WHERE subject_key IS NULL;

-- ─── ai_artifact_versions — append-only 버전 본문 ──────────────────────

CREATE TABLE ai_artifact_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id     UUID        NOT NULL REFERENCES ai_artifacts(id) ON DELETE CASCADE,
  version_no      INTEGER     NOT NULL CHECK (version_no >= 1),
  -- props JSON 전체. 렌더러가 type 별로 해석.
  props           JSONB       NOT NULL,
  -- ① hash 비교용 (props 본문의 SHA-256). 동일 hash 면 버전 생성 skip.
  props_hash      TEXT        NOT NULL,
  -- 이 버전을 생성한 assistant 메시지. ai_messages.id 는 TEXT (AI SDK 제공 ID).
  created_by_message_id TEXT  REFERENCES ai_messages(id) ON DELETE SET NULL,
  -- C-3 사용자 편집 여부. NULL = tool 생성, NOT NULL = 사용자 편집 버전.
  edited_by_user_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (artifact_id, version_no)
);

CREATE INDEX idx_ai_artifact_versions_lookup
  ON ai_artifact_versions(artifact_id, version_no DESC);
CREATE INDEX idx_ai_artifact_versions_hash
  ON ai_artifact_versions(artifact_id, props_hash);

-- ─── RLS: agent_sessions / ai_subagent_runs 동일 패턴(JWT tenant_id + initplan) ──

ALTER TABLE ai_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_artifact_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_artifacts_select" ON ai_artifacts
  FOR SELECT USING (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

CREATE POLICY "ai_artifacts_insert" ON ai_artifacts
  FOR INSERT WITH CHECK (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

CREATE POLICY "ai_artifacts_update" ON ai_artifacts
  FOR UPDATE USING (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  )
  WITH CHECK (
    tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
  );

-- versions 는 artifact 경유 tenant 판정 (join).
CREATE POLICY "ai_artifact_versions_select" ON ai_artifact_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_artifacts a
      WHERE a.id = ai_artifact_versions.artifact_id
        AND a.tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );

CREATE POLICY "ai_artifact_versions_insert" ON ai_artifact_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_artifacts a
      WHERE a.id = ai_artifact_versions.artifact_id
        AND a.tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );

-- UPDATE 정책 없음 — append-only. C-3 편집도 신규 버전 INSERT.

-- ─── updated_at 자동 갱신 트리거 (artifacts 만) ──

CREATE OR REPLACE FUNCTION trg_ai_artifacts_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_artifacts_updated_at
  BEFORE UPDATE ON ai_artifacts
  FOR EACH ROW EXECUTE FUNCTION trg_ai_artifacts_touch_updated_at();
