# 작업 일지: 타이머 초기화 시 플랜 타이머 로그 삭제 문제 수정

## 날짜
2025-01-13

## 문제 상황
타이머 초기화를 해도 플랜 타이머 로그(`plan_timer_logs`)가 삭제되지 않는 문제가 발생했습니다.

## 원인 분석
1. `resetPlanTimer` 함수에서 `plan_timer_logs` 테이블의 데이터를 삭제하는 코드는 있었습니다 (line 112-122).
2. 하지만 `plan_timer_logs` 테이블에 **DELETE 정책이 없었습니다**.
3. RLS(Row Level Security)가 활성화되어 있는데 DELETE 정책이 없으면 삭제가 실패합니다.
4. 에러가 발생해도 로그만 남기고 계속 진행하도록 되어 있어서, 실제로 삭제가 실패했는지 확인하기 어려웠습니다.

## 해결 방법

### 1. DELETE 정책 추가
`plan_timer_logs` 테이블에 DELETE 정책을 추가하는 마이그레이션을 생성했습니다:

```sql
CREATE POLICY "Enable delete for authenticated users" ON plan_timer_logs 
  FOR DELETE TO authenticated 
  USING (auth.uid() = student_id);
```

이 정책은 본인(`student_id`)의 로그만 삭제할 수 있도록 합니다.

### 2. 에러 처리 개선
삭제된 로그 수를 확인할 수 있도록 `.select()`를 추가하고, 삭제 성공 시 로그를 출력하도록 개선했습니다:

```typescript
const { error: deleteLogsError, data: deletedLogs } = await supabase
  .from("plan_timer_logs")
  .delete()
  .in("plan_id", planIds)
  .eq("student_id", user.userId)
  .select(); // 삭제된 행 수 확인용

if (deleteLogsError) {
  console.error("[timerResetActions] 타이머 로그 삭제 실패:", deleteLogsError);
} else {
  console.log(`[timerResetActions] 타이머 로그 ${deletedLogs?.length || 0}개 삭제 완료`);
}
```

## 수정된 파일
- `supabase/migrations/20250113000000_add_delete_policy_for_plan_timer_logs.sql` (신규)
  - `plan_timer_logs` 테이블에 DELETE 정책 추가
- `app/(student)/today/actions/timerResetActions.ts`
  - 삭제 결과 확인 로직 추가

## 적용 방법
마이그레이션을 실행하여 DELETE 정책을 추가해야 합니다:

```bash
# Supabase CLI 사용 시
supabase migration up

# 또는 Supabase Dashboard에서 직접 실행
```

## 테스트 항목
- [ ] 마이그레이션 실행 후 DELETE 정책이 추가되었는지 확인
- [ ] 타이머 초기화 시 `plan_timer_logs`의 로그가 삭제되는지 확인
- [ ] 삭제 후 `TimeCheckSection`에서 타이머 로그가 사라지는지 확인
- [ ] 다른 사용자의 로그는 삭제되지 않는지 확인 (RLS 정책 검증)

## 참고
- RLS가 활성화된 테이블에서는 SELECT, INSERT, UPDATE, DELETE 각각에 대한 정책이 필요합니다.
- 정책이 없으면 해당 작업이 실패합니다.
- `plan_timer_logs` 테이블에는 SELECT와 INSERT 정책만 있었고, DELETE 정책이 없었습니다.

