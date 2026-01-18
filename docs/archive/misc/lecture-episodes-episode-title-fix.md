# lecture_episodes의 episode_title 필드명 불일치 수정

## 작업 일시
2024년 11월 30일

## 작업 개요
`lecture_episodes` 테이블의 실제 필드명은 `episode_title`이지만, 코드에서 `title`을 사용하여 관리자 페이지에서 episode 제목이 제대로 표시되지 않는 문제를 해결했습니다.

## 문제점
- 실제 DB 스키마: `lecture_episodes` 테이블에 `episode_title` 필드 존재 (character varying(200))
- 코드 불일치: `getMasterLectureById` 함수와 타입 정의에서 `title` 필드를 사용
- 관리자 페이지에서 master lecture의 episode 제목이 표시되지 않음

## 수정 내용

### 1. 데이터 조회 로직 수정
**파일**: `lib/data/contentMasters.ts`
- `getMasterLectureById` 함수에서 `lecture_episodes` 테이블 조회 시 명시적으로 `episode_title` 필드 포함
- `select("*")` 대신 필드를 명시하여 타입 안전성 확보

### 2. 타입 정의 수정
**파일**: `lib/types/plan.ts`
- `LectureEpisode` 타입의 `title` 필드를 `episode_title`로 변경
- `lecture_source_url`, `difficulty_level`, `difficulty_score`, `tags` 필드 추가

**파일**: `lib/types/lecture.ts`
- `LectureEpisode` 인터페이스의 `title` 필드를 `episode_title`로 변경
- `lecture_source_url` 필드 추가

### 3. 컴포넌트 수정

**파일**: `app/(student)/contents/_components/LectureEpisodesDisplay.tsx`
- `episode.title`을 `episode.episode_title`로 변경

**파일**: `app/(student)/contents/lectures/[id]/_components/LectureEpisodesSection.tsx`
- 모든 `title` 참조를 `episode_title`로 변경

**파일**: `app/(student)/contents/_components/LectureEpisodesManager.tsx`
- episode 매핑 시 `title` 필드를 `episode_title`로 변경
- 입력 필드에서 `episode_title` 사용

### 4. 페이지 수정

**파일**: `app/(student)/contents/lectures/[id]/page.tsx`
- `lectureEpisodes` 타입의 `title` 필드를 `episode_title`로 변경
- student_lecture_episodes 조회 시 `episode_title` 필드 사용
- 마스터 강의 episode 매핑 시 `episode_title` 사용

**파일**: `app/(student)/contents/lectures/[id]/_components/LectureDetailTabs.tsx`
- `initialEpisodes` 타입의 `title` 필드를 `episode_title`로 변경

### 5. Actions 확인

**파일**: `app/(student)/actions/contentActions.ts`
- 이미 `episode_title` 필드를 사용 중 (수정 불필요)

**파일**: `app/(student)/actions/contentDetailsActions.ts`
- 이미 `episode_title` 필드를 사용 중 (수정 불필요)

## DB 스키마 확인

```sql
CREATE TABLE public.lecture_episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lecture_id uuid NULL,
  episode_number integer NOT NULL,
  episode_title character varying(200) NULL,  -- 실제 필드명
  duration integer NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NULL DEFAULT now(),
  lecture_source_url text NULL,
  CONSTRAINT lecture_episodes_pkey PRIMARY KEY (id),
  CONSTRAINT lecture_episodes_lecture_id_fkey FOREIGN KEY (lecture_id) 
    REFERENCES master_lectures (id) ON DELETE CASCADE
);
```

## 영향 범위
- 관리자 페이지: master lecture 상세보기에서 episode 제목 정상 표시
- 학생 페이지: 학생 강의 상세보기에서 episode 제목 정상 표시
- episode 관리: episode 추가/수정 시 제목 필드 정상 작동
- 학습 계획: 강의 선택 시 episode 제목 정상 표시 (기존 코드에서 이미 episode_title 사용 중)

## 테스트 결과
- 린트 에러 없음
- 타입 체크 통과
- 모든 파일에서 `episode_title` 필드로 통일

## 주의사항
- `student_lecture_episodes` 테이블도 동일하게 `episode_title` 필드를 사용해야 함
- 향후 새로운 episode 관련 기능 추가 시 `episode_title` 필드명 사용 필수

