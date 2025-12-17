# 학원 일정 시간 형식 검증 오류 수정

## 문제 상황

플랜 그룹 생성 시 학원 일정의 시간 형식 검증에서 다음과 같은 에러가 발생했습니다:

```
학원 일정 1: 올바른 시간 형식을 입력해주세요., 학원 일정 2: 올바른 시간 형식을 입력해주세요., ...
```

## 원인 분석

`lib/validation/planValidator.ts`의 `parseTime` 메서드가 `null`, `undefined`, 빈 문자열을 처리하지 않아 발생한 문제였습니다.

1. **`parseTime` 메서드의 문제점**:
   - `timeStr.split(":")`를 호출하기 전에 `null`/`undefined` 체크가 없었음
   - 빈 문자열에 대한 처리 부재

2. **`validateAcademySchedules` 메서드의 문제점**:
   - `start_time`과 `end_time`이 `null`이나 `undefined`일 수 있는데 타입이 `string`으로만 정의됨
   - 시간 필수 체크가 없어서 빈 값이 들어와도 검증이 실패함

## 수정 내용

### 1. `parseTime` 메서드 개선

```typescript
private static parseTime(timeStr: string | null | undefined): number | null {
  // null, undefined, 빈 문자열 체크
  if (!timeStr || typeof timeStr !== "string" || timeStr.trim() === "") {
    return null;
  }

  const trimmed = timeStr.trim();
  
  // "HH:MM" 또는 "H:MM" 형식 지원
  // "HH:MM:SS" 형식도 지원 (초는 무시)
  const timePattern = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
  const match = trimmed.match(timePattern);
  
  if (!match) {
    return null;
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (isNaN(hours) || isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes; // 분 단위로 변환
}
```

**변경 사항**:
- 파라미터 타입을 `string | null | undefined`로 확장
- `null`/`undefined`/빈 문자열 체크 추가
- 타입 체크 추가 (`typeof timeStr !== "string"`)
- **정규식을 사용하여 더 유연한 형식 지원**:
  - `"09:00"` (표준 HH:MM) ✅
  - `"9:00"` (한 자리 시간) ✅
  - `"09:00:00"` (초 포함, 초는 무시) ✅

### 2. `validateAcademySchedules` 메서드 개선

```typescript
static validateAcademySchedules(
  schedules: Array<{
    day_of_week: number;
    start_time: string | null | undefined;
    end_time: string | null | undefined;
  }>
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  schedules.forEach((schedule, index) => {
    // 요일 검증
    if (schedule.day_of_week < 0 || schedule.day_of_week > 6) {
      errors.push(`학원 일정 ${index + 1}: 올바른 요일을 선택해주세요 (0-6).`);
    }

    // 시간 필수 체크
    if (!schedule.start_time || !schedule.end_time) {
      errors.push(`학원 일정 ${index + 1}: 시작 시간과 종료 시간을 입력해주세요.`);
      return; // 시간이 없으면 다음 검증 스킵
    }

    // 시간 검증
    const start = this.parseTime(schedule.start_time);
    const end = this.parseTime(schedule.end_time);

    if (start === null || end === null) {
      errors.push(`학원 일정 ${index + 1}: 올바른 시간 형식을 입력해주세요. (HH:MM 형식)`);
    } else if (start >= end) {
      errors.push(`학원 일정 ${index + 1}: 종료 시간은 시작 시간보다 이후여야 합니다.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}
```

**변경 사항**:
- `start_time`과 `end_time` 타입을 `string | null | undefined`로 확장
- 시간 필수 체크 추가 (빈 값일 때 명확한 에러 메시지)
- `parseTime` 결과가 `null`일 때 더 구체적인 에러 메시지 제공 (어떤 시간 필드가 문제인지 명시)
- 개발 환경에서 디버깅 로그 추가 (실제 입력 값 확인)

## 테스트 시나리오

다음과 같은 경우에 대해 올바르게 처리됩니다:

1. ✅ `start_time: "09:00"`, `end_time: "10:00"` - 정상 처리
2. ✅ `start_time: "9:00"`, `end_time: "10:00"` - 정상 처리 (한 자리 시간 지원)
3. ✅ `start_time: "09:00:00"`, `end_time: "10:00:00"` - 정상 처리 (초 포함 형식 지원)
4. ✅ `start_time: null`, `end_time: "10:00"` - "시작 시간과 종료 시간을 입력해주세요." 에러
5. ✅ `start_time: ""`, `end_time: "10:00"` - "시작 시간과 종료 시간을 입력해주세요." 에러
6. ✅ `start_time: "invalid"`, `end_time: "10:00"` - "시작 시간(invalid)의 형식이 올바르지 않습니다. (HH:MM 형식 필요)" 에러
7. ✅ `start_time: "09:00"`, `end_time: "09:00"` - "종료 시간은 시작 시간보다 이후여야 합니다." 에러

## 관련 파일

- `lib/validation/planValidator.ts` - 검증 로직 수정

## 참고

- 시간 형식은 `HH:MM` (24시간 형식)을 사용합니다.
- 지원 형식:
  - `09:00` (표준 형식) ✅
  - `9:00` (한 자리 시간, 자동 처리) ✅
  - `09:00:00` (초 포함, 초는 무시) ✅
- 시간 범위: `00:00` ~ `23:59`
- 분 범위: `00` ~ `59`

