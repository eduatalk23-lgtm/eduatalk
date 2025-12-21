# ContentSelector 메타데이터를 마스터 콘텐츠에서 조회하도록 수정

## 문제 상황

ContentSelector에서 강의 콘텐츠의 상세 정보가 선택된 콘텐츠(ContentCard)처럼 표시되지 않았습니다.

**현상:**
- ContentSelector: 🎧 강의, 고전시가 (기본 정보만)
- ContentCard: 🎧 강의, 교과 그룹명, 고전시가, 학기, 개정교육과정, 난이도, 플랫폼 (상세 정보)

## 원인 분석

1. **ContentCard**: `fetchContentMetadataAction`을 통해 마스터 콘텐츠에서 메타데이터를 조회
2. **ContentSelector**: `fetchStudentLectures`를 통해 학생 콘텐츠 테이블에서 직접 조회
   - 학생 콘텐츠 테이블에는 `semester, revision, difficulty_level, platform` 필드가 있지만 값이 없을 수 있음
   - 마스터 콘텐츠에서 가져와야 하는데 조회하지 않음

## 수정 내용

### 1. fetchStudentBooks 수정

마스터 교재에서 메타데이터를 함께 조회:

```typescript
// 마스터 콘텐츠에서 메타데이터 조회 (ContentCard와 동일한 정보)
const masterContentsMap = new Map<string, { 
  curriculum_revision_id: string | null; 
  subject_id: string | null;
  subject: string | null;
  semester: string | null;
  revision: string | null;
  difficulty_level: string | null;
  publisher: string | null;
}>();

// 조회 시 메타데이터 필드 포함
.select("id, curriculum_revision_id, subject_id, subject, semester, revision, difficulty_level, publisher")

// 반환 시 학생 콘텐츠에 값이 없으면 마스터 콘텐츠에서 가져옴
semester: (book as any).semester || masterInfo?.semester || null,
revision: (book as any).revision || masterInfo?.revision || null,
difficulty_level: (book as any).difficulty_level || masterInfo?.difficulty_level || null,
publisher: (book as any).publisher || masterInfo?.publisher || null,
```

### 2. fetchStudentLectures 수정

마스터 강의에서 메타데이터를 함께 조회:

```typescript
// 마스터 강의에서 메타데이터 조회 (ContentCard와 동일한 정보)
const masterLecturesMap = new Map<string, { 
  curriculum_revision_id: string | null; 
  subject_id: string | null;
  subject: string | null;
  semester: string | null;
  revision: string | null;
  difficulty_level: string | null;
  platform: string | null;
}>();

// 조회 시 메타데이터 필드 포함
.select("id, curriculum_revision_id, subject_id, subject, semester, revision, difficulty_level, platform")

// 반환 시 학생 콘텐츠에 값이 없으면 마스터 콘텐츠에서 가져옴
semester: (lecture as any).semester || masterInfo?.semester || null,
revision: (lecture as any).revision || masterInfo?.revision || null,
difficulty_level: (lecture as any).difficulty_level || masterInfo?.difficulty_level || null,
platform: (lecture as any).platform || masterInfo?.platform || null,
```

## 수정된 로직

### 데이터 우선순위

1. **학생 콘텐츠 테이블의 값** (있는 경우)
2. **마스터 콘텐츠의 값** (학생 콘텐츠에 없으면)

이렇게 하면:
- 학생이 커스텀한 값이 있으면 그것을 사용
- 없으면 마스터 콘텐츠의 기본값 사용

### 조회되는 메타데이터

**교재:**
- subject (과목)
- semester (학기)
- revision (개정교육과정)
- difficulty_level (난이도)
- publisher (출판사)

**강의:**
- subject (과목)
- semester (학기)
- revision (개정교육과정)
- difficulty_level (난이도)
- platform (플랫폼)

## 수정된 파일

- `lib/data/planContents.ts`
  - `fetchStudentBooks`: 마스터 교재 메타데이터 조회 추가
  - `fetchStudentLectures`: 마스터 강의 메타데이터 조회 추가

## 결과

이제 ContentSelector에서도 ContentCard와 동일한 상세 정보를 표시합니다:

1. 콘텐츠 타입 배지
2. 교과 그룹명
3. 세부 과목
4. 학기
5. 개정교육과정
6. 난이도
7. 출판사 (교재) / 플랫폼 (강의)

## 테스트 방법

1. ContentSelector에서 강의 콘텐츠 확인
   - 학기, 개정교육과정, 난이도, 플랫폼이 표시되는지 확인

2. ContentSelector에서 교재 콘텐츠 확인
   - 학기, 개정교육과정, 난이도, 출판사가 표시되는지 확인

3. 선택된 콘텐츠와 비교
   - ContentSelector와 ContentCard에서 동일한 정보가 표시되는지 확인

