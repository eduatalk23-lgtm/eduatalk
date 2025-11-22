# 블록 번호(block_index) 도출 로직

## 개요

챕터가 없는 경우 표시되는 블록 번호는 `student_plan` 테이블의 `block_index` 컬럼 값입니다.

## 표시 로직

**파일**: `app/(student)/today/_components/PlanCard.tsx`

### 1. 같은 범위 플랜 그룹화

```typescript
// 같은 범위를 가진 플랜들을 그룹화
const rangeGroups = new Map<string, typeof group.plans>();
group.plans.forEach((plan) => {
  const rangeKey = `${plan.planned_start_page_or_time}-${plan.planned_end_page_or_time}`;
  if (!rangeGroups.has(rangeKey)) {
    rangeGroups.set(rangeKey, []);
  }
  rangeGroups.get(rangeKey)!.push(plan);
});
```

**그룹화 기준**: `planned_start_page_or_time`과 `planned_end_page_or_time`이 동일한 플랜들

### 2. 블록 번호 추출 및 정렬

```typescript
// 블록 번호 목록 생성
const blockIndices = plans
  .map((p) => p.block_index ?? 0)  // 각 플랜의 block_index 추출
  .sort((a, b) => a - b);           // 오름차순 정렬

const blockDisplay = blockIndices.length > 1
  ? `블록 ${blockIndices.join(", ")}`  // 여러 개: "블록 1, 11"
  : `블록 ${blockIndices[0]}`;         // 하나: "블록 1"
```

**로직**:
1. 같은 범위를 가진 모든 플랜에서 `block_index` 추출
2. 오름차순 정렬
3. 여러 개면 쉼표로 구분하여 표시, 하나면 단일 번호 표시

## block_index 할당 로직 (플랜 생성 시)

**파일**: `app/(student)/actions/planGroupActions.ts`

### 1. 기본 할당 방식

```typescript
// 각 세그먼트마다 별도의 레코드 생성
for (const segment of timeSegments) {
  // 기존 플랜과 겹치지 않는 block_index 찾기
  while (usedIndices.has(nextBlockIndex)) {
    nextBlockIndex++;
  }

  // 조정된 block_index를 사용 중인 목록에 추가
  usedIndices.add(nextBlockIndex);
  usedBlockIndicesByDate.set(date, usedIndices);
  
  // 플랜 생성 시 block_index 할당
  // ...
}
```

**할당 규칙**:
- 같은 날짜 내에서 시간대 순서에 따라 순차적으로 할당
- 이미 사용된 `block_index`는 건너뛰고 다음 번호 사용
- 날짜별로 독립적으로 관리 (`usedBlockIndicesByDate`)

### 2. student_block_schedule 기반 할당

**파일**: `lib/plan/scheduler.ts`

```typescript
plans.push({
  plan_date: date,
  block_index: block.block_index,  // 블록 스케줄의 block_index 사용
  content_type: content.content_type,
  content_id: content.content_id,
  planned_start_page_or_time: currentStart,
  planned_end_page_or_time: endAmount,
  // ...
});
```

**할당 규칙**:
- `student_block_schedule` 테이블에 정의된 `block_index` 사용
- 블록 스케줄이 없으면 자동으로 순차 할당

## 예시 시나리오

### 시나리오 1: 단일 블록

**상황**:
- 플랜 1개: `block_index = 1`, 범위: 1 ~ 14

**표시**: `📖 블록: 1`

### 시나리오 2: 같은 범위, 여러 블록

**상황**:
- 플랜 A: `block_index = 1`, 범위: 1 ~ 14
- 플랜 B: `block_index = 11`, 범위: 1 ~ 14 (같은 범위, 다른 시간대)

**표시**: `📖 블록: 1, 11`

**이유**: 같은 학습 범위(1 ~ 14)를 여러 시간대에 배정한 경우

### 시나리오 3: 다른 범위, 여러 블록

**상황**:
- 플랜 A: `block_index = 1`, 범위: 1 ~ 14
- 플랜 B: `block_index = 2`, 범위: 15 ~ 28 (다른 범위)

**표시**: 
- 첫 번째 항목: `📖 블록: 1` (범위: 1 ~ 14)
- 두 번째 항목: `📖 블록: 2` (범위: 15 ~ 28)

**이유**: 범위가 다르므로 별도 항목으로 표시

## block_index의 의미

### 1. 시간대 순서

`block_index`는 같은 날짜 내에서 시간대 순서를 나타냅니다:
- `block_index = 1`: 첫 번째 시간대 (예: 10:00 ~ 11:00)
- `block_index = 2`: 두 번째 시간대 (예: 11:00 ~ 12:00)
- `block_index = 11`: 열한 번째 시간대 (예: 20:00 ~ 21:00)

### 2. 블록 스케줄 참조

`student_block_schedule` 테이블의 `block_index`와 연동되어:
- 각 블록의 시작/종료 시간 정보 제공
- 시간대별 학습 블록 관리

### 3. 플랜 식별

같은 날짜, 같은 시간대에 여러 플랜이 있을 수 있지만:
- `block_index`는 시간대를 나타냄
- 같은 `block_index`를 가진 플랜들은 같은 시간대에 배정됨

## 데이터베이스 구조

### student_plan 테이블

```sql
CREATE TABLE student_plan (
  id uuid PRIMARY KEY,
  plan_date date NOT NULL,
  block_index integer NOT NULL,  -- 시간대 순서 번호
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  planned_start_page_or_time integer,
  planned_end_page_or_time integer,
  chapter text,  -- 챕터 정보 (있으면 표시, 없으면 block_index 사용)
  -- ...
);
```

### student_block_schedule 테이블

```sql
CREATE TABLE student_block_schedule (
  id uuid PRIMARY KEY,
  block_set_id uuid NOT NULL,
  day_of_week integer NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  block_index integer NOT NULL,  -- 요일별 시간대 순서
  -- ...
);
```

## 요약

1. **표시 로직**: 같은 범위를 가진 플랜들의 `block_index`를 추출하여 정렬 후 표시
2. **할당 로직**: 플랜 생성 시 시간대 순서에 따라 순차적으로 할당되거나, 블록 스케줄의 `block_index` 사용
3. **의미**: 같은 날짜 내에서 시간대 순서를 나타내는 번호
4. **표시 형식**: 
   - 단일 블록: `📖 블록: 1`
   - 여러 블록: `📖 블록: 1, 11` (같은 범위를 가진 블록들)

