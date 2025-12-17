# Phase 2 타입 정의 통합 작업 보고서

**작업 일자**: 2025-01-31  
**작업 범위**: 중복 타입 정의 통합, 공통 타입 파일 생성

## 개요

여러 파일에 분산되어 있던 중복 타입 정의를 통합하고, 공통 타입 파일을 생성하여 타입 일관성을 향상시켰습니다.

## 완료된 작업

### 1. 공통 타입 파일 생성 (`lib/types/common.ts`)

여러 도메인에서 공통으로 사용되는 타입들을 중앙화하여 관리합니다.

#### 주요 타입

**기본 타입**
- `ContentType`: 콘텐츠 타입 (book, lecture, custom)
- `ExclusionType`: 제외 타입 (휴가, 개인사정, 휴일지정, 기타)
- `StudentLevel`: 학생 수준 (high, medium, low)

**공통 필드 타입**
- `TimestampFields`: created_at, updated_at
- `IdField`: id
- `TenantField`: tenant_id
- `SoftDeleteField`: deleted_at

**공통 유틸리티 타입**
- `PartialFields<T, K>`: 특정 필드를 선택적으로 만듦
- `RequiredFields<T, K>`: 특정 필드를 필수로 만듦
- `NullableFields<T, K>`: 특정 필드를 nullable로 만듦
- `NonNullableFields<T, K>`: 특정 필드를 non-nullable로 만듦

**공통 응답 타입**
- `ApiResponse<T>`: API 응답 기본 구조
- `PaginationMeta`: 페이지네이션 메타데이터
- `PaginatedResponse<T>`: 페이지네이션된 응답

**공통 상태 타입**
- `Status`: 일반적인 상태 타입
- `ApprovalStatus`: 승인 상태 타입

**공통 날짜/시간 타입**
- `DateRange`: 날짜 범위
- `TimeRange`: 시간 범위
- `DateTimeRange`: 날짜-시간 범위

### 2. 중복 타입 정의 통합

#### 개선된 파일

**`lib/types/plan/domain.ts`**
- `ContentType`, `ExclusionType`, `StudentLevel`을 `lib/types/common.ts`에서 import
- 중복 정의 제거

**`lib/types/content-selection.ts`**
- `ContentType`, `ExclusionType`을 `lib/types/common.ts`에서 import
- 중복 정의 제거

## 개선 효과

1. **타입 일관성 향상**: 공통 타입을 한 곳에서 관리하여 일관성 보장
2. **중복 제거**: 동일한 타입이 여러 파일에 정의되어 있던 문제 해결
3. **유지보수성 향상**: 타입 변경 시 한 곳만 수정하면 됨
4. **타입 재사용성 향상**: 공통 유틸리티 타입으로 코드 중복 감소

## 사용 가이드

### 공통 타입 사용

```typescript
import { ContentType, ExclusionType, StudentLevel } from "@/lib/types/common";

// ContentType 사용
const contentType: ContentType = "book";

// ExclusionType 사용
const exclusionType: ExclusionType = "휴가";

// StudentLevel 사용
const studentLevel: StudentLevel = "high";
```

### 공통 필드 타입 사용

```typescript
import { TimestampFields, IdField, TenantField } from "@/lib/types/common";

// 타입 확장
type Student = IdField & TenantField & TimestampFields & {
  name: string;
  grade: number;
};
```

### 공통 유틸리티 타입 사용

```typescript
import { PartialFields, RequiredFields } from "@/lib/types/common";

// 특정 필드를 선택적으로 만들기
type PartialStudent = PartialFields<Student, "school_id" | "class">;

// 특정 필드를 필수로 만들기
type RequiredStudent = RequiredFields<Student, "name" | "grade">;
```

### 공통 응답 타입 사용

```typescript
import { ApiResponse, PaginatedResponse } from "@/lib/types/common";

// API 응답
type GetStudentResponse = ApiResponse<Student>;

// 페이지네이션된 응답
type GetStudentsResponse = PaginatedResponse<Student>;
```

## 타입 정의 가이드라인

### 1. 공통 타입은 `lib/types/common.ts`에 정의

여러 도메인에서 사용되는 타입은 `lib/types/common.ts`에 정의합니다.

```typescript
// ✅ 좋은 예
// lib/types/common.ts
export type ContentType = "book" | "lecture" | "custom";

// 다른 파일에서 사용
import { ContentType } from "@/lib/types/common";
```

### 2. 도메인별 타입은 해당 도메인 폴더에 정의

특정 도메인에서만 사용되는 타입은 해당 도메인 폴더에 정의합니다.

```typescript
// ✅ 좋은 예
// lib/types/plan/domain.ts
export type PlanGroup = {
  id: string;
  name: string;
  // ...
};
```

### 3. 타입 재사용을 위한 유틸리티 타입 활용

공통 유틸리티 타입을 활용하여 타입 재사용성을 높입니다.

```typescript
// ✅ 좋은 예
import { PartialFields, TimestampFields } from "@/lib/types/common";

type CreatePlanGroupInput = PartialFields<PlanGroup, "id" | "created_at" | "updated_at">;
```

### 4. 타입 export는 명시적으로

타입을 export할 때는 명시적으로 export합니다.

```typescript
// ✅ 좋은 예
export type { ContentType, ExclusionType } from "@/lib/types/common";

// ❌ 나쁜 예
export * from "@/lib/types/common"; // 모든 것을 export하면 의도가 불명확
```

## 다음 단계

1. **더 많은 중복 타입 통합**: 다른 파일에서도 중복 타입 확인 및 통합
2. **타입 문서화**: 각 타입에 대한 JSDoc 주석 추가
3. **타입 테스트**: 타입 가드 함수 작성 및 테스트
4. **타입 검증**: TypeScript strict mode 준수 확인

## 참고 문서

- [TypeScript 타입 정의 가이드](./type-definition-guide.md) (존재하는 경우)
- [Phase 1 타입 안전성 개선](./phase1-type-safety-improvements-2025-01-31.md)

