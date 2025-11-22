# 타이머 초기화 시 전체 진행률 반영 수정

## 📋 작업 개요

학습 관리(/today) 페이지에서 타이머 초기화 시 전체 진행률도 올바르게 반영되도록 수정했습니다.

## 🐛 문제점

타이머 초기화 시 다음 문제가 있었습니다:

1. **세션 데이터 미삭제**: 타이머 초기화 시 활성 세션만 종료하고, 종료된 세션 데이터는 삭제하지 않았습니다.
2. **전체 진행률 계산 오류**: `calculateTodayProgress` 함수가 모든 세션의 `duration_seconds`를 합산하는데, 초기화된 플랜의 세션도 여전히 포함되어 전체 진행률이 잘못 계산되었습니다.

## ✅ 해결 방법

`resetPlanTimer` 함수에 다음 로직을 추가했습니다:

```typescript
// 2. 해당 플랜의 모든 세션 삭제 (전체 진행률 반영을 위해)
const { error: deleteSessionsError } = await supabase
  .from("student_study_sessions")
  .delete()
  .in("plan_id", planIds)
  .eq("student_id", user.userId);
```

### 수정된 초기화 순서

1. 활성 세션 종료
2. **해당 플랜의 모든 세션 삭제** (신규 추가)
3. 플랜의 타이머 기록 및 진행률 초기화
4. student_content_progress에서 진행률 삭제
5. 타이머 로그 삭제

## 📝 변경 사항

### 파일
- `app/(student)/today/actions/timerResetActions.ts`

### 주요 변경
- 타이머 초기화 시 해당 플랜의 모든 세션(활성 + 종료된)을 삭제하도록 추가
- 이로 인해 `calculateTodayProgress`에서 초기화된 플랜의 세션이 제외되어 전체 진행률이 올바르게 반영됨

## 🎯 효과

- 타이머 초기화 시 전체 진행률이 즉시 반영됩니다.
- 초기화된 플랜의 학습 시간이 전체 진행률 계산에서 제외됩니다.
- 사용자가 타이머를 초기화하면 대시보드의 진행률도 함께 업데이트됩니다.

## 📅 작업 일자

2025-01-XX

