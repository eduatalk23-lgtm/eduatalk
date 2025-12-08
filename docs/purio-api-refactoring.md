# 뿌리오 API 리팩토링 - Client/Server 분리

## 📌 문제 상황

### 발생한 오류

```
Error: Functions cannot be passed directly to Client Components unless you explicitly expose it by marking it with "use server".
```

### 원인 분석

1. **Client Component에서 Server Action 직접 import**
   - `SMSSendForm.tsx` (Client Component)에서 `sendGeneralSMS`, `sendBulkGeneralSMS`를 `@/app/actions/smsActions`에서 직접 import
   - Next.js App Router에서는 Client Component가 Server Action을 직접 호출할 수 있지만, 함수를 props로 전달하거나 클로저로 캡처하는 경우 문제 발생 가능

2. **서버 로직의 클라이언트 노출 위험**
   - 뿌리오 API 키(`PPURIO_API_KEY`)가 서버에서만 사용되어야 하는데, Client Component로 로직이 흘러들어갈 위험
   - 환경 변수와 외부 API 호출이 클라이언트 번들에 포함될 수 있음

3. **Next.js App Router 제약사항**
   - Client Component는 함수 props를 직렬화할 수 없음
   - 서버 함수를 클라이언트로 전달하는 구조는 안전하지 않음

---

## ✅ 해결 방안

### 옵션 A: API Route 방식 (구현 완료)

**장점:**
- 명확한 서버/클라이언트 분리
- RESTful API 패턴으로 표준화
- 다른 클라이언트(모바일 앱 등)에서도 재사용 가능
- API 키와 환경 변수가 완전히 서버에서만 사용

**구현 내용:**
- `app/api/purio/send/route.ts` 생성
- POST 메서드로 단일/일괄 발송 모두 처리
- 인증, 입력값 검증, 에러 처리 포함

---

## 📁 수정된 폴더 구조

```
app/
├── api/
│   └── purio/
│       └── send/
│           └── route.ts          # 새로 생성 - API Route
├── (admin)/
│   └── admin/
│       └── sms/
│           └── _components/
│               └── SMSSendForm.tsx  # 수정 - Server Action 제거, API Route 호출로 변경
└── actions/
    └── smsActions.ts            # 기존 유지 (출석 관련 SMS 등에서 사용)
```

---

## 📝 수정된 파일 전체 코드

### 1. API Route: `app/api/purio/send/route.ts`

```typescript
/**
 * 뿌리오 SMS 발송 API Route
 * Client Component에서 호출하는 서버 전용 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/auth/requireAdminAuth";
import { getTenantContext } from "@/lib/tenant/getTenantContext";
import { sendSMS, sendBulkSMS } from "@/lib/services/smsService";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formatSMSTemplate,
  type SMSTemplateType,
} from "@/lib/services/smsTemplates";
import { AppError, ErrorCode } from "@/lib/errors";

/**
 * 단일 SMS 발송
 * POST /api/purio/send
 * Body: { type: "single", phone: string, message: string, recipientId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    // 인증 확인
    await requireAdminAuth();
    const tenantContext = await getTenantContext();

    if (!tenantContext?.tenantId) {
      return NextResponse.json(
        {
          success: false,
          error: "기관 정보를 찾을 수 없습니다.",
        },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const { type, phone, message, studentIds, templateVariables, recipientType } = body;

    // 입력값 검증
    if (!type || (type !== "single" && type !== "bulk")) {
      return NextResponse.json(
        {
          success: false,
          error: "발송 타입이 올바르지 않습니다. (single 또는 bulk)",
        },
        { status: 400 }
      );
    }

    if (type === "single") {
      // 단일 발송 로직
      // ... (생략, 실제 파일 참조)
    } else {
      // 일괄 발송 로직
      // ... (생략, 실제 파일 참조)
    }
  } catch (error: any) {
    // 에러 처리
    // ... (생략, 실제 파일 참조)
  }
}
```

**주요 기능:**
- ✅ 인증 확인 (`requireAdminAuth`)
- ✅ 입력값 검증 (phone, message, studentIds)
- ✅ 단일/일괄 발송 모두 지원
- ✅ 템플릿 변수 치환 (학생명, 학원명 등)
- ✅ 전송 대상자 타입 선택 (학생/어머니/아버지)
- ✅ 에러 처리 및 적절한 HTTP 상태 코드 반환

---

### 2. Client Component: `app/(admin)/admin/sms/_components/SMSSendForm.tsx`

**변경 사항:**

#### Before (문제 코드)
```typescript
import { sendGeneralSMS, sendBulkGeneralSMS } from "@/app/actions/smsActions";

// ...
const result = await sendGeneralSMS(customPhone.trim(), message.trim());
```

#### After (수정 코드)
```typescript
// Server Action import 제거

// ...
const response = await fetch("/api/purio/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    type: "single",
    phone: customPhone.trim(),
    message: message.trim(),
  }),
});

const result = await response.json();
```

**주요 변경점:**
1. ✅ Server Action import 제거
2. ✅ `fetch()` API로 API Route 호출
3. ✅ JSON 요청/응답 처리
4. ✅ 에러 처리 개선

