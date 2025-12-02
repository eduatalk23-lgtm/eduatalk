# 테넌트 폼 API 응답 처리 수정

## 📋 작업 개요

**날짜**: 2025-02-02  
**문제**: 테넌트 정보 저장 시 "저장 실패" 에러 발생  
**원인**: API 응답 형식을 올바르게 처리하지 못함  
**해결**: API 응답 본문의 `success` 필드를 확인하도록 수정

---

## 🐛 문제 상황

### 에러 메시지
```
저장 실패
    at handleSubmit (app/(superadmin)/superadmin/tenants/_components/TenantForm.tsx:41:15)
```

### 원인 분석

1. **API 응답 형식 불일치**
   - API는 `{ success: true, data: ... }` 또는 `{ success: false, error: ... }` 형식으로 응답
   - `TenantForm.tsx`에서는 `response.ok`만 확인하여 HTTP 상태 코드만 체크
   - API 헬퍼 함수들은 에러 발생 시에도 일부는 200 상태 코드를 반환할 수 있음

2. **에러 메시지 부족**
   - 구체적인 에러 메시지를 표시하지 않음
   - 사용자에게 원인을 알려주지 못함

---

## ✅ 해결 방법

### 수정 내용

`TenantForm.tsx`의 `handleSubmit` 함수를 수정하여:

1. **응답 본문 파싱 후 `success` 필드 확인**
   ```typescript
   const result = await response.json();
   
   if (!result.success) {
     const errorMessage =
       result.error?.message || "기관 정보 저장에 실패했습니다.";
     throw new Error(errorMessage);
   }
   ```

2. **성공 시 `data` 필드에서 tenant 정보 추출**
   ```typescript
   onSuccess(result.data);
   ```

3. **에러 메시지 개선**
   ```typescript
   const errorMessage =
     error instanceof Error ? error.message : "기관 정보 저장에 실패했습니다.";
   alert(errorMessage);
   ```

---

## 📝 수정된 코드

### Before
```typescript
const response = await fetch(url, {
  method,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name, type }),
});

if (!response.ok) {
  throw new Error("저장 실패");
}

const data = await response.json();
onSuccess(data);
```

### After
```typescript
const response = await fetch(url, {
  method,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ name, type }),
});

const result = await response.json();

// API 응답 형식 확인: { success: true, data: ... } 또는 { success: false, error: ... }
if (!result.success) {
  const errorMessage =
    result.error?.message || "기관 정보 저장에 실패했습니다.";
  throw new Error(errorMessage);
}

// 성공 시 data 필드에서 tenant 정보 추출
onSuccess(result.data);
```

---

## 🔍 확인 사항

### 데이터베이스 테이블 확인

`tenants` 테이블이 존재하고 필요한 컬럼들이 모두 있는지 확인:

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'tenants' 
ORDER BY ordinal_position;
```

**결과**:
- ✅ `id` (uuid, NOT NULL, 기본값: gen_random_uuid())
- ✅ `name` (text, NOT NULL)
- ✅ `type` (text, nullable, 기본값: 'academy')
- ✅ `created_at` (timestamptz, NOT NULL, 기본값: now())
- ✅ `updated_at` (timestamptz, NOT NULL, 기본값: now())

**결론**: 테이블은 정상적으로 존재하며, 문제는 API 응답 처리 방식이었음

---

## 📚 참고 사항

### API 응답 형식

프로젝트의 모든 API는 다음 형식을 따릅니다:

**성공 응답**:
```json
{
  "success": true,
  "data": { ... }
}
```

**에러 응답**:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "details": { ... }
  }
}
```

### 관련 파일

- `app/api/tenants/route.ts` - 테넌트 생성 API (POST)
- `app/api/tenants/[id]/route.ts` - 테넌트 수정/삭제 API (PUT/DELETE)
- `lib/api/response.ts` - API 응답 헬퍼 함수
- `lib/api/types.ts` - API 응답 타입 정의

---

## ✅ 테스트 체크리스트

- [x] 테넌트 생성 시 정상 동작 확인
- [x] 테넌트 수정 시 정상 동작 확인
- [x] 에러 발생 시 구체적인 메시지 표시 확인
- [x] 린터 에러 없음 확인

---

## 🎯 향후 개선 사항

1. **Toast 알림으로 변경**: `alert()` 대신 Toast 컴포넌트 사용 고려
2. **타입 안전성**: API 응답 타입을 명시적으로 정의하여 타입 안전성 향상
3. **에러 처리 개선**: 네트워크 에러, 파싱 에러 등 다양한 에러 케이스 처리

---

**작업 완료**: 2025-02-02

