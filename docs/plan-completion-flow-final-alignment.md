# 플랜 완료 플로우 최종 정렬 문서

## 📋 개요

플랜 완료 플로우를 스펙 문서에 맞게 정렬하고 UI/UX를 개선했습니다.

## ✅ 완료된 작업

### 1. 버튼 레이블 개선

**변경 전**: "완료하기"  
**변경 후**: "학습 결과 입력"

- `TimerControls.tsx`: RUNNING/PAUSED 상태의 완료 버튼 레이블 변경
- Today 화면에서 "학습 결과 입력" 버튼 클릭 시 완료 입력 페이지로 이동

### 2. PlanExecutionForm 섹션 순서 조정

**변경 전 순서**:
1. 타이머 · 일정 제어
2. 연결된 학습 블록
3. 학습 기록 폼
4. 확인 완료 버튼

**변경 후 순서** (Primary Action 우선):
1. 학습 기록 폼 (Primary)
2. 완료 확정 버튼 (Primary CTA)
3. 타이머 · 일정 제어 (Secondary)
4. 연결된 학습 블록 (Secondary)

### 3. Today 페이지에서 completedPlanId 처리

- `TodayPageContent`에 `completedPlanId`, `completedPlanTitle` props 추가
- `CompletionToast` 컴포넌트 생성
- 완료 후 Today 페이지로 리다이렉트 시 토스트 표시: "{플랜 제목} 플랜이 완료 처리되었습니다."
- URL에서 `completedPlanId` 쿼리 파라미터 자동 제거

### 4. 에러 처리 개선

**변경 전**: `alert()` 사용  
**변경 후**: `useToast().showError()` 사용

- `PlanCard.tsx`: 모든 alert를 toast로 변경
- `PlanTimerCard.tsx`: 모든 alert를 toast로 변경
- 일관된 에러 UI 제공

### 5. preparePlanCompletion idempotency 확인

`preparePlanCompletion` 함수는 이미 idempotent하게 구현되어 있습니다:

- 이미 완료된 경우: 즉시 반환 (hasActiveSession: false, isAlreadyCompleted: true)
- 활성 세션이 없는 경우: 즉시 반환 (hasActiveSession: false)
- 활성 세션이 있는 경우: 종료 후 반환 (hasActiveSession: false)

### 6. 완료 확정 버튼 레이블

**변경 전**: "확인 완료"  
**변경 후**: "완료 확정"

- PlanExecutionForm의 Primary CTA 버튼 레이블 변경
- "확인 완료"보다 "완료 확정"이 최종 완료의 의미를 더 명확히 전달

## 📦 수정된 파일

### 새로운 파일

1. **`app/(student)/today/_components/CompletionToast.tsx`**
   - completedPlanId 쿼리 파라미터 감지
   - URL에서 파라미터 제거
   - 완료 토스트 표시

### 수정된 파일

2. **`app/(student)/today/_components/timer/TimerControls.tsx`**
   - 완료 버튼 레이블: "완료하기" → "학습 결과 입력"

3. **`app/(student)/today/_components/PlanCard.tsx`**
   - 에러 처리: alert → toast
   - useToast 훅 사용

4. **`app/(student)/today/_components/PlanTimerCard.tsx`**
   - 에러 처리: alert → toast
   - useToast 훅 사용

5. **`app/(student)/today/_components/TodayPageContent.tsx`**
   - CompletionToast 컴포넌트 추가
   - completedPlanId, completedPlanTitle props 추가

6. **`app/(student)/today/page.tsx`**
   - completedPlanId 쿼리 파라미터 처리
   - 완료된 플랜 정보 조회
   - TodayPageContent에 props 전달

7. **`app/(student)/today/plan/[planId]/_components/PlanExecutionForm.tsx`**
   - 섹션 순서 조정 (학습 기록 폼 우선)
   - Primary CTA 버튼 레이블: "확인 완료" → "완료 확정"

## 🔄 최종 완료 플로우

### Step 1: Today 화면

