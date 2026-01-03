-- Phase 4: 학습 패턴 예측 및 조기 경고
-- 4.1: 성과 예측 모델

-- 학생 학습 패턴 테이블 (기존 learningPatternService와 호환 + Phase 4 확장)
CREATE TABLE student_learning_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 기존 learningPatternService 호환 필드
  preferred_study_times text[] DEFAULT '{}',
  strong_days integer[] DEFAULT '{}',
  weak_days integer[] DEFAULT '{}',
  frequently_incomplete_subjects text[] DEFAULT '{}',
  overall_completion_rate numeric(5,2) DEFAULT 0,
  average_daily_study_minutes integer DEFAULT 0,
  total_plans_analyzed integer DEFAULT 0,
  study_time_analysis jsonb DEFAULT '[]',
  day_analysis jsonb DEFAULT '[]',
  subject_completion_analysis jsonb DEFAULT '[]',
  calculated_at timestamptz,

  -- Phase 4 확장 필드: 시간대별 완수율 곡선
  -- 예: {"06-09": 0.85, "09-12": 0.72, "12-15": 0.45, "15-18": 0.68, "18-21": 0.78, "21-24": 0.55}
  daily_completion_curve jsonb DEFAULT '{}',

  -- Phase 4: 요일별 상세 패턴
  -- 예: {"mon": {"avgCompletion": 0.75, "avgDuration": 120}, "tue": {...}}
  weekly_pattern jsonb DEFAULT '{}',

  -- Phase 4: 과목별 성과 트렌드 (최근 30일)
  -- 예: {"math": {"trend": "improving", "slope": 0.02}, "english": {"trend": "declining", "slope": -0.03}}
  subject_performance_trend jsonb DEFAULT '{}',

  -- Phase 4: 피로도 지표
  -- 예: {"streak_length": 5, "avg_session_decline": true, "late_night_increase": false}
  fatigue_indicators jsonb DEFAULT '{}',

  -- Phase 4: 최적 생산성 시간대 (0-23)
  peak_productivity_hours integer[] DEFAULT '{}',

  -- Phase 4: 평균 세션 시간
  avg_session_duration_minutes integer DEFAULT 0,

  -- Phase 4: 주간 평균 완수율
  avg_weekly_completion_rate numeric(5,4) DEFAULT 0,

  -- 분석 기간
  analyzed_period_start date,
  analyzed_period_end date,

  -- 메타데이터
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (student_id)
);

-- 학생 예측 테이블
CREATE TABLE student_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 예측 유형
  -- 'weekly_completion': 주간 완수율 예측
  -- 'subject_struggle': 과목별 어려움 예측
  -- 'burnout_risk': 번아웃 위험도
  -- 'exam_readiness': 시험 준비도
  prediction_type text NOT NULL,

  prediction_date date NOT NULL,       -- 예측 생성일
  target_period_start date,            -- 예측 대상 기간 시작
  target_period_end date,              -- 예측 대상 기간 종료

  prediction_score numeric(5,2),       -- 0-100 점수
  confidence numeric(3,2),             -- 0-1 확신도

  -- 기여 요인
  -- 예: [{"factor": "declining_streak", "impact": -15}, {"factor": "weak_subject_load", "impact": -10}]
  contributing_factors jsonb DEFAULT '[]',

  -- 권장 조치
  -- 예: [{"type": "reduce_load", "description": "주 학습량 20% 감소 권장"}, ...]
  recommended_interventions jsonb DEFAULT '[]',

  -- 실제 결과 (모델 학습용)
  actual_outcome numeric(5,2),

  created_at timestamptz DEFAULT now(),

  -- 인덱스를 위한 복합 제약조건
  UNIQUE (student_id, prediction_type, prediction_date)
);

-- 4.2: 조기 경고 시스템

