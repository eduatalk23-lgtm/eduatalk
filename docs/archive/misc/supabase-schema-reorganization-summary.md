# Supabase 스키마 재정리 작업 요약

**작업일**: 2024-11-29  
**목적**: 기존 마이그레이션 내용 무시하고 Supabase에서 실제 스키마를 가져와 정리

## 📋 작업 내용

### 1. 기존 마이그레이션 백업

- **백업 위치**: `supabase/migrations_backup_20251129_053848/`
- **백업된 파일 수**: 45개 마이그레이션 파일
- **상태**: ✅ 완료

### 2. 현재 스키마 정보 수집

- **방법**: MCP (Model Context Protocol)를 통한 Supabase 스키마 조회
- **수집된 정보**:
  - 테이블 목록: 67개 테이블
  - 컬럼 정보: 모든 테이블의 컬럼 구조
  - 제약조건: Primary Key, Foreign Key, Unique, Check 제약조건
- **상태**: ✅ 완료

### 3. 문서화

생성된 문서:
- `docs/supabase-current-schema-summary.md` - 현재 스키마 요약
- `docs/supabase-schema-dump-guide.md` - 스키마 덤프 가이드

## 📊 현재 데이터베이스 구조

### 주요 테이블 그룹

1. **코어 테이블** (5개)
   - tenants, admin_users, parent_users, students, user_sessions

2. **교육 메타데이터** (6개)
   - curriculum_revisions, subject_groups, subject_types, subjects, schools, regions

3. **콘텐츠 관리** (12개)
   - content_masters, master_books, master_lectures, books, lectures 등

4. **성적 관리** (6개)
   - student_school_scores, student_mock_scores, student_internal_scores 등

5. **학습 계획** (5개)
   - plan_groups, student_plan, plan_contents 등

6. **블록 관리** (5개)
   - tenant_block_sets, student_block_sets 등

7. **기타** (28개)
   - 캠프, 목표, 학원, 프로필 등

## 🔄 다음 단계

### 옵션 1: Supabase CLI로 스키마 덤프 (권장)

```bash
# Docker Desktop 설치 필요
npx supabase db dump --schema public --data-only=false > supabase/migrations/$(date +%Y%m%d%H%M%S)_current_schema.sql
```

### 옵션 2: Supabase Dashboard에서 수동 생성

1. SQL Editor에서 스키마 조회 쿼리 실행
2. 결과를 마이그레이션 파일로 저장

### 옵션 3: MCP 기반 자동 생성 스크립트 개발

- MCP로 수집한 스키마 정보를 기반으로 DDL 자동 생성
- 복잡한 제약조건 처리 필요

## 📁 파일 구조

```
supabase/
├── migrations/                    # 새로운 마이그레이션 (비어있음)
├── migrations_backup_20251129_053848/  # 기존 마이그레이션 백업
└── ...

docs/
├── supabase-current-schema-summary.md      # 현재 스키마 요약
├── supabase-schema-dump-guide.md           # 스키마 덤프 가이드
└── supabase-schema-reorganization-summary.md  # 작업 요약 (이 파일)
```

## ✅ 완료된 작업

- [x] 기존 마이그레이션 파일 백업
- [x] Supabase에서 실제 스키마 정보 수집
- [x] 스키마 요약 문서 작성
- [x] 스키마 덤프 가이드 작성
- [x] 작업 요약 문서 작성

## 🚧 남은 작업

- [ ] Supabase CLI로 전체 스키마 덤프 (Docker 설치 필요)
- [ ] 새로운 통합 마이그레이션 파일 생성
- [ ] 마이그레이션 파일 검증

## 💡 권장 사항

1. **Docker 설치 후 CLI 사용**: 가장 정확하고 완전한 스키마 덤프
2. **단계별 검증**: 각 테이블 그룹별로 마이그레이션 분리 고려
3. **제약조건 확인**: Foreign Key, Unique, Check 제약조건 정확히 반영

## 📝 참고

- 기존 마이그레이션 백업은 안전하게 보관됨
- 현재 데이터베이스 스키마는 `docs/supabase-current-schema-summary.md`에서 확인 가능
- 스키마 덤프 방법은 `docs/supabase-schema-dump-guide.md` 참조
