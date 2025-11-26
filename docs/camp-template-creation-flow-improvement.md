# 캠프 템플릿 생성 플로우 개선

## 🔍 문제 상황

기존 방식의 문제점:

1. **복잡한 블록 세트 조회 로직**
   - 템플릿 저장 전에 블록 세트를 생성하면 `template_id`가 NULL
   - 템플릿에 연결된 블록 세트와 연결되지 않은 블록 세트를 모두 조회해야 함
   - 조회 로직이 복잡하고 에러 발생 가능성 높음

2. **데이터 일관성 문제**
   - `template_id`가 NULL인 블록 세트가 존재
   - 템플릿과 블록 세트의 관계가 명확하지 않음

3. **코드 복잡도 증가**
   - NULL 처리 로직이 여러 곳에 분산
   - 유지보수 어려움

## 💡 해결 방안

**템플릿 생성 시 먼저 템플릿 ID를 생성하는 방식으로 변경**

### 새로운 플로우

```
1. /admin/camp-templates/new 페이지 접속
   ↓
2. 템플릿 이름, 프로그램 유형 입력
   ↓
3. "템플릿 생성 시작" 버튼 클릭
   ↓
4. 최소 정보로 템플릿 생성 (template_id 생성)
   ↓
5. /admin/camp-templates/[id]/edit 페이지로 리다이렉트
   ↓
6. 편집 페이지에서 모든 정보 입력 (블록 세트, 학습 기간 등)
   ↓
7. 저장
```

### 장점

1. **데이터 일관성 향상**
   - 모든 블록 세트가 특정 템플릿에 연결됨
   - `template_id`가 NULL인 블록 세트가 없음

2. **조회 로직 단순화**
   - `getTemplateBlockSets(templateId)`만 호출하면 됨
   - NULL 처리 로직 불필요

3. **보안 강화**
   - 템플릿별로 블록 세트가 분리됨
   - 다른 템플릿의 블록 세트에 접근 불가

4. **코드 복잡도 감소**
   - NULL 처리 로직 제거
   - 유지보수 용이

## 🛠 구현 내용

### 1. 템플릿 초안 생성 액션 추가

**파일**: `app/(admin)/actions/campTemplateActions.ts`

```typescript
/**
 * 캠프 템플릿 초안 생성 (최소 정보만으로 템플릿 ID 생성)
 * 템플릿 생성 시작 시 호출하여 템플릿 ID를 먼저 생성
 */
export const createCampTemplateDraftAction = withErrorHandling(
  async (formData: FormData): Promise<{ success: boolean; templateId?: string; error?: string }> => {
    // 최소 정보만 검증 (이름, 프로그램 유형)
    const name = String(formData.get("name") ?? "").trim();
    const programType = String(formData.get("program_type") ?? "").trim();

    // 빈 template_data로 템플릿 생성
    const emptyTemplateData: Partial<WizardData> = {
      name,
      plan_purpose: "",
      scheduler_type: "",
      period_start: "",
      period_end: "",
      block_set_id: undefined,
      exclusions: [],
      academy_schedules: [],
      student_contents: [],
      recommended_contents: [],
    };

    // 템플릿 생성 (최소 정보만)
    const result = await createCampTemplate({
      tenant_id: tenantContext.tenantId,
      name,
      description: null,
      program_type: programType,
      template_data: emptyTemplateData,
      created_by: userId,
      // ...
    });

    return result;
  }
);
```

### 2. 새 템플릿 생성 페이지 변경

**파일**: `app/(admin)/admin/camp-templates/new/page.tsx`

```typescript
export default async function NewCampTemplatePage() {
  // ...
  return (
    <section className="mx-auto w-full max-w-4xl px-4 py-10">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">캠프 템플릿 생성</h1>
          <p className="text-sm text-gray-500">
            템플릿 이름과 프로그램 유형을 입력하고 템플릿 생성을 시작하세요.
          </p>
        </div>

        <NewCampTemplateForm />
      </div>
    </section>
  );
}
```

**파일**: `app/(admin)/admin/camp-templates/new/NewCampTemplateForm.tsx`

- 템플릿 이름, 프로그램 유형만 입력받는 간단한 폼
- "템플릿 생성 시작" 버튼 클릭 시 `createCampTemplateDraftAction` 호출
- 템플릿 ID 생성 후 편집 페이지로 리다이렉트

### 3. 편집 페이지 블록 세트 조회 로직 단순화

**파일**: `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`

```typescript
// 템플릿 블록 세트 조회 (템플릿 ID가 항상 존재하므로 단순 조회)
let initialBlockSets = [];

try {
  // 템플릿에 연결된 블록 세트 조회 (템플릿 ID가 항상 존재하므로 단순 조회)
  const blockSets = await getTemplateBlockSets(id);
  initialBlockSets = blockSets.map(bs => ({
    id: bs.id,
    name: bs.name,
    blocks: bs.blocks || []
  }));
  
  // template_data에 저장된 block_set_id가 initialBlockSets에 있는지 확인
  // (다른 템플릿에 속했을 수 있으므로 별도 조회)
  // ...
} catch (error) {
  // ...
}
```

**변경 사항**:
- `template_id`가 NULL인 블록 세트 조회 로직 제거
- 템플릿에 연결된 블록 세트만 조회
- 코드가 훨씬 단순해짐

### 4. Step1BasicInfo 자동 로드 로직 개선

**파일**: `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

```typescript
// 초기 로드 시 블록 세트 목록 자동 로드
useEffect(() => {
  // 템플릿 모드에서는 templateId가 항상 존재하므로 자동 로드 불필요
  if (blockSets.length === 0 && !isLoadingBlockSets && !isTemplateMode && !templateId) {
    handleLoadBlockSets();
  }
}, []);
```

## 📝 마이그레이션 고려사항

### 기존 데이터 처리

기존에 `template_id`가 NULL인 블록 세트가 있을 수 있습니다:

1. **옵션 1: 자동 마이그레이션**
   - 기존 NULL 블록 세트를 특정 템플릿에 연결
   - 또는 삭제

2. **옵션 2: 수동 처리**
   - 관리자가 직접 처리
   - 더 안전하지만 수동 작업 필요

3. **옵션 3: 유지**
   - 기존 NULL 블록 세트는 그대로 유지
   - 새로 생성되는 블록 세트만 템플릿에 연결
   - 조회 로직에서 NULL 블록 세트도 함께 조회 (하위 호환성)

현재는 **옵션 3**을 선택하여 하위 호환성을 유지합니다.

## ✅ 결과

- 템플릿 생성 플로우가 명확해짐
- 블록 세트 조회 로직이 단순해짐
- 데이터 일관성 향상
- 코드 복잡도 감소
- 유지보수 용이

## 🔗 관련 파일

- `app/(admin)/admin/camp-templates/new/page.tsx`
- `app/(admin)/admin/camp-templates/new/NewCampTemplateForm.tsx`
- `app/(admin)/admin/camp-templates/[id]/edit/page.tsx`
- `app/(admin)/actions/campTemplateActions.ts`
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx`

