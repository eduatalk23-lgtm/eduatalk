# 플랜 생성 최적화 및 에러 처리 개선 작업 보고서

**작업 일자**: 2025-02-01  
**작업 범위**: 플랜 생성 로직 최적화, 에러 처리 개선, 코드 중복 제거

## 작업 요약

터미널 로그 분석 결과를 바탕으로 다음 4가지 주요 개선 작업을 수행했습니다:

1. ✅ **block_index 컬럼 누락 에러 해결** - fallback 처리 추가
2. ✅ **Error 객체 로깅 개선** - console.log/warn으로 변경
3. ✅ **공통 fallback 유틸리티 생성** - 코드 중복 제거
4. ✅ **성능 최적화** - 병렬 쿼리 처리

## 발견된 문제점

### 1. block_index 컬럼 누락 에러

**에러 메시지**:
```
column student_block_schedule.block_index does not exist
```

**원인**:
- `student_block_schedule` 테이블에 `block_index` 컬럼이 없음
- `app/(student)/actions/plan-groups/queries.ts:362`에서 해당 컬럼을 조회 시도

**해결**:
- `app/(student)/dashboard/_utils.ts`의 `fetchBlocksForDay` 함수와 동일한 fallback 패턴 적용
- `start_time` 기준으로 정렬 후 동적으로 `block_index` 할당

### 2. Error 객체 로깅 남용

**문제**:
- 로깅 목적으로 `new Error()` 객체를 생성하여 스택 트레이스가 쌓임
- `lib/data/planGroups.ts`에서 35개 위치에서 사용

**해결**:
- 개발 환경에서는 `console.log` 또는 `console.warn` 사용
- 프로덕션 환경에서는 로그 비활성화
- `logError` 함수는 실제 에러 객체만 처리

### 3. 중복된 fallback 패턴

**문제**:
- `error.code === "42703"` 처리 로직이 95개 파일에 반복
- 동일한 패턴이 여러 곳에 중복 구현

**해결**:
- `lib/utils/databaseFallback.ts`에 공통 유틸리티 함수 생성
- `withColumnFallback`, `assignBlockIndex`, `fetchBlocksWithFallback` 함수 제공

### 4. 성능 이슈

**문제**:
- POST `/plan/new-group` 요청이 1.6초~3.2초 소요
- 콘텐츠 ID 해석 로직이 순차 처리됨

**해결**:
- 콘텐츠 ID 해석 및 복사 로직을 `Promise.all`로 병렬화
- 예상 성능 개선: 30-50% (1.0초~1.5초 목표)

## 수정된 파일 목록

### 1. `app/(student)/actions/plan-groups/queries.ts`

**변경 사항**:
- `block_index` fallback 처리 추가 (358-407번째 줄)
- `fetchBlocksWithFallback` 유틸리티 함수 사용

**변경 전**:
```typescript
const blocksQuery = group.block_set_id
  ? queryClient
      .from("student_block_schedule")
      .select("id, day_of_week, start_time, end_time, block_index")
      .eq("block_set_id", group.block_set_id)
      .eq("student_id", targetStudentId)
  : Promise.resolve({ data: null, error: null });
```

**변경 후**:
```typescript
const blocksQuery = group.block_set_id
  ? fetchBlocksWithFallback(queryClient, {
      block_set_id: group.block_set_id,
      student_id: targetStudentId,
    })
  : Promise.resolve({ data: null, error: null });
```

### 2. `lib/data/planGroups.ts`

**변경 사항**:
- 35개 위치의 `logError(new Error(...))` 패턴을 `console.log/warn`으로 변경
- 주요 변경 위치:
  - `getPlanContents`: 860, 885번째 줄
  - `getPlanGroupsForStudent`: 152번째 줄
  - `getPlanGroupById`: 269, 303번째 줄
  - `createPlanGroup`: 464, 481번째 줄
  - `updatePlanGroup`: 562, 581번째 줄
  - `createPlanContents`: 990번째 줄
  - `createPlanExclusions`: 1193, 1216, 1246, 1292번째 줄
  - `getAcademySchedules`: 1391번째 줄
  - `createPlanAcademySchedules`: 1590, 1605, 1626, 1647, 1687, 1710, 1793, 1860번째 줄
  - `createStudentAcademySchedules`: 1895, 1910, 1920, 1937, 1950, 1960, 2059번째 줄
  - `getPlanGroupWithDetailsForAdmin`: 2217, 2291번째 줄

