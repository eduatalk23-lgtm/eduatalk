# 학생 QR 퇴실 SMS 발송 문제 해결 및 코드 최적화

## 작업 일자
2025-12-12

## 문제 분석

### 발견된 문제
학생이 QR 코드로 직접 체크인/체크아웃할 때 SMS 발송이 실패하는 문제가 발생했습니다.

**에러 로그**:
```
[Error] {
  "message": "관리자 권한이 필요합니다.",
  "code": "FORBIDDEN",
  "statusCode": 403
}
```

### 원인 분석
1. **권한 체크 문제**: `sendAttendanceSMS` 함수가 `requireAdminAuth()`를 호출하여 학생이 직접 체크인/체크아웃할 때 SMS 발송 실패
2. **중복 코드**: `sendAttendanceSMS`와 `sendBulkAttendanceSMS`에서 수신자 결정 로직이 중복됨
3. **아키텍처 문제**: 내부 서비스 함수(`sendAttendanceSMSIfEnabled`)가 관리자 전용 함수를 호출하는 구조적 문제

### 현재 호출 흐름 (문제 발생 시)
```
학생 액션 (checkOutWithQRCode)
  → sendAttendanceSMSIfEnabled (lib/services/attendanceSMSService.ts)
    → sendAttendanceSMS (app/actions/smsActions.ts)
      → requireAdminAuth() ❌ (학생은 관리자 권한 없음)
```

## 해결 방안

### 1. SMS 발송 함수 분리 및 권한 체크 개선

**파일**: `app/actions/smsActions.ts`

- `sendAttendanceSMSInternal` 함수 추가: 권한 체크 없이 SMS 발송 로직만 수행 (내부 사용)
- `sendAttendanceSMS` 함수 수정: 관리자 권한 체크 후 `sendAttendanceSMSInternal` 호출 (관리자 액션용)
- 기존 로직은 `sendAttendanceSMSInternal`로 이동

### 2. 내부 서비스 함수 수정

**파일**: `lib/services/attendanceSMSService.ts`

- `sendAttendanceSMSIfEnabled` 함수에서 `sendAttendanceSMS` 대신 `sendAttendanceSMSInternal` 사용
- 학생 직접 체크인/체크아웃 시에도 정상 동작하도록 수정

### 3. 중복 코드 최적화

**파일**: `app/actions/smsActions.ts`

- 수신자 결정 로직을 공통 함수 `determineRecipientPhones`로 추출
- `sendAttendanceSMSInternal`와 `sendBulkAttendanceSMS`에서 공통 함수 사용

### 4. 타입 안전성 개선

**파일**: `lib/services/attendanceSMSService.ts`

- `any` 타입을 `unknown`으로 변경하고 타입 가드 사용

## 구현 내용

### Step 1: 공통 함수 추출

`determineRecipientPhones` 함수를 생성하여 수신자 결정 로직을 단일화했습니다.

```typescript
function determineRecipientPhones(
  recipientSetting: 'mother' | 'father' | 'both' | 'auto',
  student: { mother_phone: string | null; father_phone: string | null }
): string[]
```

**적용 위치**:
- `sendAttendanceSMSInternal` 내부
- `sendBulkAttendanceSMS` 내부

### Step 2: 내부 함수 생성

`sendAttendanceSMSInternal` 함수를 생성하여 권한 체크 없이 SMS 발송 로직만 수행하도록 했습니다.

```typescript
export async function sendAttendanceSMSInternal(
  studentId: string,
  templateType: "attendance_check_in" | "attendance_check_out" | "attendance_absent" | "attendance_late",
  variables: Record<string, string>
): Promise<{ success: boolean; msgId?: string; error?: string }>
```

### Step 3: 관리자용 함수 수정

`sendAttendanceSMS` 함수를 수정하여 관리자 권한 체크 후 내부 함수를 호출하도록 했습니다.

