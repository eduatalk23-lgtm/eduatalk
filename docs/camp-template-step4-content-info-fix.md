# Step4RecommendedContents 콘텐츠 정보 조회 문제 수정

## 작업 개요

편집 모드에서 이미 추가된 추천 콘텐츠의 정보가 정확히 조회되지 않는 문제를 수정했습니다.

## 문제 분석

편집 모드(`isEditMode`)에서 캠프 템플릿 상세 페이지에서 플랜 그룹 위저드를 계속 진행할 때:
- `fetchRecommendations`가 호출되지 않아 `allRecommendedContents`가 비어있음
- 이미 추가된 추천 콘텐츠의 정보(title, subject_category 등)를 조회할 수 없음
- 렌더링 시 "알 수 없음"으로 표시되거나 정보가 누락됨

## 해결 방안

편집 모드에서도 이미 추가된 추천 콘텐츠가 있으면 해당 콘텐츠의 정보를 조회하는 별도 `useEffect`를 추가했습니다.

## 수정 내용

### 파일: `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx`

#### 1. `fetchedRecommendedContentIdsRef` 추가

```typescript
const fetchedRecommendedContentIdsRef = useRef<Set<string>>(new Set());
```

- 이미 조회한 콘텐츠 ID를 추적하여 중복 조회 방지
- 무한 루프 방지

#### 2. 편집 모드에서 추천 콘텐츠 정보 조회 로직 추가

```typescript
// 편집 모드에서 이미 추가된 추천 콘텐츠 정보 조회
useEffect(() => {
  const fetchExistingRecommendedContents = async () => {
    if (!isEditMode || data.recommended_contents.length === 0) return;

    const contentsMap = new Map<string, RecommendedContent>();

    for (const content of data.recommended_contents) {
      // 이미 조회한 콘텐츠는 스킵
      if (fetchedRecommendedContentIdsRef.current.has(content.content_id)) {
        continue;
      }

      // 저장된 정보가 있으면 사용
      const storedTitle = (content as any).title;
      const storedSubjectCategory = (content as any).subject_category;

      if (storedTitle && storedSubjectCategory) {
        // 저장된 정보로 RecommendedContent 객체 생성
        contentsMap.set(content.content_id, { ... });
        continue;
      }

      // 저장된 정보가 없으면 서버 액션으로 조회
      try {
        const result = await fetchContentMetadataAction(
          content.content_id,
          content.content_type
        );
        if (result.success && result.data) {
          // 조회한 정보로 RecommendedContent 객체 생성
          contentsMap.set(content.content_id, { ... });
        }
      } catch (error) {
        // 에러 처리
      }
    }

    // allRecommendedContents에 추가
    if (contentsMap.size > 0) {
      // 조회한 콘텐츠 ID 추적
      contentsMap.forEach((_, id) => {
        fetchedRecommendedContentIdsRef.current.add(id);
      });

      setAllRecommendedContents((prev) => {
        const merged = new Map<string, RecommendedContent>();
        prev.forEach((c) => merged.set(c.id, c));
        contentsMap.forEach((c, id) => {
          merged.set(id, c);
        });
        return Array.from(merged.values());
      });
    }
  };

  fetchExistingRecommendedContents();
}, [isEditMode, data.recommended_contents]);
```

## 주요 변경사항

1. **편집 모드에서 추천 콘텐츠 정보 조회**
   - 편집 모드에서도 이미 추가된 추천 콘텐츠의 정보를 조회
   - 저장된 정보가 있으면 우선 사용
   - 저장된 정보가 없으면 `fetchContentMetadataAction`으로 조회

2. **중복 조회 방지**
   - `fetchedRecommendedContentIdsRef`를 사용하여 이미 조회한 콘텐츠 ID 추적
   - 무한 루프 방지

3. **정보 우선순위**
   - 저장된 정보 우선 사용
   - 저장된 정보가 없으면 API로 조회
   - 조회 실패 시 기본값 사용

## 테스트 시나리오

1. ✅ 캠프 템플릿 상세 페이지에서 "계속하기" 버튼 클릭
2. ✅ Step 4 (추천 콘텐츠) 단계로 이동
3. ✅ 이미 추가된 추천 콘텐츠의 제목과 과목 정보가 올바르게 표시되는지 확인
4. ✅ 편집 모드에서도 콘텐츠 정보가 정확히 조회되는지 확인
5. ✅ 중복 조회가 발생하지 않는지 확인

## 관련 파일

- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx` - 편집 모드에서 추천 콘텐츠 정보 조회 로직 추가

## 작업 일시

2025-01-XX

