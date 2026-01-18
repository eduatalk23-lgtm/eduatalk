# Step4 추천 콘텐츠 범위 정보 불러오기 로직 점검

## 📋 점검 개요

**점검 일시**: 2025-01-30  
**점검 대상**: 플랜 그룹 생성 시 추천 콘텐츠의 범위 정보(`start_range`, `end_range`) 불러오기 로직  
**점검 범위**: 
- 자동 배정 시 범위 정보 설정
- 수동 선택 시 범위 정보 설정
- 범위 편집 시 상세 정보 조회

---

## 🔍 현재 구현 상태

### 1. 자동 배정 시 범위 정보 설정 ✅

**위치**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts`

**로직**:
```typescript:135:227:app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts
const autoAssignContents = useCallback(
  async (recommendations: RecommendedContent[]) => {
    // 각 추천 콘텐츠에 대해 상세 정보 조회
    for (const r of recommendations) {
      const response = await fetch(
        `/api/master-content-details?contentType=${r.contentType}&contentId=${r.id}`
      );
      
      if (response.ok) {
        const result = await response.json();
        
        if (r.contentType === "book") {
          const details = result.details || [];
          if (details.length > 0) {
            startRange = details[0].page_number || 1;
            endRange = details[details.length - 1].page_number || 100;
          }
        } else if (r.contentType === "lecture") {
          const episodes = result.episodes || [];
          if (episodes.length > 0) {
            startRange = episodes[0].episode_number || 1;
            endRange = episodes[episodes.length - 1].episode_number || 100;
          }
        }
      }
    }
  },
  [data.student_contents, data.recommended_contents, onUpdate]
);
```

**동작**:
- ✅ 각 추천 콘텐츠에 대해 `/api/master-content-details` API 호출
- ✅ 책: 첫 페이지(`details[0].page_number`) ~ 마지막 페이지(`details[details.length - 1].page_number`)
- ✅ 강의: 첫 회차(`episodes[0].episode_number`) ~ 마지막 회차(`episodes[episodes.length - 1].episode_number`)
- ✅ API 호출 실패 시 기본값(1, 100) 사용

**평가**: 정상 동작

---

### 2. 수동 선택 시 범위 정보 설정 ⚠️

**위치**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts`

**로직**:
```typescript:55:115:app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts
const addSelectedContents = useCallback(() => {
  // 선택된 콘텐츠 정보 수집
  const contentsToAdd: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    // ...
  }> = [];

  selectedContentIds.forEach((contentId) => {
    const content = recommendedContents.find((c) => c.id === contentId);
    if (content) {
      contentsToAdd.push({
        content_type: content.contentType,
        content_id: content.id,
        start_range: 1,      // ❌ 항상 기본값
        end_range: 100,      // ❌ 항상 기본값
        // ...
      });
    }
  });
}, [selectedContentIds, data.student_contents, data.recommended_contents, recommendedContents, onUpdate]);
```

**문제점**:
- ❌ 수동으로 콘텐츠를 선택해서 추가할 때 범위 정보를 불러오지 않음
- ❌ 항상 기본값(1, 100)으로 설정됨
- ❌ 사용자가 나중에 범위를 수정해야 하는 번거로움

**영향도**: 중간
- 기능적으로는 동작하지만, 사용자 경험이 저하됨
- 범위 편집 기능이 있어서 나중에 수정할 수는 있음

---

### 3. 범위 편집 시 상세 정보 조회 ✅

