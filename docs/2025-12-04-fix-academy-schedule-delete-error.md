# 학원 일정 삭제 오류 수정

## 작업 일시
2025-12-04

## 문제 상황
학생이 학원 일정을 삭제하려고 할 때 오류가 발생함

## 원인 분석
1. **에러 처리 부족**: 클라이언트에서 Server Action 에러를 처리할 때 에러 객체의 구조를 제대로 확인하지 않음
2. **Supabase 에러 코드 미처리**: `PGRST116` (no rows returned) 에러 코드를 처리하지 않아 불필요한 에러 발생 가능
3. **에러 로깅 부족**: 실제 발생한 에러의 상세 정보를 확인하기 어려움

## 수정 내용

### 1. 클라이언트 측 에러 처리 개선
`AcademyScheduleManagement.tsx`의 `handleDeleteSchedule` 함수 개선

**변경 전**:
```typescript
catch (error: any) {
  alert(error.message || "학원 일정 삭제에 실패했습니다.");
}
```

**변경 후**:
```typescript
catch (error: unknown) {
  console.error("[AcademyScheduleManagement] 학원 일정 삭제 실패", error);
  
  // 에러 메시지 추출
  let errorMessage = "학원 일정 삭제에 실패했습니다.";
  if (error instanceof Error) {
    errorMessage = error.message || errorMessage;
  } else if (error && typeof error === "object" && "message" in error) {
    errorMessage = String(error.message) || errorMessage;
  }
  
  alert(errorMessage);
}
```

### 2. 서버 측 에러 처리 개선
`academy.ts`의 `_deleteAcademySchedule` 함수 개선

**변경 전**:
```typescript
const { data: schedule, error: fetchError } = await supabase
  .from("academy_schedules")
  .select("student_id")
  .eq("id", scheduleId)
  .single();

if (fetchError || !schedule) {
  throw new AppError(
    "학원 일정을 찾을 수 없습니다.",
    ErrorCode.NOT_FOUND,
    404,
    true
  );
}
```

**변경 후**:
```typescript
const { data: schedule, error: fetchError } = await supabase
  .from("academy_schedules")
  .select("student_id")
  .eq("id", scheduleId)
  .maybeSingle();

// PGRST116은 "no rows returned" 에러이므로 정상적인 경우 (데이터 없음)
if (fetchError && fetchError.code !== "PGRST116") {
  console.error("[_deleteAcademySchedule] 학원 일정 조회 실패", {
    scheduleId,
    errorCode: fetchError.code,
    errorMessage: fetchError.message,
  });
  throw new AppError(
    fetchError.message || "학원 일정 조회 중 오류가 발생했습니다.",
    ErrorCode.DATABASE_ERROR,
    500,
    true,
    { supabaseError: fetchError }
  );
}

if (!schedule) {
  throw new AppError(
    "학원 일정을 찾을 수 없습니다.",
    ErrorCode.NOT_FOUND,
    404,
    true
  );
}
```

## 개선 사항
1. **에러 타입 안전성**: `any` 대신 `unknown` 사용하여 타입 안전성 향상
2. **에러 메시지 추출**: 다양한 에러 객체 구조에 대응할 수 있도록 개선
3. **에러 로깅**: 콘솔에 상세한 에러 정보 로깅 추가
4. **Supabase 에러 처리**: `PGRST116` 에러 코드를 정상 케이스로 처리
5. **maybeSingle() 사용**: 데이터가 없을 때 에러 대신 `null` 반환

## 수정 파일
- `app/(student)/blocks/_components/AcademyScheduleManagement.tsx`
- `app/(student)/actions/plan-groups/academy.ts`

## 검증
- 린터 에러 없음 확인
- 타입 안전성 향상
- 에러 처리 로직 개선

