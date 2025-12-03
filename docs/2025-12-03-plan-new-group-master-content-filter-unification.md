# 플랜 그룹 생성 페이지 마스터 콘텐츠 필터 통일

## 작업 개요

플랜 그룹 생성 페이지(`/plan/new-group`)의 마스터 콘텐츠 필터링 기능을 학생/관리자 콘텐츠 필터와 동일하게 통일했습니다.

## 작업 일시

2025-12-03

## 변경 사항

### MasterContentsPanel 컴포넌트 수정

**파일**: `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx`

#### 추가된 기능

1. **학년/학기 필터 상태 추가**
   - `semester` state 추가
   - `semesters` 옵션 목록 state 추가

2. **학년/학기 목록 로드**
   - `getSemesterListAction`을 사용하여 컴포넌트 마운트 시 학년/학기 목록 로드
   - 기존 `useEffect` 패턴과 동일하게 구현

3. **UI에 학년/학기 필터 추가**
   - 과목 선택 필드 다음에 학년/학기 선택 필드 추가
   - `HierarchicalFilter`와 동일한 스타일 적용
   - disabled 상태 처리 (로딩 중, 편집 불가 등)

4. **검색 로직 수정**
   - `handleSearch`에서 `semester` 필터 전달
   - `searchContentMastersAction` 호출 시 `semester` 파라미터 포함
   - 검색 조건 검증 로직에 `semester` 추가

## 구현 세부사항

### 1. Import 추가

```typescript
import { searchContentMastersAction, getSemesterListAction } from "@/app/(student)/actions/contentMasterActions";
```

### 2. State 추가

```typescript
const [semester, setSemester] = useState("");
const [semesters, setSemesters] = useState<string[]>([]);
```

### 3. 학년/학기 목록 로드

```typescript
// 학년/학기 목록 로드
useEffect(() => {
  getSemesterListAction()
    .then((semesterList) => {
      setSemesters(semesterList || []);
    })
    .catch((err) => {
      console.error("학년/학기 목록 로드 실패:", err);
    });
}, []);
```

### 4. 검색 로직 수정

```typescript
// 검색 조건 검증에 semester 추가
if (
  !searchQuery.trim() &&
  !curriculumRevisionId &&
  !subjectGroupId &&
  !subjectId &&
  !semester &&
  selectedContentType === "all"
) {
  // ...
}

// 검색 시 semester 필터 전달
searchContentMastersAction({
  content_type: "book",
  curriculum_revision_id: curriculumRevisionId || undefined,
  subject_group_id: subjectGroupId || undefined,
  subject_id: subjectId || undefined,
  semester: semester || undefined, // 추가
  search: searchQuery.trim() || undefined,
  limit: 20,
});
```

### 5. UI 추가

```typescript
{/* 학년/학기 선택 */}
<div>
  <label className="mb-1 block text-sm font-medium text-gray-800">
    학년/학기
  </label>
  <select
    value={semester}
    onChange={(e) => setSemester(e.target.value)}
    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
    disabled={!editable || isSearching}
  >
    <option value="">전체</option>
    {semesters.map((sem) => (
      <option key={sem} value={sem}>
        {sem}
      </option>
    ))}
  </select>
</div>
```

## API 확인

### 검증 결과

- `searchContentMastersAction`은 이미 `semester` 필터를 지원함
- `lib/data/contentMasters.ts`의 `searchMasterBooks`와 `searchMasterLectures` 함수 모두 `semester` 필터 지원
- `getSemesterListAction`이 이미 구현되어 있어 추가 작업 불필요

## 통일된 필터 구조

이제 다음 세 곳에서 동일한 필터 구조를 사용합니다:

1. **학생 콘텐츠 필터** (`/contents/master-books`, `/contents/master-lectures`)
   - `HierarchicalFilter` 컴포넌트 사용
   - 개정교육과정 → 교과 → 과목 → 학년/학기 → 제목 검색

2. **관리자 콘텐츠 필터** (`/admin/master-books`, `/admin/master-lectures`)
   - `HierarchicalFilter` 컴포넌트 사용
   - 개정교육과정 → 교과 → 과목 → 학년/학기 → 제목 검색

3. **플랜 그룹 생성 페이지** (`/plan/new-group`)
   - `MasterContentsPanel` 컴포넌트 사용
   - 개정교육과정 → 교과 → 과목 → **학년/학기** → 제목 검색 (추가됨)

## 검증 사항

- [x] 학년/학기 필터가 UI에 표시되는가?
- [x] 학년/학기 필터 선택 시 검색 결과가 필터링되는가?
- [x] 필터 초기화 시 학년/학기도 초기화되는가?
- [x] 학생/관리자 콘텐츠 필터와 동일한 동작을 하는가?
- [x] 스타일이 일관성 있는가?
- [x] API가 semester 필터를 지원하는가?

## 참고 파일

- `app/(student)/plan/new-group/_components/_shared/MasterContentsPanel.tsx` - 수정된 파일
- `app/(student)/contents/master-books/_components/HierarchicalFilter.tsx` - 참고 컴포넌트
- `app/(student)/actions/contentMasterActions.ts` - API 확인
- `lib/data/contentMasters.ts` - API 구현 확인

