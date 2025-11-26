# 캠프 템플릿 제출 후 시간블록 표시 개선

## 🔍 문제 상황

캠프 템플릿 제출 후, 학생의 제출 템플릿 상세보기에서 시간블록이 표시되지 않는 문제가 있었습니다.

### 원인 분석

1. **템플릿 블록 세트 ID 조회 경로 부족**

   - `template_data.block_set_id`에서만 조회 시도
   - `campActions.ts`에서 템플릿 블록 세트 ID를 `scheduler_options.template_block_set_id`에 저장하는데, 이 경로를 확인하지 않음

2. **템플릿 블록 세트 조회 조건 문제**

   - `template_block_sets` 조회 시 `template_id` 조건을 함께 사용하여, 일부 경우 조회 실패 가능

3. **에러 처리 및 디버깅 로그 부족**
   - 템플릿 블록 조회 실패 시 원인 파악이 어려움

## 🛠 해결 방법

### 수정 내용

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

#### 1. 템플릿 블록 세트 ID 조회 경로 확장

템플릿 블록 세트 ID를 다음 두 경로에서 확인하도록 개선:

```typescript
// 1. template_data에서 block_set_id 확인
if (templateData?.block_set_id) {
  blockSetId = templateData.block_set_id;
}

// 2. scheduler_options에서 template_block_set_id 확인 (campActions.ts에서 저장한 경로)
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

#### 2. 템플릿 블록 세트 조회 로직 개선

- `template_id` 조건을 제거하고 `block_set_id`만으로 조회
- 조회 후 `template_id` 일치 여부를 보안 검증으로 확인

```typescript
// 템플릿 블록 세트 조회 (template_id 조건 제거 - block_set_id만으로 조회)
const { data: templateBlockSet, error: blockSetError } = await supabase
  .from("template_block_sets")
  .select("id, name")
  .eq("id", blockSetId)
  .maybeSingle();

// template_id 일치 확인 (보안 검증)
if (templateBlockSet.template_id !== group.camp_template_id) {
  console.warn("[CampSubmissionDetailPage] 템플릿 ID 불일치");
} else {
  // 정상 처리
}
```

#### 3. 에러 처리 및 디버깅 로그 추가

- `template_data` 파싱 에러 처리
- `scheduler_options` 파싱 에러 처리
- 각 단계별 상세 로그 추가
- 블록 조회 성공/실패 로그 추가

```typescript
// template_data 파싱 에러 처리
try {
  templateData = JSON.parse(template.template_data);
} catch (parseError) {
  console.error(
    "[CampSubmissionDetailPage] template_data 파싱 에러:",
    parseError
  );
  templateData = null;
}

// 블록 조회 성공 로그
console.log("[CampSubmissionDetailPage] 템플릿 블록 조회 성공:", {
  count: templateBlocks.length,
  blocks: templateBlocks,
});
```

## 📋 변경 사항 요약

1. **템플릿 블록 세트 ID 조회 경로 확장**

   - `template_data.block_set_id` 확인
   - `scheduler_options.template_block_set_id` 확인 (추가)

2. **템플릿 블록 세트 조회 로직 개선**

   - `template_id` 조건 제거 (조회 시)
   - 조회 후 `template_id` 일치 여부 검증 (보안)

3. **에러 처리 강화**
   - JSON 파싱 에러 처리
   - 각 단계별 상세 로그 추가
   - 디버깅 정보 개선

## ✅ 테스트 시나리오

1. **정상 케이스**: `template_data.block_set_id`에 값이 있는 경우
2. **대체 케이스**: `scheduler_options.template_block_set_id`에만 값이 있는 경우
3. **에러 케이스**: 두 경로 모두 값이 없는 경우
4. **보안 검증**: `template_id` 불일치 케이스

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 수정된 파일
- `app/(student)/actions/campActions.ts` - 템플릿 블록 세트 ID 저장 로직 참고
- `app/(student)/plan/group/[id]/_components/Step2DetailView.tsx` - 템플릿 블록 표시 컴포넌트

## 📝 참고 사항

- `campActions.ts`의 `submitCampParticipation` 함수에서 템플릿 블록 세트 ID를 `scheduler_options.template_block_set_id`에 저장함
- 템플릿 블록 세트는 `template_block_sets` 테이블에 저장되며, `template_id`로 템플릿과 연결됨
- 템플릿 블록은 `template_blocks` 테이블에 저장되며, `template_block_set_id`로 블록 세트와 연결됨
