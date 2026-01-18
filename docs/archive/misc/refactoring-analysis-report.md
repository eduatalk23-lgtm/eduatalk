# 프로젝트 리팩토링 분석 리포트

## 📅 작성일: 2024년 11월 26일

---

## 1. 전체 폴더 구조 문제점 진단

### 1.1 현재 폴더 구조

```
project/
├── app/
│   ├── _components/          # 전역 컴포넌트 (1개만 존재)
│   ├── actions/              # 전역 서버 액션 (11개)
│   ├── api/                  # API 라우트 (13개 엔드포인트)
│   ├── (admin)/
│   │   ├── actions/          # 어드민 전용 서버 액션 (12개)
│   │   └── admin/            # 어드민 페이지들
│   ├── (parent)/
│   │   ├── _utils.ts         # 부모 유틸리티
│   │   └── parent/           # 부모 페이지들
│   └── (student)/
│       ├── _utils/           # 학생 유틸리티
│       ├── actions/          # 학생 전용 서버 액션 (26개 + plan-groups/9개)
│       ├── today/actions/    # 오늘 페이지 전용 액션 (6개)
│       └── [페이지들]/
├── components/               # 공용 UI 컴포넌트 (17개)
├── lib/
│   ├── auth/                # 인증 유틸리티
│   ├── data/                # 데이터 레이어 (28개)
│   ├── supabase/            # Supabase 클라이언트
│   └── [기타 유틸리티]/
└── supabase/migrations/     # DB 마이그레이션 (39개)
```

### 1.2 주요 문제점

#### 🔴 심각한 문제

1. **Actions 분산 (4개 위치)**
   - `app/actions/` - 전역 액션
   - `app/(admin)/actions/` - 어드민 액션
   - `app/(student)/actions/` - 학생 액션
   - `app/(student)/today/actions/` - 오늘 페이지 액션
   
   **문제**: 동일한 도메인의 로직이 여러 곳에 분산되어 관리가 어려움

2. **비즈니스 로직과 UI 로직 혼재**
   - Server Actions에서 직접 Supabase 쿼리 + 검증 + 리다이렉트까지 수행
   - 관심사 분리(Separation of Concerns) 미흡

3. **컴포넌트 분산**
   - 전역 `components/ui/` (17개)
   - 각 페이지별 `_components/` 폴더에 유사한 컴포넌트 산재
   - 재사용 가능한 컴포넌트가 특정 라우트에 종속

#### 🟡 개선 필요

4. **lib/data 구조 불일치**
   - `BaseRepository` 패턴 정의되어 있으나 실제 사용 안 됨
   - 대부분의 data 파일이 함수 기반으로 구현
   - 일관성 없는 데이터 접근 패턴

5. **API 라우트와 Server Actions 혼용**
   - 동일한 기능이 API와 Server Action 양쪽에 존재
   - 명확한 사용 기준 부재

---

## 2. 중복 파일 및 중복 컴포넌트 목록

### 2.1 중복 Server Actions (동일 이름, 다른 위치)

| 파일명 | 위치 1 | 위치 2 | 중복 유형 |
|--------|--------|--------|-----------|
| `schoolActions.ts` | `app/(admin)/actions/` | `app/(student)/actions/` | **기능 중복** |
| `contentMetadataActions.ts` | `app/(admin)/actions/` | `app/(student)/actions/` | 부분 중복 |

#### schoolActions.ts 상세 비교

**app/(admin)/actions/schoolActions.ts:**
- 학교 CRUD (create, update, delete)
- 지역 조회 (getRegions, getRegionsByLevel, getRegionsByParent)
- 관리자 권한 체크 포함

**app/(student)/actions/schoolActions.ts:**
- 학교 조회 (getSchoolById, getSchoolByName, searchSchools)
- 자동 등록 (autoRegisterSchool)
- 권한 체크 없음 (학생용)

**문제점**: 동일 도메인(school)에 대한 로직이 권한에 따라 분리되어 있어, 공통 로직 재사용 불가

### 2.2 중복 데이터 조회 패턴

| 도메인 | actions 파일 | lib/data 파일 | 중복 쿼리 |
|--------|-------------|---------------|-----------|
| goals | `app/actions/goals.ts` (re-export) | `lib/data/studentGoals.ts` | ✅ |
| goals | `app/(student)/actions/goalActions.ts` | `lib/goals/queries.ts` | ⚠️ 부분 중복 |
| scores | `app/actions/scores.ts` | `lib/data/studentScores.ts` | ⚠️ 로직 중복 |
| scores | `app/(student)/actions/scoreActions.ts` | `lib/data/studentScores.ts` | ⚠️ 검증 중복 |

### 2.3 유사한 폼 컴포넌트 (리팩토링 후보)

