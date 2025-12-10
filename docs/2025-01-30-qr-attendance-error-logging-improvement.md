# QR 출석 체크 에러 로깅 개선

**작업 일자**: 2025-01-30  
**작업 내용**: QR 코드 출석 체크 시 발생하는 에러를 단계별로 추적하고 상세 로깅하여 원인 파악을 용이하게 개선

## 문제 상황

QR 코드 스캔 시 "작업을 완료하는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."라는 일반적인 에러 메시지만 표시되어 실제 원인 파악이 어려웠습니다.

## 개선 내용

### 1. `checkInWithQRCode` 함수 단계별 에러 로깅 추가

**파일**: `app/(student)/actions/attendanceActions.ts`

각 단계에서 발생할 수 있는 에러를 추적하기 위해 단계별 컨텍스트를 수집하고 로깅하도록 개선했습니다.

**추가된 단계별 로깅**:
- Step 1: 인증 확인 (`authentication`)
- Step 2: 테넌트 컨텍스트 (`tenant_context`)
- Step 3: QR 코드 검증 (`qr_verification`)
- Step 4: 테넌트 일치 확인 (`tenant_verification`)
- Step 5: 날짜 준비 (`date_preparation`)
- Step 6: 기존 기록 확인 (`existing_record_check`)
- Step 7: 출석 기록 저장 (`attendance_record_save`)
- Step 8: SMS 발송 (`sms_notification`)

**수집되는 컨텍스트 정보**:
- `step`: 현재 진행 중인 단계명
- `userId`: 학생 ID
- `tenantId`: 테넌트 ID
- `qrDataLength`, `qrDataPreview`: QR 코드 데이터 정보 (민감 정보 제외)
- `verifiedQRCodeId`, `verifiedTenantId`: 검증된 QR 코드 정보
- `today`, `now`: 날짜/시간 정보
- `existingRecordId`: 기존 출석 기록 ID
- `recordId`: 생성된 출석 기록 ID
- `smsError`: SMS 발송 실패 정보 (있는 경우)

### 2. `normalizeError` 함수 개선

**파일**: `lib/errors/handler.ts`

Supabase 에러 코드를 더 세분화하여 처리하고, 사용자에게 보여줄 수 있는 메시지를 제공하도록 개선했습니다.

**추가된 Supabase 에러 코드 처리**:
- `PGRST116`: 결과가 0개 행일 때 → "요청한 데이터를 찾을 수 없습니다."
- `42501`: 권한 오류 → "접근 권한이 없습니다."
- `08000`, `08003`, `08006`: 네트워크/연결 오류 → "데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요."

**개선사항**:
- 일반 Error 객체도 개발 환경에서는 실제 메시지를 표시하도록 `isUserFacing` 플래그 조정
- 프로덕션에서는 보안을 위해 일반 메시지 유지

### 3. `logError` 함수 개선

**파일**: `lib/errors/handler.ts`

에러 로깅에 더 많은 컨텍스트를 포함하고, 향후 에러 트래킹 서비스 통합을 준비하도록 개선했습니다.

**개선사항**:
- 컨텍스트에 `timestamp`, `environment` 자동 추가
- Supabase 에러인 경우 `supabaseCode`, `supabaseDetails`, `supabaseHint` 포함
- JSON 직렬화하여 구조화된 로그 출력
- 에러 트래킹 서비스 통합을 위한 주석 추가 (Sentry 등)

## 수정 파일

- `app/(student)/actions/attendanceActions.ts`
- `lib/errors/handler.ts`

## 예상 효과

1. **디버깅 용이성 향상**: 단계별 컨텍스트를 포함한 상세 로그로 에러 원인 파악 시간 단축
2. **사용자 경험 개선**: 가능한 경우 구체적인 에러 메시지 제공
3. **모니터링 준비**: 에러 트래킹 서비스 통합을 위한 구조 마련
4. **유지보수성 향상**: 표준화된 에러 처리로 일관성 확보

## 테스트 시나리오

다음 시나리오에서 에러 로깅이 올바르게 작동하는지 확인해야 합니다:

1. **정상 케이스**: QR 코드 스캔 성공 시 로그 확인
2. **에러 케이스**: 각 단계별 에러 발생 시나리오
   - 인증 실패
   - QR 코드 형식 오류
   - QR 코드 만료/비활성화
   - 테넌트 불일치
   - 중복 체크인
   - DB 연결 실패
3. **로그 출력 확인**: 각 단계별 컨텍스트가 올바르게 로깅되는지 확인

## 주의사항

- QR 코드 데이터는 민감 정보가 아니지만, 전체 데이터 대신 일부만 로깅
- SMS 발송 실패는 출석 기록에 영향을 주지 않도록 별도 처리
- 프로덕션 환경에서는 보안을 위해 일반적인 에러 메시지 유지
- Next.js의 `redirect()`와 `notFound()`는 재throw하여 정상 동작 보장