```typescript
export async function sendAttendanceSMS(...) {
  const handler = withErrorHandling(async () => {
    await requireAdminAuth();
    return await sendAttendanceSMSInternal(studentId, templateType, variables);
  });
  return handler();
}
```

### Step 4: 내부 서비스 함수 수정

`lib/services/attendanceSMSService.ts`에서 import를 변경하고 내부 함수를 사용하도록 수정했습니다.

```typescript
// import 변경
import { sendAttendanceSMSInternal } from "@/app/actions/smsActions";

// 함수 내부에서 사용
const result = await sendAttendanceSMSInternal(studentId, smsType, variables);
```

### Step 5: 타입 안전성 개선

`any` 타입을 제거하고 `unknown` 타입과 타입 가드를 사용하도록 수정했습니다.

```typescript
} catch (error: unknown) {
  const errorMessage = error instanceof Error 
    ? error.message 
    : "알 수 없는 오류가 발생했습니다.";
  // ...
}
```

## 수정된 파일

1. **app/actions/smsActions.ts**
   - `determineRecipientPhones` 함수 추가
   - `sendAttendanceSMSInternal` 함수 추가
   - `sendAttendanceSMS` 함수 수정 (관리자 권한 체크 후 내부 함수 호출)
   - `sendBulkAttendanceSMS` 함수 수정 (공통 함수 사용)

2. **lib/services/attendanceSMSService.ts**
   - import 변경: `sendAttendanceSMS` → `sendAttendanceSMSInternal`
   - 함수 호출 변경: `sendAttendanceSMS` → `sendAttendanceSMSInternal`
   - 타입 안전성 개선: `any` → `unknown`

## 개선된 호출 흐름

### 학생 직접 체크인/체크아웃 시
```
학생 액션 (checkOutWithQRCode)
  → sendAttendanceSMSIfEnabled (lib/services/attendanceSMSService.ts)
    → sendAttendanceSMSInternal (app/actions/smsActions.ts)
      → SMS 발송 성공 ✅
```

### 관리자 액션 시
```
관리자 액션
  → sendAttendanceSMS (app/actions/smsActions.ts)
    → requireAdminAuth() ✅
    → sendAttendanceSMSInternal (app/actions/smsActions.ts)
      → SMS 발송 성공 ✅
```

## 예상 효과

1. **문제 해결**: 학생이 직접 체크인/체크아웃할 때 SMS 정상 발송
2. **코드 중복 제거**: 수신자 결정 로직 단일화로 유지보수성 향상
3. **아키텍처 개선**: 권한 체크와 비즈니스 로직 분리로 책임 분리 명확화
4. **타입 안전성**: TypeScript 타입 정의 개선으로 런타임 에러 감소

## 영향 범위

### 수정 파일
- `app/actions/smsActions.ts`: 함수 분리 및 중복 코드 제거
- `lib/services/attendanceSMSService.ts`: import 및 함수 호출 변경

### 영향받는 기능
- 학생 직접 체크인/체크아웃 SMS 발송 (수정)
- 관리자 출석 기록 SMS 발송 (기존 동작 유지)
- 일괄 SMS 발송 (기존 동작 유지)

### 영향받지 않는 기능
- 일반 SMS 발송 (`sendGeneralSMS`)
- 기타 SMS 관련 기능

## 테스트 확인 사항

1. ✅ 학생 직접 체크인 시 SMS 발송 확인
2. ✅ 학생 직접 체크아웃 시 SMS 발송 확인
3. ✅ 관리자 액션에서 SMS 발송 정상 동작 확인
4. ✅ 린터 에러 없음 확인
5. ✅ 타입 안전성 확인

## 주의사항

1. **하위 호환성**: 기존 관리자 액션에서 `sendAttendanceSMS`를 직접 호출하는 경우 정상 동작 확인 완료
2. **에러 처리**: 내부 함수에서도 기존과 동일한 에러 처리 패턴 유지
3. **로깅**: SMS 발송 실패 시 기존과 동일한 로그 레벨 및 형식 유지

