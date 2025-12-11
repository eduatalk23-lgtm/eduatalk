# QR 출석 체크인 에러 로깅 개선

**작업 일자**: 2025-02-01  
**작업 목적**: QR 코드 출석 체크인 시 발생하는 에러의 원인을 파악하기 위한 상세 로깅 추가

---

## 🔍 문제 상황

QR 코드로 출석 체크인 시 다음과 같은 에러가 발생했지만, 실제 원인을 파악하기 어려웠습니다:

```json
{
  "message": "알 수 없는 오류가 발생했습니다.",
  "code": "INTERNAL_ERROR",
  "step": "attendance_record_save",
  "hasExistingRecord": false
}
```

에러가 `attendance_record_save` 단계에서 발생했지만, Supabase 에러의 상세 정보(code, details, hint)가 로그에 포함되지 않아 원인 파악이 어려웠습니다.

---

## ✅ 개선 내용

### 1. `insertAttendanceRecord` 함수 에러 로깅 추가

**파일**: `lib/domains/attendance/repository.ts`

출석 기록 생성 시 Supabase 에러의 상세 정보를 로깅하도록 개선했습니다:

```typescript
if (error) {
  // 에러 상세 정보 로깅 추가
  console.error("[attendance/repository] 출석 기록 생성 실패", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    tenantId,
    input,
  });
  throw error;
}
```

**개선 효과**:
- Supabase 에러 코드 확인 가능
- 에러 상세 정보(details, hint) 확인 가능
- 입력 데이터 확인 가능

### 2. `updateAttendanceRecord` 함수 에러 로깅 추가

**파일**: `lib/domains/attendance/repository.ts`

출석 기록 수정 시에도 동일하게 에러 로깅을 추가했습니다:

```typescript
if (error) {
  // 에러 상세 정보 로깅 추가
  console.error("[attendance/repository] 출석 기록 수정 실패", {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    recordId,
    input,
  });
  throw error;
}
```

### 3. `checkInWithQRCode` 함수 에러 캡처 개선

**파일**: `app/(student)/actions/attendanceActions.ts`

출석 기록 저장 단계에서 발생하는 에러를 더 자세히 캡처하도록 개선했습니다:

```typescript
// Step 7: 출석 기록 저장
stepContext.step = "attendance_record_save";
try {
  const record = await recordAttendance({
    student_id: user.userId,
    attendance_date: today,
    check_in_time: now,
    check_in_method: "qr",
    status: "present",
  });
  stepContext.recordId = record.id;
  stepContext.recordStatus = record.status;
} catch (recordError) {
  // 출석 기록 저장 에러 상세 정보 추가
  stepContext.recordError = {
    message: recordError instanceof Error ? recordError.message : String(recordError),
    code: recordError && typeof recordError === "object" && "code" in recordError 
      ? (recordError as { code: string }).code 
      : undefined,
    details: recordError && typeof recordError === "object" && "details" in recordError
      ? (recordError as { details?: unknown }).details
      : undefined,
    hint: recordError && typeof recordError === "object" && "hint" in recordError
      ? (recordError as { hint?: string }).hint
      : undefined,
  };
  throw recordError;
}
```

**개선 효과**:
- `stepContext`에 에러 상세 정보가 포함되어 최종 에러 로그에 기록됨
- Supabase 에러 코드, details, hint 정보 확인 가능
- 에러 원인 파악이 용이해짐

---

## 📊 예상되는 에러 원인

개선된 로깅을 통해 다음 중 하나의 원인을 확인할 수 있을 것으로 예상됩니다:

1. **UNIQUE 제약 조건 위반** (에러 코드: `23505`)
   - `attendance_records` 테이블의 `(student_id, attendance_date)` UNIQUE 제약 조건
   - 동시 요청으로 인한 중복 삽입 시도

2. **RLS 정책 위반** (에러 코드: `42501`)
   - Row Level Security 정책으로 인한 접근 권한 문제
   - 학생이 자신의 출석 기록을 생성할 권한이 없는 경우

3. **NOT NULL 제약 조건 위반** (에러 코드: `23502`)
   - 필수 필드 누락
   - `tenant_id` 또는 `student_id`가 null인 경우

4. **외래 키 제약 조건 위반** (에러 코드: `23503`)
   - 존재하지 않는 `tenant_id` 또는 `student_id` 참조

5. **데이터베이스 연결 문제** (에러 코드: `08000`, `08003`, `08006`)
   - 네트워크 연결 실패
   - 데이터베이스 서버 문제

---

## 🔧 다음 단계

1. **에러 재현 및 로그 확인**
   - QR 코드 출석 체크인 시도
   - 콘솔에서 상세 에러 로그 확인
   - Supabase 에러 코드 및 상세 정보 확인

2. **에러 원인에 따른 대응**
   - UNIQUE 제약 위반: 동시성 처리 개선 (트랜잭션 또는 upsert 사용)
   - RLS 정책 위반: RLS 정책 수정 또는 Admin 클라이언트 사용
   - 제약 조건 위반: 데이터 검증 로직 추가
   - 연결 문제: 재시도 로직 추가

3. **추가 개선 사항**
   - `normalizeError` 함수에서 Supabase 에러를 더 정확하게 처리
   - 사용자에게 더 명확한 에러 메시지 제공

---

## 📝 변경 파일

1. `lib/domains/attendance/repository.ts`
   - `insertAttendanceRecord`: 에러 로깅 추가
   - `updateAttendanceRecord`: 에러 로깅 추가

2. `app/(student)/actions/attendanceActions.ts`
   - `checkInWithQRCode`: 출석 기록 저장 에러 상세 캡처 추가

---

## ✅ 검증 방법

1. 개발 서버 실행
2. QR 코드로 출석 체크인 시도
3. 콘솔에서 다음 로그 확인:
   - `[attendance/repository] 출석 기록 생성 실패` (에러 발생 시)
   - `[Error]` 로그의 `context.recordError` 필드 확인

---

**작업 완료**: 2025-02-01

