# 캠프 모드 학생 상세보기 템플릿 블록 조회 개선

## 🔍 문제 상황

캠프 템플릿 제출 후 학생의 플랜 그룹 상세보기 페이지(`/plan/group/[id]`)에서 블록 및 제외일 섹션에 "블록 세트가 설정되지 않았습니다" 메시지가 표시되는 문제가 있었습니다.

### 원인 분석

1. **템플릿 블록 조회 로직 부재**
   - `app/(student)/plan/group/[id]/page.tsx`에서 캠프 모드일 때 템플릿 블록 정보를 조회하지 않음
   - `camp/[invitationId]/submitted/page.tsx`에는 조회 로직이 있지만, 일반 플랜 그룹 상세보기에는 없음

2. **조회 우선순위 문제**
   - `template_data.block_set_id`를 먼저 확인하고 있었음
   - 실제 저장된 값인 `scheduler_options.template_block_set_id`를 먼저 확인해야 함

## 🛠 해결 방법

### 1. 템플릿 블록 조회 로직 추가

**파일**: `app/(student)/plan/group/[id]/page.tsx`

캠프 모드(`plan_type === "camp"`)이고 `camp_template_id`가 있을 때 템플릿 블록 정보를 조회하도록 추가:

```typescript
// 캠프 모드일 때 템플릿 블록 세트 정보 조회
let templateBlocks: Array<{
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}> = [];
let templateBlockSetName: string | null = null;

if (isCampMode && group.camp_template_id) {
  // 템플릿 조회 및 블록 정보 조회 로직
  // ...
}
```

### 2. 조회 우선순위 개선

**변경 전**:
1. `template_data.block_set_id` 확인 (우선)
2. `scheduler_options.template_block_set_id` 확인 (fallback)

**변경 후**:
1. `scheduler_options.template_block_set_id` 확인 (우선) - 실제 저장된 값
2. `template_data.block_set_id` 확인 (fallback) - 템플릿 원본

### 3. 두 파일 간 일관성 확보

`app/(student)/plan/group/[id]/page.tsx`와 `app/(student)/camp/[invitationId]/submitted/page.tsx`의 템플릿 블록 조회 로직을 동일하게 맞춤:

- 조회 우선순위 통일
- 에러 처리 로직 통일
- 기본값 블록 사용 로직 통일
- 로그 메시지 일관성 유지

## 📋 변경 사항 요약

### `app/(student)/plan/group/[id]/page.tsx`

1. **템플릿 블록 조회 로직 추가**
   - 캠프 모드일 때 템플릿 조회
   - 템플릿 블록 세트 및 블록 조회
   - 기본값 블록 fallback 처리

2. **조회 우선순위 개선**
   - `scheduler_options.template_block_set_id` 우선 확인
   - `template_data.block_set_id` fallback

3. **Props 전달**
   - `PlanGroupDetailView`에 `templateBlocks`와 `templateBlockSetName` 전달

### `app/(student)/camp/[invitationId]/submitted/page.tsx`

1. **조회 우선순위 개선**
   - `scheduler_options.template_block_set_id` 우선 확인
   - `template_data.block_set_id` fallback

## ✅ 검증 체크리스트

- [x] 캠프 모드 플랜 그룹 상세보기에서 템플릿 블록 조회 확인
- [x] `scheduler_options.template_block_set_id` 우선 조회 확인
- [x] `template_data.block_set_id` fallback 확인
- [x] 기본값 블록 fallback 확인
- [x] 두 파일 간 로직 일관성 확인
- [x] 에러 처리 로직 확인

## 🔗 관련 파일

- `app/(student)/plan/group/[id]/page.tsx` - 플랜 그룹 상세보기 페이지
- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 캠프 제출 상세보기 페이지
- `app/(student)/plan/group/[id]/_components/Step2DetailView.tsx` - 블록 표시 컴포넌트
- `app/(student)/actions/campActions.ts` - 템플릿 블록 세트 ID 저장 로직

## 📝 참고 사항

- `campActions.ts`의 `submitCampParticipation` 함수에서 템플릿 블록 세트 ID를 `scheduler_options.template_block_set_id`에 저장함
- 템플릿 블록 세트는 `template_block_sets` 테이블에 저장되며, `template_id`로 템플릿과 연결됨
- 템플릿 블록은 `template_blocks` 테이블에 저장되며, `template_block_set_id`로 블록 세트와 연결됨
- 캠프 모드에서는 `plan_groups.block_set_id`가 `null`로 설정되므로, 템플릿 블록 정보는 `scheduler_options`에서 조회해야 함

## 날짜

2024-11-24

