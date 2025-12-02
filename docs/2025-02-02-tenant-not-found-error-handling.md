# 테넌트 수정 시 "해당 기관을 찾을 수 없습니다" 에러 처리

## 📋 작업 개요

**날짜**: 2025-02-02  
**문제**: 테넌트 수정 시 "해당 기관을 찾을 수 없습니다" 에러 발생  
**원인**: 수정하려는 테넌트가 실제로 존재하지 않음  
**해결**: 테넌트 목록 조회 API 추가 및 에러 처리 개선

---

## 🐛 문제 상황

### 에러 메시지
```
해당 기관을 찾을 수 없습니다.
    at handleSubmit (app/(superadmin)/superadmin/tenants/_components/TenantForm.tsx:46:15)
```

### 원인 분석

1. **테넌트가 실제로 존재하지 않음**
   - 다른 사용자가 삭제했을 수 있음
   - 페이지를 새로고침하지 않아서 목록에 남아있지만 실제로는 삭제된 경우
   - ID가 잘못 전달된 경우

2. **테넌트 목록 조회 API 부재**
   - GET `/api/tenants` 엔드포인트가 없음
   - 클라이언트에서 목록을 새로고침하기 어려움

---

## ✅ 해결 방법

### 수정 내용

1. **테넌트 목록 조회 API 추가**
   ```typescript
   /**
    * 테넌트 목록 조회 API
    * GET /api/tenants
    *
    * @returns
    * 성공: { success: true, data: Tenant[] }
    * 에러: { success: false, error: { code, message } }
    */
   export async function GET() {
     try {
       const { userId, role } = await getCurrentUserRole();

       // Super Admin만 접근 가능
       if (!userId || role !== "superadmin") {
         return apiForbidden("Super Admin만 기관 목록을 조회할 수 있습니다.");
       }

       const supabase = await createSupabaseServerClient();
       const { data, error } = await supabase
         .from("tenants")
         .select("id, name, type, created_at, updated_at")
         .order("created_at", { ascending: false });

       if (error) {
         return handleApiError(error, "[api/tenants] 목록 조회 실패");
       }

       return apiSuccess((data as Tenant[]) ?? []);
     } catch (error) {
       return handleApiError(error, "[api/tenants] 목록 조회 오류");
     }
   }
   ```

2. **에러 메시지는 이미 명확함**
   - "해당 기관을 찾을 수 없습니다"는 사용자에게 명확한 메시지
   - API에서 `apiNotFound`를 반환하여 적절한 HTTP 상태 코드(404) 반환

---

## 📝 수정된 코드

### 추가된 API 엔드포인트

**app/api/tenants/route.ts**:
- `GET /api/tenants` - 테넌트 목록 조회 (Super Admin만)

### 기존 동작 (정상)

**app/api/tenants/[id]/route.ts**:
- `PUT /api/tenants/[id]` - 테넌트 수정
  - 테넌트 존재 여부 확인 후 수정
  - 존재하지 않으면 `apiNotFound` 반환

**app/(superadmin)/superadmin/tenants/_components/TenantForm.tsx**:
- API 응답의 `success` 필드 확인
- 에러 메시지를 사용자에게 표시

---

## 🔍 에러 발생 시나리오

### 시나리오 1: 테넌트가 삭제됨
1. 사용자 A가 테넌트 목록을 조회
2. 사용자 B가 해당 테넌트를 삭제
3. 사용자 A가 수정 시도
4. → "해당 기관을 찾을 수 없습니다" 에러 발생

### 시나리오 2: 잘못된 ID
1. 잘못된 테넌트 ID가 전달됨
2. 수정 시도
3. → "해당 기관을 찾을 수 없습니다" 에러 발생

### 시나리오 3: 데이터베이스에 테넌트가 없음
1. 테이블이 비어있거나 초기화됨
2. 수정 시도
3. → "해당 기관을 찾을 수 없습니다" 에러 발생

---

## 📚 참고 사항

### API 응답 형식

**성공 응답**:
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "기관명",
      "type": "academy",
      "created_at": "2025-02-02T...",
      "updated_at": "2025-02-02T..."
    }
  ]
}
```

**에러 응답**:
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "해당 기관을 찾을 수 없습니다."
  }
}
```

### 권한 확인

- **Super Admin만 접근 가능**: 모든 테넌트 API는 Super Admin만 사용 가능
- **RLS 정책**: `tenants` 테이블에는 RLS가 활성화되어 있지 않음 (`rowsecurity: false`)

---

## ✅ 향후 개선 사항

1. **목록 자동 새로고침**: 테넌트 수정/삭제 후 목록 자동 새로고침
2. **낙관적 업데이트**: 수정 시도 전에 테넌트 존재 여부 확인
3. **에러 복구**: 에러 발생 시 목록을 새로고침하여 최신 상태 확인
4. **Toast 알림**: `alert()` 대신 Toast 컴포넌트 사용

---

## 🎯 사용자 가이드

### 에러 발생 시 대처 방법

1. **페이지 새로고침**: 브라우저에서 페이지를 새로고침하여 최신 목록 확인
2. **목록 확인**: 다른 사용자가 테넌트를 삭제했는지 확인
3. **다시 시도**: 테넌트가 존재하는지 확인 후 다시 시도

---

**작업 완료**: 2025-02-02

