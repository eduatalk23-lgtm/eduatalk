# 블록세트 새로고침 기능 개선 및 코드 최적화

## 작업 일시
2024년 12월

## 작업 개요
플랜그룹 생성 과정에서 블록세트 새로고침 기능을 개선하고, 중복 코드를 제거하며, 등록 후 목록 새로고침 및 활성화 로직을 최적화했습니다.

## 주요 변경 사항

### 1. 중복 코드 통합

**파일**: `app/actions/blockSets.ts`

- `_getBlockSets()` 함수가 `fetchBlockSetsWithBlocks()`와 동일한 로직을 수행하던 문제를 해결
- `lib/data/blockSets.ts`의 `fetchBlockSetsWithBlocks()`를 공통 함수로 사용하도록 변경
- 약 50줄의 중복 코드 제거

**변경 내용**:
```typescript
// 이전: 중복된 쿼리 로직
async function _getBlockSets() {
  // ... 중복된 쿼리 코드 ...
}

// 이후: 공통 함수 사용
import { fetchBlockSetsWithBlocks } from "@/lib/data/blockSets";

async function _getBlockSets() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new AppError("로그인이 필요합니다.", ErrorCode.UNAUTHORIZED, 401, true);
  }
  
  return await fetchBlockSetsWithBlocks(user.id);
}
```

### 2. 새로고침 로직 개선

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

#### 2.1 `handleCreateBlockSet` 함수 개선

**문제**: `refreshBlockSets()` 완료 전에 `onUpdate` 호출하여 새 블록세트가 목록에 반영되기 전에 선택 시도

**해결**: `refreshBlockSets()` 반환값을 확인하여 새 블록세트가 목록에 포함된 후에만 선택

```typescript
// 이전
await refreshBlockSets();
onUpdate({ block_set_id: blockSetId });

// 이후
const latestBlockSets = await refreshBlockSets();
const newBlockSet = latestBlockSets.find(set => set.id === blockSetId);
if (newBlockSet) {
  onUpdate({ block_set_id: blockSetId });
} else {
  console.warn("[Step1BasicInfo] 새로 생성된 블록 세트를 목록에서 찾을 수 없습니다.");
  alert("블록 세트가 생성되었지만 목록에 반영되지 않았습니다. 새로고침 버튼을 클릭해주세요.");
}
```

#### 2.2 `handleAddBlocksToSet` 함수 개선

**변경**: `refreshBlockSets()` 반환값을 확인하여 새로고침 완료 보장

```typescript
const latestBlockSets = await refreshBlockSets();
const updatedSet = latestBlockSets.find(set => set.id === editingBlockSetId);
if (!updatedSet) {
  console.warn("[Step1BasicInfo] 블록 추가 후 세트를 찾을 수 없습니다:", editingBlockSetId);
}
```

#### 2.3 `handleDeleteBlock` 함수 개선

**변경**: `refreshBlockSets()` 반환값을 확인하여 새로고침 완료 보장

```typescript
const latestBlockSets = await refreshBlockSets();
if (editingBlockSetId) {
  const updatedSet = latestBlockSets.find(set => set.id === editingBlockSetId);
  if (!updatedSet) {
    console.warn("[Step1BasicInfo] 블록 삭제 후 세트를 찾을 수 없습니다:", editingBlockSetId);
  }
}
```

#### 2.4 `handleUpdateBlockSetName` 함수 개선

**변경**: 업데이트된 블록세트를 찾지 못한 경우에 대한 처리 추가

```typescript
const latestBlockSets = await refreshBlockSets();
const updatedSet = latestBlockSets.find(set => set.id === editingBlockSetId);
if (updatedSet) {
  onUpdate({ block_set_id: updatedSet.id });
} else {
  console.warn("[Step1BasicInfo] 이름 수정 후 블록 세트를 목록에서 찾을 수 없습니다:", editingBlockSetId);
}
```

### 3. 데이터베이스 쿼리 최적화

**파일**: `lib/data/blockSets.ts`

**문제**: N+1 쿼리 문제 - 각 블록세트마다 별도 쿼리 실행

**해결**: 블록세트 목록과 모든 블록을 병렬로 조회한 후 JavaScript에서 그룹화

```typescript
// 이전: N+1 쿼리 문제
const blockSets = await Promise.all(
  blockSetsData.map(async (set) => {
    const { data: blocks } = await supabase
      .from("student_block_schedule")
      .select("...")
      .eq("block_set_id", set.id);
    // ...
  })
);

// 이후: 병렬 쿼리 + 그룹화
const [blockSetsResult, blocksResult] = await Promise.all([
  supabase.from("student_block_sets").select("..."),
  supabase.from("student_block_schedule").select("..."),
]);

// JavaScript에서 그룹화
const blocksBySetId = new Map();
for (const block of allBlocks) {
  // 그룹화 로직
}
```

**성능 개선**:
- 이전: 블록세트 N개 → N+1번의 쿼리 실행
- 이후: 블록세트 N개 → 2번의 쿼리 실행 (병렬)

## 테스트 항목

1. **블록세트 생성 후 자동 선택**
   - 새 블록세트 생성 시 목록에 즉시 반영되는지 확인
   - 자동으로 선택되는지 확인

2. **수동 새로고침**
   - 새로고침 아이콘 클릭 시 목록이 업데이트되는지 확인

3. **블록 추가/삭제 후 새로고침**
   - 블록 추가 후 목록 업데이트 확인
   - 블록 삭제 후 목록 업데이트 확인

4. **블록세트 이름 수정 후 새로고침**
   - 이름 수정 후 목록에 반영되는지 확인

## 예상 효과

1. **코드 중복 제거**: 약 50줄의 중복 코드 제거
2. **안정성 향상**: 새로고침 완료 후 상태 업데이트로 타이밍 이슈 해결
3. **성능 개선**: 데이터베이스 쿼리 최적화로 N+1 문제 해결 (N+1 → 2 쿼리)
4. **유지보수성 향상**: 공통 함수 사용으로 일관성 확보

## 관련 파일

- `app/actions/blockSets.ts` - 중복 코드 통합
- `lib/data/blockSets.ts` - 쿼리 최적화
- `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts` - 새로고침 로직 개선

## 참고 사항

- 새로고침 아이콘과 자동 새로고침은 모두 `refreshBlockSets()` 공통 함수를 사용
- 블록세트 생성 후 목록 새로고침은 이미 구현되어 있었으나, 타이밍 이슈가 있었음
- 개선 후 새로고침 완료를 보장한 후 상태 업데이트를 수행하도록 변경

