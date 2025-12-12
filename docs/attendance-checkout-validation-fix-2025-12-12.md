# 출석 퇴실 검증 로직 수정 (2025-12-12)

## 문제 상황

QR 코드로 입실 후 퇴실 처리 시 다음 검증 오류가 발생:

```
[Error] {
  "message": "퇴실 시간이 있으면 입실 시간도 필요합니다.",
  "code": "VALIDATION_ERROR",
  "details": {
    "validationErrors": [
      {
        "field": "check_out_time",
        "message": "퇴실 시간이 있으면 입실 시간도 필요합니다.",
        "code": "CHECK_OUT_WITHOUT_CHECK_IN"
      },
      {
        "field": "check_out_method",
        "message": "퇴실 방법이 있으면 입실 방법도 필요합니다.",
        "code": "CHECK_OUT_METHOD_WITHOUT_CHECK_IN_METHOD"
      },
      {
        "field": "check_in_time",
        "message": "이미 입실 기록이 있습니다.",
        "code": "DUPLICATE_CHECK_IN"
      }
    ]
  }
}
```

### 근본 원인

검증 로직이 입력값(`input`)만 확인하고 기존 기록(`existing`)의 입실 정보를 고려하지 않음

- `checkOutWithQRCode`에서 퇴실 처리 시 `check_in_time`과 `check_in_method`를 전달하지 않음
- `validateAttendanceTimes`가 입력값의 `check_in_time`만 확인
- `validateAttendanceMethodConsistency`가 입력값의 `check_in_method`만 확인
- `validateNoDuplicateAttendance`가 업데이트 시에도 중복 체크를 수행

## 수정 내용

### 수정 파일

- `lib/domains/attendance/service.ts`

### 주요 변경사항

#### 1. `validateAttendanceTimes` 함수 수정

- 함수 시그니처에 `existingRecord` 파라미터 추가
- `check_out_time`이 있고 `check_in_time`이 없을 때, 기존 기록의 `check_in_time` 확인
- 시간 순서 검증 시 기존 기록의 `check_in_time`도 함께 고려

```typescript
export function validateAttendanceTimes(
  record: AttendanceRecord | CreateAttendanceRecordInput | UpdateAttendanceRecordInput,
  existingRecord?: AttendanceRecord | null  // 추가
): ValidationResult
```

#### 2. `validateAttendanceMethodConsistency` 함수 수정

- 함수 시그니처에 `existingRecord` 파라미터 추가
- `check_out_method`가 있고 `check_in_method`가 없을 때, 기존 기록의 `check_in_method` 확인
- 방법 일관성 검증 시 기존 기록의 `check_in_method`도 함께 고려

```typescript
export function validateAttendanceMethodConsistency(
  record: AttendanceRecord | CreateAttendanceRecordInput | UpdateAttendanceRecordInput,
  existingRecord?: AttendanceRecord | null  // 추가
): ValidationResult
```

#### 3. `validateNoDuplicateAttendance` 함수 수정

- 함수 시그니처에 `input` 파라미터 추가
- 업데이트 시나리오 구분: 입실만 업데이트하는지, 퇴실만 업데이트하는지 확인
- 입실 시간 업데이트 시에만 중복 체크 수행
- 퇴실 시간만 업데이트하는 경우는 중복 체크 생략

```typescript
export async function validateNoDuplicateAttendance(
  studentId: string,
  date: string,
  input: CreateAttendanceRecordInput | UpdateAttendanceRecordInput,  // 추가
  existingRecord?: AttendanceRecord | null
): Promise<ValidationResult>
```

#### 4. `validateAttendanceRecord` 함수 수정

- `validateAttendanceTimes`와 `validateAttendanceMethodConsistency` 호출 시 `existingRecord` 전달
- `validateNoDuplicateAttendance` 호출 시 `input` 전달

## 검증 로직 개선

### 변경 전

```typescript
// validateAttendanceTimes
if (checkOutTime && !checkInTime) {
  errors.push({
    field: "check_out_time",
    message: "퇴실 시간이 있으면 입실 시간도 필요합니다.",
    code: "CHECK_OUT_WITHOUT_CHECK_IN",
  });
}
```

### 변경 후

```typescript
// validateAttendanceTimes
if (checkOutTime && !checkInTime) {
  // 기존 기록의 입실 시간 확인
  const existingCheckInTime = existingRecord?.check_in_time;
  if (!existingCheckInTime) {
    errors.push({
      field: "check_out_time",
      message: "퇴실 시간이 있으면 입실 시간도 필요합니다.",
      code: "CHECK_OUT_WITHOUT_CHECK_IN",
    });
  }
}
```

## 테스트 시나리오

수정 후 다음 시나리오가 정상 동작해야 함:

1. ✅ **QR 입실 → QR 퇴실**: 정상 처리
2. ✅ **QR 입실 → 위치 퇴실**: 방법 불일치 에러 (기존 동작 유지)
3. ✅ **위치 입실 → QR 퇴실**: 방법 불일치 에러 (기존 동작 유지)
4. ✅ **중복 입실 시도**: 중복 에러 (기존 동작 유지)
5. ✅ **중복 퇴실 시도**: 중복 에러 (기존 동작 유지)
6. ✅ **입실 없이 퇴실 시도**: 입실 기록 없음 에러 (기존 동작 유지)

## 영향 범위

- **수정 파일**: `lib/domains/attendance/service.ts` (검증 함수 4개)
- **영향 받는 함수**: 
  - `recordAttendance` (검증 로직 사용)
  - `checkInWithQRCode` (간접 영향)
  - `checkOutWithQRCode` (간접 영향, 문제 해결)
  - `checkInWithLocation` (간접 영향)
  - `checkOutWithLocation` (간접 영향)

## 주의사항

1. **하위 호환성**: 기존 검증 로직의 다른 케이스는 모두 유지
2. **타입 안전성**: `existingRecord`는 optional이므로 null 체크 필수
3. **에러 메시지**: 기존 에러 메시지와 코드는 변경하지 않음

## 참고

- 계획 문서: `.plan.md`
- 관련 이슈: QR 입실 후 퇴실 처리 시 검증 오류

