# 강의 스키마 빠른 참조 가이드

> **최종 업데이트**: 2024년 11월 29일  
> **관련 문서**: [lecture-schema-refactoring.md](./lecture-schema-refactoring.md)

---

## 🚨 중요! 즉시 수정 필요한 코드

### 1. 컬럼명 변경

```typescript
// ❌ 오류 발생
lecture.master_content_id
lecture.platform
episode.episode_title

// ✅ 올바른 사용
lecture.master_lecture_id
lecture.platform_name  // 또는 lecture.platform_id (권장)
episode.title
```

### 2. 삭제된 컬럼

```typescript
// ❌ 오류 발생 (lectures.duration 삭제됨)
const duration = lecture.duration;

// ✅ 올바른 사용
const { data } = await supabase
  .from('lectures')
  .select('*, master_lecture:master_lectures(total_duration)')
  .eq('id', lectureId)
  .single();
const duration = data.master_lecture?.total_duration;
```

---

## 📋 테이블별 주요 변경 사항

### master_lectures

| 이전 | 이후 | 비고 |
|------|------|------|
| `platform` | `platform_name` | 컬럼명 변경 |
| - | `platform_id` | **신규** (FK to platforms) |
| - | `curriculum_revision_id` | **신규** (FK to curriculum_revisions) |
| - | `subject_id` | **신규** (FK to subjects) |
| - | `grade_min`, `grade_max`, `school_type` | **신규** |
| - | `subtitle`, `series_name`, `instructor` | **신규** |
| - | `description`, `toc`, `tags`, `target_exam_type` | **신규** |
| - | `source`, `source_product_code`, `source_url`, `cover_image_url` | **신규** |

### lecture_episodes

| 이전 | 이후 | 비고 |
|------|------|------|
| `episode_title` | `title` | 컬럼명 변경 |
| - | `difficulty_level`, `difficulty_score`, `tags` | **신규** |
| FK 제약 | ON DELETE CASCADE | 변경 |

### lectures

| 이전 | 이후 | 비고 |
|------|------|------|
| `master_content_id` | `master_lecture_id` | 컬럼명 변경 |
| `duration` | (삭제됨) | master_lectures.total_duration 사용 |
| - | `nickname` | **신규** |
| - | `completed_episodes`, `progress` | **신규** |

### student_lecture_episodes

| 이전 | 이후 | 비고 |
|------|------|------|
| `episode_title` | `title` | 컬럼명 변경 |
| - | `master_episode_id` | **신규** (FK to lecture_episodes) |
| - | `is_completed`, `watched_seconds`, `last_watched_at`, `note` | **신규** |
| FK 제약 | ON DELETE CASCADE | 변경 |

---

## 🔧 TypeScript 타입 업데이트

### master_lectures

```typescript
interface MasterLecture {
  id: string;
  tenant_id?: string;
  is_active: boolean;

  // 교육과정/교과
  curriculum_revision_id?: string;
  subject_id?: string;
  grade_min?: number;  // 1-3
  grade_max?: number;  // 1-3
  school_type?: 'MIDDLE' | 'HIGH' | 'OTHER';

  // 기본 정보
  title: string;
  subtitle?: string;
  series_name?: string;
  instructor?: string;
  platform_id?: string;        // 우선 사용
  platform_name?: string;       // 레거시
  linked_book_id?: string;

  // 회차/시간/난이도
  total_episodes: number;
  total_duration?: number;
  difficulty_level?: string;
  overall_difficulty?: number;
  target_exam_type?: string[];

  // 설명/태그
  description?: string;
  toc?: string;
  tags?: string[];

  // 외부 소스
  source?: string;
  source_product_code?: string;
  source_url?: string;
  cover_image_url?: string;

  // 파일/AI
  video_url?: string;
  transcript?: string;
  episode_analysis?: any;

  // 레거시 (호환성)
  revision?: string;
  content_category?: string;
  semester?: string;
  subject?: string;
  subject_category?: string;

  notes?: string;
  created_at: string;
  updated_at: string;
}
```

### lecture_episodes

```typescript
interface LectureEpisode {
  id: string;
  lecture_id: string;
  episode_number: number;
  title?: string;               // 변경: episode_title → title
  duration?: number;
  display_order: number;
  difficulty_level?: string;    // 신규
  difficulty_score?: number;    // 신규
  tags?: string[];              // 신규
  created_at: string;
}
```

### lectures

