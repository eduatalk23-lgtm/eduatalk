# 비즈니스 로직 분리 - Service/Repository 구조

## 📋 작업 개요

비즈니스 로직을 `service`, `repository`, `utils`로 체계적으로 분리하고, UI 파일에서 비즈니스 로직을 완전히 분리했습니다.

## 🎯 목표

1. **Repository**: 순수 데이터 접근 (Supabase 쿼리만)
2. **Service**: 비즈니스 로직 (검증, 계산, 변환)
3. **Actions**: Server Actions (가벼운 요청 처리)
4. **Utils**: 공통 유틸리티 함수

## 📁 새로운 구조

### 도메인별 구조

```
lib/domains/
├── school/
│   ├── index.ts          # 공개 API
│   ├── types.ts          # 타입 정의
│   ├── validation.ts     # Zod 스키마
│   ├── repository.ts     # 순수 데이터 접근
│   ├── service.ts        # 비즈니스 로직
│   └── actions.ts        # Server Actions
├── score/
│   ├── index.ts
│   ├── types.ts
│   ├── validation.ts
│   ├── repository.ts
│   ├── service.ts
│   └── actions.ts
└── plan/
    ├── index.ts
    ├── types.ts
    ├── repository.ts
    └── service.ts
```

### 공통 Utils 구조

```
lib/utils/
├── index.ts          # 공개 API
├── formData.ts       # FormData 파싱 유틸리티
├── date.ts           # 날짜 관련 유틸리티
├── formatNumber.ts   # 숫자 포맷팅
└── cache.ts          # 캐시 유틸리티
```

## 🔧 레이어별 책임

### Repository (데이터 접근 레이어)

- **역할**: Supabase 쿼리만 수행
- **특징**:
  - 비즈니스 로직 없음
  - 에러는 throw (상위에서 처리)
  - 함수명은 `find*`, `insert*`, `update*`, `delete*` 패턴

```typescript
// repository.ts 예시
export async function findSchoolById(schoolId: string): Promise<School | null> {
  const supabase = await createSupabaseServerClient();
  
  const { data, error } = await supabase
    .from("schools")
    .select("*")
    .eq("id", schoolId)
    .maybeSingle();

  if (error) throw error;
  return data as School | null;
}
```

### Service (비즈니스 로직 레이어)

- **역할**: 비즈니스 규칙 적용
- **특징**:
  - 데이터 검증 및 변환
  - Repository 호출 및 에러 처리
  - 함수명은 `get*`, `create*`, `update*`, `delete*` 패턴

```typescript
// service.ts 예시
export async function createSchool(input: CreateSchoolInput): Promise<SchoolActionResult> {
  try {
    // 지역 ID 검증
    if (input.region_id) {
      const isValid = await isValidRegionId(input.region_id);
      if (!isValid) {
        return { success: false, error: "유효하지 않은 지역입니다." };
      }
    }

    // 중복 확인
    const isDuplicate = await checkDuplicateSchool(input.name, input.type);
    if (isDuplicate) {
      return { success: false, error: "이미 등록된 학교입니다." };
    }

    // 생성
    const school = await repository.insertSchool(input);
    return { success: true, data: school };
  } catch (error) {
    console.error("[school/service] 학교 생성 실패:", error);
    return { success: false, error: "학교 생성에 실패했습니다." };
  }
}
```

### Actions (Server Actions 레이어)

- **역할**: 요청 처리만
- **특징**:
  - 권한 검사
  - FormData 파싱
  - Service 호출
  - Cache 무효화

```typescript
// actions.ts 예시
"use server";

export async function createSchoolAction(formData: FormData): Promise<SchoolActionResult> {
  // 1. 권한 확인
  const { role } = await getCurrentUserRole();
  if (role !== "admin") {
    return { success: false, error: "권한이 없습니다." };
  }

  // 2. FormData 파싱
  const rawData = {
    name: parseFormString(formData.get("name")),
    type: parseFormString(formData.get("type")) as SchoolType,
  };

  // 3. 검증
  const validation = createSchoolSchema.safeParse(rawData);
  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message };
  }

  // 4. Service 호출
  const result = await service.createSchool(validation.data);

  // 5. Cache 무효화
  if (result.success) {
    revalidatePath("/admin/schools");
  }

  return result;
}
```

## 🛠 공통 Utils

### FormData 파싱 (`lib/utils/formData.ts`)

```typescript
import { parseFormString, parseFormNumber, parseFormBoolean } from "@/lib/utils";

// 문자열 파싱
const name = parseFormString(formData.get("name")); // "value" 또는 ""
const region = parseFormStringOrNull(formData.get("region")); // "value" 또는 null

// 숫자 파싱
const count = parseFormNumber(formData.get("count")); // 숫자 또는 0
const score = parseFormNumberOrNull(formData.get("score")); // 숫자 또는 null

// 불리언 파싱
const active = parseFormBoolean(formData.get("active")); // true 또는 false
```

### 날짜 유틸리티 (`lib/utils/date.ts`)

```typescript
import { 
  formatDateString, 
  parseDateString, 
  getDaysInMonth,
  calculateDday,
  isValidDateRange 
} from "@/lib/utils";

// 날짜 문자열 생성
const dateStr = formatDateString(2025, 1, 15); // "2025-01-15"

// 날짜 파싱
const { year, month, day } = parseDateString("2025-01-15");

// D-day 계산
const dday = calculateDday("2025-12-31"); // 남은 일수

// 날짜 범위 검증
const isValid = isValidDateRange("2025-01-01", "2025-12-31"); // true
```

## 📝 사용 가이드

