# Supabase 스키마 덤프 가이드

**작성일**: 2024-11-29  
**목적**: Supabase 데이터베이스에서 실제 스키마를 덤프하여 새로운 마이그레이션 파일로 생성

## 📋 개요

기존 마이그레이션 내용을 무시하고 Supabase에서 실제 스키마를 가져와 정리하는 방법을 안내합니다.

## 🎯 목표

1. Supabase에서 현재 실제 스키마 정보 수집
2. 새로운 통합 마이그레이션 파일 생성
3. 기존 마이그레이션 히스토리 백업 및 정리

## 🔧 방법 1: Supabase CLI 사용 (권장)

### 전제 조건

- Docker Desktop 설치 필요
- Supabase CLI 설치 및 로그인 완료

### 스키마 덤프 명령어

```bash
# 프로젝트 루트에서 실행
cd /path/to/project

# 전체 스키마 덤프 (public 스키마만)
npx supabase db dump --schema public --data-only=false > supabase/migrations/$(date +%Y%m%d%H%M%S)_current_schema.sql

# 또는 특정 테이블만
npx supabase db dump --schema public --table tenants --table students --data-only=false > schema_dump.sql
```

### 문제 해결

**Docker가 설치되어 있지 않은 경우:**
- Docker Desktop 설치: https://docs.docker.com/desktop
- 설치 후 재시도

**연결 문제:**
- `supabase login` 실행하여 재인증
- Connection Pooler 포트(6543) 사용 고려

## 🔧 방법 2: Supabase Dashboard 사용

1. **Supabase Dashboard 접속**
   - https://app.supabase.com 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴 → **SQL Editor**

3. **스키마 정보 조회 쿼리 실행**

```sql
-- 전체 테이블 목록
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- 특정 테이블의 CREATE TABLE 문 생성
SELECT 
    'CREATE TABLE ' || table_name || ' (' || 
    string_agg(
        column_name || ' ' || 
        data_type || 
        CASE 
            WHEN is_nullable = 'NO' THEN ' NOT NULL'
            ELSE ''
        END ||
        CASE 
            WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default
            ELSE ''
        END,
        ', '
    ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'tenants'
GROUP BY table_name;
```

4. **결과를 파일로 저장**
   - 쿼리 결과를 복사하여 마이그레이션 파일로 저장

## 🔧 방법 3: MCP를 통한 스키마 생성 (스크립트)

MCP를 통해 수집한 스키마 정보를 기반으로 마이그레이션 파일을 생성하는 스크립트를 작성할 수 있습니다.

### 장점
- Docker 불필요
- 프로그래밍 방식으로 정확한 DDL 생성

### 단점
- 복잡한 제약조건 처리 필요
- 외래키, 인덱스, 트리거 등 추가 작업 필요

## 📝 생성된 파일 위치

- **새 마이그레이션**: `supabase/migrations/[timestamp]_current_schema.sql`
- **백업**: `supabase/migrations_backup_[timestamp]/`

## ✅ 작업 완료 체크리스트

- [ ] 기존 마이그레이션 파일 백업 완료
- [ ] Supabase에서 실제 스키마 덤프 완료
- [ ] 새로운 통합 마이그레이션 파일 생성 완료
- [ ] 마이그레이션 파일 검증 완료
- [ ] 문서 업데이트 완료

## 🚨 주의사항

1. **기존 데이터 보존**
   - 스키마 덤프는 스키마만 포함 (데이터 제외)
   - 데이터는 별도로 백업 필요

2. **제약조건 순서**
   - 외래키는 참조 테이블 생성 후 추가
   - 제약조건 순서 중요

3. **인덱스 및 트리거**
   - `pg_dump` 시 자동 포함되지만
   - 수동 작업 시 별도 고려 필요

## 📚 참고 링크

- [Supabase CLI 문서](https://supabase.com/docs/guides/cli)
- [PostgreSQL pg_dump 문서](https://www.postgresql.org/docs/current/app-pgdump.html)
- [현재 스키마 요약](./supabase-current-schema-summary.md)
