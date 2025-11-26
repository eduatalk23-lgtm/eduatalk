# 캠프 템플릿 제출 시 학생 추가 콘텐츠 저장 정보

## 개요

학생이 캠프 템플릿을 작성하고 제출할 때, 학생이 추가한 콘텐츠에 대한 정보가 어디까지 저장되는지 정리합니다.

## 저장 흐름

### 1. 제출 단계 (`submitCampParticipation`)

```225:225:app/(student)/actions/campActions.ts
      student_contents: wizardData.student_contents || [],
```

학생이 입력한 `student_contents`가 그대로 `mergedData`에 포함됩니다.

### 2. 데이터 변환 (`syncWizardDataToCreationData`)

```58:101:lib/utils/planGroupDataSync.ts
    // 3. 콘텐츠 데이터 검증 및 변환
    const allContents = [
      ...wizardData.student_contents,
      ...wizardData.recommended_contents,
    ];

    // 중복 콘텐츠 검증
    const contentKeys = new Set<string>();
    const duplicateContents: string[] = [];

    allContents.forEach((content, index) => {
      const key = `${content.content_type}:${content.content_id}`;
      if (contentKeys.has(key)) {
        duplicateContents.push(`콘텐츠 ${index + 1}`);
      }
      contentKeys.add(key);
    });

    if (duplicateContents.length > 0) {
      throw new PlanGroupError(
        `중복된 콘텐츠가 있습니다: ${duplicateContents.join(', ')}`,
        PlanGroupErrorCodes.DATA_INCONSISTENCY,
        '중복된 콘텐츠가 선택되었습니다. 확인해주세요.',
        true
      );
    }

    // 4. PlanGroupCreationData 구성
    const creationData: PlanGroupCreationData = {
      name: wizardData.name || null,
      plan_purpose: wizardData.plan_purpose as any,
      scheduler_type: wizardData.scheduler_type as any,
      scheduler_options:
        Object.keys(schedulerOptions).length > 0 ? schedulerOptions : null,
      period_start: wizardData.period_start,
      period_end: wizardData.period_end,
      target_date: wizardData.target_date || null,
      block_set_id: wizardData.block_set_id || null,
      contents: allContents.map((c, idx) => ({
        content_type: c.content_type,
        content_id: c.content_id,
        start_range: c.start_range,
        end_range: c.end_range,
        display_order: idx,
      })),
```

학생 콘텐츠와 추천 콘텐츠를 합쳐서 `contents` 배열로 변환합니다. 각 콘텐츠는 다음 정보만 포함됩니다:

- `content_type`: 콘텐츠 유형 (book, lecture, custom)
- `content_id`: 콘텐츠 ID
- `start_range`: 시작 범위 (페이지/회차)
- `end_range`: 종료 범위 (페이지/회차)
- `display_order`: 표시 순서

### 3. 데이터베이스 저장 (`createPlanContents`)

```628:701:lib/data/planGroups.ts
export async function createPlanContents(
  groupId: string,
  tenantId: string,
  contents: Array<{
    content_type: string;
    content_id: string;
    start_range: number;
    end_range: number;
    display_order?: number;
    // 자동 추천 관련 필드 (선택)
    is_auto_recommended?: boolean;
    recommendation_source?: "auto" | "admin" | "template" | null;
    recommendation_reason?: string | null;
    recommendation_metadata?: {
      scoreDetails?: {
        schoolGrade?: number | null;
        schoolAverageGrade?: number | null;
        mockPercentile?: number | null;
        mockGrade?: number | null;
        riskScore?: number;
      };
      priority?: number;
    } | null;
    recommended_at?: string | null;
    recommended_by?: string | null;
  }>
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient();

  if (contents.length === 0) {
    return { success: true };
  }

  const payload = contents.map((content, index) => ({
    tenant_id: tenantId,
    plan_group_id: groupId,
    content_type: content.content_type,
    content_id: content.content_id,
    start_range: content.start_range,
    end_range: content.end_range,
    display_order: content.display_order ?? index,
    // 자동 추천 관련 필드
    is_auto_recommended: content.is_auto_recommended ?? false,
    recommendation_source: content.recommendation_source ?? null,
    recommendation_reason: content.recommendation_reason ?? null,
    recommendation_metadata: content.recommendation_metadata ?? null,
    recommended_at: content.recommended_at ?? null,
    recommended_by: content.recommended_by ?? null,
  }));

  let { error } = await supabase.from("plan_contents").insert(payload);

  if (error && error.code === "42703") {
    // 필드가 없는 경우 fallback (하위 호환성)
    const fallbackPayload = payload.map(({
      tenant_id: _tenantId,
      is_auto_recommended: _isAuto,
      recommendation_source: _source,
      recommendation_reason: _reason,
      recommendation_metadata: _metadata,
      recommended_at: _at,
      recommended_by: _by,
      ...rest
    }) => rest);
    ({ error } = await supabase.from("plan_contents").insert(fallbackPayload));
  }

  if (error) {
    console.error("[data/planGroups] 플랜 콘텐츠 생성 실패", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
```