**위치**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts`

**로직**:
```typescript:41:126:app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts
useEffect(() => {
  if (editingRangeIndex === null) return;

  const content = data.recommended_contents[editingRangeIndex];
  
  const fetchDetails = async () => {
    // 캐시 확인
    if (cachedDetailsRef.current.has(content.content_id)) {
      const cached = cachedDetailsRef.current.get(content.content_id)!;
      setContentDetails(new Map([[editingRangeIndex, cached]]));
      return;
    }

    // API 호출
    const response = await fetch(
      `/api/master-content-details?contentType=${content.content_type}&contentId=${content.content_id}`
    );
    
    if (response.ok) {
      const result = await response.json();
      const detailData = content.content_type === "book"
        ? { details: result.details || [], type: "book" as const }
        : { details: result.episodes || [], type: "lecture" as const };

      // 캐시 저장
      cachedDetailsRef.current.set(content.content_id, detailData);
      setContentDetails(new Map([[editingRangeIndex, detailData]]));

      // 현재 범위에 해당하는 항목 자동 선택
      const currentRange = {
        start: content.start_range,
        end: content.end_range,
      };
      // ... 자동 선택 로직
    }
  };

  fetchDetails();
}, [editingRangeIndex]);
```

**동작**:
- ✅ 범위 편집 시작 시 상세 정보 조회
- ✅ 캐싱 적용 (중복 요청 방지)
- ✅ 현재 범위에 해당하는 항목 자동 선택
- ✅ 책/강의 타입별로 적절한 처리

**평가**: 정상 동작, 캐싱까지 잘 구현됨

---

## 📊 API 엔드포인트 점검

### `/api/master-content-details`

**위치**: `app/api/master-content-details/route.ts`

**구현 상태**:
- ✅ 인증 확인 (student, admin, consultant)
- ✅ 파라미터 검증 (`contentType`, `contentId`)
- ✅ 책/강의 타입별 처리
- ✅ 메타데이터 선택적 포함 (`includeMetadata`)

**응답 형식**:
```typescript
// 책
{
  success: true,
  data: {
    details: BookDetail[],  // { id, book_id, page_number, ... }
    metadata?: {...}        // 선택적
  }
}