---

## 🔄 변경된 로직 흐름

### Before (문제 구조)

```
Client Component (SMSSendForm.tsx)
  ↓ import
Server Action (smsActions.ts)
  ↓ import
SMS Service (smsService.ts)
  ↓ fetch
뿌리오 API
```

**문제점:**
- Server Action이 Client Component로 직접 import됨
- 함수가 클라이언트 번들에 포함될 위험

### After (수정 구조)

```
Client Component (SMSSendForm.tsx)
  ↓ fetch()
API Route (/api/purio/send)
  ↓ import
SMS Service (smsService.ts)
  ↓ fetch
뿌리오 API
```

**개선점:**
- ✅ 명확한 서버/클라이언트 분리
- ✅ API 키와 환경 변수가 서버에서만 사용
- ✅ RESTful API 패턴으로 표준화

---

## 📊 API Route 요청/응답 형식

### 단일 발송

**Request:**
```json
POST /api/purio/send
Content-Type: application/json

{
  "type": "single",
  "phone": "01012345678",
  "message": "안녕하세요",
  "recipientId": "optional-student-id"
}
```

**Response (성공):**
```json
{
  "success": true,
  "msgId": "message-id-from-ppurio"
}
```

**Response (실패):**
```json
{
  "success": false,
  "error": "에러 메시지"
}
```

### 일괄 발송

**Request:**
```json
POST /api/purio/send
Content-Type: application/json

{
  "type": "bulk",
  "studentIds": ["student-id-1", "student-id-2"],
  "message": "{학생명}님 안녕하세요",
  "templateVariables": {
    "학원명": "에듀톡 학원"
  },
  "recipientType": "mother"
}
```

**Response (성공):**
```json
{
  "success": 2,
  "failed": 0,
  "errors": []
}
```

**Response (일부 실패):**
```json
{
  "success": 1,
  "failed": 1,
  "errors": [
    {
      "studentId": "student-id-2",
      "error": "연락처가 없습니다."
    }
  ]
}
```

---

## 🧪 테스트 방법

### 1. 단일 발송 테스트

```bash
curl -X POST http://localhost:3000/api/purio/send \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "type": "single",
    "phone": "01012345678",
    "message": "테스트 메시지"
  }'
```

### 2. 일괄 발송 테스트

```bash
curl -X POST http://localhost:3000/api/purio/send \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "type": "bulk",
    "studentIds": ["student-id-1", "student-id-2"],
    "message": "{학생명}님 안녕하세요",
    "recipientType": "mother"
  }'
```

### 3. 브라우저에서 테스트

1. 관리자 계정으로 로그인
2. `/admin/sms` 페이지 접속
3. 단일 발송 또는 일괄 발송 테스트
4. 개발자 도구 Network 탭에서 `/api/purio/send` 요청 확인

---

## ✅ 검증 체크리스트

- [x] API Route 생성 완료
- [x] Client Component에서 Server Action import 제거
- [x] `fetch()` API로 API Route 호출로 변경
- [x] 인증 확인 로직 포함
- [x] 입력값 검증 포함
- [x] 에러 처리 개선
- [x] 단일/일괄 발송 모두 지원
- [x] 템플릿 변수 치환 기능 유지
- [x] 전송 대상자 타입 선택 기능 유지
- [x] 린터 오류 없음

---

## 🔒 보안 개선사항

1. **API 키 보호**
   - ✅ `PPURIO_API_KEY`가 서버에서만 사용
   - ✅ 클라이언트 번들에 포함되지 않음

2. **인증 확인**
   - ✅ 모든 요청에 `requireAdminAuth()` 적용
   - ✅ 관리자 권한 확인

3. **입력값 검증**
   - ✅ 전화번호 형식 검증
   - ✅ 메시지 내용 검증
   - ✅ 학생 ID 배열 검증

---

## 📈 추가 개선사항 제안

### 1. Rate Limiting 추가

```typescript
// app/api/purio/send/route.ts
import { rateLimit } from "@/lib/auth/rateLimitHandler";

export async function POST(request: NextRequest) {
  // Rate limiting 적용
  const rateLimitResult = await rateLimit(request);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { success: false, error: "요청 한도를 초과했습니다." },
      { status: 429 }
    );
  }
  // ...
}
```

### 2. 요청 로깅

```typescript
// API Route에 요청 로깅 추가
console.log("[SMS API] 요청:", {
  type,
  phoneCount: type === "bulk" ? studentIds.length : 1,
  timestamp: new Date().toISOString(),
});
```

### 3. 응답 캐싱 (선택사항)

일괄 발송 결과를 일시적으로 캐싱하여 중복 요청 방지

### 4. Webhook 지원 (향후)

뿌리오 API에서 발송 결과를 받는 Webhook 엔드포인트 추가

---

## 📚 참고 자료

- [Next.js API Routes 문서](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Next.js Server Actions 문서](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [뿌리오 API 문서](https://www.ppurio.com/send-api/develop)

---

**작업 완료일**: 2025-01-15  
**작업자**: AI Assistant  
**상태**: ✅ 완료

