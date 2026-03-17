-- calendar_memos: 캘린더 사이드 패널 메모 시스템
-- 학생 메모 + 관리자(학생 대상) 메모를 하나의 테이블로 관리
-- 상담 노트(student_consulting_notes)와는 별도 — 빠른 캡처용 Keep 스타일

BEGIN;

-- ============================================================
-- 1. 테이블 생성
-- ============================================================

CREATE TABLE IF NOT EXISTS public.calendar_memos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  author_role   TEXT NOT NULL,

  -- 콘텐츠
  title         TEXT,
  content       TEXT NOT NULL DEFAULT '',
  is_checklist  BOOLEAN NOT NULL DEFAULT false,

  -- 캘린더 연결 (선택)
  memo_date     DATE,

  -- 가시성: 관리자 메모의 학생 공개 여부
  -- 'public' = 학생에게 표시, 'private' = 관리자 전용
  -- 학생 메모는 항상 public (관리자에게 보임)
  visibility    TEXT NOT NULL DEFAULT 'public',

  -- UI 메타데이터
  pinned        BOOLEAN NOT NULL DEFAULT false,
  color         TEXT,

  -- 타임스탬프
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ,

  -- 제약조건
  CONSTRAINT chk_memo_author_role
    CHECK (author_role IN ('student', 'admin', 'consultant')),
  CONSTRAINT chk_memo_visibility
    CHECK (visibility IN ('public', 'private')),
  CONSTRAINT chk_memo_has_content
    CHECK (length(trim(coalesce(content, ''))) > 0 OR title IS NOT NULL)
);

COMMENT ON TABLE public.calendar_memos IS '캘린더 사이드 패널 메모 (Keep 스타일 빠른 캡처)';
COMMENT ON COLUMN public.calendar_memos.visibility IS 'public=학생 공개, private=관리자 전용. 학생 메모는 항상 public';
COMMENT ON COLUMN public.calendar_memos.memo_date IS '캘린더 날짜 연결. NULL=자유 메모(날짜 무관)';
COMMENT ON COLUMN public.calendar_memos.is_checklist IS 'true면 content를 체크리스트로 렌더링 (JSON 배열)';

-- ============================================================
-- 2. 인덱스
-- ============================================================

-- 학생별 + 날짜별 조회 (가장 빈번한 쿼리)
CREATE INDEX idx_calendar_memos_student_date
  ON public.calendar_memos (student_id, memo_date DESC)
  WHERE deleted_at IS NULL;

-- 학생별 + 작성자 역할별 (탭 필터링)
CREATE INDEX idx_calendar_memos_student_author_role
  ON public.calendar_memos (student_id, author_role)
  WHERE deleted_at IS NULL;

-- 테넌트별 (관리자 전체 조회)
CREATE INDEX idx_calendar_memos_tenant
  ON public.calendar_memos (tenant_id)
  WHERE deleted_at IS NULL;

-- FK 인덱스 (조인 성능)
CREATE INDEX idx_calendar_memos_author
  ON public.calendar_memos (author_id);

-- ============================================================
-- 3. updated_at 트리거
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_calendar_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_calendar_memos_updated_at
  BEFORE UPDATE ON public.calendar_memos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_calendar_memos_updated_at();

-- ============================================================
-- 4. RLS 활성화 및 정책
-- ============================================================

ALTER TABLE public.calendar_memos ENABLE ROW LEVEL SECURITY;

-- 관리자/컨설턴트: 테넌트 내 모든 메모에 풀 액세스
CREATE POLICY "calendar_memos_admin_all"
  ON public.calendar_memos
  FOR ALL
  USING (public.rls_check_admin_tenant(tenant_id))
  WITH CHECK (public.rls_check_admin_tenant(tenant_id));

-- 학생: 본인 메모 + public 관리자 메모 읽기
CREATE POLICY "calendar_memos_student_select"
  ON public.calendar_memos
  FOR SELECT
  USING (
    student_id = (SELECT auth.uid())
    AND deleted_at IS NULL
    AND (
      author_id = (SELECT auth.uid())
      OR visibility = 'public'
    )
  );

-- 학생: 본인 메모 생성
CREATE POLICY "calendar_memos_student_insert"
  ON public.calendar_memos
  FOR INSERT
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND student_id = (SELECT auth.uid())
    AND author_role = 'student'
    AND visibility = 'public'
  );

-- 학생: 본인 메모만 수정
CREATE POLICY "calendar_memos_student_update"
  ON public.calendar_memos
  FOR UPDATE
  USING (
    author_id = (SELECT auth.uid())
    AND student_id = (SELECT auth.uid())
    AND author_role = 'student'
  )
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND student_id = (SELECT auth.uid())
    AND author_role = 'student'
  );

-- 학생: 본인 메모만 삭제
CREATE POLICY "calendar_memos_student_delete"
  ON public.calendar_memos
  FOR DELETE
  USING (
    author_id = (SELECT auth.uid())
    AND student_id = (SELECT auth.uid())
    AND author_role = 'student'
  );

-- 학부모: 자녀 메모 읽기 (public만)
CREATE POLICY "calendar_memos_parent_select"
  ON public.calendar_memos
  FOR SELECT
  USING (
    public.rls_check_parent_student(student_id)
    AND deleted_at IS NULL
    AND visibility = 'public'
  );

COMMIT;