// 강의
{
  success: true,
  data: {
    episodes: LectureEpisode[],  // { id, lecture_id, episode_number, ... }
    metadata?: {...}             // 선택적
  }
}
```

**평가**: 정상 동작

---

## ⚠️ 발견된 문제점 및 개선 제안

### 문제 1: 수동 선택 시 범위 정보 미조회

**현재 동작**:
- 사용자가 추천 콘텐츠를 수동으로 선택하여 추가할 때
- 범위 정보(`start_range`, `end_range`)가 항상 기본값(1, 100)으로 설정됨

**영향**:
1. 사용자가 나중에 범위를 수정해야 하는 번거로움
2. 자동 배정과 수동 선택의 일관성 부족
3. 사용자 경험 저하

**개선 방안**:

#### 방안 1: 선택 시 즉시 범위 정보 조회 (권장)

```typescript
// useContentSelection.ts 수정
const addSelectedContents = useCallback(async () => {
  if (selectedContentIds.size === 0) {
    alert(ERROR_MESSAGES.NO_CONTENT_SELECTED);
    return;
  }

  // 최대 개수 확인
  const currentTotal =
    data.student_contents.length + data.recommended_contents.length;
  const toAdd = selectedContentIds.size;

  if (currentTotal + toAdd > MAX_CONTENTS) {
    alert(ERROR_MESSAGES.EXCEED_MAX_CONTENTS(currentTotal, toAdd, MAX_CONTENTS));
    return;
  }

  // 선택된 콘텐츠 정보 수집 (범위 정보 포함)
  const contentsToAdd: Array<{
    content_type: "book" | "lecture";
    content_id: string;
    start_range: number;
    end_range: number;
    // ...
  }> = [];

  // 범위 정보를 병렬로 조회
  await Promise.all(
    Array.from(selectedContentIds).map(async (contentId) => {
      const content = recommendedContents.find((c) => c.id === contentId);
      if (!content) return;

      let startRange = 1;
      let endRange = 100;

      try {
        const response = await fetch(
          `/api/master-content-details?contentType=${content.contentType}&contentId=${content.id}`
        );

        if (response.ok) {
          const result = await response.json();

          if (content.contentType === "book") {
            const details = result.details || [];
            if (details.length > 0) {
              startRange = details[0].page_number || 1;
              endRange = details[details.length - 1].page_number || 100;
            }
          } else if (content.contentType === "lecture") {
            const episodes = result.episodes || [];
            if (episodes.length > 0) {
              startRange = episodes[0].episode_number || 1;
              endRange = episodes[episodes.length - 1].episode_number || 100;
            }
          }
        }
      } catch (error) {
        console.warn(
          `[useContentSelection] 콘텐츠 ${content.id} 상세 정보 조회 실패:`,
          error
        );
        // 기본값 유지
      }

      contentsToAdd.push({
        content_type: content.contentType,
        content_id: content.id,
        start_range: startRange,
        end_range: endRange,
        title: content.title,
        subject_category: content.subject_category || undefined,
        master_content_id: content.id,
        recommendation_reason: content.reason,
      });
    })
  );

  if (contentsToAdd.length > 0) {
    onUpdate({
      recommended_contents: [
        ...data.recommended_contents,
        ...contentsToAdd,
      ],
    });
    alert(SUCCESS_MESSAGES.CONTENTS_ADDED(contentsToAdd.length));
    setSelectedContentIds(new Set());
  }
}, [
  selectedContentIds,
  data.student_contents,
  data.recommended_contents,
  recommendedContents,
  onUpdate,
]);
```

**장점**:
- ✅ 자동 배정과 동일한 동작
- ✅ 사용자가 바로 사용 가능한 범위로 시작
- ✅ 사용자 경험 개선

**단점**:
- ⚠️ API 호출 시간 추가 (병렬 처리로 최소화)
- ⚠️ 네트워크 오류 시 기본값으로 대체 (현재와 동일)

#### 방안 2: 나중에 자동 조회 (대안)

콘텐츠가 추가된 후 백그라운드에서 범위 정보를 조회하고 자동으로 업데이트하는 방식

**장점**:
- ✅ 사용자 대기 시간 없음
- ✅ 점진적 개선

**단점**:
- ⚠️ 구현 복잡도 증가
- ⚠️ 상태 관리 추가 필요

---

### 문제 2: 에러 처리 개선 가능

**현재 상태**:
- API 호출 실패 시 기본값(1, 100) 사용
- 콘솔 경고만 출력

**개선 제안**:
- 사용자에게 명확한 피드백 제공
- 재시도 로직 고려 (선택적)

---

## ✅ 정상 동작 항목

1. **자동 배정 시 범위 정보 설정**: 정상 동작 ✅
2. **범위 편집 시 상세 정보 조회**: 정상 동작 (캐싱 포함) ✅
3. **API 엔드포인트**: 정상 동작 ✅
4. **에러 처리**: 기본적인 처리 완료 ✅

---

## 📝 개선 작업 우선순위

### 높음 🔴
1. **수동 선택 시 범위 정보 조회 추가** (방안 1 권장)
   - 사용자 경험 개선
   - 자동 배정과의 일관성 확보

### 중간 🟡
2. **에러 처리 개선**
   - 사용자 피드백 강화
   - 재시도 로직 고려

### 낮음 🟢
3. **로딩 상태 표시**
   - 범위 정보 조회 중 로딩 인디케이터

---

## 🔧 권장 수정 사항

### 즉시 적용 권장

**파일**: `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts`

**수정 내용**: `addSelectedContents` 함수에 범위 정보 조회 로직 추가 (위 방안 1 참고)

**예상 소요 시간**: 30분 ~ 1시간

---

## 📚 관련 파일 목록

### 주요 파일
- `app/(student)/plan/new-group/_components/Step4RecommendedContents.tsx` - 메인 컴포넌트
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRecommendations.ts` - 추천 콘텐츠 관리
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useContentSelection.ts` - 콘텐츠 선택 관리
- `app/(student)/plan/new-group/_components/Step4RecommendedContents/hooks/useRangeEditor.ts` - 범위 편집 관리

### API 파일
- `app/api/master-content-details/route.ts` - 마스터 콘텐츠 상세 정보 API
- `lib/data/contentMasters.ts` - 콘텐츠 데이터 조회 함수

---

## ✅ 점검 완료 항목

- [x] 자동 배정 시 범위 정보 설정 로직 확인
- [x] 수동 선택 시 범위 정보 설정 로직 확인
- [x] 범위 편집 시 상세 정보 조회 로직 확인
- [x] API 엔드포인트 확인
- [x] 데이터 흐름 추적
- [x] 에러 처리 확인
- [x] 캐싱 로직 확인
- [x] 문제점 식별 및 개선 방안 제시

---

**점검 완료일**: 2025-01-30  
**점검자**: AI Assistant  
**다음 조치**: 수동 선택 시 범위 정보 조회 로직 추가 권장

