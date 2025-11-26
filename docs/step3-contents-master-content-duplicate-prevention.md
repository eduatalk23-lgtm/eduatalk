# Step3Contents 마스터 콘텐츠 ID 기반 중복 방지 개선

## 🔍 작업 개요

Step3Contents에서 학생 콘텐츠를 추가할 때, 마스터 콘텐츠 ID를 확인하여 중복을 방지하도록 개선했습니다.

## ✅ 변경 사항

### 파일: `app/(student)/plan/new-group/_components/Step3Contents.tsx`

#### `addSelectedContents` 함수 개선

기존에는 `content_id`만으로 중복을 확인했지만, 마스터 콘텐츠 ID를 확인하여 더 정확한 중복 방지를 구현했습니다.

**변경 전**:

```typescript
// 중복 체크 (학생 콘텐츠와 추천 콘텐츠 모두 확인)
if (
  data.student_contents.some(
    (c) => c.content_type === contentType && c.content_id === contentId
  ) ||
  data.recommended_contents.some(
    (c) => c.content_type === contentType && c.content_id === contentId
  )
) {
  continue; // 이미 추가된 콘텐츠는 스킵
}
```

**변경 후**:

```typescript
// 학생 콘텐츠의 master_content_id 조회 (중복 방지 개선)
const { getStudentContentMasterIdsAction } = await import(
  "@/app/(student)/actions/getStudentContentMasterIds"
);
const studentContentsForMasterId = data.student_contents.filter(
  (c) => c.content_type === "book" || c.content_type === "lecture"
) as Array<{ content_id: string; content_type: "book" | "lecture" }>;

let studentMasterIds = new Set<string>();
if (studentContentsForMasterId.length > 0) {
  try {
    const masterIdResult = await getStudentContentMasterIdsAction(
      studentContentsForMasterId
    );
    if (masterIdResult.success && masterIdResult.data) {
      masterIdResult.data.forEach((masterId, contentId) => {
        if (masterId) {
          studentMasterIds.add(masterId);
        }
      });
    }
  } catch (error) {
    console.warn("[Step3Contents] master_content_id 조회 실패:", error);
  }
}

// 중복 체크 (학생 콘텐츠와 추천 콘텐츠 모두 확인)
// 1. content_id로 직접 비교
const isDuplicateByContentId =
  data.student_contents.some(
    (c) => c.content_type === contentType && c.content_id === contentId
  ) ||
  data.recommended_contents.some(
    (c) => c.content_type === contentType && c.content_id === contentId
  );

// 2. master_content_id로 비교 (학생이 마스터 콘텐츠를 등록한 경우)
// 2-1. 추가하려는 콘텐츠가 마스터에서 가져온 경우
//      → 이미 추가된 학생 콘텐츠의 master_content_id와 비교
//      → 추천 콘텐츠의 content_id와 비교 (추천 콘텐츠는 마스터 콘텐츠 ID를 content_id로 사용)
const isDuplicateByMasterId =
  content?.master_content_id &&
  (studentMasterIds.has(content.master_content_id) ||
    // 추천 콘텐츠의 content_id가 마스터 콘텐츠 ID인 경우
    data.recommended_contents.some(
      (c) =>
        c.content_type === contentType &&
        (c.content_id === content.master_content_id ||
          (c as any).master_content_id === content.master_content_id)
    ));

// 2-2. 추가하려는 콘텐츠가 마스터에서 가져온 것이 아닌 경우
//      → 추천 콘텐츠로 이미 추가된 마스터 콘텐츠의 content_id와 비교
//      (추천 콘텐츠는 마스터 콘텐츠 ID를 content_id로 사용하므로)
const isDuplicateByRecommendedMasterId =
  !content?.master_content_id &&
  data.recommended_contents.some(
    (c) =>
      c.content_type === contentType &&
      // 추천 콘텐츠의 content_id가 마스터 콘텐츠 ID인 경우
      // 학생 콘텐츠의 content_id가 추천 콘텐츠의 content_id와 같으면 중복
      c.content_id === contentId
  );

if (
  isDuplicateByContentId ||
  isDuplicateByMasterId ||
  isDuplicateByRecommendedMasterId
) {
  continue; // 이미 추가된 콘텐츠는 스킵
}
```

