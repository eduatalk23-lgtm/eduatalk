# 주별 플랜 캘린더 연결선 디자인 적용

## 변경 사항

주별 플랜 캘린더에 월별 플랜 캘린더와 동일한 회차 연결선 디자인을 적용했습니다.

### 개선 내용

**같은 회차 플랜 연결선 디자인**
- 같은 `plan_number`를 가진 플랜들을 시각적으로 연결
- 첫 번째, 중간, 마지막 플랜에 따라 다른 스타일 적용
- 연결된 플랜들 사이에 연결선 표시

### 구현 내용

1. **연결 상태 계산 로직 추가**
   - `getPlanConnectionState` 함수 추가
   - 날짜별로 같은 `plan_number`를 가진 플랜들을 그룹화
   - `block_index` 순으로 정렬하여 첫 번째, 중간, 마지막 판별

2. **PlanCard 컴포넌트 사용**
   - 기존의 직접 div 렌더링 대신 `PlanCard` 컴포넌트 사용
   - `compact` 모드로 표시
   - 연결 상태 props 전달 (`isConnected`, `isFirst`, `isLast`, `isMiddle`)

### 변경 파일

- `app/(student)/plan/calendar/_components/WeekView.tsx`
  - 연결 상태 계산 로직 추가
  - `PlanCard` 컴포넌트 import 및 사용
  - 사용하지 않는 `CONTENT_TYPE_EMOJIS` import 제거

### 일관성

이제 월별, 주별 뷰 모두에서 같은 회차의 플랜들이 동일한 연결선 디자인으로 표시됩니다.

## 날짜

2025-01-31

