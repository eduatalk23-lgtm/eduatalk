# 전략과목/취약과목 배치 로직 수정 (2차)

## 작업 일시
2024-12-09

## 문제 상황

로그 분석 결과, 전략과목을 주3일로 설정했지만 모든 학습일(29일)에 플랜이 배정되는 문제가 발생했습니다. 원인은 다음과 같습니다:

1. **`calculateSubjectAllocationDates` 함수의 로직 오류**: 각 주차에서 정확히 `weeklyDays`만큼만 선택해야 하는데, 현재 로직이 올바르게 작동하지 않았습니다.
2. **디버깅 정보 부족**: `subject_allocations`와 `content_allocations`가 실제로 전달되는지 확인할 수 있는 로그가 없었습니다.

## 수정 내용

### 1. calculateSubjectAllocationDates 함수 로직 수정
**파일**: `lib/plan/1730TimetableLogic.ts`

#### 문제점
기존 로직(218-226줄):
```typescript
for (const [_, weekDates] of weeks.entries()) {
  const step = Math.ceil(weekDates.length / weeklyDays);
  for (let i = 0; i < weekDates.length; i += step) {
    if (allocatedDates.length < studyDates.length) {  // ⚠️ 문제
      allocatedDates.push(weekDates[i]);
    }
  }
}
```

- 조건 `allocatedDates.length < studyDates.length`가 각 주차에서 선택할 때마다 전체 학습일 수를 체크하여, 각 주차에서 정확히 `weeklyDays`만큼 선택되지 않을 수 있습니다.
- 예: 주당 6일 학습일, 주3일 배정 시 각 주차에서 3일씩 선택되어야 하는데, 조건 때문에 제한될 수 있습니다.

#### 수정 내용
각 주차에서 정확히 `weeklyDays`만큼만 균등하게 선택하도록 로직 변경:

```typescript
// 각 주차에서 주당 배정 일수만큼 균등하게 선택
for (const [_, weekDates] of weeks.entries()) {
  const selectedCount = Math.min(weeklyDays, weekDates.length);
  if (selectedCount === 0) continue;
  
  // 균등하게 분배하기 위한 간격 계산
  const step = weekDates.length / selectedCount;
  
  for (let i = 0; i < selectedCount; i++) {
    // 중간값을 사용하여 더 균등하게 분배
    const index = Math.floor((i + 0.5) * step);
    allocatedDates.push(weekDates[index]);
  }
}
```

**개선 사항**:
- 각 주차에서 정확히 `weeklyDays`만큼만 선택 (최대 `weekDates.length`까지)
- 중간값 `(i + 0.5) * step`을 사용하여 더 균등하게 분배
- 불필요한 조건 제거

### 2. 디버깅 로그 추가
**파일**: `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수

#### 추가된 로그

1. **전략과목/취약과목 설정 확인**:
```typescript
console.log("[generate1730TimetablePlans] 전략과목/취약과목 설정:", {
  hasSubjectAllocations: !!subjectAllocations,
  subjectAllocationsCount: subjectAllocations?.length || 0,
  hasContentAllocations: !!contentAllocations,
  contentAllocationsCount: contentAllocations?.length || 0,
  subjectAllocations: subjectAllocations,
  contentAllocations: contentAllocations,
});
```

2. **각 콘텐츠의 배정 설정 확인**:
```typescript
console.log("[generate1730TimetablePlans] 콘텐츠 배정 설정:", {
  content_id: content.content_id,
  content_type: content.content_type,
  subject: content.subject,
  subject_category: content.subject_category,
  allocation,
});
```

3. **배정 날짜 계산 결과 확인**:
```typescript
console.log("[generate1730TimetablePlans] 배정 날짜 계산 결과:", {
  content_id: content.content_id,
  subject_type: allocation.subject_type,
  weekly_days: allocation.weekly_days,
  allocatedDatesCount: allocatedDates.length,
  totalStudyDatesCount: totalStudyDates,
  allocatedDates: allocatedDates.slice(0, 10), // 처음 10개만
});
```

## 수정된 파일
1. `lib/plan/1730TimetableLogic.ts` - `calculateSubjectAllocationDates` 함수 수정
2. `lib/plan/scheduler.ts` - `generate1730TimetablePlans` 함수에 디버깅 로그 추가

## 예상 결과
- 전략과목(주2일 설정): 주당 2일만 플랜 배정
- 전략과목(주3일 설정): 주당 3일만 플랜 배정
- 전략과목(주4일 설정): 주당 4일만 플랜 배정
- 취약과목: 모든 학습일에 플랜 배정
- 디버깅 로그를 통해 설정 전달 및 적용 과정 확인 가능

## 테스트 확인 사항
- [ ] 전략과목 주2일 설정 시 주당 2일만 배정되는지 확인
- [ ] 전략과목 주3일 설정 시 주당 3일만 배정되는지 확인
- [ ] 전략과목 주4일 설정 시 주당 4일만 배정되는지 확인
- [ ] 취약과목은 모든 학습일에 배정되는지 확인
- [ ] 디버깅 로그를 통해 설정이 올바르게 전달되는지 확인
- [ ] 디버깅 로그를 통해 각 콘텐츠의 배정 결과가 올바른지 확인

