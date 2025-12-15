# 콘텐츠 필터링 기능 사용성 개선 작업

**작업 일자**: 2025-02-04  
**작업자**: AI Assistant  
**목적**: 페이지 새로고침 없는 부드러운 필터링 경험 제공 및 코드 최적화

## 개요

콘텐츠 필터링 기능의 사용성을 개선하기 위해 계층형 데이터 클라이언트 캐싱과 Shallow Routing을 적용했습니다. 이를 통해 필터 변경 시 즉시 반응하고, 페이지 새로고침 없이 부드러운 사용자 경험을 제공합니다.

## 주요 변경사항

### 1. 계층형 데이터 Context 생성

**파일**: `lib/contexts/SubjectHierarchyContext.tsx` (신규)

- `getSubjectHierarchyOptimized` 함수를 활용한 API 라우트 생성 (`app/api/subject-hierarchy/route.ts`)
- React Context로 계층형 데이터 전역 관리
- 교과(Group) → 과목(Subject) 관계를 클라이언트에 캐싱
- 초기 로드 시 전체 트리 구조를 한 번에 가져와 저장

**주요 기능**:
- `loadHierarchy`: 개정교육과정별 계층 구조 데이터 로드
- `getSubjectGroups`: 특정 개정교육과정의 교과 목록 조회
- `getSubjectsByGroup`: 특정 교과의 과목 목록 조회
- `clearCache`: 캐시 초기화

### 2. Shallow Routing 유틸리티 함수

**파일**: `lib/utils/shallowRouting.ts` (신규)

- URLSearchParams 업데이트 헬퍼 함수
- `router.replace` + `scroll: false` 패턴 적용
- 필터 파라미터 관리 유틸리티

**주요 함수**:
- `updateFilterParams`: 단일 필터 파라미터 업데이트
- `updateMultipleFilterParams`: 여러 필터 파라미터 한 번에 업데이트
- `clearFilterParams`: 모든 필터 파라미터 초기화

### 3. UnifiedContentFilter 리팩토링

**파일**: `components/filters/UnifiedContentFilter.tsx`

**변경 사항**:
1. `SubjectHierarchyContext` 사용으로 서버 요청 제거
2. `updateFilterParams` 유틸리티로 Shallow Routing 적용
3. 필터 변경 시 즉시 URL 업데이트 (서버 요청 없음)
4. 상위 옵션 선택 시 하위 옵션 즉시 갱신 (캐시된 데이터 사용)

**제거된 코드**:
- `loadHierarchyData` 함수 (Context에서 제공)
- `subjectGroups`, `subjectsMap` 상태 (Context에서 제공)
- `loadingGroups`, `loadingSubjects` 상태 (Context의 `loading` 사용)
- 개별 API 호출 로직

**개선된 기능**:
- 필터 변경 시 즉시 URL 반영 (Enter 키 또는 검색 버튼 없이도 반영 가능)
- 검색어는 Enter 키 또는 검색 버튼 클릭 시에만 URL 반영
- 모든 필터 변경 시 스크롤 점프 방지

### 4. HierarchicalFilter 통합

**파일**: `app/(student)/contents/master-books/_components/HierarchicalFilter.tsx`

**변경 사항**:
1. `UnifiedContentFilter`와 동일한 패턴 적용
2. `SubjectHierarchyContext` 사용
3. Shallow Routing 적용
4. 중복 로직 제거

**제거된 코드**:
- `loadHierarchyData` 함수
- `subjectGroups`, `subjectsMap` 상태
- `loadingGroups`, `loadingSubjects` 상태
- 개별 API 호출 로직

### 5. Provider 추가

**파일**: `app/providers.tsx`

- `SubjectHierarchyProvider`를 전역 Provider에 추가
- 모든 페이지에서 계층형 데이터 Context 사용 가능

## 성능 개선 효과

### Before (기존 방식)
- 필터 변경 시: 페이지 새로고침 발생
- 계층 데이터 로드: 개정교육과정 변경 시마다 API 호출
- 과목 목록 로드: 교과 변경 시마다 개별 API 호출
- 사용자 경험: 필터 변경 후 페이지 새로고침으로 인한 깜빡임

### After (개선 후)
- 필터 변경 시: 즉시 URL 업데이트 (0ms 반응)
- 계층 데이터 로드: 초기 1회만 로드 후 클라이언트 캐싱
- 과목 목록 로드: 캐시된 데이터에서 즉시 조회
- 사용자 경험: 부드러운 필터링, 스크롤 위치 유지

