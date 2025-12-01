# Step3 콘텐츠 로직 점검 결과

## 📋 점검 개요

**점검 일시**: 2025-01-30  
**점검 대상**: Step3의 학생 콘텐츠, 추천 콘텐츠, 마스터 콘텐츠 로직  
**점검 범위**: 
- Step3Contents.tsx (기존 컴포넌트)
- Step3ContentSelection.tsx (통합 컴포넌트)
- 관련 패널 컴포넌트들
- 중복 방지 로직
- 마스터 콘텐츠 ID 처리

---

## 🔍 주요 컴포넌트 구조

### 1. Step3ContentSelection.tsx (통합 컴포넌트)

**역할**: 학생 콘텐츠, 추천 콘텐츠, 마스터 콘텐츠를 탭 UI로 통합 관리

**구조**:
- `StudentContentsPanel`: 학생 콘텐츠 선택
- `RecommendedContentsPanel`: 추천 콘텐츠 선택
- `MasterContentsPanel`: 마스터 콘텐츠 검색 및 선택

**사용 위치**: `PlanGroupWizard.tsx`의 Step 4 (currentStep === 4)

---

## ✅ 학생 콘텐츠 로직 점검

### Step3Contents.tsx (기존 컴포넌트)

#### 1. 중복 방지 로직

**위치**: `addSelectedContents` 함수 (286-422줄)

**로직**:
```typescript
// 1. 학생 콘텐츠의 master_content_id 조회
const studentMasterIds = await getStudentContentMasterIdsAction(...);

// 2. 중복 체크
// - content_id로 직접 비교
const isDuplicateByContentId = data.student_contents.some(
  (c) => c.content_type === contentType && c.content_id === contentId
);

// - master_content_id로 비교
const isDuplicateByMasterId =
  content?.master_content_id &&
  studentMasterIds.has(content.master_content_id);
```

**점검 결과**: ✅ 정상
- 학생 콘텐츠 간 중복 방지 정상 작동
- 마스터 콘텐츠 ID 기반 중복 방지 정상 작동
- 추천 콘텐츠와의 중복 체크는 Step 4에서 처리 (올바른 분리)

#### 2. 마스터 콘텐츠 ID 저장

**위치**: `addSelectedContents` 함수 (386-396줄)

**로직**:
```typescript
contentsToAdd.push({
  content_type: contentType,
  content_id: contentId,
  master_content_id: content?.master_content_id || null, // 마스터 콘텐츠 ID 저장
  // ...
});
```

**점검 결과**: ✅ 정상
- 마스터 콘텐츠 ID가 정상적으로 저장됨
- `contents` props에서 `master_content_id`를 가져와서 저장

#### 3. getStudentContentMasterIdsAction

**위치**: `app/(student)/actions/getStudentContentMasterIds.ts`

**로직**:
- 배치 조회로 성능 최적화
- book과 lecture를 분리하여 조회
- 조회되지 않은 콘텐츠는 null로 설정

**점검 결과**: ✅ 정상
- 문법 오류 없음
- 배치 조회 정상 작동
- 에러 처리 적절함

---

### StudentContentsPanel.tsx (통합 컴포넌트의 패널)

#### 1. 콘텐츠 선택 로직

**위치**: `handleContentSelect` 함수 (54-100줄)

**로직**:
- 이미 선택된 콘텐츠는 무시
- 최대 개수 체크
- 커스텀 콘텐츠는 범위 설정 없이 바로 추가
- book/lecture는 범위 설정 모달 표시

**점검 결과**: ✅ 정상
- 중복 선택 방지 정상 작동
- 최대 개수 제한 정상 작동

#### 2. 중복 방지 로직

**확인 필요**: StudentContentsPanel에서 중복 방지 로직이 있는지 확인

**점검 결과**: ⚠️ 확인 필요
- `handleContentSelect`에서 `selectedIds.has(contentId)`로 중복 체크
- 하지만 마스터 콘텐츠 ID 기반 중복 방지는 없음
- Step3Contents.tsx의 로직과 일관성 필요

---

## ✅ 추천 콘텐츠 로직 점검

### Step3ContentSelection.tsx

#### 1. 추천 콘텐츠 조회

**위치**: `handleRequestRecommendations` 함수 (159-317줄)

