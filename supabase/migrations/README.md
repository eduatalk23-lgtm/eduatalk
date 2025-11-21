# Supabase Migrations

이 디렉토리는 Supabase 데이터베이스 마이그레이션 파일을 포함합니다.

## 마이그레이션 실행 방법

### Supabase CLI 사용 (권장)

```bash
# Supabase CLI 설치 (아직 설치하지 않은 경우)
npm install -g supabase

# Supabase 프로젝트 연결
supabase link --project-ref your-project-ref

# 마이그레이션 실행
supabase db push
```

### Supabase Dashboard 사용

1. Supabase Dashboard → SQL Editor로 이동
2. 마이그레이션 파일 내용을 복사하여 실행
3. 또는 Migration 탭에서 직접 업로드

## 마이그레이션 파일 목록

- `20250101000000_create_school_and_mock_scores_tables.sql`
  - 내신 및 모의고사 성적 테이블 생성
  - 인덱스, 제약조건, RLS 정책 포함

## 주의사항

- 마이그레이션은 순서대로 실행되어야 합니다
- 프로덕션 환경에서는 반드시 백업 후 실행하세요
- 테스트 환경에서 먼저 검증하세요