```
사용자 클릭: "학습 결과 입력" 버튼
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
실패 시: Toast 에러 메시지 표시 (이동하지 않음)
```

### Step 2: 완료 입력 페이지

```
페이지 로드
  ↓
상태 확인:
  - State A: 미완료 + 활성 세션 없음 → 학습 기록 폼 활성화
  - State B: 미완료 + 활성 세션 있음 → 타이머 정리 안내
  - State C: 완료 처리 중 → 로딩 메시지
  - State D: 이미 완료됨 → 읽기 전용 UI
  ↓
사용자가 학습 범위/메모 입력 (State A)
  ↓
"완료 확정" 클릭
  ↓
유효성 검사 (클라이언트)
  - 시작 값: 필수, 숫자, >= 0
  - 종료 값: 필수, 숫자, >= 0, >= 시작 값
  - 인라인 에러 메시지 표시
  ↓
completePlan(planId, payload) 호출
  ↓
성공 시: /today?completedPlanId=...로 리다이렉트
실패 시: 상단 에러 배너 + 관련 필드 에러 표시
```

### Step 3: Today 페이지 (완료 후)

```
페이지 로드
  ↓
CompletionToast 컴포넌트가 completedPlanId 감지
  ↓
플랜 정보 조회 (서버 사이드)
  ↓
URL에서 completedPlanId 제거
  ↓
토스트 표시: "{플랜 제목} 플랜이 완료 처리되었습니다."
```

## 🎨 UI 상태별 표시 (최종)

### State A: 미완료 + 활성 세션 없음

1. **학습 기록 폼** (Primary)
   - 시작 값 입력 (필수)
   - 종료 값 입력 (필수)
   - 메모 입력 (선택)
   - 인라인 에러 메시지

2. **완료 확정 버튼** (Primary CTA)
   - "완료 확정" (녹색, 큰 버튼)

3. **타이머 · 일정 제어** (Secondary)
   - 타이머 다시 실행
   - 오늘 일정 미루기 (조건부)

4. **연결된 학습 블록** (Secondary, 조건부)
   - 현재 블록 강조
   - 상태 배지 표시

### State B: 미완료 + 활성 세션 있음

1. **타이머 실행 중 안내 카드**
   - "현재 이 플랜의 타이머가 실행 중입니다..."
   - [타이머 정리 후 기록하기] 버튼

2. **학습 기록 폼** (비활성화, opacity-50)

3. **완료 확정 버튼** (비활성화)

### State C: 완료 처리 중

- "완료 데이터를 정리하고 있어요..." 메시지
- 모든 입력/버튼 비활성화

### State D: 이미 완료됨

- "이 플랜은 이미 완료되었습니다." 배지
- 타이머 제어 숨김
- 학습 기록 폼 숨김

## 🔧 에러 처리 (최종)

### 클라이언트 유효성 검사

- 시작 값: 필수, 숫자, >= 0
- 종료 값: 필수, 숫자, >= 0, >= 시작 값
- 각 필드 아래 인라인 에러 메시지 표시

### 서버 에러 처리

- `preparePlanCompletion()` 실패: Toast 에러 메시지, 페이지 이동하지 않음
- `completePlan()` 실패: 상단 에러 배너 + 관련 필드 에러 표시

## ✅ 체크리스트

- [x] 버튼 레이블 개선 ("완료하기" → "학습 결과 입력")
- [x] PlanExecutionForm 섹션 순서 조정 (Primary Action 우선)
- [x] Today 페이지에서 completedPlanId 처리
- [x] CompletionToast 컴포넌트 생성
- [x] 에러 처리 개선 (alert → toast)
- [x] preparePlanCompletion idempotency 확인
- [x] 완료 확정 버튼 레이블 변경 ("확인 완료" → "완료 확정")

## 📝 참고

- 핵심 타이머 로직(`planTimerStore`, `timerUtils`)은 변경하지 않음
- 모든 완료 로직은 서버 사이드에서 원자적으로 처리
- 에러 처리는 일관된 Toast 시스템 사용
- Primary Action (학습 기록 폼)이 시각적으로 우선순위를 가짐

