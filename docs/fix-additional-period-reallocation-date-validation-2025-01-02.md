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

### 변경 전
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

### 변경 후
```typescript
if (e.target.checked) {
  // 4주 기간 계산 (원본 기간의 첫 4주)
  const periodStart = new Date(data.period_start);
  const periodEnd = new Date(data.period_end);
  
  // 날짜 유효성 검사
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    console.error("Invalid date values for additional period reallocation");
    return;
  }
  
  const fourWeeksEnd = new Date(periodStart);
  fourWeeksEnd.setDate(fourWeeksEnd.getDate() + 28); // 4주 = 28일

  // 실제 종료일이 4주보다 짧으면 그 날짜 사용
  const originalEnd =
    fourWeeksEnd > periodEnd ? periodEnd : fourWeeksEnd;

  // originalEnd 유효성 검사
  if (isNaN(originalEnd.getTime())) {
    console.error("Invalid originalEnd date");
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
```

## 수정 사항

1. **날짜 유효성 검사 추가**
   - `periodStart`와 `periodEnd`가 유효한 Date 객체인지 확인
   - Invalid Date인 경우 조기 반환으로 에러 방지

2. **최종 결과 날짜 검사**
   - `originalEnd`의 유효성도 추가 검사
   - 모든 날짜 연산 후 최종 검증

3. **에러 로깅**
   - 유효하지 않은 날짜 값에 대한 콘솔 에러 로깅 추가
   - 디버깅을 위한 정보 제공

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

