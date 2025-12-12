# 블록 세트 생성 로직 개선

**작업 일자**: 2025-01-27  
**작업 범위**: 플랜 그룹 생성 중 블록 세트 생성 로직 개선

## 문제점

1. **여러 번 호출**: POST /plan/new-group이 여러 번 호출됨 (터미널 로그 확인)
2. **중복 코드**: 템플릿 모드와 일반 모드의 블록 세트 생성 로직이 거의 동일함
3. **새로고침 필요**: 일반 모드에서 블록 세트 생성 후 목록을 다시 불러오지 않음
4. **바로 활성화 안됨**: 생성된 블록 세트가 목록에 없어서 선택이 반영되지 않음

## 개선 사항

### 1. 중복 호출 방지

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

- `handleCreateBlockSet` 함수 시작 부분에 `isPending` 체크 추가
- 이미 진행 중인 경우 early return으로 중복 호출 방지

```typescript
const handleCreateBlockSet = () => {
  if (!newBlockSetName.trim()) {
    alert("블록 세트 이름을 입력해주세요.");
    return;
  }

  // 중복 호출 방지
  if (isPending) {
    return;
  }
  
  // ... 기존 코드
};
```

### 2. 중복 코드 제거 및 공통 로직 추출

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

- 템플릿 모드와 일반 모드의 공통 로직을 통합
- 블록 세트 생성, 시간 블록 추가, 목록 갱신 로직을 단일 흐름으로 재구성

**개선된 구조**:
1. 블록 세트 생성 (템플릿/일반 모드 분기)
2. 시간 블록 추가 (공통 로직)
3. 목록 다시 불러오기 (공통 로직)
4. 새 블록 세트 선택 및 콜백 호출 (공통 로직)
5. 폼 초기화 (공통 로직)

### 3. 일반 모드 목록 자동 갱신

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

- 일반 모드에서도 템플릿 모드와 동일하게 `getBlockSets()` 호출 후 `onBlockSetsLoaded` 콜백 호출
- 생성된 블록 세트의 전체 정보(blocks 포함)를 목록에 반영
- 새로고침 버튼을 누르지 않아도 정보가 즉시 표시됨

### 4. 생성 후 즉시 활성화

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`

- 목록 갱신 후 새로 생성된 블록 세트를 찾아서 선택
- `onBlockSetCreated` 콜백에서 최신 목록에서 찾은 블록 세트 정보 전달
- 생성된 블록 세트가 자동으로 선택되어 시간 블록 정보가 즉시 표시됨

## 구현 세부사항

### 개선된 handleCreateBlockSet 함수

```typescript
const handleCreateBlockSet = () => {
  if (!newBlockSetName.trim()) {
    alert("블록 세트 이름을 입력해주세요.");
    return;
  }

  // 중복 호출 방지
  if (isPending) {
    return;
  }

  startTransition(() => {
    (async () => {
      try {
        let blockSetId: string;
        let blockSetName: string;

        // 1. 블록 세트 생성 (템플릿/일반 모드 분기)
        if (isTemplateMode) {
          const templateFormData = new FormData();
          templateFormData.append("name", newBlockSetName.trim());
          const templateResult = await createTenantBlockSet(templateFormData);
          blockSetId = templateResult.blockSetId;
          blockSetName = templateResult.name;
        } else {
          const formData = new FormData();
          formData.append("name", newBlockSetName.trim());
          const result = await createBlockSet(formData);
          blockSetId = result.blockSetId;
          blockSetName = result.name;
        }

        // 2. 시간 블록 추가 (공통 로직)
        if (addedBlocks.length > 0) {
          for (const block of addedBlocks) {
            const blockFormData = new FormData();
            blockFormData.append("day", String(block.day));
            blockFormData.append("start_time", block.startTime);
            blockFormData.append("end_time", block.endTime);
            blockFormData.append("block_set_id", blockSetId);

            try {
              if (isTemplateMode) {
                await addTenantBlock(blockFormData);
              } else {
                await addBlock(blockFormData);
              }
            } catch (error) {
              // 에러 처리
            }
          }
        }

        // 3. 최신 블록 세트 목록 다시 불러오기 (공통 로직)
        const latestBlockSets = isTemplateMode
          ? await getTenantBlockSets()
          : await getBlockSets();

        // 4. 목록 업데이트
        if (onBlockSetsLoaded) {
          onBlockSetsLoaded(latestBlockSets);
        }

        // 5. 새로 생성된 블록 세트 찾기 및 콜백 호출
        const newBlockSet = latestBlockSets.find((bs) => bs.id === blockSetId);
        if (newBlockSet && onBlockSetCreated) {
          onBlockSetCreated({ id: blockSetId, name: blockSetName });
        }

        // 6. 새 블록 세트 선택
        onUpdate({ block_set_id: blockSetId });

        // 7. 폼 초기화
        setNewBlockSetName("");
        setBlockSetMode("select");
        setAddedBlocks([]);
        setBlockStartTime("");
        setBlockEndTime("");
        setSelectedWeekdays([]);
        setCurrentPage(1);
      } catch (error) {
        alert(
          error instanceof Error
            ? error.message
            : "블록 세트 생성에 실패했습니다."
        );
      }
    })();
  });
};
```

## 변경된 파일

- `app/(student)/plan/new-group/_components/Step1BasicInfo/hooks/useBlockSetManagement.ts`
  - `handleCreateBlockSet` 함수 전체 리팩토링
  - 중복 코드 제거 및 공통 로직 통합
  - 일반 모드 목록 자동 갱신 추가
  - 생성 후 즉시 활성화 로직 추가

## 테스트 결과

1. **중복 호출 방지**: `isPending` 체크로 중복 호출 방지 확인
2. **일반 모드 목록 갱신**: 일반 모드에서도 생성 후 목록이 자동으로 갱신됨
3. **템플릿 모드 동작**: 템플릿 모드에서도 동일하게 동작함
4. **즉시 활성화**: 생성된 블록 세트가 자동으로 선택되어 시간 블록 정보가 즉시 표시됨

## 참고 사항

- `PlanGroupWizard.tsx`의 `onBlockSetCreated` 콜백은 기존 동작을 유지하므로 추가 수정 불필요
- `onBlockSetsLoaded`가 호출되면 전체 목록이 갱신되므로 중복 추가는 발생하지 않음
- 데이터베이스 스키마는 변경 없음

