-- 캠프 템플릿에 일반 플랜 활성화 허용 옵션 추가
ALTER TABLE camp_templates
ADD COLUMN IF NOT EXISTS allow_normal_plan_activation BOOLEAN DEFAULT false;

COMMENT ON COLUMN camp_templates.allow_normal_plan_activation IS
  '캠프 진행 중 학생이 일반 플랜을 활성화할 수 있는지 여부. false면 캠프 전용 모드.';
