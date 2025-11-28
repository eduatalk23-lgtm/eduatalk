# Supabase 현재 스키마 요약

**작성일**: 2024-11-29  
**기준**: Supabase 실제 데이터베이스 스키마 (MCP 조회)

## 📋 개요

이 문서는 Supabase에서 실제로 조회한 현재 데이터베이스 스키마 정보를 정리한 문서입니다.

## 📊 테이블 목록 (총 67개)

### 1. 코어 테이블 (Core)

1. **tenants** - 테넌트 정보
2. **admin_users** - 관리자 사용자
3. **parent_users** - 학부모 사용자
4. **students** - 학생 정보
5. **user_sessions** - 사용자 세션

### 2. 교육 메타데이터 (Education Metadata)

6. **curriculum_revisions** - 교육과정 개정
7. **subject_groups** - 교과 그룹
8. **subject_types** - 과목 구분
9. **subjects** - 과목
10. **schools** - 학교
11. **regions** - 지역 (계층 구조)

### 3. 콘텐츠 관리 (Content Management)

12. **content_masters** - 마스터 콘텐츠
13. **content_master_details** - 마스터 콘텐츠 상세
14. **master_books** - 마스터 교재
15. **master_lectures** - 마스터 강의
16. **book_details** - 교재 상세
17. **lecture_episodes** - 강의 에피소드
18. **books** - 학생 교재
19. **lectures** - 학생 강의
20. **student_lecture_episodes** - 학생 강의 에피소드
21. **student_book_details** - 학생 교재 상세
22. **student_custom_contents** - 학생 커스텀 콘텐츠
23. **content_subjects** - 콘텐츠 과목

### 4. 성적 관리 (Score Management)

24. **student_scores** - 학생 성적 (레거시)
25. **student_school_scores** - 학생 내신 성적
26. **student_mock_scores** - 학생 모의고사 성적
27. **student_analysis** - 학생 분석
28. **student_internal_scores** - 학생 내신 성적 (정규화)
29. **student_terms** - 학생 학기

### 5. 학습 계획 (Planning)

30. **plan_groups** - 계획 그룹
31. **student_plan** - 학생 일일 학습 계획
32. **plan_contents** - 계획 콘텐츠
33. **plan_exclusions** - 계획 제외 날짜
34. **plan_timer_logs** - 계획 타이머 로그

### 6. 블록 관리 (Block Management)

35. **tenant_block_sets** - 테넌트 블록 세트
36. **tenant_blocks** - 테넌트 블록
37. **student_block_sets** - 학생 블록 세트
38. **student_block_schedule** - 학생 블록 스케줄
39. **student_daily_schedule** - 학생 일일 스케줄

### 7. 캠프 관리 (Camp Management)

40. **camp_templates** - 캠프 템플릿
41. **camp_invitations** - 캠프 초대
42. **camp_template_block_sets** - 캠프 템플릿 블록 세트

### 8. 목표 및 진도 (Goals & Progress)

43. **student_goals** - 학생 목표
44. **student_goal_progress** - 학생 목표 진도
45. **student_content_progress** - 학생 콘텐츠 진도
46. **student_study_sessions** - 학생 학습 세션
47. **student_history** - 학생 이력

### 9. 학원 관리 (Academy Management)

48. **academies** - 학원
49. **academy_schedules** - 학원 시간표

### 10. 학생 프로필 (Student Profiles)

50. **student_profiles** - 학생 프로필
51. **student_career_goals** - 학생 진로 목표
52. **student_career_field_preferences** - 학생 진로 분야 선호도
53. **student_consulting_notes** - 학생 상담 노트
54. **parent_student_links** - 학부모-학생 연결

### 11. 추천 시스템 (Recommendation)

55. **recommended_contents** - 추천 콘텐츠

### 12. 마스터 데이터 (Master Data)

56. **grades** - 학년
57. **semesters** - 학기
58. **publishers** - 출판사
59. **platforms** - 플랫폼
60. **career_fields** - 진로 분야

### 13. 기타 (Miscellaneous)

61. **excluded_dates** - 제외 날짜
62. **make_scenario_logs** - 시나리오 생성 로그

## 🔑 주요 제약조건 (Constraints)

### Primary Keys
- 모든 테이블에 `id` (uuid) 기본키 존재
- 기본키는 `gen_random_uuid()` 기본값 사용

### Foreign Keys
- 대부분의 테이블이 `tenant_id`를 외래키로 가짐 (멀티테넌트 구조)
- 학생 관련 테이블은 `student_id` 외래키 가짐
- 교육과정 관련 테이블은 `curriculum_revision_id` 외래키 가짐

### Unique Constraints
- `curriculum_revisions.name` - UNIQUE
- `subject_groups` - (curriculum_revision_id, name) 조합 고려 필요
- `student_career_goals.student_id` - UNIQUE
- `camp_template_block_sets.camp_template_id` - UNIQUE
- `plan_groups.camp_invitation_id` - UNIQUE

### Check Constraints
- 여러 테이블에 ENUM 타입 체크 제약조건 존재
- 예: `students.status`, `plan_groups.status`, `camp_invitations.status` 등

## 📝 주요 특징

1. **멀티테넌트 구조**: 대부분의 테이블에 `tenant_id` 포함
2. **UUID 기반**: 모든 ID는 UUID 타입 사용
3. **타임스탬프**: `created_at`, `updated_at` 자동 관리
4. **소프트 삭제**: 일부 테이블에 `deleted_at` 컬럼 존재
5. **JSONB 활용**: 유연한 데이터 구조를 위해 JSONB 사용

## 🔄 다음 단계

1. Supabase CLI를 통한 전체 스키마 덤프 (Docker 필요)
2. 또는 MCP를 통한 스키마 생성 스크립트 개발
3. 새로운 통합 마이그레이션 파일 생성

## 📚 참고

- 실제 스키마는 Supabase 프로젝트에서 확인 가능
- 마이그레이션 히스토리는 `supabase/migrations_backup_*` 디렉토리에 백업됨
