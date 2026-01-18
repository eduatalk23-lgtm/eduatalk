# 캠프 템플릿 블록 세트 생성: tenant_id 기반으로 변경

## 작업 개요

템플릿 저장 전에도 블록 세트를 생성할 수 있도록, `template_id`를 NULL 허용으로 변경하고 `tenant_id` 기준으로 블록 세트를 생성/관리하도록 개선했습니다.

## 작업 날짜

2025년 11월 26일

## 문제 상황

### 이전 문제점

1. **데이터베이스 스키마 제약**: `template_block_sets` 테이블의 `template_id`가 NOT NULL 제약조건
2. **템플릿 저장 전 블록 세트 생성 불가**: 템플릿을 먼저 저장해야만 블록 세트 생성 가능
3. **학생 페이지와의 불일치**: 학생은 `student_id`가 항상 있어서 언제든 블록 세트 생성 가능

### 에러 발생

```
'null value in column "template_id" of relation "template_block_sets" violates not-null constraint'
```

## 해결 방안

### 1. 데이터베이스 스키마 변경

**마이그레이션 파일**: `supabase/migrations/20251126000000_make_template_id_nullable_in_template_block_sets.sql`

#### 변경 사항

1. **template_id를 NULL 허용으로 변경**

   ```sql
   ALTER TABLE template_block_sets
   ALTER COLUMN template_id DROP NOT NULL;
   ```

2. **UNIQUE 제약조건 재설정**

   - `template_id`가 NULL이 아닐 때: `(template_id, name)` 고유
   - `template_id`가 NULL일 때: `(tenant_id, name)` 고유

   ```sql
   -- 부분 인덱스 사용
   CREATE UNIQUE INDEX idx_template_block_sets_template_name_unique
   ON template_block_sets(template_id, name)
   WHERE template_id IS NOT NULL;

   CREATE UNIQUE INDEX idx_template_block_sets_tenant_name_unique
   ON template_block_sets(tenant_id, name)
   WHERE template_id IS NULL;
   ```

### 2. 코드는 이미 올바르게 구현됨

#### templateBlockSets.ts

- `template_id`가 없을 때 `tenant_id` 기준으로 중복 체크
- NULL 허용으로 처리

```typescript
// 중복 이름 확인 (같은 템플릿 내에서만, 템플릿이 없으면 tenant_id 기준)
const existingSetQuery = supabase
  .from("template_block_sets")
  .select("id")
  .eq("name", name.trim())
  .eq("tenant_id", tenantContext.tenantId);

if (templateIdValue) {
  existingSetQuery.eq("template_id", templateIdValue);
} else {
  existingSetQuery.is("template_id", null);
}
```

#### Step1BasicInfo.tsx

- 템플릿 ID 없이도 블록 세트 생성 가능
- 템플릿 저장 후에도 연결 가능

```typescript
// templateId가 있으면 추가, 없으면 템플릿에 연결되지 않은 블록 세트로 생성
if (templateId) {
  templateFormData.append("template_id", templateId);
}
```

## 사용자 흐름 개선

### 변경 전

1. 템플릿 생성 폼 입력
2. **템플릿 저장 (필수)**
3. 템플릿 편집 페이지로 이동
4. 블록 세트 생성 가능

### 변경 후

1. 템플릿 생성 폼 입력
2. **블록 세트 생성 가능 (템플릿 저장 전에도)**
3. 템플릿 저장
4. 저장된 템플릿과 블록 세트 연결 (선택적)

## 데이터베이스 구조

### template_block_sets 테이블

```sql
CREATE TABLE template_block_sets (
  id uuid PRIMARY KEY,
  template_id uuid NULL REFERENCES camp_templates(id) ON DELETE CASCADE,  -- NULL 허용
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(100) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### UNIQUE 제약조건

- **template_id가 NULL이 아닐 때**: `(template_id, name)` 고유
- **template_id가 NULL일 때**: `(tenant_id, name)` 고유

## 영향 범위

### 긍정적 영향

1. ✅ 템플릿 저장 전에도 블록 세트 생성 가능
2. ✅ 학생 페이지와 동일한 사용자 경험 (항상 생성 가능)
3. ✅ 템플릿 저장 후 블록 세트를 연결할 수 있는 유연성

### 주의사항

1. **템플릿 저장 후 블록 세트 연결**: 템플릿 저장 시 `template_id`를 업데이트하는 로직이 필요할 수 있음
2. **중복 체크**: `tenant_id` 기준 중복 체크가 올바르게 동작하는지 확인 필요

## 다음 단계

1. ✅ 마이그레이션 파일 생성
2. ⏳ 마이그레이션 실행
3. ⏳ 템플릿 저장 시 블록 세트 자동 연결 로직 검토 (필요 시)