## 관련 코드

### 개선된 checkInWithQRCode 함수

```24:243:app/(student)/actions/attendanceActions.ts
export async function checkInWithQRCode(
  qrData: string
): Promise<{ success: boolean; error?: string }> {
  const stepContext: Record<string, unknown> = {
    function: "checkInWithQRCode",
    timestamp: new Date().toISOString(),
  };

  try {
    // Step 1: 인증 확인
    stepContext.step = "authentication";
    const user = await requireStudentAuth();
    stepContext.userId = user.userId;
    
    // Step 2: 테넌트 컨텍스트
    stepContext.step = "tenant_context";
    const tenantContext = await getTenantContext();
    stepContext.tenantId = tenantContext?.tenantId;

    // Step 3: QR 코드 검증
    stepContext.step = "qr_verification";
    stepContext.qrDataLength = qrData?.length || 0;
    stepContext.qrDataPreview = qrData?.substring(0, 50) || "";
    
    const verification = await verifyQRCode(qrData);
    if (!verification.valid) {
      const error = new AppError(
        verification.error || "QR 코드가 유효하지 않습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
      logError(error, stepContext);
      throw error;
    }
    stepContext.verifiedQRCodeId = verification.qrCodeId;
    stepContext.verifiedTenantId = verification.tenantId;

    // Step 4: 테넌트 일치 확인
    stepContext.step = "tenant_verification";
    if (verification.tenantId !== tenantContext?.tenantId) {
      const error = new AppError(
        "다른 학원의 QR 코드입니다.",
        ErrorCode.VALIDATION_ERROR,
        403,
        true
      );
      logError(error, {
        ...stepContext,
        verificationTenantId: verification.tenantId,
        contextTenantId: tenantContext?.tenantId,
      });
      throw error;
    }

    // Step 5: 날짜 준비
    stepContext.step = "date_preparation";
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    stepContext.today = today;
    stepContext.now = now;

    // Step 6: 기존 기록 확인
    stepContext.step = "existing_record_check";
    const existing = await findAttendanceByStudentAndDate(user.userId, today);
    if (existing && existing.check_in_time) {
      const error = new AppError(
        "이미 입실 체크가 완료되었습니다.",
        ErrorCode.VALIDATION_ERROR,
        400,
        true
      );
      logError(error, {
        ...stepContext,
        existingRecordId: existing.id,
        existingCheckInTime: existing.check_in_time,
      });
      throw error;
    }
    stepContext.hasExistingRecord = !!existing;
    stepContext.existingRecordId = existing?.id || null;

    // Step 7: 출석 기록 저장
    stepContext.step = "attendance_record_save";
    const record = await recordAttendance({
      student_id: user.userId,
      attendance_date: today,
      check_in_time: now,
      check_in_method: "qr",
      status: "present",
    });
    stepContext.recordId = record.id;
    stepContext.recordStatus = record.status;

    // Step 8: SMS 발송 (비동기, 실패해도 출석 기록은 저장됨)
    stepContext.step = "sms_notification";
    try {
      const tenantContext = await getTenantContext();
      const supabase = await createSupabaseServerClient();

      // 학생 정보 조회
      const { data: student, error: studentError } = await supabase
        .from("students")
        .select("id, name")
        .eq("id", user.userId)
        .single();

      if (studentError) {
        stepContext.smsError = {
          step: "student_fetch",
          error: studentError.message,
          code: studentError.code,
        };
        throw studentError;
      }

      // 학원명 조회
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("name")
        .eq("id", tenantContext?.tenantId)
        .single();

      if (tenantError) {
        stepContext.smsError = {
          step: "tenant_fetch",
          error: tenantError.message,
          code: tenantError.code,
        };
        throw tenantError;
      }

      if (student && tenant) {
        const checkInTime = new Date(now).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        await sendAttendanceSMSIfEnabled(
          user.userId,
          "attendance_check_in",
          {
            학원명: tenant.name,
            학생명: student.name || "학생",
            시간: checkInTime,
          },
          true // 학생 직접 체크인
        );
        stepContext.smsSent = true;
      }
    } catch (smsError) {
      // SMS 발송 실패는 로그만 남기고 무시
      const smsErrorInfo = stepContext.smsError as { step?: string } | undefined;
      logError(normalizeError(smsError), {
        ...stepContext,
        smsErrorStep: smsErrorInfo?.step || "unknown",
      });
      stepContext.smsError = {
        ...(smsErrorInfo || {}),
        ignored: true,
      };
    }

    revalidatePath("/attendance/check-in");
    return { success: true };
  } catch (error) {
    // Next.js의 redirect()와 notFound()는 재throw
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest: string }).digest === "string"
    ) {
      const digest = (error as { digest: string }).digest;
      if (
        digest.startsWith("NEXT_REDIRECT") ||
        digest.startsWith("NEXT_NOT_FOUND")
      ) {
        throw error;
      }
    }

    const normalizedError = normalizeError(error);

    // 최종 에러 로깅 (모든 컨텍스트 포함)
    logError(normalizedError, {
      ...stepContext,
      finalError: true,
      errorMessage: normalizedError.message,
      errorCode: normalizedError.code,
      errorStatusCode: normalizedError.statusCode,
      isUserFacing: normalizedError.isUserFacing,
    });

    return {
      success: false,
      error: getUserFacingMessage(normalizedError),
    };
  }
}
```

