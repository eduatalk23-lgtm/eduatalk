# queryOptions 서버 호환성 수정

## 작업 일시
2025-01-30

## 문제 상황

Next.js 15에서는 `"use client"` 파일의 함수를 서버 컴포넌트에서 직접 호출할 수 없습니다. 

**에러 메시지**:
```
Error: Attempted to call planGroupsQueryOptions() from the server but planGroupsQueryOptions is on the client. It's not possible to invoke a client function from the server, it can only be rendered as a Component or passed to props of a Client Component.
```

**발생 위치**: `app/(student)/plan/page.tsx:54`

## 해결 방법

TanStack Query 모범 사례에 따라 `queryOptions` 함수를 서버/클라이언트 공용 파일로 분리했습니다. `queryOptions`는 순수 함수이므로 서버에서도 실행 가능합니다.

## 작업 내용

### 1. 공용 queryOptions 파일 생성

**새 디렉토리**: `lib/query-options/`

다음 파일들을 생성했습니다:

- `lib/query-options/planGroups.ts` - `planGroupsQueryOptions` 및 관련 타입 (`PlanGroupStats`, `PlanGroupWithStats`)
- `lib/query-options/todayPlans.ts` - `todayPlansQueryOptions`
- `lib/query-options/plans.ts` - `plansQueryOptions`
- `lib/query-options/blockSets.ts` - `blockSetsQueryOptions`
- `lib/query-options/studentContents.ts` - `studentContentsQueryOptions`
- `lib/query-options/campTemplates.ts` - `campTemplatesQueryOptions` 및 `CampTemplatesFilters` 타입
- `lib/query-options/campStats.ts` - `campStatsQueryOptions`, `campAttendanceStatsQueryOptions`, `campLearningStatsQueryOptions`

**공통 특징**:
- `"use client"` 지시어 없음 (서버/클라이언트 공용)
- `queryOptions` 함수만 export
- 관련 타입도 함께 export
- 클라이언트 전용 로직(훅 등)은 제외

### 2. 클라이언트 훅 파일 수정

다음 파일들을 수정하여 공용 파일에서 `queryOptions`를 import하도록 변경:

- `lib/hooks/usePlanGroups.ts`
- `lib/hooks/useTodayPlans.ts`
- `lib/hooks/usePlans.ts`
- `lib/hooks/useBlockSets.ts`
- `lib/hooks/useStudentContents.ts`
- `lib/hooks/useCampTemplates.ts`
- `lib/hooks/useCampStats.ts`

**수정 내용**:
- 공용 파일에서 `queryOptions` import
- 훅은 `"use client"` 유지
- 타입 re-export로 하위 호환성 유지

### 3. 서버 컴포넌트 import 경로 수정

다음 파일들의 import 경로를 공용 파일로 변경:

- `app/(student)/plan/page.tsx` - `planGroupsQueryOptions`
- `app/(student)/today/page.tsx` - `todayPlansQueryOptions`
- `app/(student)/plan/new-group/page.tsx` - `blockSetsQueryOptions`, `studentContentsQueryOptions`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx` - `planGroupsQueryOptions`
- `app/(admin)/admin/camp-templates/page.tsx` - `campTemplatesQueryOptions`
- `app/(admin)/admin/camp-templates/[id]/attendance/page.tsx` - `campAttendanceStatsQueryOptions`
- `app/(admin)/admin/camp-templates/[id]/reports/page.tsx` - `campAttendanceStatsQueryOptions`, `campLearningStatsQueryOptions`

### 4. 타입 정의 정리

- `PlanGroupWithStats`, `PlanGroupStats` 타입을 `lib/query-options/planGroups.ts`로 이동
- `CampTemplatesFilters` 타입을 `lib/query-options/campTemplates.ts`로 이동
- 훅 파일에서 타입 re-export로 하위 호환성 유지

## 파일 구조 변경

### Before
```
lib/
└── hooks/
    ├── usePlanGroups.ts        # "use client" + queryOptions + 훅
    ├── useTodayPlans.ts       # "use client" + queryOptions + 훅
    └── ...
```

### After
```
lib/
├── query-options/              # 새 디렉토리 (서버/클라이언트 공용)
│   ├── planGroups.ts          # queryOptions만 (타입 포함)
│   ├── todayPlans.ts
│   ├── plans.ts
│   ├── blockSets.ts
│   ├── studentContents.ts
│   ├── campTemplates.ts
│   └── campStats.ts
└── hooks/                      # 클라이언트 전용 훅
    ├── usePlanGroups.ts       # queryOptions는 공용 파일에서 import
    ├── useTodayPlans.ts
    └── ...
```

## 검증 결과

1. ✅ **빌드 성공**: `npm run build` 완료 (Exit code: 0)
2. ✅ **타입 안전성**: TypeScript 컴파일 오류 없음
3. ✅ **Linter 오류 없음**: ESLint 검사 통과
4. ✅ **하위 호환성**: 기존 import 경로에서 타입 re-export로 호환성 유지

## 참고 자료

- TanStack Query 공식 문서: queryOptions를 서버 컴포넌트에서 직접 사용 가능
- Next.js 15: "use client" 파일의 함수는 서버에서 호출 불가
- Supabase 스키마: `plan_groups` 테이블 구조 확인 완료

## 영향 범위

### 수정된 파일 (총 14개)

**새로 생성된 파일 (7개)**:
- `lib/query-options/planGroups.ts`
- `lib/query-options/todayPlans.ts`
- `lib/query-options/plans.ts`
- `lib/query-options/blockSets.ts`
- `lib/query-options/studentContents.ts`
- `lib/query-options/campTemplates.ts`
- `lib/query-options/campStats.ts`

**수정된 파일 (7개)**:
- `lib/hooks/usePlanGroups.ts`
- `lib/hooks/useTodayPlans.ts`
- `lib/hooks/usePlans.ts`
- `lib/hooks/useBlockSets.ts`
- `lib/hooks/useStudentContents.ts`
- `lib/hooks/useCampTemplates.ts`
- `lib/hooks/useCampStats.ts`

**서버 컴포넌트 import 경로 수정 (7개)**:
- `app/(student)/plan/page.tsx`
- `app/(student)/today/page.tsx`
- `app/(student)/plan/new-group/page.tsx`
- `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`
- `app/(admin)/admin/camp-templates/page.tsx`
- `app/(admin)/admin/camp-templates/[id]/attendance/page.tsx`
- `app/(admin)/admin/camp-templates/[id]/reports/page.tsx`

## 다음 단계

이 패턴을 다른 `queryOptions` 함수들에도 적용할 수 있습니다. 현재는 서버 컴포넌트에서 사용하는 `queryOptions`만 분리했지만, 향후 모든 `queryOptions`를 공용 파일로 이동하는 것을 고려할 수 있습니다.