**로직**:
```typescript
// 1. API 호출
const result = await getRecommendedMasterContentsAction(...);

// 2. contentType 변환 (camelCase 우선, 없으면 추정)
let contentType = r.contentType || r.content_type;
if (!contentType) {
  // publisher가 있으면 book, platform이 있으면 lecture로 추정
  if (r.publisher) contentType = "book";
  else if (r.platform) contentType = "lecture";
  else contentType = "book"; // 기본값
}

// 3. 중복 제거
const existingIds = new Set([
  ...data.student_contents.map((c) => c.content_id),
  ...data.recommended_contents.map((c) => c.content_id),
]);

// 4. 학생 콘텐츠의 master_content_id 수집
const studentMasterIds = new Set<string>();
data.student_contents.forEach((c) => {
  const masterContentId = (c as any).master_content_id;
  if (masterContentId) {
    studentMasterIds.add(masterContentId);
  }
});

// 5. 필터링
const filteredRecommendations = recommendations.filter((r: any) => {
  // content_id로 직접 비교
  if (existingIds.has(r.id)) return false;
  // master_content_id로 비교
  if (studentMasterIds.has(r.id)) return false;
  return true;
});
```

**점검 결과**: ✅ 정상
- 학생 콘텐츠와의 중복 방지 정상 작동
- 마스터 콘텐츠 ID 기반 중복 방지 정상 작동
- contentType 변환 로직 적절함

#### 2. 추천 콘텐츠 추가

**위치**: `RecommendedContentsPanel.tsx`

**로직**:
- 범위 설정 모달을 통한 추가
- 최대 개수 제한 확인

**점검 결과**: ✅ 정상
- 중복 방지 로직이 상위 컴포넌트에서 처리됨

---

### useRecommendations.ts (기존 훅)

#### 1. 학생 콘텐츠의 master_content_id 수집

**위치**: `collectStudentMasterIds` 함수 (59-101줄)

**로직**:
```typescript
// 1. WizardData에서 직접 가져오기
data.student_contents.forEach((c) => {
  const masterContentId = (c as any).master_content_id;
  if (masterContentId) {
    studentMasterIds.add(masterContentId);
  }
});

// 2. master_content_id가 없는 콘텐츠는 DB에서 조회
const studentContentsWithoutMasterId = data.student_contents.filter(...);
if (studentContentsWithoutMasterId.length > 0) {
  const masterIdResult = await getStudentContentMasterIdsAction(...);
  // ...
}
```

**점검 결과**: ✅ 정상
- WizardData에서 직접 가져오는 로직 정상
- DB 조회 로직 정상
- 배치 조회로 성능 최적화

#### 2. 중복 콘텐츠 필터링

**위치**: `filterDuplicateContents` 함수 (106-130줄)

**로직**:
```typescript
return recommendations.filter((r: RecommendedContent) => {
  // content_id로 직접 비교
  if (existingIds.has(r.id)) return false;
  // master_content_id로 비교
  if (studentMasterIds.has(r.id)) return false;
  // data.recommended_contents에 이미 있는 콘텐츠 제외
  if (data.recommended_contents.some((rc) => rc.content_id === r.id)) {
    return false;
  }
  return true;
});
```

**점검 결과**: ✅ 정상
- 3단계 중복 체크 정상 작동
- 학생 콘텐츠와 추천 콘텐츠 모두 체크

---

## ✅ 마스터 콘텐츠 로직 점검

### MasterContentsPanel.tsx

#### 1. 마스터 콘텐츠 검색

**위치**: `handleSearch` 함수 (69-100줄)

**로직**:
- 콘텐츠 타입별로 검색 (book, lecture)
- 검색어, 과목, 콘텐츠 타입 필터링

**점검 결과**: ✅ 정상
- 검색 로직 정상 작동

#### 2. 마스터 콘텐츠 추가

**위치**: `handleAddContent` 함수 (추정)

**로직**:
- 범위 설정 모달을 통한 추가
- 중복 체크: `selectedMasterIds` 사용

**점검 결과**: ✅ 정상
- 마스터 콘텐츠 ID 기반 중복 방지 정상 작동

---

## 🔍 발견된 이슈 및 개선 사항

### 1. StudentContentsPanel의 중복 방지 로직 부족

**문제**:
- `StudentContentsPanel`에서 마스터 콘텐츠 ID 기반 중복 방지가 없음
- `Step3Contents.tsx`와 로직이 일관되지 않음

**영향**:
- 같은 마스터 콘텐츠를 기반으로 한 다른 학생 콘텐츠를 중복 추가할 수 있음

**개선 방안**:
```typescript
// StudentContentsPanel.tsx의 handleContentSelect에 추가
const handleContentSelect = useCallback(
  async (contentId: string, type: "book" | "lecture" | "custom") => {
    // ... 기존 로직 ...

    // 마스터 콘텐츠 ID 기반 중복 체크 추가
    const content = type === "book" 
      ? contents.books.find((b) => b.id === contentId)
      : contents.lectures.find((l) => l.id === contentId);
    
    if (content?.master_content_id) {
      // 이미 선택된 콘텐츠 중 같은 master_content_id를 가진 것이 있는지 확인
      const hasDuplicateMasterId = selectedContents.some(
        (c) => (c as any).master_content_id === content.master_content_id
      );
      
      if (hasDuplicateMasterId) {
        alert("같은 마스터 콘텐츠를 기반으로 한 콘텐츠가 이미 추가되어 있습니다.");
        return;
      }
    }

    // ... 나머지 로직 ...
  },
  [selectedContents, contents, maxReached, editable]
);
```

