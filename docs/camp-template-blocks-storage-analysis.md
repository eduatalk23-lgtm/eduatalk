# 캠프 템플릿 시간 블록 저장 및 조회 경로 분석

## 🔍 문제 상황

템플릿 작성 시에는 블록이 선택 및 표시되지만, 학생의 제출 템플릿 상세보기에서는 시간 블록이 없다고 나오는 문제가 발생했습니다.

## 📊 데이터 흐름 분석

### 1. 템플릿 작성 시 (학생 입력)

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

1. **템플릿 데이터 로드** (line 123-293)
   - 템플릿의 `template_data.block_set_id`를 읽어옴
   - 템플릿 블록 세트를 조회하여 `blockSets` 목록에 추가
   - `initialData.block_set_id`에 템플릿의 `block_set_id` 설정

```typescript
// 템플릿 블록 세트 조회 및 블록 목록에 추가
if (templateData.block_set_id) {
  const { data: templateBlockSetData } = await supabase
    .from("template_block_sets")
    .select("id, name")
    .eq("id", templateData.block_set_id)
    .eq("template_id", template.id)
    .single();
  
  // 템플릿 블록 조회
  const { data: templateBlocks } = await supabase
    .from("template_blocks")
    .select("id, day_of_week, start_time, end_time")
    .eq("template_block_set_id", templateData.block_set_id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
}

// initialData에 block_set_id 설정
block_set_id: draftData?.block_set_id || templateData.block_set_id || "",
```

2. **학생이 블록 선택**
   - `PlanGroupWizard`에서 학생이 블록 세트를 선택
   - `wizardData.block_set_id`에 선택한 블록 세트 ID 저장

### 2. 템플릿 제출 시 (저장)

**파일**: `app/(student)/actions/campActions.ts`

1. **데이터 병합** (line 208-245)
   - 템플릿 기본값 + 학생 입력값 병합
   - `mergedData.block_set_id`에 `wizardData.block_set_id || templateData.block_set_id` 설정

```typescript
const mergedData: Partial<WizardData> = {
  ...templateData,
  block_set_id: wizardData.block_set_id || templateData.block_set_id || "",
  // ... 기타 필드
};
```

2. **플랜 그룹 생성 데이터 변환** (line 248-251)
   - `syncWizardDataToCreationData`로 변환
   - `creationData` 생성

3. **캠프 모드 특수 처리** (line 253-264)
   - `creationData.block_set_id = null` 설정
     - 이유: 캠프 모드에서는 `template_block_sets` 테이블의 ID를 사용하므로
     - `plan_groups.block_set_id`는 `student_block_sets` 참조이므로 저장 불가
   
   - **템플릿 블록 세트 ID를 `scheduler_options`에 저장**
     - ⚠️ **문제점**: `templateData.block_set_id`만 확인하고 있음
     - `wizardData.block_set_id`는 확인하지 않음

```typescript
// 캠프 모드에서는 block_set_id를 null로 설정
creationData.block_set_id = null;

// 템플릿 블록 세트 ID를 scheduler_options에 저장
if (templateData.block_set_id) {  // ⚠️ wizardData.block_set_id는 확인하지 않음
  if (!creationData.scheduler_options) {
    creationData.scheduler_options = {};
  }
  (creationData.scheduler_options as any).template_block_set_id = templateData.block_set_id;
}
```

### 3. 제출 템플릿 상세보기 (조회)

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

1. **템플릿 블록 세트 ID 조회** (line 171-197)
   - 두 경로에서 확인:
     1. `template_data.block_set_id` (우선)
     2. `scheduler_options.template_block_set_id` (fallback)

```typescript
// block_set_id 찾기: template_data에서 먼저 확인, 없으면 scheduler_options에서 확인
let blockSetId: string | null = null;

// 1. template_data에서 block_set_id 확인
if (templateData?.block_set_id) {
  blockSetId = templateData.block_set_id;
}

// 2. scheduler_options에서 template_block_set_id 확인
if (!blockSetId && group.scheduler_options) {
  let schedulerOptions: any = null;
  if (typeof group.scheduler_options === "string") {
    schedulerOptions = JSON.parse(group.scheduler_options);
  } else {
    schedulerOptions = group.scheduler_options;
  }
  
  if (schedulerOptions?.template_block_set_id) {
    blockSetId = schedulerOptions.template_block_set_id;
  }
}
```

