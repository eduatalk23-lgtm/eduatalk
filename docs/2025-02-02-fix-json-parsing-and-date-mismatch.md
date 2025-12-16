# JSON 파싱 에러 및 날짜 불일치 문제 수정

## 작업 일시
2025-02-02

## 문제 상황

### 1. JSON 파싱 에러
**위치**: `app/api/student-content-details/batch/route.ts:74`

**에러 메시지**:
```
SyntaxError: Unexpected end of JSON input
```

**원인**: 
- 빈 요청 본문이 `request.json()`으로 전달됨
- 클라이언트에서 빈 요청을 보내는 경우 발생

### 2. rangeMap 날짜 불일치 (핵심 문제)
**위치**: `lib/scheduler/SchedulerEngine.ts`

**증상**:
```
[SchedulerEngine] rangeMap 날짜가 studyDaysList에 없음: {
  rangeMapDates: [ '2025-12-18', '2025-12-19' ],
  studyDaysListSample: [ '2025-12-25', '2025-12-26', ... ]
}
```

**원인 분석**:
- `calculateSubjectAllocationDates`가 반환한 날짜가 실제 주차별 학습일 목록과 불일치
- `groupByWeek`에서 생성된 첫 번째 주차의 `studyDaysList`는 `2025-12-25`부터 시작
- `rangeMap`의 날짜(`2025-12-18`, `2025-12-19`)가 `studyDaysList`에 없어 학습일 플랜이 생성되지 않음

**근본 원인**:
- `allocateContentDates()`에서 `calculateSubjectAllocationDates(cycleDays, subjectAlloc)`가 전체 `cycleDays`에서 학습일을 필터링하여 날짜를 반환
- 하지만 `assignTimeSlots()`에서 `groupByWeek(cycleDays)`로 주차별로 그룹화할 때, 실제 주차별 학습일 목록이 다를 수 있음
- 제외일이나 주차 경계 계산 차이로 인한 불일치

## 수정 내용

### 1. JSON 파싱 에러 처리
**파일**: `app/api/student-content-details/batch/route.ts`

**수정 전**:
```typescript
const body: BatchRequest & { student_id?: string } = await request.json();
```

**수정 후**:
```typescript
// 요청 본문 파싱 (빈 요청 처리)
let body: BatchRequest & { student_id?: string };
try {
  const text = await request.text();
  if (!text || text.trim() === "") {
    return apiBadRequest("요청 본문이 비어있습니다.");
  }
  body = JSON.parse(text);
} catch (error) {
  if (error instanceof SyntaxError) {
    return apiBadRequest("요청 본문이 유효한 JSON 형식이 아닙니다.");
  }
  throw error;
}
```

**개선 사항**:
- 빈 요청 본문 검증 추가
- JSON 파싱 에러를 명확한 에러 메시지로 변환
- 클라이언트에 명확한 피드백 제공

### 2. rangeMap 날짜 불일치 자동 조정
**파일**: `lib/scheduler/SchedulerEngine.ts`

**수정 내용**:
- `generateStudyDayPlans` 메서드에 날짜 자동 조정 로직 추가
- `rangeMap`의 날짜가 `studyDaysList`에 없을 때, 가장 가까운 학습일로 자동 매핑
- 조정 내역을 로그로 기록하여 디버깅 용이

**추가된 로직**:
```typescript
// 날짜 배열에서 가장 가까운 날짜 찾기 (헬퍼 함수)
const findClosestDate = (targetDate: string, dateList: string[]): string | null => {
  if (dateList.length === 0) return null;
  
  const target = new Date(targetDate).getTime();
  let closestDate = dateList[0];
  let minDiff = Math.abs(new Date(closestDate).getTime() - target);
  
  for (const date of dateList) {
    const diff = Math.abs(new Date(date).getTime() - target);
    if (diff < minDiff) {
      minDiff = diff;
      closestDate = date;
    }
  }
  
  return closestDate;
};
```

**자동 조정 로직**:
```typescript
contentRangeMap.forEach((range, date) => {
  if (!studyDaysList.includes(date)) {
    unmatchedDates.push(date);
    
    // 가장 가까운 학습일로 자동 조정
    const closestDate = findClosestDate(date, studyDaysList);
    if (closestDate) {
      adjustedDates.set(date, closestDate);
      
      // 조정된 날짜에 플랜 추가
      if (!studyPlansByDate.has(closestDate)) {
        studyPlansByDate.set(closestDate, []);
      }
      studyPlansByDate.get(closestDate)!.push({
        content,
        start: range.start,
        end: range.end,
      });
      
      matchedDates.push(closestDate);
    }
    return;
  }
  // ... 기존 로직
});
```

**개선 사항**:
- 날짜 불일치 시 자동으로 가장 가까운 학습일로 조정
- 조정 내역을 로그로 기록하여 추적 가능
- 플랜 생성 실패 방지

## 테스트 시나리오

### 1. JSON 파싱 에러 테스트
- 빈 요청 본문 전송 시 `400 Bad Request` 응답 확인
- 유효하지 않은 JSON 전송 시 명확한 에러 메시지 확인

### 2. 날짜 불일치 자동 조정 테스트
- `rangeMap`의 날짜가 `studyDaysList`에 없는 경우
- 가장 가까운 학습일로 자동 조정되는지 확인
- 조정 내역이 로그에 기록되는지 확인
- 플랜이 정상적으로 생성되는지 확인

## 영향 범위

### 수정된 파일
1. `app/api/student-content-details/batch/route.ts`
   - JSON 파싱 에러 처리 추가
   
2. `lib/scheduler/SchedulerEngine.ts`
   - 날짜 불일치 자동 조정 로직 추가

### 영향받는 기능
- 플랜 그룹 생성 시 날짜 불일치로 인한 플랜 생성 실패 문제 해결
- 배치 API 호출 시 빈 요청으로 인한 에러 방지

## 향후 개선 사항

1. **근본 원인 해결**: `calculateSubjectAllocationDates`와 `groupByWeek` 간 날짜 일관성 보장
   - 주차별 학습일 목록과 배정 날짜의 일치 확인
   - 제외일 처리 로직 개선

2. **에러 처리 강화**: 
   - 날짜 조정이 너무 많이 발생하는 경우 경고
   - 조정 범위가 일정 범위를 초과하는 경우 에러 처리

3. **로깅 개선**:
   - 날짜 불일치 발생 빈도 추적
   - 조정 내역을 구조화된 로그로 기록

## 참고 사항

- 날짜 자동 조정은 임시 해결책이며, 근본 원인을 해결하는 것이 중요합니다.
- 조정 로직은 가장 가까운 학습일로 매핑하므로, 원래 의도한 날짜와 다를 수 있습니다.
- 제외일이나 주차 경계 계산 차이로 인한 불일치가 지속적으로 발생한다면, `calculateSubjectAllocationDates` 로직을 개선해야 합니다.

