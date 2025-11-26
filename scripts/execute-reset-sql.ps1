# Supabase 마이그레이션 히스토리 리셋 SQL 실행 스크립트
# psql을 사용하여 직접 SQL을 실행합니다

Write-Host "=== Supabase 마이그레이션 히스토리 리셋 SQL 실행 ===" -ForegroundColor Cyan
Write-Host ""

# SQL 파일 경로
$sqlFile = "supabase/migrations_reset_execute.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ SQL 파일을 찾을 수 없습니다: $sqlFile" -ForegroundColor Red
    exit 1
}

Write-Host "SQL 파일: $sqlFile" -ForegroundColor Green
Write-Host ""

# Supabase 연결 정보 확인
Write-Host "Supabase 연결 정보가 필요합니다." -ForegroundColor Yellow
Write-Host ""

$dbUrl = Read-Host "데이터베이스 연결 문자열을 입력하세요 (예: postgresql://postgres:[password]@[host]:5432/postgres)"
if ([string]::IsNullOrWhiteSpace($dbUrl)) {
    Write-Host "연결 문자열이 입력되지 않았습니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "대안: Supabase Dashboard에서 직접 실행하세요:" -ForegroundColor Yellow
    Write-Host "  1. https://app.supabase.com 접속" -ForegroundColor Gray
    Write-Host "  2. 프로젝트 선택 > SQL Editor" -ForegroundColor Gray
    Write-Host "  3. $sqlFile 파일의 내용을 복사하여 실행" -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "⚠️  경고: 기존 마이그레이션 히스토리가 모두 삭제됩니다." -ForegroundColor Red
$confirm = Read-Host "계속하시겠습니까? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "작업이 취소되었습니다." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "SQL 실행 중..." -ForegroundColor Yellow

# psql 실행
$sqlContent = Get-Content $sqlFile -Raw
$sqlContent | psql $dbUrl

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ 마이그레이션 히스토리 리셋 완료" -ForegroundColor Green
    Write-Host ""
    Write-Host "확인:" -ForegroundColor Cyan
    Write-Host "  npx supabase migration list" -ForegroundColor Gray
} else {
    Write-Host ""
    Write-Host "✗ SQL 실행 실패 (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host ""
    Write-Host "대안: Supabase Dashboard에서 직접 실행하세요." -ForegroundColor Yellow
}














