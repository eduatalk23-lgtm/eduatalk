# 범위 설정 모달 - 직접 입력 개선

## 작업 일시
2025-01-30

## 문제점

**상세 정보(목차)가 없어서 범위 설정 진행 시 시작, 종료 범위를 수정할 수 없는 문제**

1. **시작 시점을 바꿀 수 없음**
   - 시작 범위 입력 필드에 값을 입력해도 기본값 "1"로 고정됨
   - `ContentRangeInput`에서 `startRange || "1"`로 기본값을 강제 설정

2. **종료 범위를 완전하게 바꿀 수 없음**
   - 종료 범위 입력을 모두 지우면 마지막 범위로 복귀함
   - `ContentRangeInput`에서 `endRange || (maxValue ? String(maxValue) : "100")`로 기본값을 강제 설정

## 원인 분석

1. **기본값 강제 설정**
   - `ContentRangeInput.tsx`에서 `currentStart = startRange || "1"`로 되어 있어 빈 값이 기본값으로 대체됨
   - `currentEnd = endRange || (maxValue ? String(maxValue) : "100")`로 되어 있어 빈 값이 기본값으로 대체됨
   - 사용자가 입력을 지워도 기본값으로 복귀하여 수정이 불가능함

2. **초기화 로직 문제**
   - `RangeSettingModal.tsx`에서 초기화 시 `setStartRange(startMatch ? startMatch[0] : "1")`로 기본값 설정
   - 빈 값을 허용하지 않아 사용자가 입력을 지울 수 없음

## 해결 방법

### 1. 빈 값 허용하도록 수정

**파일**: `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`

```typescript
// 빈 값을 허용하도록 수정 (기본값으로 대체하지 않음)
const currentStart = startRange ?? "";
const currentEnd = endRange ?? "";
```

**효과**:
- 빈 값도 허용하여 사용자가 입력을 완전히 지울 수 있음
- 기본값으로 자동 복귀하지 않음

### 2. 초기화 로직 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

```typescript
// 직접 입력 값 초기화 (상세 정보가 없을 때)
if (!currentRange.start_detail_id && !currentRange.end_detail_id) {
  const startMatch = currentRange.start?.match(/\d+/);
  const endMatch = currentRange.end?.match(/\d+/);
  // 빈 값도 허용 (기본값으로 대체하지 않음)
  setStartRange(startMatch ? startMatch[0] : "");
  setEndRange(endMatch ? endMatch[0] : "");
} else {
  setStartRange(null);
  setEndRange(null);
}
```

**효과**:
- 초기화 시에도 빈 값을 허용하여 사용자가 자유롭게 입력할 수 있음
- 기본값으로 강제 설정하지 않음

### 3. 검증 로직 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

```typescript
// 상세 정보가 없을 때 (직접 입력)
// 빈 문자열 체크 (null, undefined, 빈 문자열 모두 체크)
if (!startRange || startRange.trim() === "" || !endRange || endRange.trim() === "") {
  setError("시작과 종료 범위를 모두 입력해주세요.");
  return;
}

const startNum = Number(startRange);
const endNum = Number(endRange);

if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum <= 0) {
  setError("1 이상의 올바른 숫자를 입력해주세요.");
  return;
}
```

**효과**:
- 빈 값에 대한 명확한 검증
- 저장 시에만 빈 값 체크하여 입력 중에는 자유롭게 수정 가능

### 4. 유효성 검사 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

```typescript
const isValid = hasDetails
  ? startDetailId && endDetailId
  : startRange && startRange.trim() !== "" && 
    endRange && endRange.trim() !== "" && 
    Number(startRange) > 0 && 
    Number(endRange) > 0 && 
    Number(startRange) <= Number(endRange);
```

**효과**:
- 빈 문자열도 명확하게 체크
- 저장 버튼 활성화 조건이 명확해짐

### 5. 변경 감지 개선

**파일**: `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`

```typescript
} else {
  // 상세 정보가 없을 때 (직접 입력)
  const currentStart = currentRange?.start ? currentRange.start.replace(/[^\d]/g, "") : "";
  const currentEnd = currentRange?.end ? currentRange.end.replace(/[^\d]/g, "") : "";
  // 빈 값도 비교에 포함 (기본값으로 대체하지 않음)
  changed =
    (startRange ?? "") !== currentStart ||
    (endRange ?? "") !== currentEnd;
}
```

**효과**:
- 빈 값도 변경으로 인식하여 모달 닫기 시 확인 메시지 표시
- 기본값으로 대체하지 않아 정확한 변경 감지

## 변경된 파일

1. `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`
   - 빈 값 허용하도록 수정 (`startRange ?? ""`, `endRange ?? ""`)
   - 기본값으로 자동 대체하지 않음

2. `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx`
   - 초기화 시 빈 값 허용
   - 검증 로직 개선 (빈 문자열 명확히 체크)
   - 유효성 검사 개선
   - 변경 감지 개선

## 테스트 시나리오

1. **시작 범위 수정 테스트**
   - 상세 정보가 없는 콘텐츠의 범위 설정 모달 열기
   - 시작 범위 입력 필드에 값 입력
   - 입력한 값이 그대로 유지되는지 확인
   - 입력을 지워도 기본값으로 복귀하지 않는지 확인

2. **종료 범위 수정 테스트**
   - 종료 범위 입력 필드에 값 입력
   - 입력한 값이 그대로 유지되는지 확인
   - 입력을 모두 지워도 기본값으로 복귀하지 않는지 확인
   - 새로운 값을 입력할 수 있는지 확인

3. **저장 검증 테스트**
   - 시작 또는 종료 범위를 비운 상태로 저장 시도
   - "시작과 종료 범위를 모두 입력해주세요." 에러 메시지 표시 확인
   - 유효한 범위 입력 후 저장 성공 확인

4. **변경 감지 테스트**
   - 범위를 수정한 후 모달 닫기 시도
   - "변경 사항이 저장되지 않았습니다. 정말 닫으시겠습니까?" 확인 메시지 표시 확인

## 참고사항

- 빈 값은 입력 중에는 허용되지만 저장 시에는 검증됨
- 기본값은 placeholder로만 표시되고 실제 값으로 설정되지 않음
- 사용자가 명시적으로 값을 입력해야 저장 가능

