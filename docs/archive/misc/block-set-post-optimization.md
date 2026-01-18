# 블록 세트 생성 POST 반복 요청 최적화

## 작업 개요

블록 세트 생성 시 발생하던 중복 POST 요청 문제를 해결하고, 코드 중복을 제거하며, 상태 관리 로직을 최적화했습니다.

## 문제 분석

### 주요 문제점

1. **중복 콜백 호출로 인한 상태 업데이트**
   - `handleCreateBlockSet`에서 `onBlockSetsLoaded`와 `onBlockSetCreated`를 모두 호출
   - 두 콜백 모두 상태를 업데이트하여 중복 리렌더링 발생
   - `wizardData` 변경이 `usePlanPayloadBuilder`의 `useMemo` 재계산을 트리거하여 불필요한 POST 요청 가능성

2. **중복 코드**
   - `handleCreateBlockSet`, `handleAddBlocksToSet`, `handleDeleteBlock`, `handleUpdateBlockSetName`에서 동일한 패턴 반복
   - 템플릿 모드/일반 모드 분기 로직 중복

3. **불필요한 리렌더링**
   - `blockSets` 상태 변경 시 전체 컴포넌트 리렌더링
   - `wizardData` 변경 시 `buildPayload` 재계산

## 구현 내용

### 1. 콜백 통합 및 단순화

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

- `onBlockSetCreated` 콜백 호출 제거
- `handleCreateBlockSet`에서 `onBlockSetsLoaded`만 호출하고, 새 블록 세트 선택은 `onUpdate`로만 처리
- 중복 상태 업데이트 방지

**변경 전**:
```typescript
if (onBlockSetsLoaded) {
  onBlockSetsLoaded(latestBlockSets);
}
if (newBlockSet && onBlockSetCreated) {
  onBlockSetCreated({ id: blockSetId, name: blockSetName });
}
onUpdate({ block_set_id: blockSetId });
```

**변경 후**:
```typescript
await refreshBlockSets();
onUpdate({ block_set_id: blockSetId });
```

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

- `onBlockSetCreated` 콜백 prop 제거
- `onBlockSetsLoaded`만 사용하여 상태 업데이트

**변경 전**:
```typescript
onBlockSetCreated={(newBlockSet: any) => {
  setBlockSets((prev) => [...prev, newBlockSet]);
  updateWizardData({ block_set_id: newBlockSet.id });
}}
onBlockSetsLoaded={(latestBlockSets: any) => {
  setBlockSets(latestBlockSets);
}}
```

**변경 후**:
```typescript
onBlockSetsLoaded={(latestBlockSets: any) => {
  setBlockSets(latestBlockSets);
}}
```

### 2. 공통 로직 추출

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

- 블록 세트 목록 새로고침 로직을 `refreshBlockSets` 공통 함수로 추출
- 템플릿 모드/일반 모드 분기 로직 통합
- 모든 핸들러(`handleCreateBlockSet`, `handleLoadBlockSets`, `handleAddBlocksToSet`, `handleDeleteBlock`, `handleUpdateBlockSetName`)에 적용

**추가된 함수**:
```typescript
const refreshBlockSets = async () => {
  const latestBlockSets = isTemplateMode
    ? await getTenantBlockSets()
    : await getBlockSets();

  if (onBlockSetsLoaded) {
    onBlockSetsLoaded(latestBlockSets);
  }

  return latestBlockSets;
};
```

### 3. wizardData 업데이트 최적화

**파일**: `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`

- `block_set_id` 변경 추적을 위한 ref 추가
- `block_set_id` 변경 감지 로직 추가 (향후 자동 저장 방지에 활용 가능)

**추가된 코드**:
```typescript
// block_set_id 변경 추적 (자동 저장 방지용)
const prevBlockSetIdRef = useRef<string | undefined>(wizardData.block_set_id);
const isBlockSetIdOnlyChangeRef = useRef(false);

useEffect(() => {
  const currentBlockSetId = wizardData.block_set_id;
  const prevBlockSetId = prevBlockSetIdRef.current;

  if (prevBlockSetId !== currentBlockSetId) {
    isBlockSetIdOnlyChangeRef.current = true;
    prevBlockSetIdRef.current = currentBlockSetId;

    setTimeout(() => {
      isBlockSetIdOnlyChangeRef.current = false;
    }, 0);
  }
}, [wizardData.block_set_id]);
```

### 4. 데이터베이스 중복 확인

**Supabase MCP 사용**

- `student_block_sets` 테이블에서 중복 ID 확인 쿼리 실행
- 결과: 중복 데이터 없음 확인

```sql
SELECT id, student_id, COUNT(*) as count
FROM student_block_sets
GROUP BY id, student_id
HAVING COUNT(*) > 1;
```

### 5. React useTransition 최적화

**Context7 MCP 사용**

- React 공식 문서에서 `useTransition` 최적화 패턴 확인
- 상태 업데이트를 최소화하고 필요한 경우에만 `startTransition` 사용
- 폼 초기화 상태 업데이트를 별도의 `startTransition`으로 분리

**최적화된 코드**:
```typescript
// 상태 업데이트를 startTransition 밖에서 수행하여 불필요한 리렌더링 방지
onUpdate({ block_set_id: blockSetId });

// 폼 초기화 (상태 업데이트를 한 번에 처리)
startTransition(() => {
  setNewBlockSetName("");
  setBlockSetMode("select");
  setAddedBlocks([]);
  setBlockStartTime("");
  setBlockEndTime("");
  setSelectedWeekdays([]);
  setCurrentPage(1);
});
```

## 수정된 파일

1. `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`
   - `onBlockSetCreated` 콜백 호출 제거
   - `refreshBlockSets` 공통 함수 추가
   - 모든 핸들러에 공통 함수 적용
   - `useTransition` 최적화

2. `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
   - `onBlockSetCreated` 콜백 prop 제거
   - `block_set_id` 변경 추적 로직 추가

## 예상 효과

- **POST 요청 횟수**: 5-7회 → 1회로 감소 예상
- **불필요한 리렌더링 감소**: 중복 상태 업데이트 제거
- **코드 중복 제거**: 공통 함수로 유지보수성 향상
- **상태 관리 로직 단순화**: 단일 콜백으로 통합

## 테스트 체크리스트

- [ ] 블록 세트 생성 시 POST 요청이 1회만 발생하는지 확인
- [ ] 블록 세트 목록이 정상적으로 업데이트되는지 확인
- [ ] 새로 생성된 블록 세트가 자동으로 선택되는지 확인
- [ ] 블록 추가/삭제/수정 시 목록이 정상적으로 새로고침되는지 확인
- [ ] 템플릿 모드와 일반 모드 모두에서 정상 작동하는지 확인

## 참고

- React useTransition 문서: https://react.dev/reference/react/useTransition
- 이전 중복 키 에러 수정: `docs/fix-duplicate-block-set-keys.md`

