# 학생 페이지 서비스 마스터 강의 상세보기 수정

**작업일**: 2024-11-30  
**커밋**: 7ba7dca

## 문제 상황

학생 페이지에서 서비스 마스터 강의 상세보기가 제대로 표시되지 않는 문제가 있었습니다.

### 주요 원인
1. **잘못된 필드명 사용**: 타입 정의와 실제 데이터베이스 컬럼명이 일치하지 않음
   - `instructor` → 실제는 `instructor_name`
   - `platform` → 실제는 `platform_name`
   - `source_url` → 강의의 경우 `lecture_source_url`
   
2. **누락된 필드**: 일부 표시 필드가 타입에 정의되지 않음
   - `lecture_type` (강의 유형)
   - `grade_level` (학년 레벨)

3. **서비스 마스터 교재 페이지와 불일치**: 표시 방식이 교재 페이지와 달라 일관성 부족

## 수정 내용

### 1. 페이지 컴포넌트 수정

**파일**: `app/(student)/contents/master-lectures/[id]/page.tsx`

#### ContentHeader 수정
```typescript
// 수정 전
subtitle={lecture.platform || ""}

// 수정 후
subtitle={lecture.platform_name || lecture.platform || ""}
```

#### ContentDetailTable 수정
```typescript
// 주요 변경 사항
{ label: "플랫폼", value: lecture.platform_name || lecture.platform },
{ label: "강사", value: lecture.instructor_name },
{ label: "강의 유형", value: lecture.lecture_type },
{ label: "총 회차", value: lecture.total_episodes ? `${lecture.total_episodes}회` : null },
{ label: "출처 URL", value: lecture.lecture_source_url, isUrl: true },
```

제거된 필드:
- "강의 대상 학년" - 중복 정보이므로 제거

### 2. 타입 정의 업데이트

**파일**: `lib/types/plan.ts`

#### MasterLecture 타입
```typescript
export type MasterLecture = CommonContentFields & {
  platform_name: string | null;
  platform_id?: string | null;
  total_episodes: number;
  total_duration: number | null;
  linked_book_id: string | null;
  
  // 실제 DB 컬럼명 추가
  instructor_name: string | null; // 강사명 (실제 DB 컬럼명)
  grade_level: string | null; // 학년 레벨
  lecture_type: string | null; // 강의 유형
  lecture_source_url: string | null; // 강의 출처 URL
  
  // 레거시 필드 (호환성)
  instructor?: string | null; // @deprecated instructor_name 사용 권장
  platform?: string | null; // @deprecated platform_name 사용 권장
  source_url: string | null; // 출처 URL (레거시)
  // ...
};
```

#### LectureEpisode 타입
```typescript
export type LectureEpisode = {
  id: string;
  lecture_id: string;
  episode_number: number;
  episode_title: string | null; // 실제 DB 컬럼명
  title?: string | null; // 호환성
  duration: number | null;
  display_order: number;
  created_at: string;
  lecture_source_url?: string | null;
  // ...
};
```

## 데이터베이스 스키마 참조

### master_lectures 테이블 주요 컬럼
- `instructor_name` (character varying) - 강사명
- `platform_id` (uuid) - 플랫폼 ID (FK)
- `lecture_type` (character varying) - 강의 유형
- `grade_level` (character varying) - 학년 레벨
- `lecture_source_url` (text) - 강의 출처 URL

### lecture_episodes 테이블 주요 컬럼
- `episode_number` (integer) - 회차 번호
- `episode_title` (character varying) - 회차 제목
- `duration` (integer) - 회차 시간 (초)
- `lecture_source_url` (text) - 회차별 출처 URL

## 영향 범위

- ✅ 학생 페이지의 서비스 마스터 강의 상세보기가 정상적으로 표시됩니다
- ✅ 모든 필드가 올바른 데이터베이스 컬럼에서 값을 가져옵니다
- ✅ 서비스 마스터 교재 페이지와 일관된 표시 방식을 사용합니다
- ✅ 레거시 필드 지원으로 하위 호환성 유지

## 참고한 파일

- `app/(student)/contents/master-books/[id]/page.tsx` - 서비스 마스터 교재 상세 페이지
- `lib/data/contentMasters.ts` - 데이터 조회 로직
- Supabase 스키마 - 실제 데이터베이스 구조

## 추가 개선 사항

향후 고려사항:
1. 플랫폼 정보를 `platforms` 테이블과 JOIN하여 표시
2. 연결된 교재 정보를 더 상세하게 표시
3. 강의 회차별 진도 추적 기능 추가

