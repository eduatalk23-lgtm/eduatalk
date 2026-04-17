-- ============================================================
-- AI Chat: admin/consultant 테넌트 읽기 권한 확장 (핸드오프 D 빈틈 #2)
-- ============================================================
-- 목적: 동일 테넌트에 속한 admin/consultant 가 학생·학부모 대화와
--       메시지를 읽을 수 있도록 SELECT 정책 추가.
--       INSERT/UPDATE/DELETE 는 owner 한정 유지 (기존 정책 그대로).
--
-- 패턴:
-- - auth.jwt() ->> 'user_role' 로 역할 확인 (프로젝트 표준)
-- - auth.jwt() ->> 'tenant_id' 로 테넌트 확인 (initplan 래핑)
-- - 기존 owner_select 와 OR 관계 (Postgres 는 여러 policy 를 OR 결합)
-- ============================================================

-- ai_conversations: admin/consultant 테넌트 읽기
CREATE POLICY "ai_conversations_tenant_admin_select"
  ON public.ai_conversations
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NOT NULL
    AND tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    AND (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
  );

-- ai_messages: 해당 대화가 내 테넌트의 것이고 내가 admin/consultant 면 읽기
CREATE POLICY "ai_messages_tenant_admin_select"
  ON public.ai_messages
  FOR SELECT
  TO authenticated
  USING (
    (SELECT (auth.jwt() ->> 'user_role')) IN ('admin', 'consultant', 'superadmin')
    AND EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.tenant_id = (SELECT (auth.jwt()->>'tenant_id')::uuid)
    )
  );

COMMENT ON POLICY "ai_conversations_tenant_admin_select" ON public.ai_conversations IS
  '동일 테넌트 admin/consultant/superadmin 읽기 허용. 쓰기는 여전히 owner 한정.';

COMMENT ON POLICY "ai_messages_tenant_admin_select" ON public.ai_messages IS
  '대화 테넌트 일치 + admin/consultant/superadmin 읽기 허용. 쓰기는 owner 한정.';
