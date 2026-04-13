> ⚠️ **PARTIALLY OUTDATED — 2024-11-26 작성**
>
> "도메인 기반 구조로 재배치" 원칙과 폴더 구조 원형은 **여전히 유효**하지만, 세부 도메인 목록·파일 수는 낡았습니다.
> - **현재 도메인 지도**: [`ARCHITECTURE.md` §3](./ARCHITECTURE.md#3-도메인-지도-where)
> - **도메인별 상세 규칙**: `lib/domains/*/CLAUDE.md`
>
> 이 문서는 "왜 도메인 기반이어야 하는가"의 설명 자료로만 참조하세요.

---

# 도메인 기반 아키텍처 가이드

## 📅 작성일: 2024년 11월 26일

---

## 1. 개요

프로젝트를 도메인 기반 구조로 재배치하여 코드의 응집도를 높이고 유지보수성을 개선합니다.

### 1.1 핵심 원칙

1. **도메인별 응집**: 관련된 코드(타입, 검증, 쿼리, 액션)를 한 곳에 모음
2. **명확한 계층 분리**: UI → Actions → Queries → Supabase
3. **일관된 패턴**: 모든 도메인이 동일한 구조를 따름
4. **점진적 마이그레이션**: 기존 코드와의 호환성 유지

---

## 2. 새로운 폴더 구조

### 2.1 도메인 폴더 구조

```
lib/domains/
├── index.ts              # 도메인 전체 re-export
├── school/               # 학교 도메인 ✅ 완료
│   ├── index.ts          # Public API
│   ├── types.ts          # 타입 정의
│   ├── validation.ts     # Zod 스키마
│   ├── queries.ts        # 데이터 조회/변경 함수
│   └── actions.ts        # Server Actions
├── score/                # 성적 도메인 ✅ 완료
│   ├── index.ts
│   ├── types.ts
│   ├── validation.ts
│   ├── queries.ts
│   └── actions.ts
├── plan/                 # 학습 계획 도메인 🔄 진행중
│   └── index.ts          # 기존 파일 re-export
├── content/              # 콘텐츠 도메인 📋 예정
├── goal/                 # 목표 도메인 📋 예정
├── auth/                 # 인증 도메인 📋 예정
├── student/              # 학생 도메인 📋 예정
├── block/                # 블록/시간표 도메인 📋 예정
├── camp/                 # 캠프 도메인 📋 예정
├── tenant/               # 테넌트 도메인 📋 예정
└── subject/              # 과목 도메인 📋 예정
```

### 2.2 도메인 파일 역할

| 파일 | 역할 | 사용 위치 |
|------|------|-----------|
| `types.ts` | 타입 정의 | 전체 |
| `validation.ts` | Zod 스키마 | Actions, 폼 검증 |
| `queries.ts` | Supabase 쿼리 | 서버 컴포넌트, Actions |
| `actions.ts` | Server Actions | 클라이언트 컴포넌트 |
| `index.ts` | Public API | import 시 사용 |

---

## 3. 사용 방법

### 3.1 도메인에서 import

```typescript
// ✅ 권장: 도메인에서 import
import { 
  School,
  SchoolType,
  getSchools,
  createSchoolAction,
  createSchoolSchema,
} from "@/lib/domains/school";

// ❌ 비권장: 개별 파일에서 import
import { School } from "@/lib/domains/school/types";
import { getSchools } from "@/lib/domains/school/queries";
```

### 3.2 서버 컴포넌트에서 데이터 조회

```typescript
// app/(admin)/admin/schools/page.tsx
import { getSchools } from "@/lib/domains/school";

export default async function SchoolsPage() {
  const schools = await getSchools({ type: "고등학교" });
  
  return <SchoolList schools={schools} />;
}
```

### 3.3 클라이언트 컴포넌트에서 Server Action 사용

```typescript
"use client";

import { createSchoolAction } from "@/lib/domains/school";

export function SchoolForm() {
  async function handleSubmit(formData: FormData) {
    const result = await createSchoolAction(formData);
    if (!result.success) {
      // 에러 처리
    }
  }
  
  return <form action={handleSubmit}>...</form>;
}
```

### 3.4 폼 검증

```typescript
"use client";

import { createSchoolSchema } from "@/lib/domains/school";

export function SchoolForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  function validate(data: unknown) {
    const result = createSchoolSchema.safeParse(data);
    if (!result.success) {
      setErrors(
        result.error.issues.reduce((acc, issue) => ({
          ...acc,
          [issue.path[0]]: issue.message,
        }), {})
      );
      return false;
    }
    return true;
  }
  
  // ...
}
```

---

## 4. 마이그레이션 가이드

### 4.1 기존 import 경로 변경

#### Before (기존)

```typescript
// 분산된 import
import { School, getSchools } from "@/lib/data/schools";
import { createSchool } from "@/app/(admin)/actions/schoolActions";
import { getSchoolById } from "@/app/(student)/actions/schoolActions";
```

#### After (새로운 방식)

```typescript
// 통합된 import
import { 
  School, 
  getSchools, 
  createSchoolAction,
  getSchoolByIdAction,
} from "@/lib/domains/school";
```

### 4.2 기존 파일 호환성

기존 파일들은 당분간 유지되며, 새로운 도메인 구조로 점진적으로 마이그레이션합니다.

```typescript
// lib/data/schools.ts
// @deprecated lib/domains/school 사용을 권장합니다.
export * from "@/lib/domains/school/queries";
```

---

## 5. 도메인별 상태

| 도메인 | 상태 | 설명 |
|--------|------|------|
| school | ✅ 완료 | types, validation, queries, actions 모두 구현 |
| score | ✅ 완료 | types, validation, queries, actions 모두 구현 |
| plan | 🔄 진행중 | 기존 파일 re-export, 점진적 마이그레이션 필요 |
| content | 📋 예정 | |
| goal | 📋 예정 | |
| auth | 📋 예정 | |
| student | 📋 예정 | |
| block | 📋 예정 | |
| camp | 📋 예정 | |
| tenant | 📋 예정 | |
| subject | 📋 예정 | |

---

## 6. 파일 네이밍 컨벤션

### 6.1 Actions 네이밍

- Server Action 함수: `[동사][명사]Action`
- 예: `createSchoolAction`, `updateScoreAction`, `deleteGoalAction`

### 6.2 Queries 네이밍

- 조회 함수: `get[명사]`, `get[명사]By[조건]`, `get[명사]s`
- 생성 함수: `create[명사]`
- 수정 함수: `update[명사]`
- 삭제 함수: `delete[명사]`

### 6.3 타입 네이밍

- 엔티티: `[명사]` (예: `School`, `Score`)
- 입력: `Create[명사]Input`, `Update[명사]Input`
- 필터: `Get[명사]sFilter`, `Get[명사]sOptions`
- 결과: `[명사]ActionResult`

---

## 7. 다음 단계

1. **plan 도메인 완전 마이그레이션**
   - 9개 action 파일 통합
   - types.ts 정리
   - validation.ts 추가

2. **content 도메인 마이그레이션**
   - contentMasters.ts, contentMetadata.ts, studentContents.ts 통합

3. **goal 도메인 마이그레이션**
   - goalActions.ts 통합
   - studentGoals.ts 통합

4. **기존 import 경로 업데이트**
   - 점진적으로 새로운 경로로 변경
   - deprecated 주석 추가

5. **API 라우트 정리**
   - RESTful 구조로 재배치
   - 도메인별 API 그룹화

---

## 8. 참고 문서

- [리팩토링 분석 리포트](./refactoring-analysis-report.md)
- [프로젝트 구조 분석](.cursor/rules/project_rule.mdc)

