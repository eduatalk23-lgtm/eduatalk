# lecture_episodes 조회 쿼리 수정

**작업일**: 2024-11-30  
**커밋**: 967e190

## 문제 상황

`lib/data/contentMasters.ts`의 `getMasterLectureById` 함수에서 `lecture_episodes` 테이블 조회 시 스키마에 존재하지 않는 컬럼들을 SELECT하려고 시도하여 오류가 발생했습니다.

### 존재하지 않는 컬럼
- `difficulty_level`
- `difficulty_score`
- `tags`

이 컬럼들은 `master_lectures` 테이블에만 존재하며, 각 회차(episode)별로는 관리하지 않습니다.

## 수정 내용

### 파일: `lib/data/contentMasters.ts` (410줄)

```typescript
// 수정 전
.select("id, lecture_id, episode_number, title, duration, display_order, created_at, difficulty_level, difficulty_score, tags")

// 수정 후
.select("id, lecture_id, episode_number, episode_title, duration, display_order, created_at, lecture_source_url")
```

### 변경 사항
1. 존재하지 않는 컬럼 제거: `difficulty_level`, `difficulty_score`, `tags`
2. 스키마에 맞게 컬럼명 수정: `title` → `episode_title`
3. 추가 컬럼 포함: `lecture_source_url` (스키마에 존재)

## 현재 lecture_episodes 테이블 스키마

```sql
CREATE TABLE public.lecture_episodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  lecture_id uuid,
  episode_number integer NOT NULL,
  episode_title character varying,
  duration integer,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  lecture_source_url text,
  CONSTRAINT lecture_episodes_pkey PRIMARY KEY (id),
  CONSTRAINT lecture_episodes_lecture_id_fkey FOREIGN KEY (lecture_id) 
    REFERENCES public.master_lectures(id)
);
```

## 영향 범위

- 관리자 페이지의 강의 상세 조회 시 회차 목록이 정상적으로 표시됩니다
- `getMasterLectureById` 함수가 오류 없이 동작합니다
- 난이도 정보는 `master_lectures` 테이블의 전체 강의 난이도(`difficulty_level`, `overall_difficulty`)를 사용합니다

## 관련 파일

- `lib/data/contentMasters.ts` - 데이터 조회 로직
- `lib/types/plan.ts` - LectureEpisode 타입 정의

## 추후 고려사항

회차별 난이도/태그 관리가 필요한 경우:
1. `lecture_episodes` 테이블에 해당 컬럼 추가 마이그레이션 실행
2. 타입 정의 업데이트
3. UI 컴포넌트에서 회차별 난이도 표시 기능 추가