## 저장되는 정보

### `plan_contents` 테이블에 저장되는 필드

학생 추가 콘텐츠는 다음 정보만 저장됩니다:

#### 기본 필드

- `tenant_id`: 테넌트 ID
- `plan_group_id`: 플랜 그룹 ID
- `content_type`: 콘텐츠 유형 (`book`, `lecture`, `custom`)
- `content_id`: 콘텐츠 ID (실제 콘텐츠 테이블의 `id`)
- `start_range`: 시작 범위 (페이지 번호 또는 회차)
- `end_range`: 종료 범위 (페이지 번호 또는 회차)
- `display_order`: 표시 순서

#### 자동 추천 관련 필드 (학생 추가 콘텐츠의 경우 대부분 null)

- `is_auto_recommended`: 자동 추천 여부 (기본값: `false`)
- `recommendation_source`: 추천 출처 (`auto`, `admin`, `template`, `null`)
- `recommendation_reason`: 추천 이유
- `recommendation_metadata`: 추천 메타데이터 (JSONB)
- `recommended_at`: 추천 시점
- `recommended_by`: 추천 생성자

## 저장되지 않는 정보

다음 정보는 **저장되지 않습니다**:

### 콘텐츠 상세 정보

- 콘텐츠 제목 (`title`)
- 과목 카테고리 (`subject_category`)
- 과목 (`subject`)
- 학년 (`grade`)
- 학기 (`semester`)
- 개정교육과정 (`revision`)
- 플랫폼 (`platform`)
- 총 페이지 수 / 총 회차 수
- 기타 메타데이터

### 이유

- 콘텐츠 상세 정보는 각 테이블(`books`, `lectures`, `student_custom_contents`)에서 조회해야 합니다
- `plan_contents` 테이블은 **참조 관계**만 저장하며, 실제 콘텐츠 정보는 별도 테이블에서 관리합니다
- 이렇게 하면 콘텐츠 정보가 변경되어도 `plan_contents`를 수정할 필요가 없습니다

## 콘텐츠 정보 조회 방법

### 1. `plan_contents`에서 콘텐츠 ID 조회

```typescript
const { data: planContents } = await supabase
  .from("plan_contents")
  .select("*")
  .eq("plan_group_id", groupId);
```

### 2. 각 콘텐츠 테이블에서 상세 정보 조회

```typescript
// 책인 경우
const { data: book } = await supabase
  .from("books")
  .select("*")
  .eq("id", contentId)
  .eq("student_id", studentId)
  .single();

// 강의인 경우
const { data: lecture } = await supabase
  .from("lectures")
  .select("*")
  .eq("id", contentId)
  .eq("student_id", studentId)
  .single();

// 커스텀 콘텐츠인 경우
const { data: customContent } = await supabase
  .from("student_custom_contents")
  .select("*")
  .eq("id", contentId)
  .eq("student_id", studentId)
  .single();
```

### 3. 통합 조회 함수 사용

```160:163:lib/data/planContents.ts
export async function classifyPlanContents(
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
```

`classifyPlanContents` 함수를 사용하면 학생 콘텐츠와 추천 콘텐츠를 자동으로 분류하고 상세 정보를 조회할 수 있습니다.

## 요약

### 저장되는 정보

✅ 콘텐츠 ID (`content_id`)
✅ 콘텐츠 유형 (`content_type`)
✅ 학습 범위 (`start_range`, `end_range`)
✅ 표시 순서 (`display_order`)
✅ 플랜 그룹 참조 (`plan_group_id`)

### 저장되지 않는 정보

❌ 콘텐츠 제목, 과목, 학년 등 상세 정보
❌ 콘텐츠 메타데이터

### 조회 방법

- `plan_contents` 테이블에서 콘텐츠 ID 조회
- 각 콘텐츠 테이블(`books`, `lectures`, `student_custom_contents`)에서 상세 정보 조회
- `classifyPlanContents` 함수 사용 (권장)

## 참고

- `plan_contents` 테이블은 **참조 관계**만 저장하는 중간 테이블입니다
- 실제 콘텐츠 정보는 정규화된 구조로 각 테이블에서 관리됩니다
- 이 구조는 데이터 일관성과 유지보수성을 보장합니다