2. **템플릿 블록 조회** (line 199-250)
   - `blockSetId`로 `template_block_sets` 조회
   - `template_blocks` 조회하여 블록 목록 생성

## 🐛 문제점 분석

### 문제 1: 저장 시 `wizardData.block_set_id` 미반영

**현재 코드** (`campActions.ts` line 259):
```typescript
if (templateData.block_set_id) {  // templateData만 확인
  (creationData.scheduler_options as any).template_block_set_id = templateData.block_set_id;
}
```

**문제**:
- 학생이 템플릿 작성 시 블록을 선택했다면 `wizardData.block_set_id`에 그 값이 들어있음
- 하지만 저장 시에는 `templateData.block_set_id`만 확인
- `mergedData.block_set_id`에는 `wizardData.block_set_id || templateData.block_set_id`가 들어있지만, 저장 시에는 사용하지 않음

**해결 방법**:
- `mergedData.block_set_id` 또는 `wizardData.block_set_id || templateData.block_set_id`를 사용해야 함

### 문제 2: 조회 경로 불일치 가능성

**저장 경로**: `scheduler_options.template_block_set_id`
**조회 경로**: 
1. `template_data.block_set_id` (우선)
2. `scheduler_options.template_block_set_id` (fallback)

**문제**:
- 저장 시 `templateData.block_set_id`만 저장하면, 조회 시 `template_data.block_set_id`에서 먼저 찾으므로 일치함
- 하지만 학생이 다른 블록을 선택했다면, 저장되지 않아 조회 시 문제 발생

## ✅ 해결 방안

### 수정 1: 저장 시 `mergedData.block_set_id` 사용 ✅ 완료

**파일**: `app/(student)/actions/campActions.ts`

**수정 전**:
```typescript
// 템플릿 블록 세트 ID를 scheduler_options에 저장
if (templateData.block_set_id) {  // templateData만 확인
  if (!creationData.scheduler_options) {
    creationData.scheduler_options = {};
  }
  (creationData.scheduler_options as any).template_block_set_id = templateData.block_set_id;
}
```

**수정 후**:
```typescript
// 템플릿 블록 세트 ID를 scheduler_options에 저장
// mergedData.block_set_id 사용 (wizardData.block_set_id || templateData.block_set_id)
// 학생이 블록을 선택했다면 wizardData.block_set_id가 우선적으로 사용됨
const blockSetId = mergedData.block_set_id || templateData.block_set_id;
if (blockSetId) {
  if (!creationData.scheduler_options) {
    creationData.scheduler_options = {};
  }
  (creationData.scheduler_options as any).template_block_set_id = blockSetId;
}
```

**변경 사항**:
- `templateData.block_set_id`만 확인하던 것을 `mergedData.block_set_id || templateData.block_set_id`로 변경
- 학생이 블록을 선택한 경우 `wizardData.block_set_id`가 우선적으로 저장됨
- 템플릿 원본 블록 세트 ID는 fallback으로 사용

### 수정 2: 조회 경로 우선순위 조정 (선택사항)

현재 조회 경로는 이미 올바르게 설정되어 있음:
1. `template_data.block_set_id` (템플릿 원본)
2. `scheduler_options.template_block_set_id` (실제 저장된 값)

하지만 저장 시 `mergedData.block_set_id`를 사용하면, 조회 시 `scheduler_options.template_block_set_id`에서 항상 찾을 수 있음.

## 📋 검증 체크리스트

- [ ] 템플릿 작성 시 블록 선택 확인
- [ ] 제출 시 `scheduler_options.template_block_set_id`에 올바른 값 저장 확인
- [ ] 제출 템플릿 상세보기에서 블록 조회 확인
- [ ] 학생이 다른 블록을 선택한 경우 처리 확인

## 🔗 관련 파일

- `app/(student)/actions/campActions.ts` - 템플릿 제출 시 저장 로직
- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 제출 템플릿 상세보기 조회 로직
- `app/(student)/camp/[invitationId]/page.tsx` - 템플릿 작성 페이지

## 📝 참고 사항

- 캠프 모드에서는 `template_block_sets` 테이블의 블록 세트를 사용
- `plan_groups.block_set_id`는 `student_block_sets` 참조이므로 캠프 모드에서는 null
- 템플릿 블록 세트 ID는 `scheduler_options.template_block_set_id`에 저장됨
- 템플릿 블록은 `template_blocks` 테이블에 저장됨

