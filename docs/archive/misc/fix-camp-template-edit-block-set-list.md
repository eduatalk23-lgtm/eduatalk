# 캠프 템플릿 수정 시 블록 세트 목록 미표시 문제 수정

## 🔍 문제 상황

캠프 템플릿 생성 후 수정 페이지로 이동할 때 블록 세트 목록이 표시되지 않는 문제:

1. **템플릿 수정 시 블록 세트 목록이 비어있음**
   - 템플릿 수정 페이지에서 블록 세트 목록이 표시되지 않음
   - `getTemplateBlockSets(id)`가 해당 템플릿에 연결된 블록 세트만 조회
   - 템플릿 저장 전에 생성한 블록 세트(`template_id`가 NULL)는 조회되지 않음

2. **Step1BasicInfo에서 중복 조회**
   - `edit/page.tsx`에서 이미 `initialBlockSets`를 조회하여 전달
   - `Step1BasicInfo`에서 초기 로드 시 다시 조회하면서 정보가 사라질 수 있음

## 📋 원인 분석

### 데이터베이스 스키마 변경

`template_block_sets` 테이블의 `template_id`가 NULL 허용으로 변경되었습니다 (2025-11-26 마이그레이션):
- 템플릿 저장 전에도 블록 세트를 생성할 수 있도록 변경
- 템플릿 저장 전에 생성한 블록 세트는 `template_id`가 NULL

### 문제 발생 흐름

```
1. 캠프 템플릿 생성
   ↓
   템플릿 저장 전에 블록 세트 생성 (template_id = NULL)
   ↓
   블록 세트 선택 후 템플릿 저장
   ↓
   template_data에 block_set_id 저장 ✅

2. 수정 페이지로 이동
   ↓
   getTemplateBlockSets(id)로 블록 세트 조회
   ↓
   ❌ template_id = id인 블록 세트만 조회
   ❌ template_id = NULL인 블록 세트는 조회되지 않음
   ↓
   initialBlockSets가 비어있거나 불완전함

3. Step1BasicInfo
   ↓
   blockSets.length === 0이면 자동으로 handleLoadBlockSets() 호출
   ↓
   templateId가 있으면 해당 템플릿의 블록 세트만 조회
   ↓
   ❌ template_id = NULL인 블록 세트는 여전히 조회되지 않음
```

## 🛠 해결 방법

### 수정 내용

#### 1. `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`

**템플릿에 연결되지 않은 블록 세트도 함께 조회**:

```typescript
// 1. 템플릿에 연결된 블록 세트 조회
const blockSets = await getTemplateBlockSets(id);
const connectedBlockSets = blockSets.map(bs => ({
  id: bs.id,
  name: bs.name,
  blocks: bs.blocks || []
}));

// 2. 템플릿에 연결되지 않은 블록 세트 조회 (template_id가 NULL인 블록 세트)
const { data: unconnectedBlockSets } = await supabase
  .from("template_block_sets")
  .select("id, name")
  .eq("tenant_id", tenantContext.tenantId)
  .is("template_id", null)
  .order("created_at", { ascending: true });

// 3. 각 블록 세트의 시간 블록 조회 후 병합
initialBlockSets = [...connectedBlockSets, ...unconnectedBlockSetsWithBlocks];
```

**template_data에 저장된 block_set_id 조회 로직 개선**:

```typescript
// template_id가 NULL일 수도 있으므로 .eq("template_id", id) 조건 제거
const { data: missingBlockSet } = await supabase
  .from("template_block_sets")
  .select("id, name")
  .eq("id", savedBlockSetId)
  .eq("tenant_id", tenantContext.tenantId) // 보안을 위해 tenant_id로 필터링
  .maybeSingle();
```

#### 2. `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

**템플릿 수정 시 중복 조회 방지**:

```typescript
// 초기 로드 시 블록 세트 목록 자동 로드
useEffect(() => {
  // blockSets가 비어있고 아직 로딩 중이 아닐 때만 자동 로드
  // templateId가 있으면 서버에서 이미 initialBlockSets를 전달했으므로 자동 로드하지 않음
  if (blockSets.length === 0 && !isLoadingBlockSets && !templateId) {
    handleLoadBlockSets();
  }
}, []); // 초기 마운트 시에만 실행
```

## 📝 상세 설명

### 템플릿 블록 세트 조회 전략

1. **템플릿에 연결된 블록 세트**: `getTemplateBlockSets(id)`로 조회
2. **템플릿에 연결되지 않은 블록 세트**: `template_id IS NULL` 조건으로 조회
3. **병합**: 두 목록을 합쳐서 `initialBlockSets`로 전달

### 중복 조회 방지

- `edit/page.tsx`에서 이미 모든 블록 세트를 조회하여 전달
- `Step1BasicInfo`에서 `templateId`가 있으면 자동 로드를 하지 않음
- 서버에서 조회한 `initialBlockSets`를 그대로 사용

## ✅ 결과

- 템플릿 수정 시 템플릿에 연결된 블록 세트와 연결되지 않은 블록 세트 모두 표시됨
- `template_data`에 저장된 `block_set_id`가 정상적으로 조회됨
- 중복 조회로 인한 정보 손실 방지
- 블록 세트 선택 정보가 정상적으로 표시됨

## 🔗 관련 파일

- `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`
- `app/(admin)/actions/templateBlockSets.ts`
- `docs/camp-template-block-set-tenant-based-creation.md`