### 도메인 모듈 사용

```typescript
// 방법 1: 도메인 전체 import
import { school, score, plan } from "@/lib/domains";

const schools = await school.service.getAllSchools();
const scores = await score.service.getSchoolScores(studentId);
const plans = await plan.service.getTodayPlans(studentId);

// 방법 2: 개별 함수 import (Actions)
import { getSchoolsAction, createSchoolAction } from "@/lib/domains/school";

// Server Actions 사용
const result = await createSchoolAction(formData);
```

### UI 컴포넌트에서 사용

```tsx
// UI 컴포넌트에서는 Actions만 호출
"use client";

import { createSchoolAction } from "@/lib/domains/school";

function SchoolForm() {
  const handleSubmit = async (formData: FormData) => {
    const result = await createSchoolAction(formData);
    if (result.success) {
      // 성공 처리
    } else {
      // 에러 처리: result.error
    }
  };
  
  return <form action={handleSubmit}>...</form>;
}
```

## ✅ 완료된 작업

### 1. School 도메인
- [x] `repository.ts` - 순수 데이터 접근 분리
- [x] `service.ts` - 비즈니스 로직 분리
- [x] `actions.ts` - Server Actions 간소화
- [x] `queries.ts` 삭제 (repository로 대체)

### 2. Score 도메인
- [x] `repository.ts` - 순수 데이터 접근 분리
- [x] `service.ts` - 비즈니스 로직 분리
- [x] `actions.ts` - Server Actions 간소화
- [x] `queries.ts` 삭제 (repository로 대체)

### 3. Plan 도메인
- [x] `types.ts` - 도메인 내부 타입 정의
- [x] `repository.ts` - 순수 데이터 접근 분리
- [x] `service.ts` - 비즈니스 로직 분리

### 4. 공통 Utils
- [x] `formData.ts` - FormData 파싱 유틸리티
- [x] `date.ts` - 날짜 관련 유틸리티
- [x] `index.ts` - 공개 API

## 🔧 생성된 커스텀 훅

### usePlanPeriod (`lib/hooks/usePlanPeriod.ts`)

플랜 기간 관리 로직을 분리한 훅입니다.

```typescript
import { usePlanPeriod } from "@/lib/hooks/usePlanPeriod";

function MyComponent() {
  const {
    periodInputType,
    periodStart,
    periodEnd,
    dday,
    isValid,
    errorMessage,
    setPeriodInputType,
    setDirectState,
    setDdayState,
    setWeeksState,
  } = usePlanPeriod({
    initialPeriodStart: "2025-01-01",
    initialPeriodEnd: "2025-03-31",
  });

  // ...
}
```

### useBlockSet (`lib/hooks/useBlockSet.ts`)

블록 세트 관리 로직을 분리한 훅입니다.

```typescript
import { useBlockSet } from "@/lib/hooks/useBlockSet";

function MyComponent() {
  const {
    blockSets,
    mode,
    selectedBlockSetId,
    isPending,
    selectBlockSet,
    loadBlockSets,
    createNewBlockSet,
    updateExistingBlockSet,
    addTimeBlock,
    removeTimeBlock,
  } = useBlockSet({
    initialBlockSets: [],
    onBlockSetCreated: (blockSet) => console.log("Created:", blockSet),
  });

  // ...
}
```

## 🔜 향후 작업 (TODO)

### UI 컴포넌트 비즈니스 로직 제거 (진행 중)

1. **Step1BasicInfo.tsx** (2,797줄)
   - ✅ 날짜 계산 로직 → `usePlanPeriod` 훅으로 분리 가능
   - ✅ 블록 세트 관리 로직 → `useBlockSet` 훅으로 분리 가능
   - 🔲 유효성 검사 로직 → Zod 스키마 사용

2. **기타 대형 컴포넌트**
   - 비즈니스 로직을 커스텀 훅으로 분리
   - 데이터 변환 로직을 service로 이동

### 기존 Actions 마이그레이션

```
app/actions/ → lib/domains/[domain]/actions.ts
app/(admin)/actions/ → lib/domains/[domain]/actions.ts
app/(student)/actions/ → lib/domains/[domain]/actions.ts
```

## 📊 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────┐
│                    UI Components                        │
│           (페이지, 클라이언트 컴포넌트)                    │
└────────────────────────┬────────────────────────────────┘
                         │ Server Actions 호출
                         ▼
┌─────────────────────────────────────────────────────────┐
│                     Actions Layer                       │
│     • 권한 검사                                          │
│     • FormData 파싱                                     │
│     • Service 호출                                      │
│     • Cache 무효화                                      │
└────────────────────────┬────────────────────────────────┘
                         │ Service 호출
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    Service Layer                        │
│     • 비즈니스 규칙 적용                                  │
│     • 데이터 검증/변환                                   │
│     • 에러 처리                                         │
└────────────────────────┬────────────────────────────────┘
                         │ Repository 호출
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   Repository Layer                      │
│     • Supabase 쿼리만                                   │
│     • 순수 데이터 접근                                   │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                      Supabase                           │
│               (PostgreSQL + RLS)                        │
└─────────────────────────────────────────────────────────┘
```

## 🎯 핵심 원칙

1. **단일 책임**: 각 레이어는 하나의 역할만 담당
2. **의존성 방향**: UI → Actions → Service → Repository → DB
3. **에러 처리**: Repository는 throw, Service는 catch하여 결과 객체 반환
4. **타입 안전성**: 모든 레이어에서 TypeScript 타입 사용
5. **테스트 용이성**: 각 레이어를 독립적으로 테스트 가능