**변경 예시**:
```typescript
// 변경 전
logError(new Error("플랜 콘텐츠 조회 시작"), {
  function: "getPlanContents",
  level: "info",
  groupId,
  tenantId,
});

// 변경 후
console.log("[getPlanContents] 플랜 콘텐츠 조회 시작", { groupId, tenantId });
```

### 3. `lib/utils/databaseFallback.ts` (신규 파일)

**생성된 함수**:
- `isColumnMissingError`: 컬럼 누락 에러 확인
- `withColumnFallback`: 컬럼 누락 시 fallback 쿼리 실행
- `assignBlockIndex`: block_index 동적 할당
- `fetchBlocksWithFallback`: student_block_schedule 조회 시 block_index fallback 처리

**사용 예시**:
```typescript
import { fetchBlocksWithFallback } from "@/lib/utils/databaseFallback";

const { data, error } = await fetchBlocksWithFallback(queryClient, {
  block_set_id: group.block_set_id,
  student_id: targetStudentId,
});
```

### 4. `app/(student)/actions/plan-groups/generatePlansRefactored.ts`

**변경 사항**:
- 콘텐츠 ID 해석 및 복사 로직 병렬화 (220-300번째 줄)

**변경 전**:
```typescript
for (const content of contents) {
  // 순차 처리
  const { data: existingBook } = await queryClient...
  // ...
}
```

**변경 후**:
```typescript
const contentCheckPromises = contents.map(async (content) => {
  // 병렬 처리
  // ...
});
const contentCheckResults = await Promise.all(contentCheckPromises);
```

## 성능 개선 효과

### 예상 개선 사항

1. **에러 처리 시간 단축**: fallback 처리로 불필요한 에러 스택 생성 제거
2. **쿼리 병렬화**: 콘텐츠 ID 해석 시간 단축 (순차 → 병렬)
3. **로깅 오버헤드 감소**: Error 객체 생성 비용 제거

### 측정 지표

- **현재**: POST 요청 1.6초~3.2초
- **목표**: 1.0초~1.5초 (30-50% 개선)

## 테스트 계획

### 1. block_index fallback 테스트

- `student_block_schedule` 테이블에서 `block_index` 없이 조회 시도
- fallback 쿼리가 정상 실행되는지 확인
- `block_index`가 올바르게 할당되는지 확인

### 2. 로깅 테스트

- 개발 환경에서 `console.log/warn` 출력 확인
- 프로덕션 환경에서 로그 비활성화 확인

### 3. 성능 테스트

- 플랜 생성 요청 시간 측정 (before/after)
- 병렬 처리로 인한 성능 개선 확인

## 하위 호환성

- ✅ 기존 기능 유지 (fallback 처리로 안전성 확보)
- ✅ 에러 발생 시에도 빈 배열 반환하여 플랜 조회 계속 진행
- ✅ 기존 API 인터페이스 변경 없음

## 향후 개선 사항

1. **추가 fallback 유틸리티 적용**: 다른 95개 파일에도 점진적 적용
2. **성능 모니터링**: 실제 성능 개선 효과 측정 및 최적화
3. **에러 트래킹 서비스 통합**: Sentry 등 에러 트래킹 서비스 연동

## 참고 사항

- 데이터베이스 스키마 확인: `student_block_schedule` 테이블에 `block_index` 컬럼 없음
- 기존 패턴 참고: `app/(student)/dashboard/_utils.ts:188-278`의 `fetchBlocksForDay` 함수
- 공통 유틸리티: `lib/utils/databaseFallback.ts`에 재사용 가능한 함수 제공

