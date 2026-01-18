# startTransition async 파서 오류 수정

## 문제 상황

빌드 시 다음과 같은 파서 오류가 발생했습니다:

```
./app/(student)/plan/new-group/_components/Step1BasicInfo.tsx:597:6
Parsing ecmascript source code failed
Expected a semicolon
```

## 원인 분석

React의 `startTransition`은 동기 함수만 받을 수 있는데, 코드에서 `startTransition(async () => { ... })` 형태로 async 함수를 직접 전달하고 있었습니다. 이로 인해 파서가 구문을 올바르게 파싱하지 못했습니다.

## 해결 방법

`startTransition` 내부에서 Promise를 처리하도록 수정했습니다:

### 수정 전
```typescript
startTransition(async () => {
  try {
    // async 작업
  } catch (error) {
    // 에러 처리
  }
});
```

### 수정 후
```typescript
startTransition(() => {
  (async () => {
    try {
      // async 작업
    } catch (error) {
      // 에러 처리
    }
  })();
});
```

## 수정된 함수들

다음 함수들에서 `startTransition` 사용 방식을 수정했습니다:

1. `handleCreateBlockSet` - 블록 세트 생성
2. `handleLoadBlockSets` - 블록 세트 목록 로드
3. `handleAddBlocksToSet` - 블록 추가
4. `handleDeleteBlock` - 블록 삭제
5. `handleUpdateBlockSetName` - 블록 세트 이름 수정

## 추가 수정 사항

`handleCreateBlockSet` 함수에서 변수명 충돌을 해결하기 위해 템플릿 모드의 변수명을 변경했습니다:
- `formData` → `templateFormData`
- `result` → `templateResult`
- `blockSetId` → `templateBlockSetId`
- `blockSetName` → `templateBlockSetName`

## 결과

원래의 파서 오류가 해결되어 빌드가 성공적으로 진행됩니다.

## 참고

- React의 `startTransition`은 동기 함수만 받을 수 있습니다.
- async 작업이 필요한 경우, `startTransition` 내부에서 즉시 실행 함수(IIFE)로 Promise를 처리해야 합니다.
- 이 패턴은 상태 업데이트를 트랜지션으로 표시하면서도 비동기 작업을 수행할 수 있게 해줍니다.

