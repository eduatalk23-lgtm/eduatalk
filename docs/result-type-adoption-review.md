# Result 타입 도입 검토 문서

## 📋 개요

이 문서는 `lib/utils` 디렉토리에서 Result 타입 도입의 필요성과 방법을 검토한 결과입니다.

**작성일**: 2025-02-04  
**작업**: Phase 3.2 - Result 타입 도입 검토

---

## 🔍 현재 에러 처리 패턴 분석

### 발견된 패턴

프로젝트에서 사용 중인 에러 처리 패턴은 다음과 같습니다:

#### 1. null 반환 패턴

**사용 예시**:
```typescript
// lib/utils/contentDetailsUtils.ts
export function transformBatchResponse(
  // ...
): ContentDetailsResponse | null {
  const contentData = batchResponse[contentId];
  if (!contentData) {
    return null; // ❌ 에러 이유를 알 수 없음
  }
  // ...
}
```

**특징**:
- 에러 이유를 알 수 없음
- null 체크 필요
- 타입 안전성 낮음

#### 2. throw 패턴

**사용 예시**:
```typescript
// lib/utils/formDataHelpers.ts
export function getFormString(
  formData: FormData,
  key: string,
  options?: { required?: boolean }
): string {
  const value = formData.get(key);
  if (!value && options?.required) {
    throw new Error(`${key}는 필수입니다.`); // ❌ 호출자가 항상 try-catch 필요
  }
  return value?.toString() || "";
}
```

**특징**:
- 호출자가 항상 try-catch 필요
- 제어 흐름이 복잡해짐
- 비동기 함수에서 에러 추적 어려움

#### 3. 객체 반환 패턴

**사용 예시**:
```typescript
// lib/utils/phone.ts
export function validatePhoneNumber(
  phone: string
): { valid: boolean; error?: string } {
  // ...
  return { valid: false, error: "올바른 전화번호 형식이 아닙니다" };
}

// lib/utils/rangeValidation.ts
export type RangeValidationResult = {
  valid: boolean;
  error?: string;
  parsedStart?: number;
  parsedEnd?: number;
};
```

**특징**:
- 에러 정보 제공 가능
- 패턴이 일관되지 않음
- 타입 안전성 중간 수준

#### 4. Result 타입 패턴 (일부 사용 중)

**사용 예시**:
```typescript
// lib/utils/campErrorHandler.ts
export type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code?: string };

export async function withCampErrorHandling<T>(
  operation: () => Promise<T>,
  errorMessage: string
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: errorMessage,
      code: error instanceof Error ? error.message : String(error),
    };
  }
}
```

**특징**:
- 타입 안전성 높음
- 에러 정보 명확
- 패턴이 일부 파일에만 사용됨

---

## 📊 패턴별 사용 통계

| 패턴 | 사용 파일 수 | 특징 |
|------|-------------|------|
| null 반환 | 많음 | 에러 이유 불명확 |
| throw | 중간 | 제어 흐름 복잡 |
| 객체 반환 | 많음 | 패턴 불일치 |
| Result 타입 | 1개 파일 | 타입 안전성 높음 |

---

## 🎯 Result 타입 도입 검토

### typescript-result 라이브러리

**라이브러리 정보**:
- 이름: `typescript-result`
- Context7 ID: `/everweij/typescript-result`
- 설명: Rust와 Kotlin에서 영감을 받은 Result 타입으로, TypeScript의 강력한 타입 시스템을 활용하여 에러 처리를 단순화하고 코드를 더 읽기 쉽고 유지보수하기 쉽게 만듭니다.
- 소스 평판: High
- 코드 스니펫: 100개

**주요 특징**:
- 완전한 타입 안전성
- 함수형 프로그래밍 스타일
- 메서드 체이닝 지원
- 패턴 매칭 지원

### 도입 장단점 분석

#### ✅ 장점

1. **타입 안전성 향상**
   - 컴파일 타임에 에러 처리 강제
   - null 체크 불필요 (타입 시스템이 보장)

2. **에러 처리 일관성**
   - 모든 함수에서 동일한 패턴 사용
   - 에러 정보 일관된 형태로 제공

3. **코드 가독성 향상**
   - 에러 처리가 명시적
   - 함수 시그니처만으로 에러 가능성 파악 가능

4. **테스트 용이성**
   - 성공/실패 케이스 명확히 분리
   - 에러 케이스 테스트 용이

#### ❌ 단점

1. **학습 곡선**
   - 개발팀이 Result 패턴에 익숙해야 함
   - 기존 코드와의 혼용 시 혼란 가능