-- 조기 경고 테이블
CREATE TABLE early_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- 경고 유형
  -- 'completion_drop': 완수율 급락
  -- 'streak_break': 연속 학습 위험
  -- 'subject_struggle': 과목별 어려움
  -- 'burnout_risk': 번아웃 위험
  -- 'schedule_overload': 과부하
  -- 'exam_unpreparedness': 시험 미준비
  warning_type text NOT NULL,

  -- 심각도: 'low', 'medium', 'high', 'critical'
  severity text NOT NULL,

  detected_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,          -- 관리자 확인 시간
  acknowledged_by uuid REFERENCES users(id),
  resolved_at timestamptz,              -- 해결 시간

  -- 컨텍스트 데이터
  -- 예: {"current_rate": 0.35, "previous_rate": 0.72, "affected_subjects": ["math"]}
  context_data jsonb NOT NULL DEFAULT '{}',

  -- 권장 조치
  -- 예: [{"action": "contact_student", "priority": 1}, {"action": "reduce_load", "priority": 2}]
  recommended_actions jsonb DEFAULT '[]',

  -- 알림 상태
  notification_sent boolean DEFAULT false,
  notification_sent_at timestamptz,
  notification_channels text[] DEFAULT '{}',  -- ['admin_dashboard', 'email', 'push']

  created_at timestamptz DEFAULT now()
);

-- 경고 처리 이력 테이블
CREATE TABLE warning_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id uuid NOT NULL REFERENCES early_warnings(id) ON DELETE CASCADE,

  -- 조치 유형
  -- 'acknowledged': 확인
  -- 'contacted_student': 학생 연락
  -- 'adjusted_schedule': 일정 조정
  -- 'reduced_load': 학습량 감소
  -- 'resolved': 해결 완료
  action_type text NOT NULL,

  action_taken_by uuid REFERENCES users(id),
  action_notes text,
  action_at timestamptz DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_learning_patterns_student ON student_learning_patterns(student_id);
CREATE INDEX idx_learning_patterns_tenant ON student_learning_patterns(tenant_id);
CREATE INDEX idx_learning_patterns_updated ON student_learning_patterns(updated_at);

CREATE INDEX idx_predictions_student ON student_predictions(student_id);
CREATE INDEX idx_predictions_tenant ON student_predictions(tenant_id);
CREATE INDEX idx_predictions_type_date ON student_predictions(prediction_type, prediction_date);
CREATE INDEX idx_predictions_recent ON student_predictions(student_id, prediction_date DESC);

CREATE INDEX idx_warnings_student ON early_warnings(student_id);
CREATE INDEX idx_warnings_tenant ON early_warnings(tenant_id);
CREATE INDEX idx_warnings_unresolved ON early_warnings(tenant_id, resolved_at) WHERE resolved_at IS NULL;
CREATE INDEX idx_warnings_severity ON early_warnings(severity, detected_at DESC);
CREATE INDEX idx_warnings_type ON early_warnings(warning_type, detected_at DESC);

CREATE INDEX idx_warning_actions_warning ON warning_actions(warning_id);
CREATE INDEX idx_warning_actions_user ON warning_actions(action_taken_by);

-- RLS 정책
ALTER TABLE student_learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE early_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_actions ENABLE ROW LEVEL SECURITY;

-- 학습 패턴: 같은 테넌트 내에서만 접근
CREATE POLICY "tenant_isolation_learning_patterns" ON student_learning_patterns
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- 예측: 같은 테넌트 내에서만 접근
CREATE POLICY "tenant_isolation_predictions" ON student_predictions
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- 경고: 같은 테넌트 내에서만 접근
CREATE POLICY "tenant_isolation_warnings" ON early_warnings
  FOR ALL USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- 경고 조치: 같은 테넌트 내에서만 접근
CREATE POLICY "tenant_isolation_warning_actions" ON warning_actions
  FOR ALL USING (
    warning_id IN (
      SELECT id FROM early_warnings
      WHERE tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    )
  );

-- 트리거: updated_at 자동 업데이트
CREATE TRIGGER update_learning_patterns_updated_at
  BEFORE UPDATE ON student_learning_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE student_learning_patterns IS 'Phase 4.1: 학생별 학습 패턴 분석 결과';
COMMENT ON TABLE student_predictions IS 'Phase 4.1: 학생 성과 예측';
COMMENT ON TABLE early_warnings IS 'Phase 4.2: 조기 경고';
COMMENT ON TABLE warning_actions IS 'Phase 4.2: 경고 처리 이력';
