# 도메인 기반 프로젝트 구조 재배치 작업 내역

## 📅 작업일: 2024년 11월 26일

---

## 1. 작업 개요

프로젝트를 도메인 기반 구조로 재배치하여 코드의 응집도를 높이고 유지보수성을 개선했습니다.

### 1.1 주요 목표

1. ✅ 도메인 기반 폴더 구조 생성
2. ✅ 중복 컴포넌트 및 로직 통합
3. ✅ 비즈니스 로직 분리 (service / repository / UI)
4. ✅ API 라우트 구조 정리
5. ✅ 컴포넌트 구조 가이드라인 수립

---

## 2. 생성된 파일 목록

### 2.1 도메인 구조 (`lib/domains/`)

```
lib/domains/
├── index.ts                    # 전체 re-export
├── school/                     # 학교 도메인 ✅ 완전 구현
│   ├── index.ts
│   ├── types.ts               # 타입 정의 (120줄)
│   ├── validation.ts          # Zod 스키마 (95줄)
│   ├── queries.ts             # 데이터 조회 (280줄)
│   └── actions.ts             # Server Actions (300줄)
├── score/                      # 성적 도메인 ✅ 완전 구현
│   ├── index.ts
│   ├── types.ts               # 타입 정의 (140줄)
│   ├── validation.ts          # Zod 스키마 (95줄)
│   ├── queries.ts             # 데이터 조회 (280줄)
│   └── actions.ts             # Server Actions (350줄)
├── plan/                       # 학습 계획 도메인
│   └── index.ts               # 기존 파일 re-export
├── content/                    # 콘텐츠 도메인
│   └── index.ts               # 기존 파일 re-export
├── goal/                       # 목표 도메인
│   └── index.ts               # 기존 파일 re-export
├── auth/                       # 인증 도메인
│   └── index.ts               # 기존 파일 re-export
├── student/                    # 학생 도메인
│   └── index.ts               # 기존 파일 re-export
├── block/                      # 블록/시간표 도메인
│   └── index.ts               # 기존 파일 re-export
├── camp/                       # 캠프 도메인
│   └── index.ts               # 기존 파일 re-export
├── tenant/                     # 테넌트 도메인
│   └── index.ts               # 기존 파일 re-export
└── subject/                    # 과목 도메인
    └── index.ts               # 기존 파일 re-export
```

### 2.2 문서 (`docs/`)

| 파일 | 설명 |
|------|------|
| `refactoring-analysis-report.md` | 리팩토링 전 분석 리포트 |
| `domain-based-architecture-guide.md` | 도메인 기반 아키텍처 가이드 |
| `api-structure-improvement.md` | API 라우트 구조 개선안 |
| `component-structure-guide.md` | 컴포넌트 구조 가이드 |
| `refactoring-domain-based-restructure.md` | 이 문서 (작업 내역) |

---

## 3. 해결된 문제

### 3.1 중복 Actions 통합

#### Before (분산)

```
app/(admin)/actions/schoolActions.ts  - 관리자용 학교 CRUD
app/(student)/actions/schoolActions.ts - 학생용 학교 조회
app/actions/scores.ts                 - 레거시 성적 액션
app/(student)/actions/scoreActions.ts - 학생용 성적 액션
```

#### After (통합)

```
lib/domains/school/actions.ts  - 모든 학교 관련 액션 통합
lib/domains/score/actions.ts   - 모든 성적 관련 액션 통합
```

### 3.2 계층 분리

```
┌─────────────────┐
│  Server Action  │  ← 요청 처리, 검증, revalidate
└────────┬────────┘
         │
┌────────▼────────┐
│    Queries      │  ← 데이터 접근 (Supabase)
└────────┬────────┘
         │
┌────────▼────────┐
│   Validation    │  ← Zod 스키마
└────────┬────────┘
         │
┌────────▼────────┐
│     Types       │  ← 타입 정의
└─────────────────┘
```

### 3.3 삭제된 파일

```
app/api/test-supabase/route.ts  ← 개발 테스트용 API 삭제
```

---

## 4. Git 커밋 기록

| 커밋 | 설명 |
|------|------|
| `39b2a52` | 프로젝트 리팩토링 분석 리포트 작성 |
| `1cf270e` | 도메인 기반 아키텍처 구조 생성 (school, score) |
| `f9c8da4` | 나머지 도메인 기본 구조 생성 |
| `d693c85` | API 및 컴포넌트 구조 개선 가이드 작성 |

---

## 5. 사용 방법

### 5.1 도메인에서 import

```typescript
// ✅ 권장: 도메인에서 통합 import
import { 
  School,
  SchoolType,
  getSchools,
  createSchoolAction,
  createSchoolSchema,
} from "@/lib/domains/school";

// 또는 전체 도메인에서
import { School, SchoolScore } from "@/lib/domains";
```

### 5.2 서버 컴포넌트

```typescript
// 직접 queries 사용
import { getSchools } from "@/lib/domains/school";

export default async function SchoolsPage() {
  const schools = await getSchools({ type: "고등학교" });
  return <SchoolList schools={schools} />;
}
```

### 5.3 클라이언트 컴포넌트

```typescript
"use client";

import { createSchoolAction } from "@/lib/domains/school";

export function SchoolForm() {
  async function handleSubmit(formData: FormData) {
    const result = await createSchoolAction(formData);
    // ...
  }
  
  return <form action={handleSubmit}>...</form>;
}
```

---

## 6. 향후 작업 (TODO)

### 6.1 단기 (1-2주)

- [ ] 기존 import 경로를 새로운 도메인 경로로 점진적 변경
- [ ] plan 도메인 완전 마이그레이션 (9개 action 파일 통합)
- [ ] Supabase 자동 생성 타입과 연동

### 6.2 중기 (1개월)

- [ ] 나머지 도메인 완전 구현 (types, validation, queries, actions)
- [ ] API 라우트 v1 구조 적용
- [ ] 컴포넌트 구조 개선 (forms, charts 폴더 분리)

### 6.3 장기

- [ ] 기존 분산된 actions 파일 deprecated 처리 후 삭제
- [ ] 번들 크기 최적화
- [ ] 테스트 코드 추가

---

## 7. 참고 문서

- [도메인 기반 아키텍처 가이드](./domain-based-architecture-guide.md)
- [API 구조 개선안](./api-structure-improvement.md)
- [컴포넌트 구조 가이드](./component-structure-guide.md)
- [리팩토링 분석 리포트](./refactoring-analysis-report.md)

---

**작성자**: AI Assistant  
**검토 필요**: 프로젝트 담당자

