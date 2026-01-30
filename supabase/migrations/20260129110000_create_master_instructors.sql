-- ============================================================================
-- 강사 마스터 테이블 생성
--
-- 콜드 스타트 시스템과 통합된 강사 분석 데이터 저장
-- - 강사 프로필 및 전문 분야
-- - 강의 스타일 분석
-- - 리뷰/평점 정보
-- - 추천 대상 학생 유형
-- ============================================================================

-- ============================================================================
-- 1. master_instructors 테이블 생성
-- ============================================================================

CREATE TABLE IF NOT EXISTS master_instructors (
  -- 기본 키
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 테넌트 (null = 공유 카탈로그)
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,

  -- ========================================
  -- 기본 정보
  -- ========================================

  /** 강사명 (필수) */
  name TEXT NOT NULL,

  /** 플랫폼 (메가스터디, 이투스, 대성마이맥, EBS 등) */
  platform TEXT,

  /** 프로필 요약 (경력, 소개) */
  profile_summary TEXT,

  /** 프로필 이미지 URL */
  profile_image_url TEXT,

  -- ========================================
  -- 전문 분야
  -- ========================================

  /** 담당 교과 (수학, 영어 등 - 복수 가능) */
  subject_categories TEXT[] DEFAULT '{}',

  /** 담당 세부 과목 (미적분, 확통, 영어독해 등) */
  subjects TEXT[] DEFAULT '{}',

  /** 전문 영역 (개념 설명, 문제풀이, 실전 대비 등) */
  specialty TEXT,

  -- ========================================
  -- 강의 스타일 분석
  -- ========================================

  /** 강의 스타일 (개념형, 문풀형, 속성형, 심화형, 균형형) */
  teaching_style TEXT,

  /** 주력 난이도 (개념, 기본, 심화, 최상위) */
  difficulty_focus TEXT,

  /** 강의 속도 (빠름, 보통, 느림) */
  lecture_pace TEXT,

  /** 설명 방식 (친절함, 핵심만, 반복강조, 비유활용) */
  explanation_style TEXT,

  -- ========================================
  -- 리뷰 / 평점
  -- ========================================

  /** 평균 리뷰 점수 (5점 만점) */
  review_score DECIMAL(2,1),

  /** 총 리뷰 수 */
  review_count INTEGER DEFAULT 0,

  -- ========================================
  -- 추천 정보
  -- ========================================

  /** 추천 대상 학생 유형 */
  target_students TEXT[] DEFAULT '{}',

  /** 강사 장점 */
  strengths TEXT[] DEFAULT '{}',

  /** 강사 단점/주의사항 */
  weaknesses TEXT[] DEFAULT '{}',

  -- ========================================
  -- 메타데이터 (JSONB)
  -- ========================================

  /**
   * 강사 상세 메타데이터
   * {
   *   "career": { "years": 15, "highlights": [...] },
   *   "reviews": { "positives": [...], "negatives": [...], "keywords": [...] },
   *   "statistics": { "totalLectures": 50, "avgRating": 4.5 },
   *   "recommendations": { "reasons": [...], "targetStudents": [...] },
   *   "meta": { "collectedAt": "...", "sources": [...], "reliability": 0.8 }
   * }
   */
  instructor_metadata JSONB,

  -- ========================================
  -- 시스템 필드
  -- ========================================

  /** 데이터 소스 (cold_start, manual, import) */
  source TEXT DEFAULT 'cold_start',

  /** 활성 상태 */
  is_active BOOLEAN DEFAULT true,

  /** 생성 일시 */
  created_at TIMESTAMPTZ DEFAULT NOW(),

  /** 수정 일시 */
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 테이블 코멘트
COMMENT ON TABLE master_instructors IS '강사 마스터 테이블 - 콜드 스타트 시스템 연동';

-- ============================================================================
-- 2. 인덱스 생성
-- ============================================================================

-- 이름 + 플랫폼 유니크 (중복 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_master_instructors_name_platform
ON master_instructors (name, COALESCE(platform, ''))
WHERE is_active = true;

-- 테넌트별 조회
CREATE INDEX IF NOT EXISTS idx_master_instructors_tenant
ON master_instructors (tenant_id)
WHERE is_active = true;

-- 플랫폼별 조회
CREATE INDEX IF NOT EXISTS idx_master_instructors_platform
ON master_instructors (platform)
WHERE is_active = true;

-- 교과별 조회 (GIN 인덱스)
CREATE INDEX IF NOT EXISTS idx_master_instructors_subjects
ON master_instructors USING GIN (subject_categories);

-- 대상 학생 유형 조회 (GIN 인덱스)
CREATE INDEX IF NOT EXISTS idx_master_instructors_target_students
ON master_instructors USING GIN (target_students);

-- 리뷰 점수 정렬
CREATE INDEX IF NOT EXISTS idx_master_instructors_review_score
ON master_instructors (review_score DESC NULLS LAST)
WHERE is_active = true AND review_score IS NOT NULL;

-- 강의 스타일별 조회
CREATE INDEX IF NOT EXISTS idx_master_instructors_teaching_style
ON master_instructors (teaching_style, difficulty_focus)
WHERE is_active = true;

-- 복합 인덱스: 추천 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_master_instructors_recommendation
ON master_instructors (subject_categories, difficulty_focus, review_score DESC NULLS LAST)
WHERE is_active = true;

-- ============================================================================
-- 3. master_lectures 테이블에 instructor_id FK 추가
-- ============================================================================

-- instructor_id 컬럼 추가
ALTER TABLE master_lectures
ADD COLUMN IF NOT EXISTS instructor_id UUID REFERENCES master_instructors(id) ON DELETE SET NULL;

COMMENT ON COLUMN master_lectures.instructor_id IS '강사 마스터 테이블 참조 (FK)';

-- instructor_id 인덱스
CREATE INDEX IF NOT EXISTS idx_master_lectures_instructor
ON master_lectures (instructor_id)
WHERE instructor_id IS NOT NULL;

-- ============================================================================
-- 4. updated_at 자동 갱신 트리거
-- ============================================================================

-- 트리거 함수 (이미 존재하면 재사용)
CREATE OR REPLACE FUNCTION update_master_instructors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 생성
DROP TRIGGER IF EXISTS trigger_master_instructors_updated_at ON master_instructors;
CREATE TRIGGER trigger_master_instructors_updated_at
  BEFORE UPDATE ON master_instructors
  FOR EACH ROW
  EXECUTE FUNCTION update_master_instructors_updated_at();

-- ============================================================================
-- 5. RLS (Row Level Security) 정책
--
-- master_books, master_lectures와 동일한 패턴:
-- - SELECT: 모든 사용자 (공개 카탈로그)
-- - INSERT/UPDATE/DELETE: 관리자만
-- ============================================================================

-- RLS 활성화
ALTER TABLE master_instructors ENABLE ROW LEVEL SECURITY;

-- SELECT: 모든 사용자 읽기 가능 (공개 카탈로그)
CREATE POLICY master_instructors_select_all ON master_instructors
  FOR SELECT
  USING (true);

-- INSERT: 관리자만
CREATE POLICY master_instructors_insert_admin ON master_instructors
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  );

-- UPDATE: 관리자만
CREATE POLICY master_instructors_update_admin ON master_instructors
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  );

-- DELETE: 관리자만
CREATE POLICY master_instructors_delete_admin ON master_instructors
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid())
  );
