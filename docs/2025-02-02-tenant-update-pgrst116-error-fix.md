# 테넌트 수정 API PGRST116 에러 수정

## 📋 작업 개요

**날짜**: 2025-02-02  
**문제**: 테넌트 수정 시 `PGRST116` 에러 발생  
**원인**: `.single()` 사용 시 결과가 0개 행일 때 발생하는 에러  
**해결**: 업데이트 전 테넌트 존재 여부 확인 및 에러 처리 개선

---

## 🐛 문제 상황

### 에러 메시지
```
[api/tenants] 수정 실패 {
  code: 'PGRST116',
  details: 'The result contains 0 rows',
  hint: null,
  message: 'Cannot coerce the result to a single JSON object'
}
```

### 원인 분석

1. **PGRST116 에러**
   - Supabase PostgREST 에러 코드
   - `.single()` 메서드를 사용했는데 결과가 0개 행일 때 발생
   - 테넌트가 존재하지 않거나, RLS 정책으로 인해 접근 불가능한 경우

2. **기존 코드 문제점**
   - 업데이트 전에 테넌트 존재 여부를 확인하지 않음
   - `.single()` 사용 시 결과가 없으면 에러 발생
   - 에러 메시지가 사용자에게 명확하지 않음

---

## ✅ 해결 방법

### 수정 내용

1. **업데이트 전 테넌트 존재 여부 확인**
   ```typescript
   // 먼저 테넌트 존재 여부 확인
   const { data: existingTenant, error: checkError } = await supabase
     .from("tenants")
     .select("id")
     .eq("id", id)
     .maybeSingle();

   if (!existingTenant) {
     return apiNotFound("해당 기관을 찾을 수 없습니다.");
   }
   ```

2. **PGRST116 에러 명시적 처리**
   ```typescript
   if (error) {
     // PGRST116 에러 처리: 결과가 0개 행일 때
     if (error.code === "PGRST116") {
       return apiNotFound("해당 기관을 찾을 수 없습니다.");
     }
     return handleApiError(error, "[api/tenants] 수정 실패");
   }
   ```

3. **`handleApiError`에 PGRST116 처리 추가**
   ```typescript
   // PGRST116: 결과가 0개 행일 때 (single() 사용 시)
   if (supabaseError.code === "PGRST116") {
     return apiNotFound("요청한 리소스를 찾을 수 없습니다.");
   }
   ```

4. **삭제 API에도 동일한 로직 적용**

---

## 📝 수정된 코드

### Before
```typescript
const { data, error } = await supabase
  .from("tenants")
  .update({
    name: name.trim(),
    type: type || "academy",
  })
  .eq("id", id)
  .select()
  .single();

if (error) {
  return handleApiError(error, "[api/tenants] 수정 실패");
}

return apiSuccess(data as Tenant);
```

### After
```typescript
// 먼저 테넌트 존재 여부 확인
const { data: existingTenant, error: checkError } = await supabase
  .from("tenants")
  .select("id")
  .eq("id", id)
  .maybeSingle();

if (checkError) {
  return handleApiError(checkError, "[api/tenants] 테넌트 확인 실패");
}

if (!existingTenant) {
  return apiNotFound("해당 기관을 찾을 수 없습니다.");
}

// 테넌트 업데이트
const { data, error } = await supabase
  .from("tenants")
  .update({
    name: name.trim(),
    type: type || "academy",
    updated_at: new Date().toISOString(),
  })
  .eq("id", id)
  .select()
  .single();

if (error) {
  // PGRST116 에러 처리: 결과가 0개 행일 때
  if (error.code === "PGRST116") {
    return apiNotFound("해당 기관을 찾을 수 없습니다.");
  }
  return handleApiError(error, "[api/tenants] 수정 실패");
}

if (!data) {
  return apiNotFound("기관 정보를 가져올 수 없습니다.");
}

return apiSuccess(data as Tenant);
```

---

## 🔍 Supabase PostgREST 에러 코드

### PGRST116
- **의미**: 결과를 단일 JSON 객체로 변환할 수 없음
- **원인**: `.single()` 또는 `.maybeSingle()` 사용 시 결과가 0개 행
- **해결**: 업데이트/삭제 전에 존재 여부 확인

### 관련 에러 코드
- **PGRST116**: 결과가 0개 행 (`.single()` 사용 시)
- **23505**: 중복 키 에러
- **42501**: 권한 없음 (RLS 정책 위반)

---

## 📚 참고 사항

### `.single()` vs `.maybeSingle()`

**`.single()`**:
- 정확히 1개 행을 기대
- 0개 또는 2개 이상이면 에러 발생
- 결과가 확실할 때 사용

**`.maybeSingle()`**:
- 0개 또는 1개 행 허용
- 2개 이상이면 에러 발생
- 존재 여부 확인 시 사용

### 업데이트 패턴

```typescript
// 1. 존재 여부 확인 (maybeSingle 사용)
const { data: existing } = await supabase
  .from("table")
  .select("id")
  .eq("id", id)
  .maybeSingle();

if (!existing) {
  return apiNotFound("리소스를 찾을 수 없습니다.");
}

// 2. 업데이트 실행 (single 사용)
const { data, error } = await supabase
  .from("table")
  .update({ ... })
  .eq("id", id)
  .select()
  .single();
```

---

## ✅ 수정된 파일

1. **app/api/tenants/[id]/route.ts**
   - PUT 메서드: 업데이트 전 존재 여부 확인 추가
   - DELETE 메서드: 삭제 전 존재 여부 확인 추가
   - PGRST116 에러 명시적 처리

2. **lib/api/response.ts**
   - `handleApiError`에 PGRST116 에러 처리 추가

---

## ✅ 테스트 체크리스트

- [x] 존재하지 않는 테넌트 수정 시도 → 404 에러 반환
- [x] 존재하는 테넌트 수정 → 정상 동작
- [x] PGRST116 에러가 명확한 메시지로 변환되는지 확인
- [x] 삭제 API에도 동일한 로직 적용
- [x] 린터 에러 없음 확인

---

## 🎯 향후 개선 사항

1. **RLS 정책 확인**: 테넌트 테이블에 RLS 정책이 있는지 확인하고 필요시 수정
2. **에러 로깅**: 더 자세한 에러 로깅 추가
3. **유효성 검증**: ID 형식 검증 추가 (UUID 형식 확인)

---

**작업 완료**: 2025-02-02