2. **점진적 마이그레이션 어려움**
   - 기존 코드 전면 수정 필요
   - 큰 리팩토링 비용

3. **라이브러리 의존성 추가**
   - 번들 크기 증가 (작지만)
   - 외부 의존성 추가

4. **기존 패턴과의 혼용**
   - null 반환, throw 등과 혼용 시 일관성 저하
   - 전체 프로젝트에 적용 시 비용 큼

---

## 💡 권장사항

### 현재 상황 분석

1. **기존 Result 타입 존재**: `campErrorHandler.ts`에서 이미 사용 중
2. **패턴 혼재**: null 반환, throw, 객체 반환 등 여러 패턴 혼용
3. **프로젝트 규모**: 대규모 프로젝트로 전체 마이그레이션 비용 큼

### 권장 방안: 점진적 도입 (선택적)

**결론**: 현재는 Result 타입을 전체적으로 도입하지 않고, **선택적으로 사용**하는 것을 권장합니다.

**이유**:
1. 기존 코드베이스가 크고 패턴이 다양함
2. 전체 마이그레이션 비용이 큼
3. 현재 패턴들이 각각의 용도에 적합함
4. 일부 파일(`campErrorHandler.ts`)에서 이미 사용 중

### 권장 사용 가이드

#### Result 타입을 사용해야 하는 경우

1. **새로운 유틸리티 함수 작성 시**
   - 복잡한 에러 처리 필요 시
   - 여러 에러 케이스가 있을 때

2. **비동기 작업**
   - Promise 기반 함수
   - 에러 정보가 중요한 경우

3. **데이터베이스 쿼리**
   - Supabase 쿼리 래퍼 함수
   - 에러 타입이 명확한 경우

#### 기존 패턴을 유지해야 하는 경우

1. **간단한 유틸리티**
   - null 반환으로 충분한 경우
   - 에러 정보가 불필요한 경우

2. **폼 유효성 검사**
   - `{ valid: boolean; error?: string }` 패턴이 적합
   - UI와 밀접하게 연관됨

3. **예외적 상황**
   - throw가 적절한 경우 (예: 프로그래밍 오류)

---

## 📝 typescript-result 라이브러리 사용 예시

### 설치

```bash
npm install typescript-result
```

### 기본 사용법

```typescript
import { Result, Ok, Err } from "typescript-result";

// 성공 케이스
function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return Err("0으로 나눌 수 없습니다");
  }
  return Ok(a / b);
}

// 사용
const result = divide(10, 2);
if (result.isOk()) {
  console.log(result.value); // 5
} else {
  console.error(result.error); // 에러 메시지
}

// 메서드 체이닝
const result2 = divide(10, 2)
  .map(value => value * 2) // 10
  .mapErr(err => `계산 실패: ${err}`); // 에러 변환
```

### 현재 프로젝트 적용 예시

```typescript
// 기존 코드 (null 반환)
export function transformBatchResponse(
  batchResponse: Record<string, ContentDetailsResponse>,
  contentId: string,
  contentType: ContentType
): ContentDetailsResponse | null {
  const contentData = batchResponse[contentId];
  if (!contentData) {
    return null;
  }
  // ...
}

// Result 타입 적용 (선택적)
import { Result, Ok, Err } from "typescript-result";

export function transformBatchResponse(
  batchResponse: Record<string, ContentDetailsResponse>,
  contentId: string,
  contentType: ContentType
): Result<ContentDetailsResponse, string> {
  const contentData = batchResponse[contentId];
  if (!contentData) {
    return Err(`콘텐츠 ID ${contentId}에 대한 데이터를 찾을 수 없습니다`);
  }
  // ...
  return Ok(transformedData);
}
```

---

## 🎯 결론

### 권장 사항

1. **현재 상태 유지**: 기존 에러 처리 패턴 유지
2. **선택적 도입**: 새로운 복잡한 함수 작성 시 Result 타입 고려
3. **점진적 확장**: 팀 합의 후 특정 영역에만 선택적으로 도입

### 향후 검토 사항

1. **팀 합의**: Result 타입 도입 여부 팀 회의에서 논의
2. **파일트리**: 새로운 파일이나 모듈 작성 시 Result 타입 사용 검토
3. **문서화**: Result 타입 사용 가이드라인 작성 (도입 시)

---

## 📚 참고 자료

- typescript-result 라이브러리: https://github.com/everweij/typescript-result
- Context7 문서: `/everweij/typescript-result`
- 현재 프로젝트 Result 타입: `lib/utils/campErrorHandler.ts`
