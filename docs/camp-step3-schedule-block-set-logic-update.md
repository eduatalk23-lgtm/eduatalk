# 캠프 Step3 스케줄 확인 블록세트 로직 업데이트

## 🔍 문제 상황

3단계 스케줄 확인 단계에서 블록세트 조회 로직이 오래된 방식을 사용하고 있었습니다.

### 원인 분석

1. **오래된 테이블 사용**
   - `calculateScheduleAvailability.ts`에서 캠프 모드일 때 `template_blocks` 테이블에서 조회
   - 새로운 로직은 `camp_template_block_sets` 연결 테이블을 통해 `tenant_blocks` 테이블에서 조회해야 함

2. **다른 파일과의 불일치**
   - `plan-groups/queries.ts`의 `_getScheduleResultData` 함수는 이미 새로운 로직 반영됨
   - `plan-groups/plans.ts`의 `_generatePlansFromGroup` 함수도 새로운 로직 반영됨
   - `calculateScheduleAvailability.ts`만 오래된 로직 사용 중

## 🛠 해결 방법

### 수정 내용

**파일**: `app/(student)/actions/calculateScheduleAvailability.ts`

#### 변경 전 (오래된 방식)

```typescript
// 캠프 모드: 템플릿 블록 세트의 블록 조회
if (params.isCampMode && params.campTemplateId && params.blockSetId) {
  // template_blocks 테이블에서 조회
  const { data: blocksData, error: blocksError } = await supabase
    .from("template_blocks")
    .select("day_of_week, start_time, end_time")
    .eq("template_block_set_id", params.blockSetId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
  // ...
}
```

#### 변경 후 (새로운 연결 테이블 방식)

```typescript
// 캠프 모드: 템플릿 블록 세트의 블록 조회
if (params.isCampMode && params.campTemplateId && params.blockSetId) {
  // 1. 연결 테이블에서 템플릿에 연결된 블록 세트 조회
  const { data: templateBlockSetLink, error: linkError } = await supabase
    .from("camp_template_block_sets")
    .select("tenant_block_set_id")
    .eq("camp_template_id", params.campTemplateId)
    .maybeSingle();

  let templateBlockSetId: string | null = null;
  if (templateBlockSetLink) {
    templateBlockSetId = templateBlockSetLink.tenant_block_set_id;
  } else {
    // 하위 호환성: template_data.block_set_id 확인 (마이그레이션 전 데이터용)
    const { getCampTemplate } = await import("@/lib/data/campTemplates");
    const template = await getCampTemplate(params.campTemplateId);
    if (template && template.template_data) {
      const templateData = template.template_data as any;
      templateBlockSetId = templateData.block_set_id || params.blockSetId || null;
    } else {
      // 연결 테이블에 없고 템플릿 데이터도 없으면 blockSetId를 직접 사용
      templateBlockSetId = params.blockSetId;
    }
  }

  if (templateBlockSetId) {
    // 2. tenant_blocks 테이블에서 블록 조회
    const { data: blocksData, error: blocksError } = await supabase
      .from("tenant_blocks")
      .select("day_of_week, start_time, end_time")
      .eq("tenant_block_set_id", templateBlockSetId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });
    // ...
  }
}
```

### 로직 흐름

1. **연결 테이블 조회 우선**
   - `camp_template_block_sets` 테이블에서 `camp_template_id`로 `tenant_block_set_id` 조회

2. **하위 호환성 처리**
   - 연결 테이블에 데이터가 없으면 템플릿의 `template_data.block_set_id` 확인
   - 그것도 없으면 `params.blockSetId`를 직접 사용 (이미 `tenant_block_sets`의 ID일 수 있음)

3. **블록 조회**
   - `tenant_blocks` 테이블에서 `tenant_block_set_id`로 블록 조회

## 📊 변경 사항 요약

### 데이터 흐름

**변경 전**:
```
campTemplateId + blockSetId
  ↓
template_blocks 테이블 조회 (template_block_set_id = blockSetId)
```

**변경 후**:
```
campTemplateId
  ↓
camp_template_block_sets 테이블 조회 (camp_template_id = campTemplateId)
  ↓
tenant_block_set_id 획득
  ↓
tenant_blocks 테이블 조회 (tenant_block_set_id)
```

### 다른 파일과의 일관성

이제 다음 파일들이 모두 동일한 로직을 사용합니다:

1. ✅ `app/(student)/actions/calculateScheduleAvailability.ts` (수정 완료)
2. ✅ `app/(student)/actions/plan-groups/queries.ts` (이미 반영됨)
3. ✅ `app/(student)/actions/plan-groups/plans.ts` (이미 반영됨)
4. ✅ `app/(student)/camp/[invitationId]/page.tsx` (이미 반영됨)

## ✅ 검증 완료

- [x] 새로운 연결 테이블 방식으로 블록세트 조회
- [x] 하위 호환성 처리 (마이그레이션 전 데이터 지원)
- [x] 다른 파일들과 로직 일관성 확보
- [x] 린터 오류 없음

