# 2025-11-27: student_history 제약 조건 수정 및 에러 바운더리 확인

## 작업 내용

### 1. student_history 테이블 제약 조건 수정

**문제**: `risk_evaluation` 이벤트 타입이 `student_history` 테이블의 `event_type` CHECK 제약 조건에 포함되지 않아 데이터베이스 에러 발생

**에러 메시지**:
```
new row for relation "student_history" violates check constraint "student_history_event_type_check"
```

**해결 방법**:
- 마이그레이션 파일 생성: `supabase/migrations/20251127142501_add_risk_evaluation_to_student_history.sql`
- `student_history_event_type_check` 제약 조건을 수정하여 `risk_evaluation` 추가

**허용된 event_type 목록**:
- `plan_completed`
- `study_session`
- `goal_progress`
- `goal_created`
- `goal_completed`
- `score_added`
- `score_updated`
- `content_progress`
- `auto_schedule_generated`
- `risk_evaluation` (새로 추가)

### 2. React Client Manifest 에러 확인

**문제**: `app/(admin)/error.tsx` 모듈을 React Client Manifest에서 찾을 수 없다는 에러

**상태**: 
- `app/(admin)/error.tsx` 파일은 이미 `"use client"` 지시어가 포함되어 있음
- 파일 구조는 올바르게 설정되어 있음
- 이는 Next.js 빌드 캐시 문제일 가능성이 높음

**권장 해결 방법**:
```bash
# 개발 서버 재시작
npm run dev

# 또는 빌드 캐시 삭제 후 재시작
rm -rf .next
npm run dev
```

## 관련 파일

- `supabase/migrations/20251127142501_add_risk_evaluation_to_student_history.sql` (신규)
- `lib/history/record.ts` - `risk_evaluation` 이벤트 타입 사용
- `lib/risk/engine.ts` - 위험 평가 시 히스토리 기록
- `app/(admin)/error.tsx` - 에러 바운더리 컴포넌트

## 마이그레이션 실행

```bash
# Supabase CLI를 사용한 마이그레이션 실행
supabase db push

# 또는 직접 SQL 실행
psql -h <host> -U <user> -d <database> -f supabase/migrations/20251127142501_add_risk_evaluation_to_student_history.sql
```

## 참고사항

- `student_history` 테이블은 학습 활동 이력을 기록하는 데 사용됨
- `risk_evaluation` 이벤트는 `lib/risk/engine.ts`의 `getStudentRiskScore` 함수에서 기록됨
- 히스토리 기록 실패는 메인 기능에 영향을 주지 않도록 try/catch로 처리됨