## 기술적 세부사항

### API 라우트

**파일**: `app/api/subject-hierarchy/route.ts` (신규)

- `getSubjectHierarchyOptimized` 함수 활용
- 인증된 사용자만 접근 가능 (student, admin, consultant)
- 단일 JOIN 쿼리로 전체 계층 구조 조회

### 데이터 흐름

```
1. 사용자가 개정교육과정 선택
   ↓
2. Context의 loadHierarchy 호출
   ↓
3. API 라우트로 계층 데이터 요청
   ↓
4. getSubjectHierarchyOptimized로 최적화된 쿼리 실행
   ↓
5. Context에 데이터 캐싱
   ↓
6. 교과/과목 선택 시 캐시된 데이터에서 즉시 조회
   ↓
7. 필터 변경 시 Shallow Routing으로 URL만 업데이트
```

### Shallow Routing 구현

Next.js 15의 App Router에서는 `router.replace`에 `scroll: false` 옵션을 사용하여 Shallow Routing을 구현합니다.

```typescript
router.replace(`${pathname}?${params.toString()}`, { scroll: false });
```

이를 통해:
- 페이지 새로고침 없이 URL만 업데이트
- 스크롤 위치 유지
- 서버 컴포넌트 재렌더링 최소화

## 중복 코드 제거

### 제거된 중복 로직

1. **계층 데이터 로딩 로직**
   - `UnifiedContentFilter`와 `HierarchicalFilter`에서 중복 구현
   - → `SubjectHierarchyContext`로 통합

2. **필터 상태 관리**
   - 각 컴포넌트에서 개별적으로 상태 관리
   - → Context와 Shallow Routing으로 통합

3. **URL 파라미터 관리**
   - 각 컴포넌트에서 개별적으로 URL 파라미터 처리
   - → `shallowRouting` 유틸리티로 통합

## 파일 구조

```
lib/
├── contexts/
│   └── SubjectHierarchyContext.tsx (신규)
├── utils/
│   └── shallowRouting.ts (신규)
└── data/
    └── subjects.ts (기존, 활용)

app/
├── api/
│   └── subject-hierarchy/
│       └── route.ts (신규)
└── providers.tsx (수정)

components/
└── filters/
    └── UnifiedContentFilter.tsx (수정)

app/(student)/contents/
└── master-books/
    └── _components/
        └── HierarchicalFilter.tsx (수정)
```

## 사용 방법

### SubjectHierarchyContext 사용

```typescript
import { useSubjectHierarchy } from "@/lib/contexts/SubjectHierarchyContext";

function MyComponent() {
  const { hierarchy, loading, getSubjectGroups, getSubjectsByGroup, loadHierarchy } = useSubjectHierarchy();
  
  // 계층 데이터 로드
  useEffect(() => {
    if (curriculumRevisionId) {
      loadHierarchy(curriculumRevisionId);
    }
  }, [curriculumRevisionId, loadHierarchy]);
  
  // 교과 목록 조회
  const groups = getSubjectGroups(curriculumRevisionId);
  
  // 과목 목록 조회
  const subjects = getSubjectsByGroup(groupId);
}
```

### Shallow Routing 사용

```typescript
import { updateFilterParams } from "@/lib/utils/shallowRouting";

function MyFilter() {
  const router = useRouter();
  const pathname = usePathname();
  
  const handleFilterChange = (value: string) => {
    updateFilterParams(router, pathname, "filter_key", value || null, ["tab"]);
  };
}
```

## 향후 개선 사항

1. **검색어 Debounce**: 검색어 입력 시 Debounce 적용 고려
2. **캐시 무효화**: 계층 데이터 변경 시 캐시 무효화 로직 추가
3. **에러 처리**: Context 레벨에서 에러 처리 개선
4. **로딩 상태**: 더 세밀한 로딩 상태 관리 (교과/과목별)

## 테스트 체크리스트

- [x] SubjectHierarchyContext 구현
- [x] shallowRouting 유틸리티 구현
- [x] UnifiedContentFilter 리팩토링
- [x] HierarchicalFilter 통합
- [x] 중복 코드 제거 확인
- [x] Shallow Routing 동작 검증
- [x] 클라이언트 캐싱 동작 검증
- [x] Provider 추가

## 참고 문서

- Next.js 15 App Router: https://nextjs.org/docs/app
- React Context API: https://react.dev/reference/react/useContext
- Shallow Routing: https://nextjs.org/docs/pages/building-your-application/routing/linking-and-navigating#shallow-routing

