# 캠프 템플릿 생성 시 블록 세트 목록 미표시 문제 수정

## 🔍 문제 상황

`/admin/camp-templates/new` 페이지에서 블록 세트 목록이 표시되지 않는 문제:

1. **템플릿 모드에서 templateId가 없을 때 빈 배열 반환**
   - 새 템플릿 생성 시 `templateId`가 없음
   - `handleLoadBlockSets`에서 `templateId`가 없으면 빈 배열을 반환
   - 결과적으로 블록 세트 목록이 표시되지 않음

2. **초기 로드 시 블록 세트 목록 자동 로드 미구현**
   - 사용자가 수동으로 새로고침 버튼을 클릭해야 목록이 로드됨
   - 초기 로드 시 자동으로 블록 세트 목록을 불러오지 않음

## 🛠 해결 방법

### 수정 내용

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

1. **템플릿 모드에서 templateId가 없어도 블록 세트 조회**
   ```typescript
   // 수정 전
   if (isTemplateMode) {
     if (!templateId) {
       // 새 템플릿 생성 시에는 블록 세트 목록이 없음 (정상)
       if (onBlockSetsLoaded) {
         onBlockSetsLoaded([]);
       }
       setBlockSetMode("select");
       setIsLoadingBlockSets(false);
       return;
     }
     const latestBlockSets = await getTemplateBlockSets(
       templateId || null
     );
     // ...
   }

   // 수정 후
   if (isTemplateMode) {
     // templateId가 없어도 템플릿에 연결되지 않은 블록 세트를 조회
     // (새 템플릿 생성 시에도 기존 블록 세트를 선택할 수 있도록)
     const latestBlockSets = await getTemplateBlockSets(
       templateId || null
     );
     if (onBlockSetsLoaded) {
       onBlockSetsLoaded(latestBlockSets);
     }
   }
   ```

2. **초기 로드 시 블록 세트 목록 자동 로드**
   ```typescript
   // 초기 로드 시 블록 세트 목록 자동 로드
   useEffect(() => {
     // blockSets가 비어있고 아직 로딩 중이 아닐 때만 자동 로드
     if (blockSets.length === 0 && !isLoadingBlockSets) {
       handleLoadBlockSets();
     }
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []); // 초기 마운트 시에만 실행
   ```

## 📝 상세 설명

### `getTemplateBlockSets` 함수 동작

`app/(admin)/actions/templateBlockSets.ts`의 `_getTemplateBlockSets` 함수는:
- `templateId`가 `null`이면 템플릿에 연결되지 않은 블록 세트만 조회
- `templateId`가 있으면 해당 템플릿의 블록 세트 조회

따라서 새 템플릿 생성 시에도 `getTemplateBlockSets(null)`을 호출하면 템플릿에 연결되지 않은 블록 세트 목록을 가져올 수 있습니다.

### 초기 로드 자동화

초기 마운트 시 `blockSets`가 비어있으면 자동으로 `handleLoadBlockSets()`를 호출하여 블록 세트 목록을 불러옵니다. 이를 통해 사용자가 수동으로 새로고침 버튼을 클릭하지 않아도 목록이 표시됩니다.

## ✅ 결과

- 새 템플릿 생성 시에도 템플릿에 연결되지 않은 블록 세트 목록이 표시됨
- 초기 로드 시 자동으로 블록 세트 목록이 로드됨
- 사용자가 블록 세트를 선택하거나 새로 생성할 수 있음

## 🔗 관련 파일

- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- `app/(admin)/actions/templateBlockSets.ts`
- `app/(admin)/admin/camp-templates/new/page.tsx`
- `app/(admin)/admin/camp-templates/new/CampTemplateForm.tsx`

