# 마스터 콘텐츠 필터링 로직 병렬화 개선

## 작업 일자
2025-02-02

## 작업 개요
마스터 콘텐츠 필터링 로직을 순차적 처리에서 병렬 처리로 개선하여 성능을 향상시켰습니다. 개정교육과정, 교과, 과목 관련 조회를 병렬로 처리하여 로딩 시간을 단축했습니다.

## 주요 변경 사항

### 1. API Route 최적화

#### `app/api/subject-groups/route.ts`
- **`include_subjects` 파라미터 추가**:
  - `?include_subjects=true` 옵션으로 교과와 과목을 함께 조회 가능
  - `getSubjectGroupsWithSubjects` 함수 활용하여 한 번의 API 호출로 모든 계층 데이터 조회
  - 기존 동작은 유지 (파라미터 없으면 교과만 조회)

```typescript
// 기존: 교과만 조회
GET /api/subject-groups?curriculum_revision_id=xxx

// 개선: 교과와 과목을 함께 조회 (병렬 처리)
GET /api/subject-groups?curriculum_revision_id=xxx&include_subjects=true
```

### 2. HierarchicalFilter 컴포넌트 병렬화

#### `app/(student)/contents/master-books/_components/HierarchicalFilter.tsx`

**주요 개선 사항**:

1. **초기값 처리 개선**:
   - 페이지 로드 시 초기값(`initialCurriculumRevisionId`, `initialSubjectGroupId`, `initialSubjectId`)이 있으면 병렬로 모든 계층 데이터 조회
   - 즉시 모든 필터 옵션 표시 가능

2. **개정교육과정 변경 시 병렬 로딩**:
   - 기존: 개정교육과정 선택 → 교과 로드 → 교과 선택 → 과목 로드 (순차)
   - 개선: 개정교육과정 선택 → 모든 교과와 각 교과의 과목을 병렬로 로드

3. **데이터 구조 개선**:
   - 교과별 과목을 `Map<string, Subject[]>` 형태로 관리
   - 교과 선택 시 이미 로드된 데이터를 즉시 사용
   - 중복 API 호출 방지

**변경 전 로직**:
```typescript
// 순차적 로딩
useEffect(() => {
  if (selectedCurriculumRevisionId) {
    // 1. 교과 목록 로드
    fetchSubjectGroups().then(groups => {
      setSubjectGroups(groups);
    });
  }
}, [selectedCurriculumRevisionId]);

useEffect(() => {
  if (selectedSubjectGroupId) {
    // 2. 과목 목록 로드 (교과 선택 후)
    fetchSubjects().then(subjects => {
      setSubjects(subjects);
    });
  }
}, [selectedSubjectGroupId]);
```

**변경 후 로직**:
```typescript
// 병렬 로딩
const loadHierarchyData = async (curriculumRevisionId: string) => {
  // 교과와 과목을 함께 조회 (병렬 처리)
  const response = await fetch(
    `/api/subject-groups?curriculum_revision_id=${curriculumRevisionId}&include_subjects=true`
  );
  const groupsWithSubjects = await response.json();
  
  // 교과별 과목을 Map으로 변환하여 즉시 사용 가능
  const subjectsMap = new Map();
  groupsWithSubjects.forEach(group => {
    subjectsMap.set(group.id, group.subjects);
  });
  
  setSubjectGroups(groups);
  setSubjectsMap(subjectsMap);
};
```

### 3. 성능 최적화 효과

#### 개선 전 (순차 로딩)
```
개정교육과정 선택
  ↓ (API 호출 1)
교과 목록 표시
  ↓ (교과 선택)
  ↓ (API 호출 2)
과목 목록 표시

총 시간: API 호출 1 + API 호출 2
```

#### 개선 후 (병렬 로딩)
```
개정교육과정 선택
  ↓ (API 호출 1 - 교과 + 과목 함께)
교과 목록 + 모든 교과의 과목 목록 동시 로드
  ↓ (교과 선택)
과목 목록 즉시 표시 (이미 로드됨)

총 시간: API 호출 1만
```