```
ScoreForm.tsx              → scores/_components/
ScoreFormModal.tsx         → scores/_components/
MockScoreFormModal.tsx     → scores/mock/.../
SchoolScoreForm.tsx        → scores/school/.../

SchoolForm.tsx             → admin/schools/new/
SchoolFormModal.tsx        → admin/schools/_components/
SchoolEditForm.tsx         → admin/schools/[id]/edit/
```

**문제점**: 
- Score 관련 폼 4개가 유사한 구조
- School 관련 폼 3개가 유사한 구조
- 공통 폼 컴포넌트로 추출 가능

### 2.4 중복 상수 정의

```typescript
// 여러 파일에 중복 정의됨
const planPurposeLabels = { ... };
const schedulerTypeLabels = { ... };

// 이미 정의된 위치
lib/constants/planLabels.ts // ✅ 일부 통합됨
```

---

## 3. API 라우트 구조 분석 및 개선안

### 3.1 현재 API 라우트 구조

```
app/api/
├── admin/check-student-scores/    # 어드민 전용
├── auth/check-superadmin/         # 인증
├── goals/list/                    # 목표 조회
├── master-content-details/        # 마스터 콘텐츠
├── master-content-info/           # 마스터 콘텐츠 정보
├── recommended-master-contents/   # 추천 콘텐츠
├── schools/
│   ├── auto-register/            # 학교 자동 등록
│   └── search/                   # 학교 검색
├── student-content-details/       # 학생 콘텐츠
├── student-content-info/          # 학생 콘텐츠 정보
├── tenants/                       # 테넌트 CRUD
├── test-supabase/                 # 테스트 (삭제 필요)
└── today/
    ├── plans/                    # 오늘 플랜
    └── progress/                 # 진행률
```

### 3.2 문제점

1. **일관성 없는 네이밍**
   - kebab-case (`master-content-details`) vs 단일 명사 (`tenants`)
   - 복수형/단수형 혼용

2. **역할 분리 불명확**
   - `app/api/` API Route와 `app/actions/` Server Actions의 역할 구분 없음
   - 같은 기능이 양쪽에 존재 (schools 검색)

3. **RESTful 미준수**
   - `/schools/auto-register` → POST `/schools` (자동 등록 로직은 내부 처리)
   - `/goals/list` → GET `/goals`

### 3.3 개선안

```
app/api/
├── v1/                           # 버전 관리 추가
│   ├── auth/
│   │   └── check-superadmin/
│   ├── admin/                    # 어드민 전용 API
│   │   └── scores/check/
│   ├── schools/                  # 학교 API (RESTful)
│   │   └── route.ts             # GET: search, POST: create
│   ├── contents/                 # 콘텐츠 API 통합
│   │   ├── master/
│   │   └── student/
│   ├── goals/
│   │   └── route.ts             # GET, POST
│   ├── tenants/
│   │   └── [id]/
│   └── today/
│       └── plans/
```

### 3.4 권장 역할 분리

| 사용 케이스 | 권장 방식 | 이유 |
|-------------|-----------|------|
| 폼 제출 후 리다이렉트 | Server Action | Next.js 최적화 |
| 실시간 데이터 조회 | API Route + React Query | 캐싱 + 재검증 |
| 외부 시스템 연동 | API Route | Webhook 지원 |
| 파일 업로드 | API Route | 스트리밍 지원 |

---

## 4. 클라이언트/서버 컴포넌트 혼재 문제

### 4.1 현황 통계

- **"use client" 컴포넌트**: 193개
- **"use server" 액션 파일**: 53개
- **서버 컴포넌트 (기본)**: 약 80개 (추정)

### 4.2 문제 있는 패턴

#### 패턴 1: 불필요한 클라이언트 컴포넌트

```tsx
// ❌ 문제: 상태 없이 "use client" 사용
"use client";

export function StaticCard({ title, value }: Props) {
  return (
    <div>
      <h3>{title}</h3>
      <p>{value}</p>
    </div>
  );
}
```

**해당 파일 예시:**
- 일부 카드 컴포넌트들이 단순 렌더링만 하면서 "use client" 사용

#### 패턴 2: 서버 컴포넌트에서 클라이언트 훅 사용 시도

```tsx
// app/(student)/settings/page.tsx - 989줄의 거대한 클라이언트 컴포넌트
"use client";

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  // ... 수많은 상태와 로직
}
```

**문제점:**
- 페이지 전체가 클라이언트 컴포넌트로 번들됨
- 서버에서 미리 fetch 가능한 데이터도 클라이언트에서 조회

#### 패턴 3: 데이터 페칭 + 인터랙션 혼합

```tsx
// 현재 패턴 (비효율적)
"use client";

export function ScoresPage() {
  const [scores, setScores] = useState([]);
  
  useEffect(() => {
    fetch('/api/scores').then(...);
  }, []);
  
  return <ScoresList scores={scores} />;
}
```