### 개선된 normalizeError 함수

```104:189:lib/errors/handler.ts
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // Supabase 에러 처리
    if ("code" in error) {
      const code = (error as { code: string }).code;
      
      // UNIQUE 제약 조건 위반
      if (code === "23505") {
        return new AppError(
          "이미 존재하는 데이터입니다.",
          ErrorCode.DUPLICATE_ENTRY,
          409,
          true
        );
      }
      
      // 외래 키 제약 조건 위반
      if (code === "23503") {
        return new AppError(
          "관련된 데이터를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }
      
      // NOT NULL 제약 조건 위반
      if (code === "23502") {
        return new AppError(
          "필수 입력값이 누락되었습니다.",
          ErrorCode.VALIDATION_ERROR,
          400,
          true
        );
      }

      // PGRST116: 결과가 0개 행일 때 (single() 사용 시)
      if (code === "PGRST116") {
        return new AppError(
          "요청한 데이터를 찾을 수 없습니다.",
          ErrorCode.NOT_FOUND,
          404,
          true
        );
      }

      // 권한 오류
      if (code === "42501") {
        return new AppError(
          "접근 권한이 없습니다.",
          ErrorCode.FORBIDDEN,
          403,
          true
        );
      }

      // 네트워크/연결 오류
      if (code === "08000" || code === "08003" || code === "08006") {
        return new AppError(
          "데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
          ErrorCode.DATABASE_ERROR,
          503,
          true
        );
      }
    }
    
    // 일반 Error는 사용자에게 보여줄 수 있는 메시지로 변환
    // 단, 프로덕션에서는 일반적인 메시지만 반환
    const errorMessage = error.message || "알 수 없는 오류가 발생했습니다.";
    
    return new AppError(
      errorMessage,
      ErrorCode.INTERNAL_ERROR,
      500,
      // 개발 환경에서는 실제 메시지 표시, 프로덕션에서는 일반 메시지
      process.env.NODE_ENV === "development"
    );
  }

  return new AppError(
    "알 수 없는 오류가 발생했습니다.",
    ErrorCode.INTERNAL_ERROR,
    500,
    false
  );
}
```

### 개선된 logError 함수

```64:108:lib/errors/handler.ts
export function logError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  const errorInfo: Record<string, unknown> = {
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: {
      ...context,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
    },
  };

  // AppError인 경우 추가 정보 포함
  if (error instanceof AppError) {
    errorInfo.code = error.code;
    errorInfo.statusCode = error.statusCode;
    errorInfo.isUserFacing = error.isUserFacing;
    errorInfo.name = error.name;
    if (error.details) {
      errorInfo.details = error.details;
    }
  } else if (error instanceof Error) {
    errorInfo.name = error.name;
    
    // Supabase 에러인 경우 추가 정보
    if ("code" in error) {
      errorInfo.supabaseCode = (error as { code: string }).code;
      errorInfo.supabaseDetails = (error as { details?: unknown }).details;
      errorInfo.supabaseHint = (error as { hint?: string }).hint;
    }
  }

  // 개발 환경에서는 console.error 사용
  if (process.env.NODE_ENV === "development") {
    console.error("[Error]", JSON.stringify(errorInfo, null, 2));
  } else {
    // 프로덕션에서는 에러 트래킹 서비스로 전송
    // 예: Sentry, LogRocket 등
    console.error("[Error]", JSON.stringify(errorInfo, null, 2));
    
    // TODO: 에러 트래킹 서비스 통합
    // if (typeof window !== 'undefined' && window.Sentry) {
    //   window.Sentry.captureException(error, { extra: errorInfo });
    // }
  }
}
```

## 참고 사항

- 에러 로깅은 개발 환경과 프로덕션 환경 모두에서 구조화된 JSON 형식으로 출력됩니다.
- 향후 Sentry, LogRocket 등의 에러 트래킹 서비스 통합을 위한 구조가 준비되어 있습니다.
- 각 단계별 에러 발생 시 해당 단계의 컨텍스트가 모두 포함되어 로깅되므로, 원인 파악이 용이합니다.

