# 교재 수정 시 school_type enum 검증 오류 수정

**작업일**: 2025-02-02  
**관련 파일**: `lib/utils/masterContentFormHelpers.ts`

## 문제 상황

교재 수정 시 다음과 같은 오류가 발생했습니다:

```
Invalid enum value. Expected 'MIDDLE' | 'HIGH' | 'OTHER', received ''
```

### 원인 분석

1. **폼에서 빈 문자열 전달**: 교재 수정 폼에서 `school_type` 필드가 선택되지 않으면 빈 문자열(`""`)이 전달됨
2. **파싱 로직 문제**: `parseMasterBookUpdateFormData` 함수에서 `getFormValue("school_type") || undefined`를 사용하여 빈 문자열이 `null`로 변환되지만, `|| undefined`로 인해 `undefined`가 되어 필터링됨
3. **데이터베이스 제약**: `master_books` 테이블의 `school_type` 컬럼은 `CHECK (school_type IS NULL OR school_type IN ('MIDDLE','HIGH','OTHER'))` 제약이 있어 빈 문자열을 허용하지 않음

## 해결 방법

### 1. `getSchoolTypeValue` 전용 헬퍼 함수 추가

`school_type` 필드 전용 헬퍼 함수를 추가하여:
- 빈 문자열을 `null`로 변환
- 유효한 enum 값(`MIDDLE`, `HIGH`, `OTHER`)만 허용
- 유효하지 않은 값은 `null`로 처리

```typescript
const getSchoolTypeValue = (): string | null | undefined => {
  const value = formData.get("school_type");
  if (value === null) return undefined; // 폼에 필드가 없음 → 업데이트하지 않음
  const str = value.toString().trim();
  if (str === "") return null; // 빈 문자열 → null로 설정 (삭제)
  // 유효한 enum 값인지 확인
  if (str === "MIDDLE" || str === "HIGH" || str === "OTHER") {
    return str;
  }
  // 유효하지 않은 값이면 null로 처리
  return null;
};
```

### 2. `school_type` 필드에 전용 헬퍼 적용

기존 코드:
```typescript
school_type: getFormValue("school_type") || undefined,
```

수정된 코드:
```typescript
school_type: getSchoolTypeValue(), // 수정: 전용 헬퍼 사용 (빈 문자열 → null 처리)
```

## 변경 사항

### 수정된 파일

- `lib/utils/masterContentFormHelpers.ts`
  - `parseMasterBookUpdateFormData` 함수에 `getSchoolTypeValue` 헬퍼 추가
  - `school_type` 필드에 전용 헬퍼 적용

## 테스트 시나리오

1. ✅ 교재 수정 시 `school_type`을 선택하지 않으면 → `null`로 저장됨
2. ✅ 교재 수정 시 `school_type`을 "중학교"로 선택하면 → `"MIDDLE"`로 저장됨
3. ✅ 교재 수정 시 `school_type`을 "고등학교"로 선택하면 → `"HIGH"`로 저장됨
4. ✅ 교재 수정 시 `school_type`을 "기타"로 선택하면 → `"OTHER"`로 저장됨
5. ✅ 유효하지 않은 값이 전달되면 → `null`로 처리되어 오류 없이 저장됨

## 참고 사항

- 데이터베이스 스키마: `school_type` 컬럼은 `NULL`을 허용하며, 값이 있을 경우 `MIDDLE`, `HIGH`, `OTHER` 중 하나여야 함
- 폼 필드: `MasterBookEditForm.tsx`에서 `school_type` 필드는 선택 사항이며, 기본값으로 빈 문자열(`""`)이 설정됨

