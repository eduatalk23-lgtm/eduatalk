# 학습 제외 일정 날짜 선택 기능 개선

**작업 일자**: 2025-02-02  
**작업 범위**: 시간 관리의 학습 제외 일정 추가 기능에 플랜 그룹 생성 시 사용하는 날짜 선택 옵션 추가 및 중복 코드 최적화

## 작업 목표

시간 관리의 학습 제외 일정 추가 기능(`ExclusionManagement.tsx`)에 플랜 그룹 생성 시 사용하는 날짜 선택 옵션(단일/범위/비연속 다중 선택)을 추가하고, 중복 코드를 최적화합니다.

## 구현 내용

### Phase 1: 공통 유틸리티 함수 생성 및 중복 제거

#### 1.1 `lib/utils/date.ts`에 `generateDateRange` 함수 추가

문자열 기반 날짜 범위 생성 함수를 추가하여 타임존 문제를 방지하고 재사용성을 높였습니다.

```typescript
/**
 * 시작일과 종료일 사이의 모든 날짜를 생성 (YYYY-MM-DD 형식)
 * 타임존 문제를 방지하기 위해 문자열을 직접 파싱합니다.
 */
export function generateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const startParts = parseDateString(startDate);
  const endParts = parseDateString(endDate);
  const start = new Date(startParts.year, startParts.month - 1, startParts.day);
  const end = new Date(endParts.year, endParts.month - 1, endParts.day);
  const current = new Date(start);

  while (current <= end) {
    dates.push(formatDateFromDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}
```

#### 1.2 중복 코드 제거

- `ExclusionsPanel.tsx`의 중복된 `generateDateRange` 함수 제거
- `lib/utils/date.ts`에서 import하여 사용하도록 변경
- `ExclusionsPanel.tsx`의 비연속 다중 선택 부분도 `generateDateRange` 사용하도록 개선

### Phase 2: ExclusionManagement 컴포넌트 개선

#### 2.1 날짜 선택 타입 상태 추가

- `ExclusionInputType` 타입 정의: `"single" | "range" | "multiple"`
- 상태 관리 추가:
  - `exclusionInputType`: 현재 선택된 입력 타입
  - `newExclusionStartDate`, `newExclusionEndDate`: 범위 선택용
  - `newExclusionDates`: 비연속 다중 선택용 배열

#### 2.2 UI 컴포넌트 추가

- 입력 타입 선택 버튼 (단일 날짜 / 시작일~종료일 / 비연속 다중 선택)
- 타입별 입력 필드 조건부 렌더링
- `DateInput` 컴포넌트 재사용
- 비연속 다중 선택용 스크롤 가능한 날짜 목록 (최근 1년 전~1년 후)

#### 2.3 날짜 선택 로직 구현

- `toggleExclusionDate`: 비연속 다중 선택 토글 함수
- `getAvailableDates`: 선택 가능한 날짜 목록 생성
- `handleAddExclusion` 수정: 여러 날짜를 순차적으로 추가하도록 변경

#### 2.4 Server Action 호출

- 여러 날짜를 순차적으로 추가 (for loop)
- 각 날짜마다 `addPlanExclusion` 호출
- 모든 날짜 추가 완료 후 폼 초기화 및 데이터 재로드

### Phase 3: 코드 최적화 및 리팩토링

- 불필요한 주석 제거
- 타입 안전성 확인
- `ExclusionsPanel.tsx`의 비연속 다중 선택 부분도 `generateDateRange` 사용하도록 개선

### Phase 4: 테스트 및 검증

- 린터 에러 확인 (에러 없음)
- 모든 파일의 import 경로 확인
- 코드 일관성 확인

## 변경된 파일

### 수정 파일

1. **`lib/utils/date.ts`**
   - `generateDateRange` 함수 추가

2. **`app/(student)/blocks/_components/ExclusionManagement.tsx`**
   - 날짜 선택 타입 상태 추가
   - 날짜 선택 UI 컴포넌트 추가 (단일/범위/비연속 다중 선택)
   - 날짜 선택 로직 구현
   - `DateInput` 컴포넌트 및 `generateDateRange` 함수 import

3. **`app/(student)/plan/new-group/_components/_features/scheduling/components/ExclusionsPanel.tsx`**
   - 중복된 `generateDateRange` 함수 제거
   - `lib/utils/date.ts`에서 import하여 사용
   - 비연속 다중 선택 부분도 `generateDateRange` 사용하도록 개선

## 주요 기능

### 1. 단일 날짜 선택
- 기존 기능 유지
- `DateInput` 컴포넌트 사용

### 2. 범위 선택 (시작일 ~ 종료일)
- 시작일과 종료일을 선택하여 연속된 날짜 범위 추가
- `generateDateRange` 함수를 사용하여 범위 내 모든 날짜 생성
- 시작일이 종료일보다 앞서야 함 (유효성 검사)

### 3. 비연속 다중 선택
- 최근 1년 전부터 1년 후까지의 날짜 목록 표시
- 여러 날짜를 개별적으로 선택/해제 가능
- 이미 제외된 날짜는 비활성화 및 취소선 표시
- 선택된 날짜 개수 표시

## 기술적 고려사항

### 타임존 처리
- `parseDateString`, `formatDateFromDate` 사용으로 타임존 문제 방지
- Date 객체 생성 시 로컬 타임존 사용

### 성능
- 여러 날짜 추가 시 순차 처리 (현재 구조 유지)
- 비연속 다중 선택 시 스크롤 가능한 목록 사용 (가상화는 선택사항)

### 사용자 경험
- 선택된 날짜 개수 표시
- 이미 제외된 날짜 비활성화
- 입력 타입 전환 시 폼 초기화
- 중복 날짜 체크 및 친화적 에러 메시지

## 테스트 결과

- ✅ 린터 에러 없음
- ✅ 모든 import 경로 정상
- ✅ 타입 안전성 확인
- ✅ 코드 일관성 확인

## 향후 개선 사항

1. **배치 API 추가**: 여러 날짜를 한 번에 처리하는 Server Action 추가 고려
2. **날짜 목록 가상화**: 비연속 다중 선택 시 대량 날짜 처리 시 가상화 고려
3. **접근성 개선**: ARIA 레이블 및 키보드 네비게이션 추가 고려