## 🔄 중복 방지 로직

### 1. content_id로 직접 비교

추가하려는 콘텐츠의 `content_id`가 이미 추가된 학생 콘텐츠나 추천 콘텐츠의 `content_id`와 일치하는지 확인합니다.

### 2. master_content_id로 비교

#### 2-1. 추가하려는 콘텐츠가 마스터에서 가져온 경우

- 추가하려는 콘텐츠의 `master_content_id`가 이미 추가된 학생 콘텐츠의 `master_content_id`와 일치하는지 확인
- 추가하려는 콘텐츠의 `master_content_id`가 추천 콘텐츠의 `content_id`와 일치하는지 확인 (추천 콘텐츠는 마스터 콘텐츠 ID를 `content_id`로 사용)

#### 2-2. 추가하려는 콘텐츠가 마스터에서 가져온 것이 아닌 경우

- 추천 콘텐츠의 `content_id`가 추가하려는 콘텐츠의 `content_id`와 일치하는지 확인
- 이 경우는 일반적으로 발생하지 않지만, 안전을 위해 확인

## 🎯 효과

### 개선 전

- `content_id`만으로 중복 확인
- 같은 마스터 콘텐츠를 기반으로 한 다른 학생 콘텐츠가 중복으로 추가될 수 있음

### 개선 후

- `content_id`와 `master_content_id` 모두 확인
- 같은 마스터 콘텐츠를 기반으로 한 콘텐츠는 중복으로 추가되지 않음
- 학생 콘텐츠와 추천 콘텐츠 간의 중복도 방지

## 📋 사용 예시

### 시나리오 1: 마스터 콘텐츠를 기반으로 한 학생 콘텐츠 중복 방지

1. 학생이 마스터 교재 A를 복사하여 학생 교재 B 생성 (B의 `master_content_id` = A의 ID)
2. 학생 교재 B를 Step3Contents에서 추가
3. 학생 교재 C도 마스터 교재 A를 기반으로 생성 (C의 `master_content_id` = A의 ID)
4. 학생 교재 C를 Step3Contents에서 추가하려고 시도
5. **결과**: 이미 마스터 교재 A를 기반으로 한 학생 교재 B가 추가되어 있으므로 C는 중복으로 감지되어 추가되지 않음

### 시나리오 2: 학생 콘텐츠와 추천 콘텐츠 간 중복 방지

1. 학생이 마스터 교재 A를 복사하여 학생 교재 B 생성 (B의 `master_content_id` = A의 ID)
2. 학생 교재 B를 Step3Contents에서 추가
3. Step4RecommendedContents에서 마스터 교재 A가 추천됨
4. 마스터 교재 A를 추천 콘텐츠로 추가하려고 시도
5. **결과**: 이미 마스터 교재 A를 기반으로 한 학생 교재 B가 추가되어 있으므로 추천 콘텐츠 A는 중복으로 감지되어 추가되지 않음

## ✅ 검증 완료

- [x] `getStudentContentMasterIdsAction`을 사용하여 학생 콘텐츠의 `master_content_id` 조회
- [x] `content_id`로 직접 비교
- [x] `master_content_id`로 비교
- [x] 추천 콘텐츠와의 중복도 확인
- [x] 린터 오류 없음

## 📝 참고 사항

- 이 개선은 Step4RecommendedContents의 중복 방지 로직과 일관성을 유지합니다.
- `getStudentContentMasterIdsAction`은 배치 조회를 사용하여 성능을 최적화합니다.
- 에러 발생 시에도 기존 로직으로 fallback하여 기능이 중단되지 않습니다.
