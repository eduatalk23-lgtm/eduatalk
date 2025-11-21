# 학습 세션 테이블 마이그레이션

## 파일
`20250102000000_create_study_sessions_table.sql`

## 설명
학생의 학습 세션(타이머) 기록을 저장하는 테이블을 생성합니다.

## 테이블 구조
- `student_study_sessions`: 학습 세션 로그 테이블
  - `id`: 세션 고유 ID
  - `student_id`: 학생 ID (FK)
  - `plan_id`: 플랜 ID (FK, nullable)
  - `content_type`: 콘텐츠 타입 (book/lecture/custom, nullable)
  - `content_id`: 콘텐츠 ID (nullable)
  - `started_at`: 학습 시작 시간
  - `ended_at`: 학습 종료 시간 (nullable)
  - `duration_seconds`: 학습 시간(초) (nullable)
  - `focus_level`: 집중도 (1~5, nullable, 추후 확장용)
  - `note`: 세션 메모 (nullable)
  - `created_at`: 생성 시간

## 인덱스
- `idx_study_sessions_student_id`: 학생별 조회 최적화
- `idx_study_sessions_started_at`: 시간순 정렬 최적화
- `idx_study_sessions_plan_id`: 플랜별 조회 최적화
- `idx_study_sessions_student_started`: 학생+시간 복합 조회
- `idx_study_sessions_active`: 활성 세션 조회 최적화 (ended_at IS NULL)

## RLS 정책
- SELECT: 본인 세션만 조회 가능
- INSERT: 본인 세션만 생성 가능
- UPDATE: 본인 세션만 수정 가능
- DELETE: 본인 세션만 삭제 가능

## 적용 방법
```bash
# Supabase CLI 사용
supabase migration up

# 또는 Supabase Dashboard에서 직접 실행
```

