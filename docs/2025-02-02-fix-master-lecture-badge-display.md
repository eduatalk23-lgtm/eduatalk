# 마스터 강의 조회 및 뱃지 표시 수정

## 문제 상황

학생 콘텐츠 관리 페이지에서 서비스 마스터 강의를 조회할 때 특정 강의가 조회되지 않거나, 마스터에서 가져온 강의에 "마스터에서 가져옴" 뱃지가 표시되지 않는 문제가 발생했습니다.

### 증상

1. **강의 조회 문제**: 콘텐츠 관리 페이지에서 일부 마스터 강의가 조회되지 않음
2. **뱃지 표시 누락**: 플랜 생성 과정에서는 조회되지만, 콘텐츠 관리 페이지에서는 뱃지가 표시되지 않음
3. **회차 정보 불러오기 실패**: 마스터 서비스 강의의 상세정보(회차정보)가 있음에도 불러오지 못함

### 원인 분석

1. **`master_lecture_id` 미포함**: `ContentsList.tsx`에서 강의 조회 시 `master_content_id`만 select하고 있어, `master_lecture_id`가 있는 강의는 뱃지가 표시되지 않음
2. **뱃지 표시 로직 불완전**: `ContentCard.tsx`에서 `master_content_id`만 체크하여 강의의 `master_lecture_id`는 반영되지 않음
3. **중복 코드**: 여러 곳에서 `master_content_id`와 `master_lecture_id`를 개별적으로 체크하는 중복 로직 존재
4. **타입 정의 불일치**: 관련 타입에 `master_lecture_id` 필드가 누락됨

### 데이터베이스 확인 결과

- `lectures` 테이블에 `master_content_id`와 `master_lecture_id` 두 컬럼 모두 존재
- `student_lecture_episodes` 테이블에 `episode_title` 컬럼 존재 (회차 정보 복사는 정상 작동)

## 수정 내용

### 1. 공통 유틸리티 함수 생성

**파일**: `lib/utils/contentMaster.ts` (신규 생성)

마스터 콘텐츠 여부를 체크하는 공통 함수를 생성하여 중복 코드 제거:

```typescript
/**
 * 콘텐츠가 마스터에서 가져온 것인지 확인
 */
export function isFromMaster(item: {
  master_content_id?: string | null;
  master_lecture_id?: string | null;
}): boolean {
  return !!(item.master_content_id || item.master_lecture_id);
}
```

### 2. ContentsList.tsx 수정

**파일**: `app/(student)/contents/_components/ContentsList.tsx`

#### 변경 사항

1. **타입 정의 업데이트**: `ContentListItem` 타입에 `master_lecture_id` 필드 추가
2. **강의 조회 쿼리 수정**: `selectLectures` 함수에서 `master_lecture_id`도 함께 select하도록 수정

```typescript
// 변경 전
.select("id,title,...,master_content_id,...")

// 변경 후
.select("id,title,...,master_content_id,master_lecture_id,...")
```

### 3. ContentCard.tsx 수정

**파일**: `app/(student)/contents/_components/ContentCard.tsx`

#### 변경 사항

1. **타입 정의 업데이트**: `ContentCardProps`의 `item` 타입에 `master_lecture_id` 필드 추가
2. **뱃지 표시 로직 개선**: `isFromMaster` 유틸리티 함수 사용
3. **메모이제이션 개선**: memo 비교 함수에 `master_lecture_id` 추가

```typescript
// 변경 전
{item.master_content_id && (
  <span>📦 마스터에서 가져옴</span>
)}

// 변경 후
{isFromMaster(item) && (
  <span>📦 마스터에서 가져옴</span>
)}
```

### 4. 플랜 생성 관련 컴포넌트 수정

#### ContentItem.tsx

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentItem.tsx`

- 타입에 `master_lecture_id` 필드 추가
- `isFromMaster` 함수 사용

#### AddedContentList.tsx

**파일**: `app/(student)/plan/new-group/_components/_features/content-selection/components/AddedContentList.tsx`

- 타입에 `master_lecture_id` 필드 추가
- `isFromMaster` 함수 사용

#### Step6Simplified.tsx

**파일**: `app/(student)/plan/new-group/_components/Step6Simplified.tsx`

- 타입 정의에 `master_lecture_id` 필드 추가

### 5. 데이터 조회 로직 최적화

**파일**: `lib/plan/contentResolver.ts`

#### loadLectureMetadata 함수 개선

1. **select 절 수정**: `master_lecture_id`도 함께 select
2. **조회 로직 개선**: `master_content_id`와 `master_lecture_id` 모두로 조회 가능하도록 수정

```typescript
// 변경 전
.select("title, subject, subject_category, master_content_id")
.eq("master_content_id", actualMasterContentId)

// 변경 후
.select("title, subject, subject_category, master_content_id, master_lecture_id")
.or(`master_content_id.eq.${actualMasterContentId},master_lecture_id.eq.${actualMasterContentId}`)
```

### 6. 타입 정의 통합

**파일**: `app/types/content.ts`

- `ContentListItem` 타입에 `master_lecture_id` 필드 추가
- `Lecture` 타입에는 이미 `master_lecture_id` 필드가 존재함을 확인

## 최적화 사항

### 중복 코드 제거

1. **마스터 콘텐츠 체크 로직 통합**: `isFromMaster` 유틸리티 함수로 통일
2. **타입 정의 일관성**: 모든 관련 타입에 `master_lecture_id` 필드 추가
3. **쿼리 최적화**: 필요한 필드를 한 번에 select하여 불필요한 조회 방지

### 성능 개선

1. **병렬 조회**: `master_content_id`와 `master_lecture_id`를 동시에 select하여 네트워크 요청 최소화
2. **메모이제이션**: `ContentCard` 컴포넌트의 memo 비교 함수에 `master_lecture_id` 추가

## 수정된 파일 목록

1. `lib/utils/contentMaster.ts` (신규 생성)
2. `app/(student)/contents/_components/ContentsList.tsx`
3. `app/(student)/contents/_components/ContentCard.tsx`
4. `app/(student)/plan/new-group/_components/_features/content-selection/components/ContentItem.tsx`
5. `app/(student)/plan/new-group/_components/_features/content-selection/components/AddedContentList.tsx`
6. `app/(student)/plan/new-group/_components/Step6Simplified.tsx`
7. `lib/plan/contentResolver.ts`
8. `app/types/content.ts`

## 테스트 확인 사항

1. ✅ 학생 콘텐츠 관리 페이지에서 마스터 강의 조회 확인
2. ✅ 마스터에서 가져온 강의에 뱃지 표시 확인
3. ✅ 플랜 생성 과정에서 마스터 강의 뱃지 표시 확인
4. ✅ 회차 정보가 정상적으로 표시되는지 확인
5. ✅ 교재와 강의 모두에서 뱃지가 정상 표시되는지 확인

## 참고 사항

- 데이터베이스 스키마: `lectures` 테이블에 `master_content_id`와 `master_lecture_id` 모두 존재
- 회차 정보: `copyMasterLectureToStudent` 함수는 이미 올바르게 구현되어 있음
- 호환성: 기존 `master_content_id` 사용 코드와의 호환성 유지

## 관련 이슈

- 플랜 생성 과정에서는 조회가 되지만 콘텐츠 관리에서는 안 되는 문제 해결
- 마스터 서비스에서 가져온 강의의 회차 정보 불러오기 문제 해결

