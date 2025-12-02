# 학습 기간 설정 날짜 선택 타임존 문제 수정

## 문제 상황

학습 기간 설정 중 달력에서 날짜를 선택할 때 선택한 날짜보다 하루 빠른 날짜가 입력되는 문제가 발생했습니다.

### 원인 분석

1. **`toISOString()` 사용 문제**: 
   - `toISOString()`은 UTC 시간으로 변환하기 때문에, 로컬 타임존이 UTC보다 앞서 있는 경우 (예: 한국은 UTC+9) 날짜가 하루 전으로 바뀔 수 있습니다.
   - 예: 한국 시간대(UTC+9)에서 2025-01-31 00:00:00 KST는 2025-01-30 15:00:00 UTC로 변환됨
   - 따라서 `toISOString().split("T")[0]`는 "2025-01-30"이 됨

2. **영향을 받은 함수들**:
   - `calculatePeriodFromDday`: D-day 기준으로 학습 기간 계산
   - `calculatePeriodFromWeeks`: 주 단위로 학습 기간 계산
   - `generateDateRange`: 날짜 범위 생성
   - 추가 기간 재배치 관련 날짜 계산

## 수정 내용

### 1. 날짜 유틸리티 함수 개선 (`lib/utils/date.ts`)

#### `calculateEndDate` 함수 수정
- `new Date(startDate)` 대신 `parseDateString`을 사용하여 YYYY-MM-DD 문자열을 직접 파싱
- 타임존 문제 방지

#### `addDaysToDate` 함수 추가
```typescript
/**
 * 날짜 문자열에 일수를 더하거나 빼기 (타임존 문제 방지)
 * @param dateStr YYYY-MM-DD 형식의 날짜 문자열
 * @param days 더하거나 빼고 싶은 일수 (음수 가능)
 * @returns YYYY-MM-DD 형식의 날짜 문자열
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const parts = parseDateString(dateStr);
  const date = new Date(parts.year, parts.month - 1, parts.day);
  date.setDate(date.getDate() + days);
  return formatDateFromDate(date);
}
```

### 2. Step1BasicInfo 컴포넌트 수정

#### `calculatePeriodFromDday` 함수
- `toISOString()` 제거
- `parseDateStringUtil`과 `formatDateFromDate` 사용

```typescript
const calculatePeriodFromDday = (dday: string) => {
  // YYYY-MM-DD 형식 문자열을 직접 파싱하여 타임존 문제 방지
  const targetParts = parseDateStringUtil(dday);
  const targetDate = new Date(targetParts.year, targetParts.month - 1, targetParts.day);

  // D-day 기준으로 30일 전부터 시작
  const start = new Date(targetDate);
  start.setDate(start.getDate() - 30);

  onUpdate({
    period_start: formatDateFromDate(start),
    period_end: formatDateFromDate(targetDate),
    target_date: dday,
  });
};
```

#### `calculatePeriodFromWeeks` 함수
- `toISOString()` 제거
- `parseDateStringUtil`과 `formatDateFromDate` 사용

```typescript
const calculatePeriodFromWeeks = (weeks: number, startDate: string) => {
  // YYYY-MM-DD 형식 문자열을 직접 파싱하여 타임존 문제 방지
  const startParts = parseDateStringUtil(startDate);
  const start = new Date(startParts.year, startParts.month - 1, startParts.day);

  const end = new Date(start);
  end.setDate(end.getDate() + weeks * 7);

  onUpdate({
    period_start: formatDateFromDate(start),
    period_end: formatDateFromDate(end),
  });
};
```

#### `today` 변수 수정
- `new Date().toISOString().split("T")[0]` 대신 `getTodayParts()`와 `formatDateString` 사용

#### 추가 기간 재배치 관련 날짜 계산
- 모든 `toISOString()` 사용 부분을 `addDaysToDate` 함수로 대체
- 날짜 비교 및 계산 로직 개선

### 3. ExclusionsPanel 컴포넌트 수정

#### `generateDateRange` 함수
- `toISOString()` 제거
- `parseDateString`과 `formatDateFromDate` 사용

```typescript
const generateDateRange = (start: string, end: string): string[] => {
  const dates: string[] = [];
  // YYYY-MM-DD 형식 문자열을 직접 파싱하여 타임존 문제 방지
  const startParts = parseDateString(start);
  const endParts = parseDateString(end);
  const startDate = new Date(startParts.year, startParts.month - 1, startParts.day);
  const endDate = new Date(endParts.year, endParts.month - 1, endParts.day);
  const current = new Date(startDate);

  while (current <= endDate) {
    dates.push(formatDateFromDate(current));
    current.setDate(current.getDate() + 1);
  }

  return dates;
};
```

## 수정된 파일 목록

1. `lib/utils/date.ts`
   - `calculateEndDate` 함수 수정
   - `addDaysToDate` 함수 추가

2. `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
   - `calculatePeriodFromDday` 함수 수정
   - `calculatePeriodFromWeeks` 함수 수정
   - `today` 변수 수정
   - 추가 기간 재배치 관련 날짜 계산 수정

3. `app/(student)/plan/new-group/_components/_panels/ExclusionsPanel.tsx`
   - `generateDateRange` 함수 수정
   - 날짜 범위 생성 로직 수정

## 핵심 원칙

1. **YYYY-MM-DD 문자열은 직접 파싱**: `new Date(dateString)` 대신 `parseDateString` 사용
2. **로컬 타임존 기준 변환**: `toISOString()` 대신 `formatDateFromDate` 사용
3. **날짜 계산은 Date 객체 사용 후 포맷팅**: 날짜 연산은 Date 객체로 수행하고, 결과는 `formatDateFromDate`로 변환

## 테스트 권장 사항

1. **다양한 타임존에서 테스트**: UTC+9 (한국), UTC+0 (영국), UTC-5 (미국 동부) 등
2. **날짜 경계 테스트**: 
   - 자정 경계 (23:59 → 00:00)
   - 월말 경계 (1월 31일 → 2월 1일)
   - 연말 경계 (12월 31일 → 1월 1일)
3. **D-day 계산 테스트**: 다양한 날짜로 D-day 계산이 정확한지 확인
4. **주 단위 계산 테스트**: 다양한 주 수로 기간 계산이 정확한지 확인

## 참고 사항

- `input type="date"`는 항상 로컬 타임존 기준으로 YYYY-MM-DD 형식의 문자열을 반환하므로, 이 값은 그대로 사용해야 합니다.
- `new Date(dateString)`을 사용할 때는 타임존 문제가 발생할 수 있으므로, YYYY-MM-DD 형식의 문자열을 직접 파싱하는 것이 더 안전합니다.