## 적용 범위

### HierarchicalFilter 컴포넌트
다음 페이지에서 동일한 `HierarchicalFilter` 컴포넌트를 사용하므로 모든 곳에 적용됩니다:

1. ✅ `app/(student)/contents/master-books/page.tsx` - 학생 교재 검색
2. ✅ `app/(student)/contents/master-lectures/page.tsx` - 학생 강의 검색
3. ✅ `app/(admin)/admin/master-books/page.tsx` - 관리자 교재 목록

### 플랜 그룹 생성 단계
플랜 그룹 생성 과정에서 사용하는 마스터 콘텐츠 검색 컴포넌트에도 동일한 병렬화 로직을 적용했습니다:

1. ✅ `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx` - 콘텐츠 마스터 검색 다이얼로그
2. ✅ `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx` - 마스터 콘텐츠 패널

## 기술적 세부사항

### 데이터 로드 전략

1. **초기 마운트 시**:
   - `initialCurriculumRevisionId`가 있으면 즉시 계층 데이터 로드
   - 초기값(`initialSubjectGroupId`, `initialSubjectId`) 보존

2. **개정교육과정 변경 시**:
   - 모든 교과와 각 교과의 과목을 한 번에 로드
   - 교과별 과목을 Map에 저장하여 즉시 접근 가능

3. **교과 변경 시**:
   - 이미 로드된 과목 목록을 Map에서 즉시 조회
   - 추가 API 호출 불필요

### 에러 핸들링

- 병렬 처리 중 일부 실패 시에도 나머지 결과는 표시
- 각 단계별 에러 로깅 및 사용자 피드백

### 메모리 관리

- 교과별 과목을 Map으로 관리하여 메모리 효율성 향상
- 불필요한 재렌더링 방지

## 예상 효과

1. **로딩 시간 단축**: 순차 로딩 → 병렬 로딩으로 API 호출 시간 감소
2. **사용자 경험 개선**: 초기값 처리 시 즉시 모든 옵션 표시
3. **API 호출 감소**: 여러 번의 API 호출 → 한 번의 API 호출
4. **반응 속도 향상**: 교과 선택 시 과목 목록 즉시 표시

## 테스트 포인트

1. ✅ 초기값이 있을 경우 모든 필터 옵션이 즉시 표시되는지 확인
2. ✅ 개정교육과정 변경 시 교과와 과목이 함께 로드되는지 확인
3. ✅ 교과 선택 시 과목 목록이 즉시 표시되는지 확인
4. ✅ API 호출 횟수가 감소했는지 확인 (Network 탭)
5. ✅ 에러 발생 시 적절한 처리 확인

### 플랜 그룹 생성 컴포넌트 병렬화

#### `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`
- 개정교육과정 변경 시 교과와 과목을 병렬로 로드
- 교과별 과목을 Map으로 관리
- 동일한 `include_subjects` 파라미터 활용

#### `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`
- 동일한 병렬화 로직 적용
- 플랜 그룹 생성 Step 3에서 마스터 콘텐츠 검색 시 성능 향상

## 참고 파일

- `app/api/subject-groups/route.ts`: API Route 최적화
- `app/(student)/contents/master-books/_components/HierarchicalFilter.tsx`: 병렬화된 필터 컴포넌트
- `app/(student)/plan/new-group/_components/ContentMasterSearch.tsx`: 플랜 그룹 생성용 마스터 콘텐츠 검색
- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`: 마스터 콘텐츠 패널
- `lib/data/subjects.ts`: `getSubjectGroupsWithSubjects` 함수 활용
- `docs/2025-02-02-master-content-filtering-improvement.md`: 이전 필터링 개선 작업

## 마이그레이션 노트

- 기존 동작과 완전히 호환 (하위 호환성 유지)
- 기존 URL 파라미터 구조 변경 없음
- 추가 API 파라미터는 선택사항 (`include_subjects`)

