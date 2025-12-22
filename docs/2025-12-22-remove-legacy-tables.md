# 레거시 테이블 삭제 작업

**작성일**: 2025-12-22  
**마이그레이션**: `20251222192848_remove_legacy_tables`

---

## 작업 개요

사용되지 않는 레거시 테이블 3개를 안전하게 삭제했습니다.

---

## 삭제된 테이블

### 1. `content_masters`
- **상태**: 0개 행
- **대체 테이블**: `master_books`, `master_lectures`
- **삭제 내용**:
  - RLS 정책: `content_masters_select_all`
  - 외래키: `content_masters_tenant_id_fkey`
  - 인덱스: 5개 (자동 삭제)
  - 테이블 삭제 완료

### 2. `content_master_details`
- **상태**: 0개 행
- **대체 테이블**: `book_details`, `lecture_episodes`
- **삭제 내용**:
  - RLS 정책: `content_master_details_select`
  - 외래키: `content_master_details_master_id_fkey`
  - 인덱스: 4개 (자동 삭제)
  - 테이블 삭제 완료

### 3. `student_daily_schedule`
- **상태**: 0개 행
- **대체 테이블**: `student_plan`
- **삭제 내용**:
  - RLS 정책: 5개
    - `Admins can view all daily schedules in their tenant`
    - `Parents can view their children's daily schedules`
    - `Students can delete their own daily schedule`
    - `Students can insert their own daily schedule`
    - `Students can update their own daily schedule`
    - `Students can view their own daily schedule`
  - 외래키: 2개
    - `student_daily_schedule_student_id_fkey`
    - `student_daily_schedule_tenant_id_fkey`
  - 인덱스: 6개 (자동 삭제)
  - 테이블 삭제 완료

---

## 검증 사항

### 사전 검증
- ✅ 코드베이스 참조 확인: `app/`, `lib/` 폴더에서 참조 없음 확인
- ✅ 데이터 확인: 모든 테이블 0개 행 확인
- ✅ 외래키 관계 확인: 의존성 파악 완료
- ✅ RLS 정책 확인: 정책 목록 확인 완료

### 마이그레이션 실행
- ✅ 마이그레이션 파일 생성: `supabase/migrations/20251222192848_remove_legacy_tables.sql`
- ✅ Supabase MCP를 통한 마이그레이션 적용 성공
- ✅ 삭제 확인: 3개 테이블 모두 존재하지 않음 확인

---

## 마이그레이션 파일 구조

```sql
-- Part 1: content_master_details 테이블 제거
-- Part 2: content_masters 테이블 제거
-- Part 3: student_daily_schedule 테이블 제거
-- Part 4: 완료 메시지
```

각 파트는 다음 순서로 진행:
1. 테이블 존재 여부 확인
2. RLS 정책 삭제
3. 외래키 제약조건 삭제
4. 테이블 삭제 (CASCADE로 인덱스 자동 삭제)

---

## 영향 범위

### 코드 영향
- **없음**: 코드베이스에서 참조하지 않음 확인

### 데이터 영향
- **없음**: 모든 테이블 0개 행

### 스키마 영향
- **RLS 정책**: 7개 정책 삭제
- **외래키 제약조건**: 4개 제약조건 삭제
- **인덱스**: 15개 인덱스 자동 삭제
- **테이블**: 3개 테이블 삭제

---

## 참고 사항

1. **안전한 삭제**: 모든 테이블이 0개 행이고 코드 참조가 없어 안전하게 삭제 가능
2. **대체 테이블**: 각 테이블은 새로운 구조로 대체되어 기능상 문제 없음
3. **마이그레이션 롤백**: 필요 시 마이그레이션 파일을 참고하여 수동으로 복구 가능

---

## 다음 단계

### 예정된 작업
- `content_subjects` 테이블 마이그레이션 후 삭제 (32개 행)
- `excluded_dates`와 `plan_exclusions` 통합 검토
- `student_book_details`와 `book_details` 통합 검토

---

**작업 완료일**: 2025-12-22