```tsx
// 권장 패턴
// page.tsx (서버 컴포넌트)
export default async function ScoresPage() {
  const scores = await getScores(); // 서버에서 데이터 조회
  return <ScoresList scores={scores} />;
}

// ScoresList.tsx (클라이언트 컴포넌트 - 인터랙션만)
"use client";
export function ScoresList({ scores }: Props) {
  // 인터랙션 로직만
}
```

### 4.3 개선이 필요한 주요 파일

| 파일 | 문제 | 개선 방향 |
|------|------|-----------|
| `settings/page.tsx` | 989줄 클라이언트 컴포넌트 | 서버/클라이언트 분리 |
| `today/_components/TodayPageContent.tsx` | 대량 상태 관리 | Context + 작은 컴포넌트 분리 |
| `plan/new-group/_components/Step1BasicInfo.tsx` | 2797줄 | 스텝별 분리 |
| `scores/dashboard/*` | 각 차트가 개별 fetch | 서버에서 통합 조회 |

---

## 5. Supabase 기반 비즈니스 로직 문제점 분석

### 5.1 현재 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Server Action  │────▶│   lib/data/*     │────▶│    Supabase    │
│  (검증+처리)     │     │  (쿼리 헬퍼)     │     │     (DB)       │
└─────────────────┘     └──────────────────┘     └────────────────┘
         │
         ▼
┌─────────────────┐
│  직접 Supabase  │
│  쿼리 호출      │ ❌ 우회 패턴
└─────────────────┘
```

### 5.2 문제점

#### 문제 1: lib/data 우회

```typescript
// app/actions/scores.ts - 직접 Supabase 쿼리
export async function _addStudentScore(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  // ... 직접 쿼리 작성
  const insertResult = await supabase.from("student_scores").insert(...);
}

// app/(student)/actions/scoreActions.ts - lib/data 사용
export async function addSchoolScore(formData: FormData) {
  // ... 검증
  const result = await createSchoolScore({ ... }); // lib/data 사용 ✅
}
```

**결과**: 동일 테이블에 대한 쿼리가 2곳에서 다른 방식으로 작성됨

#### 문제 2: 검증 로직 분산

```typescript
// app/(student)/actions/scoreActions.ts - 수동 검증 (67줄)
if (!grade || !semester || !subjectGroup || ...) {
  throw new Error("필수 필드를 모두 입력해주세요.");
}
if (grade < 1 || grade > 3) {
  throw new Error("학년은 1~3 사이여야 합니다.");
}
// ... 반복적인 검증 코드

// app/actions/scores.ts - Zod 스키마 검증 (일관성 있음)
const validation = validateFormData(formData, studentScoreSchema);
```

#### 문제 3: 타입 불일치

```typescript
// lib/data/students.ts - 수동 타입 정의
export type Student = {
  id: string;
  tenant_id?: string | null;
  name?: string | null;
  // ...
};

// Supabase 자동 생성 타입 미사용
// (types/supabase.ts가 없거나 활용되지 않음)
```

### 5.3 RLS 정책 연동 문제

```typescript
// 현재: RLS 우회를 위한 fallback 쿼리 패턴
const insertQuery = async () => {
  const result = await supabase.from("student_scores").insert(insertPayload);
  return { data: result.data, error: result.error };
};
const fallbackInsertQuery = async () => {
  const { student_id: _studentId, ...fallbackPayload } = insertPayload;
  const result = await supabase.from("student_scores").insert(fallbackPayload);
  return { data: result.data, error: result.error };
};

const insertResult = await safeQuery(insertQuery, fallbackInsertQuery);
```

**문제점**:
- RLS 정책과 애플리케이션 로직의 불일치
- fallback 패턴으로 인한 보안 취약점 가능성
- 에러 원인 파악 어려움

### 5.4 권장 아키텍처

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Server Action  │────▶│    Service       │────▶│   Repository   │
│  (요청 처리)     │     │  (비즈니스로직)   │     │  (데이터접근)   │
└─────────────────┘     └──────────────────┘     └────────────────┘
                                                          │
                                                          ▼
                                                 ┌────────────────┐
                                                 │    Supabase    │
                                                 │   (RLS 적용)   │
                                                 └────────────────┘
```

---

## 6. 리팩토링 단계별 수행 계획

### Phase 1: 기반 정비 (1-2주)

#### 1.1 타입 시스템 정비
- [ ] Supabase CLI로 타입 자동 생성 설정
- [ ] `types/database.ts` 생성 및 전체 적용
- [ ] lib/data 타입을 Supabase 타입 기반으로 재정의

#### 1.2 데이터 레이어 통합
- [ ] Repository 패턴 완성 (`lib/repositories/`)
- [ ] 기존 `lib/data/` 함수를 Repository로 마이그레이션
- [ ] 공통 쿼리 빌더 개선

