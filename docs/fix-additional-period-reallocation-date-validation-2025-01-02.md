# 추가 기간 재배치 날짜 유효성 검사 수정

## 작업 일시
2025-01-02

## 문제 상황

### 에러 타입
Runtime RangeError: Invalid time value

### 에러 위치
`app/(student)/plan/new-group/_components/Step1BasicInfo.tsx:2631`

### 에러 메시지
```
Invalid time value
at Date.toISOString (<anonymous>:null:null)
at onChange (app/(student)/plan/new-group/_components/Step1BasicInfo.tsx:2631:30)
```

### 원인 분석
- `data.period_start` 또는 `data.period_end`가 빈 문자열이거나 유효하지 않은 값일 경우
- `new Date()`로 변환 시 Invalid Date 객체가 생성됨
- Invalid Date 객체에 대해 `toISOString()` 호출 시 RangeError 발생

## 수정 내용

### 변경 전 (초기)
```typescript
if (e.target.checked) {
  // 4주 기간 계산 (원본 기간의 첫 4주)
  const periodStart = new Date(data.period_start);
  const periodEnd = new Date(data.period_end);
  const fourWeeksEnd = new Date(periodStart);
  fourWeeksEnd.setDate(fourWeeksEnd.getDate() + 28); // 4주 = 28일

  // 실제 종료일이 4주보다 짧으면 그 날짜 사용
  const originalEnd =
    fourWeeksEnd > periodEnd ? periodEnd : fourWeeksEnd;

  onUpdate({
    additional_period_reallocation: {
      period_start: "",
      period_end: "",
      type: "additional_review",
      original_period_start: data.period_start,
      original_period_end: originalEnd
        .toISOString()
        .split("T")[0],
      review_of_review_factor: 0.25,
    },
  });
}
```

### 변경 후 (최종)
```typescript
// useToast 훅 추가
const { showError } = useToast();

// 체크박스 변경 핸들러
onChange={(e) => {
  if (e.target.checked) {
    // 날짜 값 확인
    if (!data.period_start || !data.period_end) {
      showError("학습 기간을 먼저 입력해주세요.");
      e.target.checked = false;
      return;
    }
    
    // 4주 기간 계산 (원본 기간의 첫 4주)
    const periodStart = new Date(data.period_start);
    const periodEnd = new Date(data.period_end);
    
    // 날짜 유효성 검사
    if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
      showError("유효하지 않은 날짜 형식입니다. 학습 기간을 다시 확인해주세요.");
      e.target.checked = false;
      return;
    }
    
    const fourWeeksEnd = new Date(periodStart);
    fourWeeksEnd.setDate(fourWeeksEnd.getDate() + 28); // 4주 = 28일

    // 실제 종료일이 4주보다 짧으면 그 날짜 사용
    const originalEnd =
      fourWeeksEnd > periodEnd ? periodEnd : fourWeeksEnd;

    // originalEnd 유효성 검사
    if (isNaN(originalEnd.getTime())) {
      showError("날짜 계산 중 오류가 발생했습니다.");
      e.target.checked = false;
      return;
    }

    onUpdate({
      additional_period_reallocation: {
        period_start: "",
        period_end: "",
        type: "additional_review",
        original_period_start: data.period_start,
        original_period_end: originalEnd
          .toISOString()
          .split("T")[0],
        review_of_review_factor: 0.25,
      },
    });
  }
}}

// 체크박스 비활성화 조건 개선
disabled={
  (isCampMode && !canStudentInputAdditionalPeriodReallocation) ||
  !data.period_start ||
  !data.period_end ||
  isNaN(new Date(data.period_start).getTime()) ||
  isNaN(new Date(data.period_end).getTime())
}
```

## 수정 사항

### 1단계: 기본 유효성 검사 추가
1. **날짜 유효성 검사 추가**
   - `periodStart`와 `periodEnd`가 유효한 Date 객체인지 확인
   - Invalid Date인 경우 조기 반환으로 에러 방지

2. **최종 결과 날짜 검사**
   - `originalEnd`의 유효성도 추가 검사
   - 모든 날짜 연산 후 최종 검증

3. **에러 로깅**
   - 유효하지 않은 날짜 값에 대한 콘솔 에러 로깅 추가

### 2단계: UX 개선 및 사용자 피드백
1. **Toast 메시지로 사용자 피드백 제공**
   - `useToast` 훅 추가 및 import
   - 유효하지 않은 날짜일 때 Toast 에러 메시지 표시
   - 사용자 친화적인 한국어 에러 메시지 제공

2. **체크박스 조건부 비활성화**
   - 날짜가 없거나 유효하지 않을 때 체크박스 비활성화
   - 사용자가 유효하지 않은 상태로 체크할 수 없도록 예방

3. **체크박스 상태 복원**
   - 에러 발생 시 체크박스 체크 상태를 자동으로 해제
   - 일관된 UI 상태 유지

## 테스트 시나리오

1. **정상 케이스**
   - 유효한 `period_start`와 `period_end`로 추가 기간 재배치 체크박스 활성화
   - 정상적으로 날짜 계산 및 저장

2. **에러 케이스**
   - 빈 문자열이나 유효하지 않은 날짜 값이 있는 경우
   - 에러 로그 출력 후 처리 중단 (RangeError 방지)

## 영향 범위

- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- 1730 Timetable 스케줄러 타입에서 추가 기간 학습 범위 재배치 기능

## 관련 이슈

- Invalid Date 객체로 인한 `toISOString()` RangeError

