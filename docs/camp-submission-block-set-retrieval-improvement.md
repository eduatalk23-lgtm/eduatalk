# 캠프 템플릿 제출 상세보기 블록 세트 조회 로직 개선

## 🔍 점검 결과

### 현재 로직 분석

**파일**: `app/(student)/camp/[invitationId]/submitted/page.tsx`

1. **블록 세트 ID 조회 우선순위** ✅ 올바름
   - `scheduler_options.template_block_set_id` 우선 확인 (실제 저장된 값)
   - `template_data.block_set_id` fallback 확인 (템플릿 원본)

2. **템플릿 블록 세트 조회** ✅ 올바름
   - 캠프 모드에서는 항상 템플릿 블록 세트를 조회하는 것이 맞음
   - 학생이 선택한 블록도 템플릿 블록 세트 중 하나 (학생 블록 세트가 아님)

3. **템플릿 ID 검증** ⚠️ 개선 필요
   - 조회 후 검증하는 방식 → 조회 쿼리에 포함하는 것이 더 안전

## 🛠 개선 사항

### 1. 템플릿 ID 검증을 조회 쿼리에 포함

**변경 전**:
```typescript
// 템플릿 블록 세트 조회 (template_id 조건 제거 - block_set_id만으로 조회)
const { data: templateBlockSet } = await supabase
  .from("template_block_sets")
  .select("id, name, template_id")
  .eq("id", blockSetId)
  .maybeSingle();

// 조회 후 template_id 검증
if (templateBlockSet.template_id !== group.camp_template_id) {
  console.warn("템플릿 ID 불일치");
}
```

**변경 후**:
```typescript
// 템플릿 블록 세트 조회 (template_id 검증 포함)
const { data: templateBlockSet } = await supabase
  .from("template_block_sets")
  .select("id, name, template_id")
  .eq("id", blockSetId)
  .eq("template_id", group.camp_template_id)
  .maybeSingle();
```

### 2. 에러 처리 및 로깅 개선

- 에러 발생 시 더 상세한 컨텍스트 정보 포함
- 블록 조회 실패 시 블록 세트 정보 포함
- 템플릿 블록 세트를 찾을 수 없을 때 명확한 메시지

## 📋 변경 사항 요약

### `app/(student)/camp/[invitationId]/submitted/page.tsx`

1. **템플릿 ID 검증 개선**
   - 조회 쿼리에 `template_id` 조건 추가
   - 조회 후 검증 단계 제거 (쿼리 레벨에서 처리)

2. **에러 처리 개선**
   - 에러 로그에 컨텍스트 정보 추가 (block_set_id, template_id 등)
   - 경고 메시지에 더 명확한 설명 추가

3. **로깅 개선**
   - 성공 로그에 template_id 포함
   - 블록 조회 실패 시 block_set_name 포함

## ✅ 검증 체크리스트

- [x] 템플릿 블록 세트 조회 로직 확인
- [x] 템플릿 ID 검증 로직 개선
- [x] 에러 처리 개선
- [x] 로깅 개선
- [x] 캠프 템플릿 블록 세트 조회가 올바른지 확인

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/submitted/page.tsx` - 학생 제출 템플릿 상세보기 페이지
- `app/(student)/actions/campActions.ts` - 템플릿 블록 세트 ID 저장 로직

## 📝 참고 사항

### 캠프 모드에서 템플릿 블록 세트를 조회하는 것이 맞는 이유

1. **캠프 모드의 특성**
   - 캠프 모드에서는 항상 템플릿 블록 세트를 사용
   - 학생이 선택한 블록도 템플릿 블록 세트 중 하나
   - 학생의 개인 블록 세트(`student_block_sets`)는 사용하지 않음

2. **데이터 저장 구조**
   - `plan_groups.block_set_id`는 `null`로 설정 (캠프 모드)
   - `scheduler_options.template_block_set_id`에 템플릿 블록 세트 ID 저장
   - 템플릿 블록 세트는 `template_block_sets` 테이블에 저장

3. **조회 경로**
   - `scheduler_options.template_block_set_id` 우선 확인 (실제 저장된 값)
   - `template_data.block_set_id` fallback 확인 (템플릿 원본)

## 날짜

2024-11-24

