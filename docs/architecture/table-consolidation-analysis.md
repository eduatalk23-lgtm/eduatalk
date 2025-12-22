# 테이블 정리 및 통합 분석

**작성일**: 2025-02-02  
**분석 방법**: Supabase MCP를 통한 실제 데이터베이스 조회 및 코드베이스 검색

---

## 📋 목차

1. [사용되지 않는 테이블 (0개 행)](#사용되지-않는-테이블-0개-행)
2. [통합 가능한 테이블](#통합-가능한-테이블)
3. [레거시/Deprecated 테이블](#레거시deprecated-테이블)
4. [정리 권장사항](#정리-권장사항)

---

## 사용되지 않는 테이블 (0개 행)

### ✅ 삭제 완료 (2025-12-22)

#### 1. `content_masters` & `content_master_details` ✅

- **상태**: 삭제 완료 (마이그레이션: `20251222192848_remove_legacy_tables`)
- **이유**: `master_books`, `master_lectures`로 대체됨
- **삭제 내용**:
  - RLS 정책 제거 완료
  - 외래키 제약조건 제거 완료
  - 테이블 및 인덱스 삭제 완료

#### 2. `student_daily_schedule` ✅

- **상태**: 삭제 완료 (마이그레이션: `20251222192848_remove_legacy_tables`)
- **이유**: `student_plan`으로 대체됨
- **삭제 내용**:
  - RLS 정책 제거 완료 (5개 정책)
  - 외래키 제약조건 제거 완료
  - 테이블 및 인덱스 삭제 완료

### 데이터 마이그레이션 후 삭제 예정

#### 3. `content_subjects`

- **상태**: 32개 행 (마스터 데이터)
- **이유**: `subjects` 테이블로 대체됨
- **조치**: 데이터 마이그레이션 후 삭제 예정

### 향후 사용 예정 (기능 미구현)

#### 4. `plan_group_items`

- **상태**: 0개 행
- **목적**: 논리 플랜 항목 (플랜 그룹 내 학습 계획의 "설계" 단위)
- **조치**: 기능 구현 대기 중, 유지

#### 5. `plan_history` & `reschedule_log`

- **상태**: 0개 행
- **목적**: 플랜 재조정 히스토리 관리
- **조치**: 기능 구현 대기 중, 유지

#### 6. `plan_timer_logs`

- **상태**: 0개 행
- **목적**: 플랜 타이머 이벤트 로그
- **조치**: 기능 구현 대기 중, 유지

#### 7. `student_terms`

- **상태**: 0개 행
- **목적**: 학생 학기 정보 관리
- **조치**: 기능 구현 대기 중, 유지

#### 8. `student_internal_scores`

- **상태**: 0개 행
- **목적**: 내신 성적 관리
- **조치**: 기능 구현 대기 중, 유지 (정규화된 구조)

#### 9. `grade_conversion_rules`

- **상태**: 0개 행
- **목적**: 등급 변환 규칙 관리
- **조치**: 기능 구현 대기 중, 유지

#### 10. `student_score_analysis_cache` & `student_score_events`

- **상태**: 0개 행
- **목적**: 성적 분석 캐시 및 이벤트 로그
- **조치**: 기능 구현 대기 중, 유지

#### 11. `attendance_record_history`

- **상태**: 0개 행
- **목적**: 출석 기록 수정 이력
- **조치**: 기능 구현 대기 중, 유지 (감사 추적용)

#### 12. `student_goals` & `student_goal_progress`

- **상태**: 0개 행
- **목적**: 학습 목표 및 진행률 관리
- **조치**: 기능 구현 대기 중, 유지

#### 13. `student_analysis`

- **상태**: 0개 행
- **목적**: 학생별 과목 분석
- **조치**: 기능 구현 대기 중, 유지

#### 14. `student_consulting_notes`

- **상태**: 0개 행
- **목적**: 학생별 상담노트
- **조치**: 기능 구현 대기 중, 유지

#### 15. `student_notification_preferences`

- **상태**: 0개 행
- **목적**: 학생 알림 설정
- **조치**: 기능 구현 대기 중, 유지

#### 16. `student_connection_codes`

- **상태**: 0개 행
- **목적**: 학생 계정 연결 코드
- **조치**: 기능 구현 대기 중, 유지

#### 17. `make_scenario_logs`

- **상태**: 0개 행
- **목적**: 시나리오 생성 로그
- **조치**: 기능 구현 대기 중, 유지

#### 18. `user_consents`

- **상태**: 0개 행
- **목적**: 사용자 약관 동의
- **조치**: 기능 구현 대기 중, 유지

#### 19. `recommendation_settings` & `recommended_contents`

- **상태**: 0개 행
- **목적**: 추천 시스템 설정 및 추천 콘텐츠
- **조치**: 기능 구현 대기 중, 유지

#### 20. `tenant_scheduler_settings`

- **상태**: 0개 행
- **목적**: 기관별 전역 스케줄러 기본 설정
- **조치**: 기능 구현 대기 중, 유지

#### 21. `excluded_dates`

- **상태**: 0개 행
- **목적**: 제외 날짜 (학생별 전역)
- **조치**: `plan_exclusions`와 중복 가능성, 통합 검토 필요

#### 22. `student_book_details`

- **상태**: 0개 행
- **목적**: 학생 교재 상세 정보
- **조치**: `book_details`와 중복 가능성, 통합 검토 필요

#### 23. `student_career_field_preferences`

- **상태**: 0개 행
- **목적**: 학생 진로 계열 선호도 (다중 선택)
- **조치**: `student_career_goals.desired_career_field`와 중복 가능성, 통합 검토 필요

---

## 통합 가능한 테이블

### 1. 콘텐츠 상세 정보 테이블 통합

#### 현재 구조

- `book_details` (마스터 교재 상세) - 177개 행
- `student_book_details` (학생 교재 상세) - 0개 행
- `lecture_episodes` (마스터 강의 회차) - 982개 행
- `student_lecture_episodes` (학생 강의 회차) - 71개 행

#### 통합 제안

```
content_details (통합 테이블)
- id
- content_type (book/lecture)
- master_content_id (FK → master_books or master_lectures)
- student_content_id (FK → books or lectures, nullable)
- detail_type (page/episode)
- detail_number (page_number or episode_number)
- detail_title
- detail_data (JSONB)
- display_order
```

**장점**:

- 단일 테이블로 관리 간소화
- 콘텐츠 타입별 쿼리 통일
- 인덱스 최적화 용이

**단점**:

- 기존 쿼리 수정 필요
- 마이그레이션 복잡도 증가

---

### 2. 제외일 관리 테이블 통합

#### 현재 구조

- `plan_exclusions` (플랜 그룹별 제외일) - 24개 행
- `excluded_dates` (학생별 전역 제외일) - 0개 행

#### 통합 제안

`plan_exclusions`에 `scope` 필드 추가:

- `scope`: 'plan_group' | 'student' | 'tenant'
- `plan_group_id`: nullable (scope가 'plan_group'일 때만)

**장점**:

- 단일 테이블로 제외일 관리
- 쿼리 단순화

**단점**:

- 기존 데이터 마이그레이션 필요

---

### 3. 진로 정보 테이블 통합

#### 현재 구조

- `student_career_goals` (단일 진로 목표) - 7개 행
  - `desired_career_field`: 단일 선택
- `student_career_field_preferences` (다중 진로 선호도) - 0개 행

#### 통합 제안

`student_career_goals`에 `career_field_preferences` JSONB 배열 추가:

```json
{
  "preferences": [
    { "field": "인문계열", "priority": 1 },
    { "field": "사회계열", "priority": 2 }
  ]
}
```

또는 별도 테이블 유지하되 `student_career_goals`와 1:N 관계로 명확화

**장점**:

- 진로 정보 일원화
- 쿼리 단순화

---

### 4. 블록 관리 테이블 통합 검토

#### 현재 구조

- `tenant_block_sets` & `tenant_blocks` (테넌트 블록)
- `student_block_sets` & `student_block_schedule` (학생 블록)
- `camp_template_block_sets` (캠프 템플릿 블록)

#### 통합 제안

단일 블록 테이블 구조:

```
blocks
- id
- owner_type (tenant/student/camp_template)
- owner_id
- block_set_id
- day_of_week
- start_time
- end_time
```

**장점**:

- 블록 관리 로직 통일
- 코드 중복 제거

**단점**:

- 기존 구조와 차이가 큼
- 마이그레이션 복잡도 높음

**권장**: 현재 구조 유지 (명확한 책임 분리)

---

### 5. 설정 테이블 통합

#### 현재 구조

- `system_settings` (시스템 전역) - 4개 행
- `recommendation_settings` (추천 설정) - 0개 행
- `tenant_scheduler_settings` (스케줄러 설정) - 0개 행

#### 통합 제안

단일 설정 테이블:

```
settings
- id
- scope (system/tenant/student)
- scope_id (nullable)
- category (scheduler/recommendation/etc)
- key
- value (JSONB)
- version
```

**장점**:

- 설정 관리 일원화
- 확장성 향상

**단점**:

- 기존 구조와 차이가 큼
- 쿼리 복잡도 증가 가능

**권장**: 현재 구조 유지 (명확한 책임 분리)

---

## 레거시/Deprecated 테이블

### 1. `content_masters` & `content_master_details`

- **상태**: 레거시, 사용 안 함
- **대체**: `master_books`, `master_lectures`
- **조치**: 삭제 권장

### 2. `content_subjects`

- **상태**: 레거시
- **대체**: `subjects`
- **조치**: 데이터 마이그레이션 후 삭제

### 3. `student_daily_schedule`

- **상태**: 레거시, 사용 안 함
- **대체**: `student_plan`
- **조치**: 삭제 권장

### 4. Deprecated 컬럼

- `books.difficulty_level` → `books.difficulty_level_id` 사용
- `lectures.difficulty_level` → `lectures.difficulty_level_id` 사용
- `student_custom_contents.difficulty_level` → `student_custom_contents.difficulty_level_id` 사용

**조치**: 코드에서 새 컬럼 사용 후 기존 컬럼 제거

---

## 정리 권장사항

### 즉시 삭제 가능 (우선순위: 높음)

1. **`content_masters`** - 코드 참조 없음, 0개 행
2. **`content_master_details`** - 코드 참조 없음, 0개 행
3. **`student_daily_schedule`** - 코드 참조 없음, 0개 행

### 데이터 마이그레이션 후 삭제 (우선순위: 중간)

4. **`content_subjects`** - `subjects`로 마이그레이션 후 삭제

### 통합 검토 필요 (우선순위: 낮음)

5. **`excluded_dates`** - `plan_exclusions`와 통합 검토
6. **`student_book_details`** - `book_details`와 통합 검토
7. **`student_career_field_preferences`** - `student_career_goals`와 통합 검토

### 기능 구현 대기 (유지)

- `plan_group_items`
- `plan_history` & `reschedule_log`
- `plan_timer_logs`
- `student_terms`
- `student_internal_scores`
- `grade_conversion_rules`
- `student_score_analysis_cache` & `student_score_events`
- `attendance_record_history`
- `student_goals` & `student_goal_progress`
- `student_analysis`
- `student_consulting_notes`
- `student_notification_preferences`
- `student_connection_codes`
- `make_scenario_logs`
- `user_consents`
- `recommendation_settings` & `recommended_contents`
- `tenant_scheduler_settings`

---

## 마이그레이션 계획

### Phase 1: 즉시 삭제 (안전)

```sql
-- 1. content_masters 삭제
DROP TABLE IF EXISTS content_master_details CASCADE;
DROP TABLE IF EXISTS content_masters CASCADE;

-- 2. student_daily_schedule 삭제
DROP TABLE IF EXISTS student_daily_schedule CASCADE;
```

### Phase 2: 데이터 마이그레이션 후 삭제

```sql
-- content_subjects → subjects 마이그레이션
-- (데이터 확인 후 마이그레이션 스크립트 작성 필요)
```

### Phase 3: 통합 검토

- `excluded_dates` → `plan_exclusions` 통합
- `student_book_details` → `book_details` 통합
- `student_career_field_preferences` → `student_career_goals` 통합

---

## 참고 사항

1. **외래키 관계 확인**: 삭제 전 모든 외래키 관계 확인 필요
2. **코드베이스 검색**: 삭제 전 코드베이스 전체 검색으로 참조 확인
3. **백업**: 삭제 전 반드시 백업
4. **단계적 진행**: 한 번에 하나씩 삭제하여 문제 발생 시 롤백 용이

---

**마지막 업데이트**: 2025-02-02