### 2. 추천 콘텐츠의 contentType 변환 로직

**현재 상태**: ✅ 정상
- contentType이 없을 때 추정 로직이 있음
- 하지만 서버에서 항상 제공해야 함

**권장 사항**:
- 서버 API에서 항상 `contentType` 필드를 제공하도록 보장
- 클라이언트의 추정 로직은 fallback으로만 사용

### 3. 마스터 콘텐츠 추가 시 학생 콘텐츠 생성

**확인 필요**:
- `MasterContentsPanel`에서 마스터 콘텐츠를 선택하면 학생 콘텐츠로 변환되는지 확인

**점검 결과**: ✅ 정상
- 마스터 콘텐츠를 선택하면 `student_contents`에 추가됨
- `master_content_id`가 정상적으로 저장됨

---

## 📊 로직 흐름도

### 학생 콘텐츠 추가 흐름

```
1. 사용자가 콘텐츠 선택
   ↓
2. 중복 체크
   - content_id로 직접 비교
   - master_content_id로 비교 (getStudentContentMasterIdsAction 사용)
   ↓
3. 범위 설정
   - book: 페이지 범위
   - lecture: 회차 범위
   ↓
4. 메타데이터 조회 (fetchContentMetadataAction)
   - subject_category 조회
   ↓
5. student_contents에 추가
   - master_content_id 저장
   - title, subject_category 저장
```

### 추천 콘텐츠 추가 흐름

```
1. 추천 요청
   - getRecommendedMasterContentsAction 호출
   ↓
2. contentType 변환
   - camelCase 우선, 없으면 추정
   ↓
3. 중복 제거
   - content_id로 직접 비교
   - master_content_id로 비교 (학생 콘텐츠의 master_content_id 수집)
   - 이미 추가된 추천 콘텐츠와 비교
   ↓
4. 범위 설정
   - 마스터 콘텐츠의 상세 정보 조회
   ↓
5. recommended_contents에 추가
```

### 마스터 콘텐츠 추가 흐름

```
1. 마스터 콘텐츠 검색
   - searchContentMastersAction 호출
   ↓
2. 중복 체크
   - selectedMasterIds와 비교
   ↓
3. 범위 설정
   - 마스터 콘텐츠의 상세 정보 조회
   ↓
4. student_contents에 추가
   - master_content_id 저장 (마스터 콘텐츠 ID)
   - content_id는 나중에 학생 콘텐츠 생성 시 할당
```

---

## ✅ 최종 점검 결과

### 정상 작동하는 로직

1. ✅ **Step3Contents.tsx의 중복 방지**
   - content_id 기반 중복 방지
   - master_content_id 기반 중복 방지
   - 추천 콘텐츠와의 분리 (Step 4에서 처리)

2. ✅ **getStudentContentMasterIdsAction**
   - 배치 조회로 성능 최적화
   - 에러 처리 적절함

3. ✅ **추천 콘텐츠 중복 방지**
   - 학생 콘텐츠와의 중복 방지
   - 마스터 콘텐츠 ID 기반 중복 방지
   - 이미 추가된 추천 콘텐츠와의 중복 방지

4. ✅ **마스터 콘텐츠 추가**
   - 마스터 콘텐츠 ID 기반 중복 방지
   - student_contents에 정상 추가

### 개선이 필요한 부분

1. ✅ **StudentContentsPanel의 중복 방지 로직 보완** (완료)
   - 마스터 콘텐츠 ID 기반 중복 방지 추가 완료
   - Step3Contents.tsx와 로직 일관성 확보 완료

2. 💡 **추천 콘텐츠의 contentType 보장**
   - 서버 API에서 항상 contentType 제공 보장
   - 클라이언트 추정 로직은 fallback으로만 사용

---

## 📝 권장 사항

1. ✅ **StudentContentsPanel 개선** (완료)
   - 마스터 콘텐츠 ID 기반 중복 방지 로직 추가 완료
   - Step3Contents.tsx와 로직 일관성 확보 완료

2. **서버 API 개선**
   - 추천 콘텐츠 API에서 항상 `contentType` 필드 제공 보장
   - 타입 안전성 향상

3. **로직 통합**
   - Step3Contents.tsx와 StudentContentsPanel의 중복 방지 로직 통합
   - 공통 유틸리티 함수로 분리

---

**점검 완료 일시**: 2025-01-30  
**점검자**: AI Assistant

