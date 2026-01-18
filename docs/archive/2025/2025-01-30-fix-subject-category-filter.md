# 교과 카테고리 필터링 누락 문제 수정

## 📋 개요

AI 추천 콘텐츠 조회 시 여러 교과를 요청했지만 1개만 반환되는 문제를 수정했습니다. `searchMasterBooks`와 `searchMasterLectures` 함수에서 `subject_category` 필터링이 누락되어 있었습니다.

## 🔍 문제점

### 기존 문제
- **여러 교과 요청**: 사회, 과학, 영어, 수학, 국어 각 1개씩 요청
- **조회는 성공**: 각 교과에 대해 마스터 콘텐츠 조회 성공 (5개씩)
- **필터링 실패**: `subject_category` 필터링이 없어서 모든 교과에 동일한 콘텐츠 반환
- **최종 결과**: 수학 1개만 반환됨

### 원인
- `MasterBookFilters` 타입에 `subject_category` 필드 없음
- `MasterLectureFilters`에 `subject_category` 필드가 있지만 `@deprecated 사용 안 함` 주석
- `searchMasterBooks`와 `searchMasterLectures` 함수에서 `subject_category` 필터링 로직 없음
- `masterContentRecommendation.ts`에서 `subject_category`를 전달하지만 실제로 필터링되지 않음

## ✅ 수정 내용

### 1. `MasterBookFilters` 타입에 `subject_category` 추가

#### 수정 전
```typescript
export type MasterBookFilters = {
  subject_id?: string; // 과목 ID로 필터링
  semester?: string;
  revision?: string;
  search?: string; // 제목 검색
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};
```

#### 수정 후
```typescript
export type MasterBookFilters = {
  subject_id?: string; // 과목 ID로 필터링
  subject_category?: string; // 교과 카테고리로 필터링 (예: "국어", "수학", "영어")
  semester?: string;
  revision?: string;
  search?: string; // 제목 검색
  tenantId?: string | null;
  limit?: number;
  offset?: number;
};
```

### 2. `MasterLectureFilters` 타입 수정

#### 수정 전
```typescript
export type MasterLectureFilters = {
  subject_id?: string; // 과목 ID로 필터링
  semester?: string;
  revision?: string;
  search?: string; // 제목 검색
  tenantId?: string | null;
  limit?: number;
  offset?: number;
  
  // 레거시 필드 (호환성)
  subject?: string; // @deprecated subject_id 사용 권장
  subject_category?: string; // @deprecated 사용 안 함
};
```

#### 수정 후
```typescript
export type MasterLectureFilters = {
  subject_id?: string; // 과목 ID로 필터링
  subject_category?: string; // 교과 카테고리로 필터링 (예: "국어", "수학", "영어")
  semester?: string;
  revision?: string;
  search?: string; // 제목 검색
  tenantId?: string | null;
  limit?: number;
  offset?: number;
  
  // 레거시 필드 (호환성)
  subject?: string; // @deprecated subject_id 사용 권장
};
```

### 3. `searchMasterBooks` 함수에 필터링 로직 추가

#### 수정 전
```typescript
// 필터 적용
if (filters.subject_id) {
  query = query.eq("subject_id", filters.subject_id);
}
if (filters.semester) {
  query = query.eq("semester", filters.semester);
}
// ...
```

#### 수정 후
```typescript
// 필터 적용
if (filters.subject_id) {
  query = query.eq("subject_id", filters.subject_id);
}
if (filters.subject_category) {
  query = query.eq("subject_category", filters.subject_category);
}
if (filters.semester) {
  query = query.eq("semester", filters.semester);
}
// ...
```

### 4. `searchMasterLectures` 함수에 필터링 로직 추가

#### 수정 전
```typescript
// 필터 적용
if (filters.subject_id) {
  query = query.eq("subject_id", filters.subject_id);
}
if (filters.semester) {
  query = query.eq("semester", filters.semester);
}
// ...
```

#### 수정 후
```typescript
// 필터 적용
if (filters.subject_id) {
  query = query.eq("subject_id", filters.subject_id);
}
if (filters.subject_category) {
  query = query.eq("subject_category", filters.subject_category);
}
if (filters.semester) {
  query = query.eq("semester", filters.semester);
}
// ...
```

## 🎯 수정 사항 상세

### 1. 타입 정의 수정
- `MasterBookFilters`에 `subject_category` 필드 추가
- `MasterLectureFilters`에서 `subject_category`의 deprecated 주석 제거

### 2. 필터링 로직 추가
- `searchMasterBooks`에서 `subject_category` 필터링 추가
- `searchMasterLectures`에서 `subject_category` 필터링 추가
- `subject_id` 필터와 동일한 방식으로 적용

### 3. 일관성 유지
- 두 함수 모두 동일한 방식으로 필터링
- `subject_id`와 `subject_category` 모두 지원

## 📝 테스트 시나리오

### 시나리오 1: 여러 교과 요청
- **입력**: 
  - 교과: 국어, 수학, 영어, 과학, 사회 (각 1개씩)
- **기대 결과**: 
  - 각 교과에 맞는 콘텐츠 반환
  - 총 5개 이상의 추천 콘텐츠 반환

### 시나리오 2: 특정 교과만 요청
- **입력**: 
  - 교과: 수학 (2개)
- **기대 결과**: 
  - 수학 교과 콘텐츠만 반환
  - 총 2개 반환

### 시나리오 3: 교과별 개수 다르게 요청
- **입력**: 
  - 국어: 1개, 수학: 2개, 영어: 1개
- **기대 결과**: 
  - 각 교과에 맞는 개수만큼 반환
  - 총 4개 반환

## 🚀 배포 전 확인사항

1. [x] `subject_category` 필터링이 정상적으로 작동하는지 확인
2. [x] 여러 교과를 요청했을 때 각 교과에 맞는 콘텐츠가 반환되는지 확인
3. [x] 요청한 개수만큼 정확히 반환되는지 확인
4. [x] 기존 `subject_id` 필터링과 충돌하지 않는지 확인

---

**수정일**: 2025-01-30  
**수정 파일**: 
- `lib/data/contentMasters.ts`

