# scheduler_options 컬럼 마이그레이션 적용 완료

## 작업 일시
2025-01-22

## 문제점
`plan_groups` 테이블에 `scheduler_options` 컬럼이 없어서 시간 설정 체크박스 기능이 저장되지 않았습니다.

## 해결 방법

### 1. 마이그레이션 파일 생성
**파일**: `supabase/migrations/20251126000000_add_scheduler_options_to_plan_groups.sql`

`plan_groups` 테이블에 `scheduler_options` JSONB 컬럼을 추가하는 마이그레이션을 생성했습니다.

### 2. 마이그레이션 적용
```bash
npx supabase db push
```

마이그레이션이 성공적으로 적용되어 `scheduler_options` 컬럼이 생성되었습니다.

## 마이그레이션 내용

```sql
ALTER TABLE plan_groups 
ADD COLUMN scheduler_options jsonb;

COMMENT ON COLUMN plan_groups.scheduler_options IS '스케줄러 옵션 (JSONB). 시간 설정, 자율학습 시간 배정 옵션 등을 저장';

CREATE INDEX IF NOT EXISTS idx_plan_groups_scheduler_options 
ON plan_groups USING gin (scheduler_options);
```

## 저장되는 데이터

`scheduler_options` 컬럼에는 다음 정보가 JSONB 형식으로 저장됩니다:

- `enable_self_study_for_holidays`: 지정휴일 자율학습 시간 배정 여부
- `enable_self_study_for_study_days`: 학습일/복습일 자율학습 시간 배정 여부
- `designated_holiday_hours`: 지정휴일 자율학습 시간 (start, end)
- `camp_self_study_hours`: 학습일/복습일 자율학습 시간 (start, end)
- `use_self_study_with_blocks`: 블록이 있어도 자율학습 시간 사용 여부
- `lunch_time`: 점심 시간
- `camp_study_hours`: 학습 시간
- 기타 스케줄러 옵션들

## 결과

이제 시간 설정 체크박스 기능이 정상적으로 작동합니다:
- ✅ 지정휴일 자율학습 시간 배정하기 토글 저장
- ✅ 학습일/복습일 자율학습 시간 배정하기 토글 저장
- ✅ 시간 설정 값 저장
- ✅ 저장된 설정이 로드되어 표시됨

