# 캠프 템플릿 RLS 정책 위반 수정

## 작업 일시
2025-12-19

## 문제 상황

관리자가 캠프 템플릿을 생성할 때 다음과 같은 에러가 발생했습니다:

```
new row violates row-level security policy for table "camp_templates"
```

### 에러 발생 위치
- `app/(admin)/actions/campTemplateActions.ts:405`
- `lib/data/campTemplates.ts:104` - `createCampTemplate` 함수

## 원인 분석

### 문제점

1. `createCampTemplate` 함수가 **일반 서버 클라이언트** (`createSupabaseServerClient`)를 사용하고 있었습니다.

2. `camp_templates` 테이블에 **RLS(Row Level Security)**가 활성화되어 있지만, INSERT 정책이 없어서 일반 사용자로는 INSERT가 불가능했습니다.

3. 관리자 전용 함수임에도 불구하고 RLS를 우회하지 않아 INSERT가 실패했습니다.

### 코드 비교

#### 수정 전 (문제 발생)
```typescript
// lib/data/campTemplates.ts
export async function createCampTemplate(data: {...}) {
  const supabase = await createSupabaseServerClient(); // RLS 적용
  // ...
  const { data: template, error } = await supabase
    .from("camp_templates")
    .insert(insertData)
    .select("id")
    .single();
}
```

#### 수정 후 (정상 작동)
```typescript
// lib/data/campTemplates.ts
export async function createCampTemplate(data: {...}) {
  // 관리자 전용 함수이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  // ...
  const { data: template, error } = await supabase
    .from("camp_templates")
    .insert(insertData)
    .select("id")
    .single();
}
```

## 해결 방법

### 1. `createCampTemplate` 함수 수정

`lib/data/campTemplates.ts`의 `createCampTemplate` 함수를 Admin 클라이언트를 사용하도록 수정했습니다:

```typescript
/**
 * 캠프 템플릿 생성
 * 관리자 전용 함수이므로 Admin 클라이언트를 사용하여 RLS를 우회합니다.
 */
export async function createCampTemplate(data: {...}) {
  // 관리자 전용 함수이므로 Admin 클라이언트 사용 (RLS 우회)
  // 호출 전에 requireAdminOrConsultant()로 권한 검증이 완료되어야 함
  const supabase = createSupabaseAdminClient();
  // ...
}
```

### 2. `copyCampTemplate` 함수 수정

동일한 문제가 발생할 수 있는 `copyCampTemplate` 함수도 함께 수정했습니다:

```typescript
/**
 * 캠프 템플릿 복사
 * 관리자 전용 함수이므로 Admin 클라이언트를 사용하여 RLS를 우회합니다.
 */
export async function copyCampTemplate(...) {
  // 관리자 전용 함수이므로 Admin 클라이언트 사용 (RLS 우회)
  const supabase = createSupabaseAdminClient();
  // ...
}
```

### 3. Import 추가

Admin 클라이언트를 사용하기 위해 import를 추가했습니다:

```typescript
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
```

## 결과

1. **템플릿 생성 정상화**: 관리자가 캠프 템플릿을 정상적으로 생성할 수 있습니다.
2. **템플릿 복사 정상화**: 관리자가 캠프 템플릿을 정상적으로 복사할 수 있습니다.
3. **RLS 우회**: Admin 클라이언트를 사용하여 RLS 정책을 우회하므로 INSERT 작업이 성공합니다.

## 참고 사항

- Admin 클라이언트는 RLS를 우회하므로, 권한 검증을 반드시 먼저 수행해야 합니다.
- `createCampTemplate`와 `copyCampTemplate` 함수는 모두 관리자 액션(`requireAdminOrConsultant()`)에서만 호출되므로 안전합니다.
- 관리자 전용 함수에서는 Admin 클라이언트를 사용하는 것이 적절합니다.

## 관련 문서

- `docs/2025-12-05-캠프-관리자-RLS-우회-수정.md` - 유사한 문제 해결 사례

