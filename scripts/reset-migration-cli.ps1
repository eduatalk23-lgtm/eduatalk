# Supabase 마이그레이션 히스토리 리셋 스크립트 (CLI 사용)
# Supabase CLI를 사용하여 마이그레이션 히스토리를 리셋합니다

Write-Host "=== Supabase 마이그레이션 히스토리 리셋 (CLI) ===" -ForegroundColor Cyan
Write-Host ""

# 1단계: 현재 마이그레이션 상태 확인
Write-Host "1️⃣ 현재 마이그레이션 상태 확인 중..." -ForegroundColor Yellow
npx supabase migration list
Write-Host ""

# 2단계: 확인 요청
Write-Host "⚠️  경고: 기존 마이그레이션 히스토리가 모두 삭제됩니다." -ForegroundColor Red
Write-Host "   데이터는 보존되지만, 마이그레이션 히스토리만 삭제됩니다." -ForegroundColor Yellow
Write-Host ""
$confirm = Read-Host "계속하시겠습니까? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "작업이 취소되었습니다." -ForegroundColor Yellow
    exit 0
}

Write-Host ""

# 3단계: Supabase Dashboard에서 실행할 SQL 표시
Write-Host "2️⃣ 마이그레이션 히스토리 리셋 SQL 생성 중..." -ForegroundColor Yellow
Write-Host ""

$resetSql = @"
-- ============================================
-- Supabase 마이그레이션 히스토리 리셋 SQL
-- ============================================

-- 기존 마이그레이션 히스토리 삭제
DELETE FROM supabase_migrations.schema_migrations;

-- 새로운 초기 마이그레이션으로 등록
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20250131000000', 'initial_schema', ARRAY[]::text[]);

-- 확인 쿼리
SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;
"@

Write-Host "다음 SQL을 Supabase Dashboard > SQL Editor에서 실행하세요:" -ForegroundColor Cyan
Write-Host ""
Write-Host $resetSql -ForegroundColor Gray
Write-Host ""

# 4단계: SQL 파일로 저장
$sqlFile = "supabase/migrations_reset_execute.sql"
$resetSql | Out-File -FilePath $sqlFile -Encoding UTF8
Write-Host "✓ SQL 파일 저장 완료: $sqlFile" -ForegroundColor Green
Write-Host ""

# 5단계: 실행 안내
Write-Host "3️⃣ 실행 방법:" -ForegroundColor Yellow
Write-Host ""
Write-Host "방법 1: Supabase Dashboard에서 실행 (권장)" -ForegroundColor Cyan
Write-Host "  1. https://app.supabase.com 접속" -ForegroundColor Gray
Write-Host "  2. 프로젝트 선택" -ForegroundColor Gray
Write-Host "  3. SQL Editor 열기" -ForegroundColor Gray
Write-Host "  4. 위 SQL 복사하여 실행" -ForegroundColor Gray
Write-Host ""

Write-Host "방법 2: psql을 사용하여 직접 실행" -ForegroundColor Cyan
Write-Host "  psql -h <your-db-host> -U postgres -d postgres -f $sqlFile" -ForegroundColor Gray
Write-Host ""

Write-Host "4️⃣ 실행 후 확인:" -ForegroundColor Yellow
Write-Host "  npx supabase migration list" -ForegroundColor Gray
Write-Host ""

Write-Host "=== 준비 완료 ===" -ForegroundColor Cyan
Write-Host "SQL 파일: $sqlFile" -ForegroundColor Green