#### 1.3 검증 스키마 통합
- [ ] `lib/validation/schemas.ts` 확장
- [ ] 모든 Server Action에 Zod 스키마 적용
- [ ] 중복 검증 코드 제거

### Phase 2: Actions 통합 (1주)

#### 2.1 중복 Actions 통합
```
lib/
├── services/
│   ├── school/
│   │   ├── schoolService.ts      # 비즈니스 로직
│   │   └── schoolRepository.ts   # 데이터 접근
│   ├── score/
│   │   ├── scoreService.ts
│   │   └── scoreRepository.ts
│   └── ...
```

#### 2.2 Server Actions 리팩토링
- [ ] `app/actions/` → 역할별 서비스 호출로 변경
- [ ] 중복 제거 후 단일 진입점 유지
- [ ] 권한 체크는 서비스 레이어로 이동

### Phase 3: 컴포넌트 구조 개선 (2주)

#### 3.1 공용 컴포넌트 추출
- [ ] Form 컴포넌트 통합 (`components/forms/`)
- [ ] Modal/Dialog 패턴 표준화
- [ ] 차트 컴포넌트 추상화

#### 3.2 서버/클라이언트 분리
- [ ] 거대 클라이언트 컴포넌트 분할
- [ ] 데이터 페칭을 서버 컴포넌트로 이동
- [ ] 인터랙션만 클라이언트 컴포넌트로

#### 3.3 페이지별 로딩 상태
- [ ] `loading.tsx` 세분화
- [ ] Suspense 경계 최적화
- [ ] 스켈레톤 UI 표준화

### Phase 4: API 정리 (1주)

#### 4.1 API Route 정리
- [ ] RESTful 네이밍 통일
- [ ] 버전 관리 도입 (`/api/v1/`)
- [ ] 불필요한 API 제거 (`test-supabase`)

#### 4.2 역할 명확화
- [ ] API Route vs Server Action 가이드라인 문서화
- [ ] 외부 연동용 API만 Route로 유지
- [ ] 내부 mutation은 Server Action으로

### Phase 5: 최적화 (1주)

#### 5.1 번들 최적화
- [ ] 클라이언트 번들 크기 분석
- [ ] 동적 import 적용
- [ ] 불필요한 의존성 제거

#### 5.2 캐싱 전략
- [ ] React Query 설정 최적화
- [ ] 서버 사이드 캐싱 (`unstable_cache`)
- [ ] Revalidation 전략 정립

---

## 7. 예상 결과물

### 7.1 새로운 폴더 구조

```
project/
├── app/
│   ├── (admin)/
│   │   └── admin/[pages]     # 어드민 페이지만
│   ├── (parent)/
│   │   └── parent/[pages]    # 부모 페이지만
│   ├── (student)/
│   │   └── [pages]           # 학생 페이지만
│   ├── api/v1/               # RESTful API
│   └── actions/              # 통합된 Server Actions
├── components/
│   ├── ui/                   # 기본 UI 컴포넌트
│   ├── forms/                # 폼 컴포넌트
│   ├── charts/               # 차트 컴포넌트
│   └── layout/               # 레이아웃 컴포넌트
├── lib/
│   ├── services/             # 비즈니스 로직
│   ├── repositories/         # 데이터 접근
│   ├── validation/           # 검증 스키마
│   └── types/                # 타입 정의
└── types/
    └── database.ts           # Supabase 자동 생성 타입
```

### 7.2 기대 효과

| 영역 | Before | After |
|------|--------|-------|
| Actions 파일 수 | 53개 (4곳 분산) | ~30개 (1곳 통합) |
| 중복 코드 | 약 30% | 약 5% |
| 클라이언트 번들 | 큰 번들 | 50% 이상 감소 예상 |
| 타입 안전성 | 부분적 | 100% 커버리지 |
| 유지보수성 | 낮음 | 높음 |

---

## 8. 우선순위 권장

### 🔴 즉시 (이번 주)
1. Supabase 타입 자동 생성 설정
2. 중복 `schoolActions.ts` 통합
3. `app/actions/goals.ts` re-export 정리

### 🟡 단기 (2주 내)
1. lib/services 구조 도입
2. 검증 스키마 통합
3. 거대 컴포넌트 분할 시작

### 🟢 중기 (1개월)
1. 전체 Actions 리팩토링
2. API Route 정리
3. 번들 최적화

---

## 9. 참고 문서

- [기존 플랜 그룹 위저드 구현 가이드](./플랜-그룹-위저드-구현-가이드.md)
- [Schools CRUD UI Review](./schools-crud-ui-review.md)
- [프로젝트 구조 분석](.cursor/rules/project_rule.mdc)

---

**작성자**: AI Assistant  
**검토 필요**: 프로젝트 담당자

