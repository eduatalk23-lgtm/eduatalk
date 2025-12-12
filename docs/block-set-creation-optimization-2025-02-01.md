# 블록 세트 생성 최적화 완료

## 작업 일자
2025-02-01

## 문제점
블록 세트 생성 시 시간 블록을 순차적으로 추가하여 다음과 같은 문제가 발생했습니다:

1. **다중 네트워크 요청**: 평일 5개 시간 블록 추가 시 POST 요청 5회 발생
2. **다중 리렌더링**: 각 `addBlock` 호출마다 `revalidatePath` → 리렌더링 발생
3. **자동 저장 트리거**: `onUpdate({ block_set_id })` 호출로 `wizardData` 변경 → `usePlanPayloadBuilder` 재계산 → 자동 저장 가능성
4. **중복 코드**: `handleCreateBlockSet`과 `handleAddBlocksToSet`에서 유사한 순차 추가 로직 반복

## 해결 방안

### 1. 일괄 추가 함수 활용
- `app/actions/blocks.ts`의 `addBlocksToMultipleDays` 함수 활용
- 템플릿 모드용 `addTenantBlocksToMultipleDays` 함수 추가 구현

### 2. 최적화된 흐름
```
이전:
handleCreateBlockSet()
├── createBlockSet() → POST 요청 1회
├── for (const block of addedBlocks) {
│   ├── await addBlock(blockFormData) → POST 요청 N회
│   ├── revalidatePath("/blocks") → N회
│   └── 리렌더링 가능성 → N회
│   }
├── await refreshBlockSets()
└── onUpdate({ block_set_id }) → wizardData 변경

개선:
handleCreateBlockSet()
├── createBlockSet() → POST 요청 1회
├── addBlocksToMultipleDays() → POST 요청 1회 (같은 시간대 블록 일괄)
│   └── revalidatePath("/blocks") → 1회
├── await refreshBlockSets()
└── onUpdate({ block_set_id }) → 1회만 호출
```

## 구현 내용

### 1. 템플릿 모드용 일괄 추가 함수 추가
**파일**: `app/(admin)/actions/tenantBlockSets.ts`

- `_addTenantBlocksToMultipleDays` 함수 구현
- `addTenantBlocksToMultipleDays` export 추가
- 일반 모드의 `addBlocksToMultipleDays`와 동일한 로직 적용

### 2. useBlockSetManagement.ts 최적화
**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

#### Import 추가
```typescript
import { addBlock, deleteBlock, addBlocksToMultipleDays } from "@/app/actions/blocks";
import {
  // ...
  addTenantBlocksToMultipleDays,
  // ...
} from "@/app/(admin)/actions/tenantBlockSets";
```

#### handleCreateBlockSet 최적화
- `addedBlocks`를 시간대별로 그룹화
- 같은 시간대를 가진 블록들을 `addBlocksToMultipleDays`로 일괄 추가
- 다른 시간대는 별도로 처리

**변경 전**:
```typescript
for (const block of addedBlocks) {
  const blockFormData = new FormData();
  blockFormData.append("day", String(block.day));
  blockFormData.append("start_time", block.startTime);
  blockFormData.append("end_time", block.endTime);
  blockFormData.append("block_set_id", blockSetId);
  await addBlock(blockFormData);
}
```

**변경 후**:
```typescript
// 같은 시간대를 가진 블록들을 그룹화
const blocksByTime = addedBlocks.reduce((acc, block) => {
  const timeKey = `${block.startTime}-${block.endTime}`;
  if (!acc[timeKey]) {
    acc[timeKey] = {
      startTime: block.startTime,
      endTime: block.endTime,
      days: [],
    };
  }
  acc[timeKey].days.push(block.day);
  return acc;
}, {} as Record<string, { startTime: string; endTime: string; days: number[] }>);

// 각 시간대별로 일괄 추가
for (const timeKey in blocksByTime) {
  const { startTime, endTime, days } = blocksByTime[timeKey];
  const blockFormData = new FormData();
  blockFormData.append("target_days", days.join(","));
  blockFormData.append("start_time", startTime);
  blockFormData.append("end_time", endTime);
  blockFormData.append("block_set_id", blockSetId);
  await addBlocksToMultipleDays(blockFormData);
}
```

#### handleAddBlocksToSet 최적화
- 순차 추가 → 일괄 추가로 변경
- 단일 호출로 모든 요일 처리

**변경 전**:
```typescript
for (const day of selectedWeekdays) {
  const blockFormData = new FormData();
  blockFormData.append("day", String(day));
  blockFormData.append("start_time", blockStartTime);
  blockFormData.append("end_time", blockEndTime);
  blockFormData.append("block_set_id", editingBlockSetId);
  await addBlock(blockFormData);
}
```

**변경 후**:
```typescript
const blockFormData = new FormData();
blockFormData.append("target_days", selectedWeekdays.join(","));
blockFormData.append("start_time", blockStartTime);
blockFormData.append("end_time", blockEndTime);
blockFormData.append("block_set_id", editingBlockSetId);
await addBlocksToMultipleDays(blockFormData);
```

### 3. 에러 처리 개선
- 부분 성공 메시지 처리: `INFO:` 접두사가 있는 경우 부분 성공으로 처리
- 에러 발생 시에도 사용자에게 명확한 피드백 제공

## 최적화 효과

1. **네트워크 요청 감소**: N회 → 1회 (같은 시간대 블록의 경우)
2. **리렌더링 감소**: N회 → 1회
3. **자동 저장 트리거 감소**: 블록 추가 완료 후 한 번만 `onUpdate` 호출
4. **코드 중복 제거**: 순차 추가 로직 통합

## 테스트 방법

1. **네트워크 요청 확인**: 개발자 도구 Network 탭에서 POST 요청 횟수 확인
2. **리렌더링 확인**: React DevTools에서 리렌더링 횟수 확인
3. **기능 테스트**:
   - 평일 5개 요일에 동일 시간대 블록 추가
   - 여러 시간대 블록 추가
   - 템플릿 모드에서 블록 추가

## 관련 파일

- `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`
- `app/(admin)/actions/tenantBlockSets.ts`
- `app/actions/blocks.ts` (기존 함수 활용)

