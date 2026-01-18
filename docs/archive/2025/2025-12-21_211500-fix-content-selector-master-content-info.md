# ContentSelector 마스터 콘텐츠 정보 조회 수정

## 📋 작업 개요

`ContentSelector`에서 개정교육과정과 교과 정보가 표시되지 않던 문제를 해결했습니다. `master_content_id`가 있는 경우 마스터 콘텐츠에서 `curriculum_revision_id`와 `subject_id`를 가져오도록 수정했습니다.

## 🎯 문제점

- 학생 콘텐츠 테이블(`books`, `lectures`)에 `curriculum_revision_id`나 `subject_id`가 없는 경우가 많음
- `master_content_id`가 있는 경우 마스터 콘텐츠에서 정보를 가져와야 하는데, 기존 코드는 학생 콘텐츠에서만 조회
- 결과적으로 개정교육과정과 교과 정보가 표시되지 않음

## 🔧 변경 사항

### 1. `fetchStudentBooks` 함수 수정

**변경 내용:**
- `master_content_id`가 있는 경우 마스터 콘텐츠(`master_books`)에서 `curriculum_revision_id`, `subject_id` 조회
- 학생 콘텐츠에 정보가 없으면 마스터 콘텐츠에서 가져온 정보 사용
- 배치 조회로 성능 최적화

**로직:**
1. 학생 콘텐츠 조회
2. `master_content_id` 목록 추출
3. 마스터 콘텐츠에서 `curriculum_revision_id`, `subject_id` 배치 조회
4. 학생 콘텐츠 정보와 마스터 콘텐츠 정보 병합 (학생 콘텐츠 우선)
5. 최종 `subject_id`, `curriculum_revision_id` 목록으로 교과명, 개정교육과정명 조회

### 2. `fetchStudentLectures` 함수 수정

**변경 내용:**
- `master_lecture_id` 또는 `master_content_id`가 있는 경우 마스터 강의(`master_lectures`)에서 정보 조회
- 학생 강의에 정보가 없으면 마스터 강의에서 가져온 정보 사용
- 배치 조회로 성능 최적화

**로직:**
1. 학생 강의 조회 (`master_lecture_id` 포함)
2. `master_lecture_id` 또는 `master_content_id` 목록 추출
3. 마스터 강의에서 `curriculum_revision_id`, `subject_id` 배치 조회
4. 학생 강의 정보와 마스터 강의 정보 병합 (학생 강의 우선)
5. 최종 `subject_id`, `curriculum_revision_id` 목록으로 교과명, 개정교육과정명 조회

## 📊 데이터 흐름

### Before
```
학생 콘텐츠 조회
  ↓
subject_id, curriculum_revision_id 추출 (없으면 null)
  ↓
교과명, 개정교육과정명 조회 (null이면 표시 안 됨)
```

### After
```
학생 콘텐츠 조회
  ↓
master_content_id 추출
  ↓
마스터 콘텐츠에서 curriculum_revision_id, subject_id 조회
  ↓
학생 콘텐츠 정보와 마스터 콘텐츠 정보 병합
  ↓
최종 subject_id, curriculum_revision_id로 교과명, 개정교육과정명 조회
  ↓
표시
```

## ✅ 검증 사항

- [x] `master_content_id`가 있는 경우 마스터 콘텐츠에서 정보를 가져오는가?
- [x] 학생 콘텐츠에 정보가 있으면 우선 사용하는가?
- [x] 배치 조회로 성능 최적화가 되었는가?
- [x] 개정교육과정과 교과 정보가 제대로 표시되는가?

## 📝 수정된 파일

1. `lib/data/planContents.ts` - `fetchStudentBooks`, `fetchStudentLectures` 함수 수정

## 🚀 성능 최적화

- 마스터 콘텐츠 조회를 배치로 수행하여 N+1 쿼리 문제 해결
- `Set`을 사용하여 중복 ID 제거
- 병렬 조회로 성능 향상

