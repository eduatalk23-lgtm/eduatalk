# 캠프 템플릿 블록 세트 조회 오류 수정

## 🔍 문제 상황

학생 페이지에서 캠프 템플릿 입력 중 아래 오류가 발생했습니다:

```
[CampParticipationPage] 템플릿 데이터 검증: {period_start: '2025-11-28', period_end: '2025-12-26', block_set_id: 'b8e5b308-41c9-44c4-9b7d-975974cfa68f', ...}

[CampParticipationPage] 블록 세트 목록: {templateBlockSet: null, studentBlockSetsCount: 1, totalBlockSetsCount: 1, templateBlockSetId: 'b8e5b308-41c9-44c4-9b7d-975974cfa68f', willBeSelected: false}

[Step1BasicInfo] 템플릿 블록 세트를 찾을 수 없습니다: b8e5b308-41c9-44c4-9b7d-975974cfa68f
```

### 원인 분석

1. **데이터베이스 스키마 변경**
   - `template_block_sets` 테이블의 `template_id`가 NULL 허용으로 변경됨 (2025-11-26 마이그레이션)
   - 템플릿 저장 전에도 블록 세트를 생성할 수 있도록 변경됨

2. **조회 쿼리 문제**
   - `app/(student)/camp/[invitationId]/page.tsx`에서 템플릿 블록 세트 조회 시 `.eq("template_id", template.id)` 조건 사용
   - `template_id`가 NULL이거나 다른 템플릿에 속한 블록 세트를 찾지 못함

## 🛠 해결 방법

### 1. 조회 조건 변경

**파일**: `app/(student)/camp/[invitationId]/page.tsx`

**변경 전**:
```typescript
const { data: templateBlockSetData, error: templateBlockSetError } =
  await supabase
    .from("template_block_sets")
    .select("id, name")
    .eq("id", templateData.block_set_id)
    .eq("template_id", template.id)  // ❌ 문제: template_id가 NULL일 수 있음
    .single();
```

**변경 후**:
```typescript
// template_id는 NULL 허용이므로, ID와 tenant_id로만 조회
// 보안을 위해 tenant_id로 필터링
const { data: templateBlockSetData, error: templateBlockSetError } =
  await supabase
    .from("template_block_sets")
    .select("id, name")
    .eq("id", templateData.block_set_id)
    .eq("tenant_id", template.tenant_id)  // ✅ tenant_id로 필터링
    .single();
```

### 2. 디버깅 로그 개선

에러 발생 시 상세 정보를 출력하도록 개선:

```typescript
if (templateBlockSetError || !templateBlockSetData) {
  // 개발 환경에서 상세 로그 출력
  if (process.env.NODE_ENV === "development") {
    console.error("[CampParticipationPage] 템플릿 블록 세트 조회 실패:", {
      block_set_id: templateData.block_set_id,
      template_id: template.id,
      tenant_id: template.tenant_id,
      error: templateBlockSetError,
    });
  }
  validationErrors.push(
    `템플릿의 블록 세트(ID: ${templateData.block_set_id})를 찾을 수 없습니다. 관리자에게 문의해주세요.`
  );
}
```

## ✅ 결과

이제 템플릿 블록 세트가 정상적으로 조회됩니다:

1. **template_id가 NULL인 경우에도 조회 가능**
   - `tenant_id`로 필터링하여 같은 기관의 블록 세트만 조회
   - 보안 유지 (다른 기관의 블록 세트 접근 방지)

2. **템플릿 블록 세트 자동 선택**
   - `blockSets` 목록에 템플릿 블록 세트가 포함됨
   - `willBeSelected: true`로 설정되어 자동 선택됨

3. **Step1BasicInfo에서 정상 표시**
   - 템플릿 블록 세트를 찾을 수 있다는 로그 출력
   - 블록 정보가 정상적으로 표시됨

## 🔗 관련 파일

- `app/(student)/camp/[invitationId]/page.tsx` - 캠프 참여 페이지 (수정됨)
- `app/(student)/plan/new-group/_components/Step1BasicInfo.tsx` - Step1 컴포넌트
- `supabase/migrations/20251127000000_make_template_id_nullable_in_template_block_sets.sql` - 스키마 변경 마이그레이션

## 📝 참고 사항

### 데이터베이스 스키마

`template_block_sets` 테이블:
- `template_id`: NULL 허용 (템플릿 저장 전에도 블록 세트 생성 가능)
- `tenant_id`: NOT NULL (기관별 블록 세트 관리)
- UNIQUE 제약조건:
  - `template_id`가 NULL이 아닐 때: `(template_id, name)` 고유
  - `template_id`가 NULL일 때: `(tenant_id, name)` 고유

### 보안 고려사항

- `tenant_id`로 필터링하여 같은 기관의 블록 세트만 조회
- 다른 기관의 블록 세트에 접근할 수 없도록 보안 유지

## 🧪 테스트 시나리오

### 시나리오 1: template_id가 NULL인 블록 세트
1. 관리자가 템플릿 저장 전에 블록 세트 생성
2. 템플릿 저장 후 블록 세트와 연결
3. 학생이 캠프 참여 시 블록 세트 정상 조회 및 선택

### 시나리오 2: template_id가 설정된 블록 세트
1. 관리자가 템플릿 저장 후 블록 세트 생성
2. 템플릿과 블록 세트 연결
3. 학생이 캠프 참여 시 블록 세트 정상 조회 및 선택

---

**작업 날짜**: 2025년 11월 28일  
**작업자**: AI Assistant

