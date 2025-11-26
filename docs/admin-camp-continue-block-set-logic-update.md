# 관리자 페이지 '남은 단계 진행하기' 블록세트 로직 업데이트

## 🔍 문제 상황

관리자 페이지에서 '남은 단계 진행하기' 버튼 클릭 시 5~7단계 진행 시 블록 세트 로직이 변경된 부분이 반영되지 않아 에러가 발생했습니다.

### 에러 메시지

```
[getCampPlanGroupForReview] 템플릿 블록 세트 조회 에러: {}
```

### 원인 분석

1. **오래된 테이블 사용**
   - `getCampPlanGroupForReview` 함수에서 `template_block_sets` 테이블에서 조회
   - `template_blocks` 테이블에서 블록 조회
   - 새로운 로직은 `camp_template_block_sets` 연결 테이블을 통해 `tenant_blocks` 테이블에서 조회해야 함

2. **여러 위치에서 동일한 문제**
   - `app/(admin)/actions/campTemplateActions.ts`의 `getCampPlanGroupForReview` 함수
   - `app/(admin)/actions/campTemplateActions.ts`의 `continueCampStepsForAdmin` 함수
   - `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

## 🛠 해결 방법

### 수정 내용

#### 1. `getCampPlanGroupForReview` 함수 수정

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**변경 전**:
```typescript
// template_block_sets 테이블에서 조회
const { data: templateBlockSet, error: blockSetError } =
  await supabase
    .from("template_block_sets")
    .select("id, name")
    .eq("id", templateBlockSetId)
    .eq("template_id", result.group.camp_template_id)
    .maybeSingle();

// template_blocks 테이블에서 블록 조회
const { data: blocks, error: blocksError } = await supabase
  .from("template_blocks")
  .select("id, day_of_week, start_time, end_time")
  .eq("template_block_set_id", templateBlockSetId)
  .order("day_of_week", { ascending: true })
  .order("start_time", { ascending: true });
```

**변경 후**:
```typescript
// 1. 연결 테이블에서 템플릿에 연결된 블록 세트 조회
const { data: templateBlockSetLink, error: linkError } = await supabase
  .from("camp_template_block_sets")
  .select("tenant_block_set_id")
  .eq("camp_template_id", result.group.camp_template_id)
  .maybeSingle();

let tenantBlockSetId: string | null = null;
if (templateBlockSetLink) {
  tenantBlockSetId = templateBlockSetLink.tenant_block_set_id;
} else {
  // 하위 호환성: templateBlockSetId가 이미 tenant_block_sets의 ID일 수 있음
  tenantBlockSetId = templateBlockSetId;
}

if (tenantBlockSetId) {
  // 2. tenant_block_sets에서 블록 세트 정보 조회
  const { data: templateBlockSet, error: blockSetError } =
    await supabase
      .from("tenant_block_sets")
      .select("id, name")
      .eq("id", tenantBlockSetId)
      .eq("tenant_id", tenantContext.tenantId)
      .maybeSingle();

  // 3. tenant_blocks 테이블에서 블록 조회
  const { data: blocks, error: blocksError } = await supabase
    .from("tenant_blocks")
    .select("id, day_of_week, start_time, end_time")
    .eq("tenant_block_set_id", tenantBlockSetId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
}
```

#### 2. `continueCampStepsForAdmin` 함수 검증 로직 수정

**파일**: `app/(admin)/actions/campTemplateActions.ts`

**변경 전**:
```typescript
// template_blocks 테이블에서 블록 조회
const { data: templateBlocks } = await supabase
  .from("template_blocks")
  .select("id")
  .eq("template_block_set_id", templateBlockSetId)
  .limit(1);
```

**변경 후**:
```typescript
// 새로운 연결 테이블 방식으로 블록 세트 조회
const { data: templateBlockSetLink } = await supabase
  .from("camp_template_block_sets")
  .select("tenant_block_set_id")
  .eq("camp_template_id", result.group.camp_template_id)
  .maybeSingle();

let tenantBlockSetId: string | null = null;
if (templateBlockSetLink) {
  tenantBlockSetId = templateBlockSetLink.tenant_block_set_id;
} else {
  // 하위 호환성: template_data.block_set_id 확인
  const { data: templateData } = await supabase
    .from("camp_templates")
    .select("template_data")
    .eq("id", result.group.camp_template_id)
    .maybeSingle();

  if (templateData?.template_data) {
    const templateDataObj = templateData.template_data as any;
    tenantBlockSetId = templateDataObj.block_set_id || null;
  }
}

if (tenantBlockSetId) {
  // tenant_blocks 테이블에서 블록 조회
  const { data: templateBlocks } = await supabase
    .from("tenant_blocks")
    .select("id")
    .eq("tenant_block_set_id", tenantBlockSetId)
    .limit(1);
}
```

#### 3. `continue/page.tsx` 수정

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[groupId]/continue/page.tsx`

동일한 방식으로 새로운 연결 테이블 방식을 사용하도록 수정했습니다.

## 📊 변경 사항 요약

### 데이터 흐름

**변경 전**:
```
templateBlockSetId (template_data.block_set_id)
  ↓
template_block_sets 테이블 조회
  ↓
template_blocks 테이블 조회
```

**변경 후**:
```
camp_template_id
  ↓
camp_template_block_sets 테이블 조회 (tenant_block_set_id 획득)
  ↓
tenant_block_sets 테이블 조회 (블록 세트 정보)
  ↓
tenant_blocks 테이블 조회 (블록 정보)
```

### 하위 호환성

- 연결 테이블에 데이터가 없으면 `template_data.block_set_id` 확인
- 마이그레이션 전 데이터도 정상적으로 처리

## ✅ 검증 완료

- [x] `getCampPlanGroupForReview` 함수 수정 완료
- [x] `continueCampStepsForAdmin` 함수 검증 로직 수정 완료
- [x] `continue/page.tsx` 수정 완료
- [x] 하위 호환성 처리 완료
- [x] 린터 오류 없음

## 📝 참고

이제 관리자 페이지의 모든 블록세트 조회 로직이 새로운 연결 테이블 방식을 사용합니다:
- 학생 페이지와 일관성 확보
- 다른 관리자 페이지 함수들과도 일관성 확보

