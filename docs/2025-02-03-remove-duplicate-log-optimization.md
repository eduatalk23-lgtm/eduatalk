# 중복 로그 제거 최적화

## 작업 일자
2025-02-03

## 문제점

현재 `RangeSettingModal`과 `ContentRangeInput`에서 동일한 상황(상세 정보 없음)에 대해 중복으로 로그를 출력하고 있었습니다:

1. `RangeSettingModal.tsx:177` - 상세 정보 조회 후 로그 출력
2. `ContentRangeInput.tsx:111` - 상세 정보 없을 때 로그 출력

두 로그가 같은 콘텐츠에 대해 중복으로 출력되어 불필요한 로깅 오버헤드가 발생했습니다.

## 해결 방안

`ContentRangeInput`의 로그를 제거했습니다. 이유:
- `ContentRangeInput`은 `RangeSettingModal`에서만 사용됨
- `RangeSettingModal`이 이미 상세 정보를 조회하고 로그를 출력함
- `ContentRangeInput`은 단순히 UI를 렌더링하는 역할만 수행

## 구현 내용

### 파일: `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`

**변경사항**:

1. **상세 정보 없음 로그 출력 코드 제거** (108-118줄)
   - `console.debug` 호출 제거
   - 로그 출력 관련 조건문 제거

2. **불필요한 ref 제거**
   - `hasLoggedNoDetails` ref 제거 (39-40줄)
   - `prevDetailsLength` ref 제거 (41줄)
   - ref 리셋 로직 제거 (43-47줄)

3. **불필요한 import 제거**
   - `useRef` import 제거 (더 이상 사용하지 않음)

**변경 전**:
```typescript
// 중복 로그 방지를 위한 ref (details가 변경될 때마다 리셋)
const hasLoggedNoDetails = useRef(false);
const prevDetailsLength = useRef(details.length);

// details가 변경되면 로그 플래그 리셋
if (prevDetailsLength.current !== details.length) {
  prevDetailsLength.current = details.length;
  hasLoggedNoDetails.current = false;
}

// 상세 정보가 없을 때 직접 입력 모드
if (!hasDetails) {
  // 상세정보가 없는 경우 로깅 (개발 환경에서만, 한 번만)
  if (process.env.NODE_ENV === "development" && !hasLoggedNoDetails.current) {
    hasLoggedNoDetails.current = true;
    console.debug("[ContentRangeInput] 상세정보 없음 (정상):", {
      type: "NO_DETAILS",
      contentType: type,
      detailsLength: details.length,
      reason: "해당 콘텐츠에 목차/회차 정보가 없습니다. 사용자가 범위를 직접 입력해야 합니다.",
    });
  }
  // ...
}
```

**변경 후**:
```typescript
// 상세 정보가 없을 때 직접 입력 모드
if (!hasDetails) {
  // 로그 제거 (RangeSettingModal에서 이미 로그 출력)
  // ...
}
```

## 예상 효과

- **중복 로그 제거**: 콘솔 출력 감소
- **메모리 사용량 감소**: 불필요한 ref 관리 제거
- **코드 단순화**: 로그 관련 로직 제거로 가독성 향상

## 변경 파일

### 수정 파일
- `app/(student)/plan/new-group/_components/_shared/ContentRangeInput.tsx`

### 참고 파일
- `app/(student)/plan/new-group/_components/_shared/RangeSettingModal.tsx` (상위 컴포넌트에서 로그 출력)

## 테스트 확인 사항

- [x] 중복 로그 제거 확인
- [x] 불필요한 ref 제거 확인
- [x] 불필요한 import 제거 확인
- [x] 린터 오류 없음 확인
- [x] RangeSettingModal에서만 로그 출력 확인

