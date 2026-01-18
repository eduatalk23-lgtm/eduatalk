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

### 2. React Client Manifest 에러 해결

**문제**: `app/(admin)/error.tsx` 모듈을 React Client Manifest에서 찾을 수 없다는 에러

**에러 메시지**:
```
Error: Could not find the module "[project]/app/(admin)/error.tsx#default" in the React Client Manifest. 
This is probably a bug in the React Server Components bundler.
```

**원인**: 
- Next.js 16의 알려진 버그 (React Server Components bundler)
- 빌드 캐시 문제
- 타입 정의 방식 문제

**해결 방법**:
1. **타입 정의 명시화**: 인라인 타입 대신 인터페이스로 분리
   ```typescript
   interface ErrorProps {
     error: Error & { digest?: string };
     reset: () => void;
   }
   ```

2. **빌드 캐시 삭제 및 재시작**:
   ```bash
   # 빌드 캐시 삭제
   rm -rf .next
   
   # 개발 서버 재시작
   npm run dev
   ```

3. **파일 재생성** (필요한 경우):
   - 파일을 삭제하고 다시 생성
   - 다른 error.tsx 파일과 동일한 구조로 작성

**수정 내용**:
- `app/(admin)/error.tsx` 파일의 타입 정의를 인터페이스로 분리하여 명시화
- 다른 error.tsx 파일들(`app/(student)/error.tsx`, `app/(parent)/error.tsx`)과 동일한 구조로 통일

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

