# 재조정 기능 및 미리보기 로직 분석 문서

**작성일**: 2025-01-03  
**목적**: 재조정 기능과 미리보기 관련 파일 정리 및 로직 분석  
**요청 이유**: 기능이 정상 작동하지 않는 이유 분석 및 수정을 위한 문서화

---

## 📋 목차

1. [재조정 기능 관련 파일 구조](#재조정-기능-관련-파일-구조)
2. [미리보기 로직 상세 분석](#미리보기-로직-상세-분석)
3. [데이터 흐름도](#데이터-흐름도)
4. [잠재적 문제점 및 가설](#잠재적-문제점-및-가설)
5. [디버깅 체크리스트](#디버깅-체크리스트)

---

## 재조정 기능 관련 파일 구조

### 1. 서버 액션 (Server Actions)

#### `app/(student)/actions/plan-groups/reschedule.ts`
**역할**: 재조정 기능의 핵심 서버 액션
- `getReschedulePreview`: 미리보기 결과 생성
- `rescheduleContents`: 실제 재조정 실행

**주요 함수**:
- `_getReschedulePreview()`: 미리보기 로직 (84-402줄)
- `_rescheduleContents()`: 재조정 실행 로직 (421-611줄)

#### `app/(student)/actions/plan-groups/plans.ts`
**역할**: 플랜 관련 서버 액션
- `_previewPlansFromGroup()`: 플랜 그룹에서 플랜 미리보기 (1729줄부터)

### 2. 재조정 로직 모듈 (`lib/reschedule/`)

#### `lib/reschedule/scheduleEngine.ts`
**역할**: 재조정 스케줄 엔진 (순수 함수)
- `applyAdjustments()`: 조정 요청을 콘텐츠에 적용
- `generatePlans()`: 플랜 생성 (인터페이스 정의)
- `generateAdjustmentSummary()`: 조정 요약 생성

#### `lib/reschedule/uncompletedRangeCalculator.ts`
**역할**: 미진행 범위 계산
- `calculateUncompletedRange()`: 오늘 이전 미진행 플랜 범위 계산
- `applyUncompletedRangeToContents()`: 미진행 범위를 콘텐츠에 적용

#### `lib/reschedule/periodCalculator.ts`
**역할**: 재조정 기간 계산
- `getAdjustedPeriod()`: 오늘 이후 재조정 기간 결정
- `getTodayDateString()`: 오늘 날짜 가져오기
- `validateReschedulePeriod()`: 기간 유효성 검증

#### `lib/reschedule/transaction.ts`
**역할**: 트랜잭션 관리
- `executeRescheduleTransaction()`: 재조정 트랜잭션 실행
- `executeRescheduleTransactionWithRetry()`: 재시도 포함 트랜잭션

#### `lib/reschedule/previewCache.ts`
**역할**: 미리보기 결과 캐싱
- `generatePreviewCacheKey()`: 캐시 키 생성
- `getCachedPreview()`: 캐시된 결과 조회
- `cachePreviewResult()`: 결과 캐싱

#### 기타 유틸리티 모듈
- `lib/reschedule/conflictDetector.ts`: 시간 충돌 감지
- `lib/reschedule/batchProcessor.ts`: 배치 처리
- `lib/reschedule/analytics.ts`: 분석 로직
- `lib/reschedule/rollbackValidator.ts`: 롤백 검증

### 3. UI 컴포넌트

#### `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx`
**역할**: 3단계 위저드 메인 컴포넌트
- Step 1: 콘텐츠 선택
- Step 2: 상세 조정
- Step 3: 미리보기 & 확인

#### `app/(student)/plan/group/[id]/reschedule/_components/PreviewStep.tsx`
**역할**: Step 3 미리보기 컴포넌트
- 미리보기 자동 로드
- 변경 전/후 비교
- 재조정 실행

#### 기타 컴포넌트
- `ContentSelectStep.tsx`: Step 1 콘텐츠 선택
- `AdjustmentStep.tsx`: Step 2 상세 조정
- `BeforeAfterComparison.tsx`: 변경 전/후 비교
- `AffectedPlansList.tsx`: 영향받는 플랜 목록
- `ConflictWarning.tsx`: 충돌 경고

### 4. 데이터 페칭 모듈

#### `lib/data/planGroups.ts`
**역할**: 플랜 그룹 데이터 조회
- `getPlanGroupWithDetails()`: 플랜 그룹 상세 정보 조회

#### `lib/plan/scheduler.ts`
**역할**: 플랜 생성 스케줄러
- `generatePlansFromGroup()`: 플랜 그룹에서 플랜 생성

---

## 미리보기 로직 상세 분석

### 1. 미리보기 호출 흐름

```
PreviewStep 컴포넌트
  ↓ (useEffect 또는 loadPreview 호출)
getReschedulePreview 서버 액션
  ↓
_getReschedulePreview 함수 실행
```

### 2. `_getReschedulePreview` 함수 상세 로직

#### 단계 1: 플랜 그룹 및 관련 데이터 조회 (98-103줄)
```typescript
const { group, contents, exclusions, academySchedules } =
  await getPlanGroupWithDetails(groupId, user.userId, tenantContext?.tenantId || null);
```

#### 단계 2: 기존 플랜 조회 (124-141줄)
```typescript
let query = supabase
  .from("student_plan")
  .select("id, plan_date, content_id, content_type, ...")
  .eq("plan_group_id", groupId)
  .eq("student_id", group.student_id);

// 날짜 범위 필터링 (선택한 경우)
if (dateRange?.from && dateRange?.to) {
  query = query.gte("plan_date", dateRange.from).lte("plan_date", dateRange.to);
}

const reschedulablePlans = (existingPlans || []).filter((plan) =>
  isReschedulable(plan)
);
```

**문제점 가설 1**: `dateRange` 필터링이 재조정 대상 플랜 조회에만 적용되고, 실제 재조정 기간 결정에는 별도로 처리됨

#### 단계 2.5: 오늘 이전 미진행 플랜 조회 및 미진행 범위 계산 (144-157줄)
```typescript
const today = getTodayDateString();
const { data: pastUncompletedPlans } = await supabase
  .from("student_plan")
  .select("content_id, planned_start_page_or_time, planned_end_page_or_time, completed_amount")
  .eq("plan_group_id", groupId)
  .eq("student_id", group.student_id)
  .eq("is_active", true)
  .lt("plan_date", today)  // 오늘 이전만
  .in("status", ["pending", "in_progress"]);

const uncompletedRangeMap = calculateUncompletedRange(pastUncompletedPlans || []);
```

**문제점 가설 2**: `dateRange`가 지정된 경우에도 오늘 이전의 모든 미진행 플랜을 조회함. 날짜 범위와 무관하게 전체 미진행 범위가 계산될 수 있음

#### 단계 3: 조정된 콘텐츠 생성 (159-166줄)
```typescript
const adjustedContents = applyAdjustments(contents, adjustments);
const contentsWithUncompleted = applyUncompletedRangeToContents(
  adjustedContents,
  uncompletedRangeMap
);
```

**문제점 가설 3**: `applyAdjustments`는 선택된 콘텐츠만 조정하지만, `applyUncompletedRangeToContents`는 모든 콘텐츠에 미진행 범위를 적용함. 선택되지 않은 콘텐츠에도 미진행 범위가 추가될 수 있음

#### 단계 4-5: 블록 세트 및 스케줄러 설정 조회 (168-229줄)
- 블록 세트 조회
- 스케줄러 설정 병합

#### 단계 6: 스케줄 결과 계산 (231-275줄)
```typescript
const scheduleResult = calculateAvailableDates(
  group.period_start,
  group.period_end,
  baseBlocks,
  exclusions,
  academySchedules,
  schedulerOptions
);
```

**문제점 가설 4**: `calculateAvailableDates`는 전체 기간(`period_start` ~ `period_end`)에 대해 계산하지만, 재조정은 오늘 이후만 대상임. 불필요한 계산이 포함됨

#### 단계 7: 날짜별 사용 가능 시간 범위 추출 (277-317줄)
```typescript
const dateAvailableTimeRanges = new Map<string, Array<{ start: string; end: string }>>();
const dateTimeSlots = new Map<string, Array<{...}>>();

scheduleResult.daily_schedule.forEach((daily) => {
  if ((daily.day_type === "학습일" || daily.day_type === "복습일") && 
      daily.available_time_ranges.length > 0) {
    dateAvailableTimeRanges.set(daily.date, ...);
  }
});
```

#### 단계 8: 콘텐츠 과목 정보 조회 (319-320줄)
```typescript
const contentSubjects = new Map<string, { subject?: string | null; subject_category?: string | null }>();
```
**비고**: 현재는 빈 Map 사용

#### 단계 9: 실제 플랜 생성 (322-333줄)
```typescript
const generatedPlans = generatePlansFromGroup(
  group,
  contentsWithUncompleted,  // 조정된 콘텐츠 + 미진행 범위
  exclusions,
  academySchedules,
  baseBlocks,
  contentSubjects,
  undefined, // riskIndexMap
  dateAvailableTimeRanges,
  dateTimeSlots
);
```

**문제점 가설 5**: `generatePlansFromGroup`은 전체 기간에 대해 플랜을 생성하지만, 재조정은 오늘 이후만 대상임. 이후 필터링 단계에서 처리하지만 비효율적

#### 단계 10: 오늘 이후 날짜만 필터링 (335-350줄)
```typescript
let adjustedPeriod: { start: string; end: string };
try {
  adjustedPeriod = getAdjustedPeriod(dateRange || null, today, group.period_end);
} catch (error) {
  // 에러 처리
}

const filteredPlans = generatedPlans.filter(
  (plan) => plan.plan_date >= adjustedPeriod.start && plan.plan_date <= adjustedPeriod.end
);
```

**문제점 가설 6**: 전체 기간에 대해 플랜을 생성한 후 필터링하는 방식은 비효율적. 특히 기간이 긴 경우 불필요한 계산이 많음

#### 단계 11-14: 결과 집계 및 반환 (352-401줄)
- 영향받는 날짜 계산
- 예상 시간 계산
- 기존 플랜 상세 정보 변환
- 결과 반환

### 3. PreviewStep 컴포넌트 로직

#### 미리보기 자동 로드 (155-184줄)
```typescript
useEffect(() => {
  if (preview || isLoadingRef.current || loadAttemptedRef.current) {
    return;
  }

  const hasAdjustments = adjustments.length > 0;
  const hasDateRange = !!(dateRange?.from && dateRange?.to);

  if (hasAdjustments || hasDateRange) {
    loadPreview();
  }
}, [adjustments, dateRange, loadPreview]);
```

**문제점 가설 7**: `adjustments`와 `dateRange`가 모두 없으면 미리보기를 로드하지 않음. 하지만 `dateRange`만 있어도 미리보기가 필요할 수 있음 (미진행 범위 재분배)

#### loadPreview 함수 (106-153줄)
```typescript
const loadPreview = useCallback(async () => {
  if (isLoadingRef.current) {
    return; // 중복 호출 방지
  }

  isLoadingRef.current = true;
  setLoading(true);
  loadAttemptedRef.current = true;

  try {
    const currentAdjustments = adjustmentsRef.current;
    const currentDateRange = dateRangeRef.current;

    const result = await getReschedulePreview(
      groupId,
      currentAdjustments,
      currentDateRange
    );

    setPreview(result);
    onLoad(result);
  } catch (error) {
    // 에러 처리
  } finally {
    isLoadingRef.current = false;
    setLoading(false);
  }
}, [groupId, onLoad, toast]);
```

**문제점 가설 8**: `adjustmentsRef`와 `dateRangeRef`를 사용하여 최신 값을 가져오지만, 서버 액션 호출 시점에 값이 변경되면 불일치 발생 가능

---

## 데이터 흐름도

### 미리보기 데이터 흐름

```
[PreviewStep 컴포넌트]
  ↓ (adjustments, dateRange)
[getReschedulePreview 서버 액션]
  ↓
[1. 플랜 그룹 조회]
  ↓
[2. 기존 플랜 조회 (dateRange 필터링)]
  ↓
[2.5. 오늘 이전 미진행 플랜 조회 (dateRange 무시)]
  ↓
[3. 조정 적용 (adjustments)]
  ↓
[3.5. 미진행 범위 적용 (모든 콘텐츠)]
  ↓
[4-5. 블록 세트 및 스케줄러 설정]
  ↓
[6. 전체 기간 스케줄 계산]
  ↓
[7. 날짜별 시간 범위 추출]
  ↓
[8. 콘텐츠 과목 정보 (빈 Map)]
  ↓
[9. 전체 기간 플랜 생성]
  ↓
[10. 오늘 이후만 필터링]
  ↓
[11-14. 결과 집계]
  ↓
[ReschedulePreviewResult 반환]
```

### 문제점이 될 수 있는 지점

1. **지점 A (2.5단계)**: 미진행 플랜 조회 시 `dateRange` 무시
2. **지점 B (3.5단계)**: 선택되지 않은 콘텐츠에도 미진행 범위 적용
3. **지점 C (6단계)**: 전체 기간에 대해 스케줄 계산
4. **지점 D (9단계)**: 전체 기간에 대해 플랜 생성 후 필터링

---

## 잠재적 문제점 및 가설

### 가설 1: 날짜 범위 필터링 불일치

**문제**: 기존 플랜 조회에는 `dateRange` 필터가 적용되지만, 미진행 플랜 조회에는 적용되지 않음

**영향**:
- 날짜 범위를 지정해도 전체 미진행 범위가 계산됨
- 선택한 범위 외의 미진행 범위도 재분배됨

**증상**:
- 날짜 범위를 지정했는데도 예상보다 많은 플랜이 생성됨
- 선택한 범위와 무관한 콘텐츠의 플랜도 변경됨

**해결 방안**:
```typescript
// 미진행 플랜 조회 시에도 dateRange 필터 적용
const { data: pastUncompletedPlans } = await supabase
  .from("student_plan")
  .select(...)
  .eq("plan_group_id", groupId)
  .eq("student_id", group.student_id)
  .eq("is_active", true)
  .lt("plan_date", today)
  .in("status", ["pending", "in_progress"]);

// dateRange가 지정된 경우 추가 필터링
if (dateRange?.from && dateRange?.to) {
  // 날짜 범위와 겹치는 미진행 플랜만 조회
  // 또는 dateRange 내의 콘텐츠만 조회
}
```

### 가설 2: 선택되지 않은 콘텐츠에 미진행 범위 적용

**문제**: `applyUncompletedRangeToContents`는 모든 콘텐츠에 미진행 범위를 적용함

**영향**:
- Step 1에서 선택하지 않은 콘텐츠에도 미진행 범위가 추가됨
- 선택한 콘텐츠만 재조정하려 했지만 다른 콘텐츠도 변경됨

**증상**:
- 특정 콘텐츠만 선택했는데 다른 콘텐츠의 플랜도 변경됨
- 미리보기에서 예상보다 많은 플랜이 생성됨

**해결 방안**:
```typescript
// 선택된 콘텐츠만 미진행 범위 적용
const selectedContentIds = new Set(adjustments.map(a => a.plan_content_id));
const contentsToApply = contentsWithUncompleted.filter(c => 
  selectedContentIds.has(c.id || '')
);

// 또는 applyUncompletedRangeToContents 함수 수정
export function applyUncompletedRangeToContents<T>(...) {
  return contents.map(content => {
    // 선택된 콘텐츠만 처리
    if (!selectedContentIds.has(content.id || content.content_id || '')) {
      return content;
    }
    // 미진행 범위 적용
  });
}
```

### 가설 3: 전체 기간 플랜 생성 후 필터링

**문제**: 전체 기간에 대해 플랜을 생성한 후 오늘 이후만 필터링

**영향**:
- 불필요한 계산 오버헤드
- 기간이 긴 경우 성능 저하
- 오늘 이전 플랜도 생성되지만 버려짐

**증상**:
- 미리보기 로딩 시간이 길어짐
- 서버 리소스 낭비

**해결 방안**:
```typescript
// 재조정 기간을 먼저 결정
const adjustedPeriod = getAdjustedPeriod(dateRange || null, today, group.period_end);

// 조정된 기간에 대해서만 스케줄 계산
const scheduleResult = calculateAvailableDates(
  adjustedPeriod.start,  // period_start 대신
  adjustedPeriod.end,    // period_end 대신
  ...
);

// 조정된 기간에 대해서만 플랜 생성
const generatedPlans = generatePlansFromGroup(
  group,
  contentsWithUncompleted,
  ...
  // adjustedPeriod.start ~ adjustedPeriod.end 범위만
);
```

### 가설 4: adjustments와 dateRange 조건 불일치

**문제**: PreviewStep에서 `hasAdjustments || hasDateRange` 조건으로 미리보기 로드

**영향**:
- `dateRange`만 있어도 미리보기가 로드되어야 함 (미진행 범위 재분배)
- 하지만 `adjustments`가 없으면 조정이 적용되지 않음

**증상**:
- 날짜 범위만 선택했을 때 미리보기가 로드되지 않음
- 또는 미리보기는 로드되지만 조정이 반영되지 않음

**해결 방안**:
```typescript
// dateRange만 있어도 미리보기 로드
const shouldLoadPreview = 
  adjustments.length > 0 || 
  (dateRange?.from && dateRange?.to);

if (shouldLoadPreview) {
  loadPreview();
}
```

### 가설 5: 콘텐츠 선택과 adjustments 불일치

**문제**: Step 1에서 선택한 콘텐츠와 Step 2에서 생성한 `adjustments`가 일치하지 않을 수 있음

**영향**:
- 선택한 콘텐츠 중 일부만 조정하거나, 선택하지 않은 콘텐츠를 조정할 수 있음
- 미리보기 결과가 예상과 다를 수 있음

**증상**:
- Step 1에서 선택한 콘텐츠와 Step 3 미리보기 결과가 다름
- 조정하지 않은 콘텐츠의 플랜도 변경됨

**해결 방안**:
```typescript
// Step 1에서 선택한 콘텐츠 ID 저장
const selectedContentIds = new Set<string>();

// Step 2에서 adjustments 생성 시 선택된 콘텐츠만 포함
const adjustments = selectedContentIds.map(id => {
  // 선택된 콘텐츠에 대한 조정만 생성
});

// Step 3에서 미리보기 호출 시 선택된 콘텐츠 정보도 전달
const result = await getReschedulePreview(
  groupId,
  adjustments,
  dateRange,
  selectedContentIds  // 추가 파라미터
);
```

### 가설 6: 미진행 범위 계산 로직 오류

**문제**: `calculateUncompletedRange`에서 음수 방지는 하지만, 초과 완료된 경우 처리 미흡

**영향**:
- 완료량이 계획량을 초과한 경우 음수가 될 수 있음 (현재는 `Math.max(0, ...)`로 방지)
- 하지만 초과 완료된 플랜의 경우 미진행 범위가 0이 되어야 함

**증상**:
- 초과 완료된 플랜도 미진행 범위에 포함될 수 있음

**해결 방안**:
```typescript
// calculateUncompletedRange 함수에서 이미 처리됨
const uncompletedAmount = Math.max(0, plannedAmount - completedAmount);
// 이미 음수 방지 로직이 있음
```

### 가설 7: 트랜잭션 및 동시성 문제

**문제**: 미리보기는 트랜잭션 없이 실행되지만, 실행 시에는 트랜잭션 사용

**영향**:
- 미리보기와 실제 실행 결과가 다를 수 있음
- 동시에 여러 사용자가 재조정을 시도하면 충돌 가능

**증상**:
- 미리보기에서는 정상이지만 실행 시 에러 발생
- 동시 재조정 시도 시 일부만 성공

**해결 방안**:
- 이미 `executeRescheduleTransaction`에서 락 처리됨
- 미리보기와 실행 로직의 일관성 확인 필요

### 가설 8: 캐시 문제

**문제**: `previewCache.ts`가 있지만 실제로 사용되지 않을 수 있음

**영향**:
- 동일한 요청에 대해 매번 재계산
- 성능 저하

**증상**:
- 미리보기 로딩 시간이 길어짐

**해결 방안**:
```typescript
// getReschedulePreview 함수에서 캐시 사용
const cacheKey = generatePreviewCacheKey(groupId, adjustments);
const cached = await getCachedPreview(cacheKey);
if (cached) {
  return cached;
}

// 계산 후 캐싱
const result = await _getReschedulePreview(...);
await cachePreviewResult(cacheKey, result);
return result;
```

---

## 디버깅 체크리스트

### 1. 미리보기 로딩 실패

- [ ] `getReschedulePreview` 서버 액션 호출 확인
- [ ] 네트워크 에러 확인
- [ ] 서버 로그 확인
- [ ] `adjustments`와 `dateRange` 값 확인
- [ ] 플랜 그룹 존재 여부 확인

### 2. 미리보기 결과가 예상과 다름

- [ ] 선택한 콘텐츠와 생성된 플랜 일치 여부 확인
- [ ] 날짜 범위 필터링 적용 여부 확인
- [ ] 미진행 범위 계산 정확성 확인
- [ ] 조정 적용 여부 확인

### 3. 미리보기와 실행 결과 불일치

- [ ] 미리보기와 실행 로직 일치 여부 확인
- [ ] 트랜잭션 처리 확인
- [ ] 동시성 문제 확인

### 4. 성능 문제

- [ ] 전체 기간 플랜 생성 여부 확인
- [ ] 캐시 사용 여부 확인
- [ ] 불필요한 쿼리 확인

### 5. 데이터 정합성

- [ ] 미진행 범위 계산 정확성
- [ ] 조정 적용 정확성
- [ ] 날짜 범위 필터링 정확성

---

## 참고 문서

- [재조정 기능 시나리오](./re.md)
- [재조정 기능 TODO](./reschedule-todo.md)
- [재조정 UI 개선 구현](./refactoring/reschedule_ui_improvements_implementation.md)
- [재조정 로직 통합 TODO](./refactoring/logical_plan_reschedule_integration_todo.md)

---

**문서 버전**: 1.0  
**최종 수정일**: 2025-01-03





