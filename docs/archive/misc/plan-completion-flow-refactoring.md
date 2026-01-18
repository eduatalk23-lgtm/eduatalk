# 플랜 완료 플로우 리팩토링 문서

## 📋 개요

플랜 완료 플로우를 2단계로 분리하여 로직의 일관성과 사용자 경험을 개선했습니다.

## 🎯 주요 변경사항

### 1. 2단계 완료 플로우

**이전**: Today 화면에서 "완료하기" 클릭 → 즉시 완료 처리

**현재**: 
1. **Today 화면**: "학습 완료" 버튼 → 확인 다이얼로그 → `preparePlanCompletion()` 호출 → 완료 입력 페이지로 이동
2. **완료 입력 페이지**: 학습 범위/메모 입력 → "확인 완료" 클릭 → `completePlan()` 호출 (최종 완료)

### 2. 새로운 Server Action: `preparePlanCompletion`

- **역할**: 활성 세션 정리 및 완료 입력 페이지에 필요한 메타데이터 반환
- **동작**:
  - 해당 플랜의 활성 세션이 있으면 종료
  - 플랜 메타데이터 반환
  - 완료 여부 플래그 반환

### 3. PlanExecutionForm 상태별 UI

4가지 상태를 명확히 구분:

1. **미완료 + 활성 세션 없음**: 타이머 제어 + 학습 기록 폼 활성화
2. **미완료 + 활성 세션 있음**: 타이머 정리 안내 + 학습 기록 폼 비활성화
3. **완료 처리 중**: 로딩 메시지 표시
4. **이미 완료됨**: 읽기 전용 완료 배지 표시

## 📦 수정된 파일

### Server Actions

1. **`app/(student)/today/actions/todayActions.ts`**
   - `preparePlanCompletion()` 함수 추가
   - 활성 세션 종료 및 플랜 메타데이터 반환
   - `stopAllActiveSessionsForPlan()`는 deprecated로 표시 (하위 호환성 유지)

### Today 화면 컴포넌트

2. **`app/(student)/today/_components/PlanCard.tsx`**
   - `handleComplete()` 수정: `preparePlanCompletion()` 호출 후 `/today/plan/[planId]`로 이동
   - 확인 다이얼로그 추가

3. **`app/(student)/today/_components/PlanTimerCard.tsx`**
   - `handleComplete()` 수정: `preparePlanCompletion()` 호출 후 `/today/plan/[planId]`로 이동
   - 확인 다이얼로그 추가

### 완료 입력 페이지

4. **`app/(student)/today/plan/[planId]/page.tsx`**
   - 특정 플랜의 활성 세션 확인 로직 추가
   - `getSessionsInRange()`를 사용하여 해당 플랜의 활성 세션만 조회

5. **`app/(student)/today/plan/[planId]/_components/PlanExecutionForm.tsx`**
   - 완전 리팩토링: 4가지 상태별 UI 분기
   - 인라인 에러 메시지 표시
   - 유효성 검사 개선
   - 연결된 블록 섹션 설명 추가
   - 타이머 정리 기능 추가

## 🔄 새로운 완료 플로우

### Step 1: Today 화면에서 "학습 완료" 클릭

```
사용자 클릭
  ↓
확인 다이얼로그 표시
  "플랜을 완료하시겠습니까?
   지금까지의 학습을 기준으로 이 플랜을 완료 입력 화면으로 이동할까요?
   이후에 학습 범위와 메모를 입력해 최종 완료할 수 있어요."
  ↓
확인 시: preparePlanCompletion(planId) 호출
  - 활성 세션 종료 (있다면)
  - 플랜 메타데이터 반환
  ↓
성공 시: /today/plan/[planId]로 이동
```

### Step 2: 완료 입력 페이지에서 최종 완료

```
페이지 로드
  ↓
상태 확인:
  - 이미 완료됨 → 읽기 전용 UI
  - 활성 세션 있음 → 타이머 정리 안내
  - 활성 세션 없음 → 학습 기록 폼 활성화
  ↓
사용자가 학습 범위/메모 입력
  ↓
"확인 완료" 클릭
  ↓
유효성 검사 (클라이언트)
  ↓
completePlan(planId, payload) 호출
  ↓
성공 시: /today?completedPlanId=...로 리다이렉트
```

## 🎨 UI 상태별 표시

### 상태 1: 미완료 + 활성 세션 없음

- ✅ 타이머 · 일정 제어 섹션
  - [타이머 다시 실행] 버튼
  - [오늘 일정 미루기] 버튼 (조건부)
- ✅ 연결된 학습 블록 섹션 (조건부)
- ✅ 학습 기록 폼 (활성화)
  - 시작 값 입력
  - 종료 값 입력
  - 메모 입력 (선택)
- ✅ [확인 완료] 버튼

### 상태 2: 미완료 + 활성 세션 있음

- ⚠️ 타이머 실행 중 안내 카드
  - "현재 이 플랜의 타이머가 실행 중입니다..."
  - [타이머 정리 후 기록하기] 버튼
- ❌ 학습 기록 폼 (비활성화, opacity-50)
- ❌ [확인 완료] 버튼 (비활성화)

### 상태 3: 완료 처리 중

- 🔄 "완료 데이터를 정리하고 있어요..." 메시지
- ❌ 모든 입력/버튼 비활성화

### 상태 4: 이미 완료됨

- ✅ "이 플랜은 이미 완료되었습니다." 배지
- ❌ 타이머 제어 숨김
- ❌ 학습 기록 폼 숨김

## 🔧 에러 처리

### 클라이언트 유효성 검사

- 시작 값: 필수, 숫자, >= 0
- 종료 값: 필수, 숫자, >= 0, >= 시작 값
- 각 필드 아래 인라인 에러 메시지 표시

### 서버 에러 처리

- `preparePlanCompletion()` 실패: alert 표시
- `completePlan()` 실패: 상단 에러 배너 + 관련 필드 에러 표시

## 📝 연결된 블록 섹션 개선

- **설명 추가**: "이 페이지에서 완료 처리되는 것은 **현재 블록**만입니다. 다른 블록의 상태는 변경되지 않습니다."
- **상태 배지**: 각 블록에 StatusBadge 표시 (대기/진행 중/완료됨)
- **현재 블록 강조**: border, 배경색으로 시각적 강조

## ✅ 체크리스트

- [x] `preparePlanCompletion` Server Action 생성
- [x] PlanCard 완료 버튼 수정
- [x] PlanTimerCard 완료 버튼 수정
- [x] page.tsx에서 특정 플랜의 활성 세션 확인
- [x] PlanExecutionForm 4가지 상태 처리
- [x] 인라인 에러 메시지 표시
- [x] 유효성 검사 개선
- [x] 연결된 블록 섹션 설명 추가
- [x] 타이머 정리 기능 추가

## 🚀 다음 단계 (선택사항)

1. Today 페이지에서 `completedPlanId` 쿼리 파라미터 처리하여 토스트 표시
2. 애니메이션 추가 (완료 처리 중 등)
3. 더 나은 에러 UI (토스트 시스템 활용)

## 📝 참고

- 핵심 타이머 로직(`planTimerStore`, `timerUtils`)은 변경하지 않음
- 기존 `stopAllActiveSessionsForPlan()`는 하위 호환성을 위해 유지 (deprecated)
- 모든 완료 로직은 서버 사이드에서 원자적으로 처리

