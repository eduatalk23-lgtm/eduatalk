# 캠프 템플릿 블록 세트 정보 불러오기 수정

## 🔍 문제 상황

캠프 템플릿 작성 시 블록 세트 정보를 불러오지 못하는 문제가 발생했습니다.

### 문제 원인 분석

1. **에러 처리 부족**: `getTemplateBlockSets` 함수 호출 시 에러가 발생해도 빈 배열로 처리되어 실제 문제를 파악하기 어려움
2. **로깅 부족**: 블록 세트 조회 실패 시 상세한 로그가 없어 디버깅이 어려움
3. **반환값 검증 부족**: `getTemplateBlockSets` 함수의 반환값이 예상한 형식인지 확인하지 않음

## 🛠 해결 방안

### 1. 에러 처리 및 로깅 개선

**파일**: `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`

#### 변경 사항

1. **반환값 검증 추가**
   ```typescript
   const blockSetsResult = await getTemplateBlockSets(id);
   
   // getTemplateBlockSets는 withErrorHandling으로 래핑되어 있으므로
   // 에러가 발생하면 AppError를 던지거나, 성공하면 배열을 반환합니다
   if (blockSetsResult && Array.isArray(blockSetsResult)) {
     initialBlockSets = blockSetsResult.map(bs => ({
       id: bs.id,
       name: bs.name,
       blocks: bs.blocks || []
     }));
     
     console.log("[EditCampTemplatePage] 템플릿 블록 세트 조회 성공:", {
       template_id: id,
       block_sets_count: initialBlockSets.length,
       block_set_ids: initialBlockSets.map(bs => bs.id),
     });
   } else {
     console.warn("[EditCampTemplatePage] getTemplateBlockSets가 예상하지 못한 값을 반환했습니다:", blockSetsResult);
   }
   ```

2. **상세한 에러 로깅 추가**
   ```typescript
   } catch (error) {
     console.error("[EditCampTemplatePage] 템플릿 블록 세트 조회 실패:", {
       template_id: id,
       error: error instanceof Error ? error.message : String(error),
       stack: error instanceof Error ? error.stack : undefined,
     });
     // 에러가 발생해도 빈 배열로 계속 진행
   }
   ```

3. **저장된 block_set_id 조회 시 에러 로깅 개선**
   ```typescript
   if (blockSetError) {
     console.error("[EditCampTemplatePage] 저장된 block_set_id 조회 실패:", {
       block_set_id: savedBlockSetId,
       error: blockSetError,
     });
   } else if (missingBlockSet) {
     // 블록 세트의 블록도 조회
     const { data: blocks, error: blocksError } = await supabase
       .from("template_blocks")
       .select("id, day_of_week, start_time, end_time")
       .eq("template_block_set_id", savedBlockSetId)
       .order("day_of_week", { ascending: true })
       .order("start_time", { ascending: true });
     
     if (blocksError) {
       console.error("[EditCampTemplatePage] 저장된 block_set_id의 블록 조회 실패:", {
         block_set_id: savedBlockSetId,
         error: blocksError,
       });
     } else if (blocks) {
       // 맨 앞에 추가하여 기본값으로 표시
       initialBlockSets = [
         {
           id: missingBlockSet.id,
           name: missingBlockSet.name,
           blocks: blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>,
         },
         ...initialBlockSets,
       ];
       
       console.log("[EditCampTemplatePage] 저장된 block_set_id를 initialBlockSets에 추가:", {
         block_set_id: savedBlockSetId,
         block_set_name: missingBlockSet.name,
         blocks_count: blocks.length,
       });
     }
   }
   ```

## 📋 주요 개선 사항

### 1. 반환값 검증
- `getTemplateBlockSets` 함수의 반환값이 배열인지 확인
- 예상하지 못한 값이 반환되는 경우 경고 로그 출력

### 2. 상세한 로깅
- 블록 세트 조회 성공 시 조회된 블록 세트 개수와 ID 로그 출력
- 에러 발생 시 상세한 에러 정보 로그 출력
- 저장된 block_set_id 조회 및 추가 과정 로그 출력

### 3. 에러 처리 개선
- 각 단계별 에러를 개별적으로 처리하고 로그 출력
- 에러가 발생해도 빈 배열로 계속 진행하여 사용자 경험 유지

## 🔗 관련 파일

- `app/(admin)/admin/camp-templates/[id]/edit/page.tsx` - 편집 페이지 블록 세트 조회 로직
- `app/(admin)/actions/templateBlockSets.ts` - 블록 세트 조회 액션
- `lib/errors/handler.ts` - 에러 핸들링 유틸리티

## ✅ 결과

- 블록 세트 조회 실패 시 상세한 로그를 통해 문제를 빠르게 파악 가능
- 반환값 검증을 통해 예상하지 못한 상황을 조기에 발견 가능
- 에러 처리 개선으로 사용자 경험 향상

## 🧪 테스트 방법

1. 캠프 템플릿 편집 페이지 접속
2. 브라우저 콘솔에서 다음 로그 확인:
   - `[EditCampTemplatePage] 템플릿 블록 세트 조회 성공:` - 정상 조회 시
   - `[EditCampTemplatePage] 템플릿 블록 세트 조회 실패:` - 에러 발생 시
   - `[EditCampTemplatePage] 저장된 block_set_id를 initialBlockSets에 추가:` - 저장된 block_set_id 추가 시

## 📝 참고 사항

- `getTemplateBlockSets` 함수는 `withErrorHandling`으로 래핑되어 있어 에러 발생 시 `AppError`를 던집니다
- 템플릿에 연결된 블록 세트만 조회되므로, 템플릿에 연결되지 않은 블록 세트는 조회되지 않습니다
- `template_data`에 저장된 `block_set_id`가 조회된 블록 세트 목록에 없으면 별도로 조회하여 추가합니다