```typescript
interface Lecture {
  id: string;
  tenant_id: string;
  student_id?: string;
  master_lecture_id?: string;   // 변경: master_content_id → master_lecture_id
  
  // 인스턴스 정보
  title?: string;
  nickname?: string;            // 신규
  notes?: string;
  
  // 진도
  total_episodes?: number;
  completed_episodes?: number;  // 신규
  progress?: number;            // 신규 (0-100)
  
  linked_book_id?: string;
  
  // 레거시 (호환성, 향후 제거 예정)
  platform?: string;
  subject?: string;
  subject_category?: string;
  revision?: string;
  semester?: string;
  chapter_info?: any;
  difficulty_level?: string;
  latest_version?: string;
  
  created_at: string;
  updated_at: string;
}
```

### student_lecture_episodes

```typescript
interface StudentLectureEpisode {
  id: string;
  lecture_id: string;
  master_episode_id?: string;   // 신규
  episode_number: number;
  title?: string;               // 변경: episode_title → title
  duration?: number;
  display_order: number;
  
  // 진도 추적
  is_completed: boolean;        // 신규
  watched_seconds: number;      // 신규
  last_watched_at?: string;     // 신규
  note?: string;                // 신규
  
  created_at: string;
}
```

---

## 💡 자주 사용하는 쿼리 패턴

### 1. 강의 목록 조회 (교육과정 필터)

```typescript
const { data: lectures } = await supabase
  .from('master_lectures')
  .select(`
    *,
    curriculum_revision:curriculum_revisions(name),
    subject:subjects(name),
    platform:platforms(name)
  `)
  .eq('is_active', true)
  .eq('curriculum_revision_id', revisionId)
  .gte('grade_min', targetGrade)
  .lte('grade_max', targetGrade)
  .eq('school_type', 'HIGH');
```

### 2. 강의 인스턴스 생성

```typescript
const { data: lecture } = await supabase
  .from('lectures')
  .insert({
    tenant_id: tenantId,
    student_id: studentId,
    master_lecture_id: masterLectureId,
    title: customTitle,          // 선택: 커스텀 제목
    nickname: '6평 대비 패키지',  // 선택: 별명
    total_episodes: 30,
    linked_book_id: bookId,
  })
  .select()
  .single();
```

### 3. 진도 업데이트

```typescript
// 회차 완료 처리
await supabase
  .from('student_lecture_episodes')
  .update({
    is_completed: true,
    watched_seconds: totalSeconds,
    last_watched_at: new Date().toISOString(),
  })
  .eq('id', episodeId);

// 강의 전체 진도 업데이트
const completedCount = await getCompletedEpisodesCount(lectureId);
const totalCount = await getTotalEpisodesCount(lectureId);
const progress = (completedCount / totalCount) * 100;

await supabase
  .from('lectures')
  .update({
    completed_episodes: completedCount,
    progress: progress,
  })
  .eq('id', lectureId);
```

### 4. 강의 상세 조회 (모든 관련 정보)

```typescript
const { data } = await supabase
  .from('lectures')
  .select(`
    *,
    master_lecture:master_lectures(*),
    linked_book:books(*),
    student:students(name),
    episodes:student_lecture_episodes(
      *,
      master_episode:lecture_episodes(*)
    )
  `)
  .eq('id', lectureId)
  .single();
```

### 5. 태그 기반 검색

```typescript
const { data: lectures } = await supabase
  .from('master_lectures')
  .select('*')
  .contains('tags', ['핵심개념', '기출문제'])
  .eq('is_active', true);
```

---

## ⚠️ 레거시 컬럼 주의사항

다음 컬럼은 **호환성을 위해 유지**되지만, **새 코드에서는 사용하지 마세요**:

**lectures 테이블**:
- `platform` → 대신 `master_lectures.platform_id` 또는 `platform_name` 사용
- `subject`, `subject_category` → 대신 `master_lectures.subject_id` 사용
- `revision`, `semester` → 대신 `master_lectures` 컬럼 사용
- `chapter_info` → 대신 `lecture_episodes`/`student_lecture_episodes` 사용
- `difficulty_level` → 대신 `master_lectures.difficulty_level` 사용
- `latest_version` → 사용하지 않음

---

## 🔗 관련 파일

### 마이그레이션
- `supabase/migrations/*_refactor_master_lectures_and_episodes.sql`
- `supabase/migrations/*_refactor_lectures_and_student_episodes.sql`

### 문서
- [lecture-schema-refactoring.md](./lecture-schema-refactoring.md) - 상세 가이드
- [master-books-schema-refactoring.md](./master-books-schema-refactoring.md) - 교재 스키마

### 수정 필요 파일
- `app/actions/lectures.ts`
- `app/(student)/actions/masterContentActions.ts`
- `lib/data/lectures.ts`
- `lib/types/lecture.ts`
- `app/(admin)/admin/master-lectures/**/*.tsx`
- `app/(student)/contents/**/*.tsx`

---

## 📞 문의

궁금한 점이 있거나 추가 지원이 필요하면 팀 채널로 문의해 주세요.

**마지막 업데이트**: 2024년 11월 29일

