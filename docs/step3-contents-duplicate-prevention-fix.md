# Step3Contents 중복 방지 로직 수정

## 🔍 문제 상황

Step3Contents에서 추천 콘텐츠와의 중복을 체크하는 로직이 불필요하게 추가되었습니다.

### 원인

- Step 3은 학생 콘텐츠만 선택하는 단계
- Step 4는 추천 콘텐츠를 선택하는 단계
- Step 3에서 추천 콘텐츠와의 중복을 체크할 필요가 없음

## ✅ 수정 내용

### 파일: `app/(student)/plan/new-group/_components/Step3Contents.tsx`

#### `addSelectedContents` 함수 수정

**변경 전**:
- 학생 콘텐츠와 추천 콘텐츠 모두와의 중복을 체크
- 추천 콘텐츠의 content_id와 비교
- 추천 콘텐츠의 master_content_id와 비교

**변경 후**:
- 학생 콘텐츠와의 중복만 체크
- 추천 콘텐츠 관련 중복 체크 제거

```typescript
// 중복 체크 (학생 콘텐츠만 확인 - 추천 콘텐츠는 Step 4에서 처리)
// 1. content_id로 직접 비교
const isDuplicateByContentId = data.student_contents.some(
  (c) => c.content_type === contentType && c.content_id === contentId
);

// 2. master_content_id로 비교 (같은 마스터 콘텐츠를 기반으로 한 학생 콘텐츠 중복 방지)
const isDuplicateByMasterId =
  content?.master_content_id &&
  studentMasterIds.has(content.master_content_id);

if (isDuplicateByContentId || isDuplicateByMasterId) {
  continue; // 이미 추가된 콘텐츠는 스킵
}
```

## 📋 각 Step의 역할

### Step 3: 학생 콘텐츠 선택
- 학생이 직접 등록한 교재/강의 선택
- 같은 마스터 콘텐츠를 기반으로 한 학생 콘텐츠 간 중복 방지
- 추천 콘텐츠와의 중복 체크 불필요 (Step 4에서 처리)

### Step 4: 추천 콘텐츠 선택
- 시스템이 추천한 마스터 콘텐츠 선택
- 학생 콘텐츠의 master_content_id와 중복 방지
- 이미 추가된 추천 콘텐츠와 중복 방지

## ✅ 검증 완료

- [x] Step 3에서 추천 콘텐츠 관련 중복 체크 제거
- [x] 학생 콘텐츠 간 중복 방지 로직 유지
- [x] 마스터 콘텐츠 ID 기반 중복 방지 유지
- [x] 린터 오류 없음

## 📝 참고 사항

- Step 3과 Step 4의 역할이 명확히 분리됨
- 각 Step에서 필요한 중복 방지만 수행
- Step 4의 중복 방지 로직은 별도로 점검 필요

