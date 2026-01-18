# 관리자 모드 콘텐츠 범위 수정 오류 수정

## 작업 일시
2025-02-02

## 문제점 분석

1. **student_id 오류**: `useRangeEditor`에서 학생 콘텐츠를 편집할 때 `/api/student-content-details`를 호출해야 하는데, 현재는 항상 `/api/master-content-details`를 호출하고 있었습니다. 관리자 모드에서는 `student_id` 파라미터가 필요합니다.

2. **상세 정보를 찾을 수 없음 오류**: 학생 콘텐츠의 경우 `/api/student-content-details`를 호출해야 하는데, 마스터 콘텐츠 API를 호출하고 있어서 오류가 발생했습니다.

3. **상세 정보가 없을 때 학생 입력 범위 표시**: 상세 정보가 없을 때 현재 범위(`start_range`, `end_range`)를 표시해야 합니다.

## 해결 방안

### Phase 1: useRangeEditor에서 콘텐츠 타입에 따라 올바른 API 호출

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

**변경사항**:
- `UseRangeEditorProps`에 `studentId?: string` prop 추가
- `editingContentType`에 따라 API 엔드포인트 선택
  - `recommended`: `/api/master-content-details` 사용 (기존)
  - `student`: `/api/student-content-details` 사용 (새로 추가)
- 학생 콘텐츠 조회 시 `student_id` 파라미터 추가

### Phase 2: fetchContentTotal에서도 student_id 지원

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

**변경사항**:
- `fetchContentTotal` 함수에 `studentId?: string`, `isStudentContent?: boolean` 파라미터 추가
- 학생 콘텐츠의 경우 `/api/student-content-info` 호출 시 `student_id` 파라미터 추가
- 캐시 키에 `studentId` 포함 (학생 콘텐츠의 경우)

### Phase 3: 상세 정보가 없을 때 현재 범위 표시 개선

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

**변경사항**:
- 상세 정보가 없을 때 `start_range`, `end_range`를 기본값으로 사용하도록 개선
- 총 페이지수/회차가 있으면 전체 범위로 설정, 없으면 현재 범위 사용

## 구현 세부사항

### Phase 1: API 호출 수정

```typescript
// useRangeEditor Props에 studentId 추가
type UseRangeEditorProps = {
  data: WizardData;
  onUpdate: (updates: Partial<WizardData>) => void;
  studentId?: string; // 관리자 모드에서 필요
};

// useEffect에서 콘텐츠 타입에 따라 API 선택
const apiEndpoint = editingContentType === "recommended"
  ? `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`
  : `/api/student-content-details?contentType=${content.content_type}&contentId=${content.content_id}${studentId ? `&student_id=${studentId}` : ""}`;
```

### Phase 2: fetchContentTotal 수정

```typescript
const fetchContentTotal = useCallback(async (
  contentType: "book" | "lecture",
  contentId: string,
  studentId?: string,
  isStudentContent?: boolean
): Promise<number | null> => {
  // 캐시 확인 (학생 콘텐츠의 경우 studentId를 포함한 키 사용)
  const cacheKey = isStudentContent && studentId 
    ? `${contentId}_${studentId}` 
    : contentId;
  
  // 학생 콘텐츠의 경우 student-content-info API 사용
  const apiEndpoint = isStudentContent && studentId
    ? `/api/student-content-info?content_type=${contentType}&content_id=${contentId}&student_id=${studentId}`
    : `/api/master-content-info?content_type=${contentType}&content_id=${contentId}`;
  // ...
}, []);
```

### Phase 3: 상세 정보 없을 때 범위 표시

```typescript
// 상세 정보가 없을 때 현재 범위를 기본값으로 사용
if (detailData.details.length === 0) {
  setEditingRange((prev) => {
    if (prev) {
      return prev;
    }
    // 총 페이지수/회차가 있으면 전체 범위로 설정, 없으면 현재 범위 사용
    if (total && total > 0) {
      return {
        start: "1",
        end: String(total),
      };
    } else {
      return {
        start: String(content.start_range || 1),
        end: String(content.end_range || 100),
      };
    }
  });
}
```

## 관련 파일

### 수정 파일
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

### 참고 파일
- `app/api/student-content-details/route.ts`
- `app/api/master-content-details/route.ts`
- `app/api/student-content-info/route.ts`
- `app/api/master-content-info/route.ts`

## 테스트 체크리스트

- [ ] 관리자 모드에서 추천 콘텐츠 범위 수정 시 정상 작동 확인
- [ ] 관리자 모드에서 학생 콘텐츠 범위 수정 시 student_id 오류 없이 정상 작동 확인
- [ ] 학생 콘텐츠 상세 정보 조회 시 올바른 API 호출 확인
- [ ] 상세 정보가 없을 때 현재 범위가 표시되는지 확인
- [ ] 총 페이지수/회차가 있을 때 전체 범위로 자동 설정되는지 확인

