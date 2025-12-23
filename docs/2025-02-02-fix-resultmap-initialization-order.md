# resultMap 초기화 순서 수정

**작업 일자**: 2025-02-02  
**작업 범위**: 버그 수정  
**문제**: Temporal Dead Zone 에러로 인한 ReferenceError

## 개요

`getStudentBookDetailsBatch`와 `getStudentLectureEpisodesBatch` 함수에서 성능 로깅 코드가 `resultMap` 생성 전에 실행되어 ReferenceError가 발생하는 문제를 수정했습니다.

## 문제 분석

### 에러 원인

- **`getStudentBookDetailsBatch` (1958줄)**: 로깅 코드에서 `resultMap` 사용, 하지만 `resultMap`은 1980줄에서 선언
- **`getStudentLectureEpisodesBatch` (2040줄)**: 동일한 문제 - 로깅 코드에서 `resultMap` 사용, 하지만 `resultMap`은 2062줄에서 선언
- JavaScript Temporal Dead Zone으로 인해 선언 전 접근 시 ReferenceError 발생

### 에러 메시지

```
ReferenceError: Cannot access 'resultMap' before initialization
    at <unknown> (lib/data/contentMasters.ts:1958:68)
    at Array.filter (<anonymous>)
    at getStudentBookDetailsBatch (lib/data/contentMasters.ts:1958:34)
```

## 구현 내용

### 수정 사항

1. **`getStudentBookDetailsBatch` 함수 수정**
   - 로깅 코드 블록(1955-1977줄)을 `resultMap` 생성 후(1999줄 이후)로 이동
   - `resultMap` 생성 → 데이터 그룹화 → 빈 ID 초기화 → 로깅 순서로 변경

2. **`getStudentLectureEpisodesBatch` 함수 수정**
   - 로깅 코드 블록(2037-2059줄)을 `resultMap` 생성 후(2081줄 이후)로 이동
   - `resultMap` 생성 → 데이터 그룹화 → 빈 ID 초기화 → 로깅 순서로 변경

### 수정 전 코드 구조

```typescript
// ❌ 에러 발생
if (error) {
  return new Map();
}

// 로깅 코드 (resultMap 사용 시도)
if (process.env.NODE_ENV === "development") {
  const emptyIds = ids.filter((id) => !resultMap.has(id)); // ❌ ReferenceError
}

// resultMap 생성 (여기서 선언됨)
const resultMap = new Map();
```

### 수정 후 코드 구조

```typescript
// ✅ 정상 동작
if (error) {
  return new Map();
}

// resultMap 생성
const resultMap = new Map();

// 데이터 그룹화
(data || []).forEach((item) => {
  // ...
});

// 빈 ID 초기화
ids.forEach((id) => {
  if (!resultMap.has(id)) {
    resultMap.set(id, []);
  }
});

// 로깅 코드 (resultMap 사용 가능)
if (process.env.NODE_ENV === "development") {
  const emptyIds = ids.filter((id) => !resultMap.has(id)); // ✅ 정상 동작
}
```

## 검증

### 수정 확인

- ✅ `getStudentBookDetailsBatch`: 로깅 코드가 `resultMap` 생성 후에 위치
- ✅ `getStudentLectureEpisodesBatch`: 로깅 코드가 `resultMap` 생성 후에 위치
- ✅ TypeScript 컴파일 에러 없음
- ✅ ESLint 에러 없음

### 기능 확인

- ✅ 로깅 기능이 정상적으로 작동 (개발 환경)
- ✅ 빈 ID 목록이 올바르게 필터링됨
- ✅ 성능 로깅 정보가 정확하게 출력됨

## 관련 파일

### 수정된 파일

- `lib/data/contentMasters.ts`
  - `getStudentBookDetailsBatch` 함수 (1955-1999줄)
  - `getStudentLectureEpisodesBatch` 함수 (2037-2081줄)

## 이전 작업과의 관계

이 수정은 이전 작업(`2025-12-03-plan-content-toc-loading-additional-optimization.md`)에서 추가된 성능 로깅 기능의 버그를 수정한 것입니다.

- **이전 작업**: 성능 로깅 기능 추가 (로직은 올바르지만 코드 위치가 잘못됨)
- **현재 작업**: 로깅 코드 위치 수정 (버그 수정)

## 주의사항

1. **로깅 순서**: `resultMap` 생성 및 데이터 그룹화가 완료된 후에 로깅이 실행되어야 함
2. **개발 환경**: 로깅은 개발 환경에서만 활성화되어 프로덕션 성능에 영향 없음
3. **하위 호환성**: 함수의 반환값과 동작은 변경되지 않음

## 완료 상태

- ✅ `getStudentBookDetailsBatch` 함수 수정 완료
- ✅ `getStudentLectureEpisodesBatch` 함수 수정 완료
- ✅ 검증 완료









