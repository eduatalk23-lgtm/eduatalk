# 캠프 템플릿 수정 시 블록 세트 기본값 누락 문제 수정

## 🔍 문제 상황

캠프 템플릿 저장 후 수정하기로 이동할 때 블록 세트 기본값 내용이 없어지는 문제가 발생했습니다.

### 증상
- 캠프 템플릿을 저장할 때 블록 세트를 선택하고 저장
- 수정 페이지로 이동하면 선택했던 블록 세트가 표시되지 않음
- `template_data`에는 `block_set_id`가 저장되어 있지만, UI에서 선택된 상태로 표시되지 않음

## 📋 원인 분석

### 문제 발생 흐름

```
1. 캠프 템플릿 저장
   ↓
   template_data에 block_set_id 저장 ✅
   
2. 수정 페이지로 이동
   ↓
   getTemplateBlockSets(id)로 블록 세트 목록 조회
   ↓
   ❌ template_data의 block_set_id가 initialBlockSets에 포함되지 않을 수 있음
   
3. CampTemplateEditForm
   ↓
   initialData = { ...templateData, block_set_id: "xxx" } ✅
   ↓
   PlanGroupWizard에 전달
   
4. Step1BasicInfo
   ↓
   data.block_set_id는 있지만
   blockSets에 해당 ID가 없음 ❌
   ↓
   선택된 상태로 표시되지 않음
```

### 핵심 원인

**`template_data`에 저장된 `block_set_id`가 `initialBlockSets`에 포함되지 않는 경우**:
- 템플릿을 저장할 때 블록 세트를 선택했지만, 나중에 해당 블록 세트가 삭제되었을 수 있음
- 또는 `getTemplateBlockSets`가 조회한 블록 세트 목록에 해당 ID가 포함되지 않았을 수 있음
- 특히 템플릿을 저장한 직후 수정 페이지로 이동할 때 발생할 수 있음

## 🛠 수정 내용

### `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`

**수정 전**:
```typescript
// 템플릿 블록 세트 조회 (실제 DB에서)
let initialBlockSets: Array<{ id: string; name: string; blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }> = [];

try {
  initialBlockSets = await getTemplateBlockSets(id);
} catch (error) {
  console.error("[EditCampTemplatePage] 템플릿 블록 세트 조회 실패:", error);
  // 에러가 발생해도 빈 배열로 계속 진행
}
```

**수정 후**:
```typescript
// 템플릿 블록 세트 조회 (실제 DB에서)
let initialBlockSets: Array<{ id: string; name: string; blocks: Array<{ id: string; day_of_week: number; start_time: string; end_time: string }> }> = [];

try {
  initialBlockSets = await getTemplateBlockSets(id);
  
  // template_data에 저장된 block_set_id가 initialBlockSets에 있는지 확인
  const templateData = result.template.template_data as any;
  const savedBlockSetId = templateData?.block_set_id;
  
  if (savedBlockSetId) {
    const hasBlockSet = initialBlockSets.some(set => set.id === savedBlockSetId);
    
    if (!hasBlockSet) {
      // template_data에 저장된 block_set_id가 initialBlockSets에 없으면
      // 해당 블록 세트를 별도로 조회하여 추가
      const { createSupabaseServerClient } = await import("@/lib/supabase/server");
      const supabase = await createSupabaseServerClient();
      
      const { data: missingBlockSet, error: blockSetError } = await supabase
        .from("template_block_sets")
        .select("id, name")
        .eq("id", savedBlockSetId)
        .eq("template_id", id)
        .single();
      
      if (!blockSetError && missingBlockSet) {
        // 블록 세트의 블록도 조회
        const { data: blocks, error: blocksError } = await supabase
          .from("template_blocks")
          .select("id, day_of_week, start_time, end_time")
          .eq("template_block_set_id", savedBlockSetId)
          .order("day_of_week", { ascending: true })
          .order("start_time", { ascending: true });
        
        if (!blocksError && blocks) {
          // 맨 앞에 추가하여 기본값으로 표시
          initialBlockSets = [
            {
              id: missingBlockSet.id,
              name: missingBlockSet.name,
              blocks: blocks as Array<{ id: string; day_of_week: number; start_time: string; end_time: string }>,
            },
            ...initialBlockSets,
          ];
        }
      } else {
        // 블록 세트를 찾을 수 없으면 경고 로그만 출력
        console.warn("[EditCampTemplatePage] template_data에 저장된 block_set_id를 찾을 수 없습니다:", {
          block_set_id: savedBlockSetId,
          template_id: id,
        });
      }
    }
  }
} catch (error) {
  console.error("[EditCampTemplatePage] 템플릿 블록 세트 조회 실패:", error);
  // 에러가 발생해도 빈 배열로 계속 진행
}
```

## ✅ 수정 효과

### 1. 블록 세트 기본값 보장
- `template_data`에 저장된 `block_set_id`가 `initialBlockSets`에 없으면 별도로 조회하여 추가
- 수정 페이지에서 선택했던 블록 세트가 항상 표시됨

### 2. 맨 앞에 배치
- 저장된 블록 세트를 `initialBlockSets`의 맨 앞에 추가하여 기본값으로 표시
- 사용자가 쉽게 확인할 수 있음

### 3. 에러 처리
- 블록 세트를 찾을 수 없는 경우 경고 로그만 출력하고 계속 진행
- 사용자 경험을 해치지 않음

## 🧪 테스트 시나리오

### 시나리오 1: 정상 케이스
1. 캠프 템플릿 생성
2. 블록 세트 선택 및 저장
3. 수정 페이지로 이동
4. **예상 결과**: 선택했던 블록 세트가 선택된 상태로 표시됨 ✅

### 시나리오 2: 블록 세트가 initialBlockSets에 없는 경우
1. 캠프 템플릿 생성 및 저장 (블록 세트 선택)
2. 수정 페이지로 이동
3. `getTemplateBlockSets`가 해당 블록 세트를 반환하지 않음
4. **예상 결과**: `template_data`의 `block_set_id`를 확인하여 별도로 조회하고 추가 ✅

### 시나리오 3: 블록 세트가 삭제된 경우
1. 캠프 템플릿 생성 및 저장 (블록 세트 선택)
2. 블록 세트 삭제
3. 수정 페이지로 이동
4. **예상 결과**: 경고 로그 출력, 빈 상태로 표시 (정상 동작) ✅

## 📝 관련 파일

- `app/(admin)/admin/camp-templates/[id]/edit/page.tsx` - 수정 페이지
- `app/(admin)/admin/camp-templates/[id]/edit/CampTemplateEditForm.tsx` - 수정 폼
- `app/(admin)/actions/templateBlockSets.ts` - 템플릿 블록 세트 조회 액션
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx` - 블록 세트 선택 UI

## 🔗 참고 문서

- `doc/블록-세트-템플릿-저장-개선-방안.md` - 블록 세트 템플릿 저장 개선 방안

---

**수정 일자**: 2024년 11월  
**수정자**: AI Assistant  
**상태**: ✅ 완료









