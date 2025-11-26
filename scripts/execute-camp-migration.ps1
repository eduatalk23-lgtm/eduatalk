# 캠프 기능 마이그레이션 실행 스크립트
# Supabase Dashboard의 SQL Editor에서 실행하거나, 이 스크립트를 사용하여 실행할 수 있습니다.

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "캠프 기능 마이그레이션 실행" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 마이그레이션 파일 경로
$migrationFile = "supabase/migrations/20250201000000_add_camp_tables.sql"

if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ 마이그레이션 파일을 찾을 수 없습니다: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 마이그레이션 파일 확인: $migrationFile" -ForegroundColor Green
Write-Host ""

# 마이그레이션 파일 내용 표시
Write-Host "마이그레이션 파일 내용:" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Get-Content $migrationFile
Write-Host "----------------------------------------" -ForegroundColor Gray
Write-Host ""

Write-Host "실행 방법:" -ForegroundColor Yellow
Write-Host "1. Supabase Dashboard (권장):" -ForegroundColor White
Write-Host "   - https://app.supabase.com 접속" -ForegroundColor Gray
Write-Host "   - 프로젝트 선택 > SQL Editor 열기" -ForegroundColor Gray
Write-Host "   - 위 마이그레이션 파일 내용을 복사하여 실행" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Supabase CLI (설치된 경우):" -ForegroundColor White
Write-Host "   npx supabase db push" -ForegroundColor Gray
Write-Host ""
Write-Host "3. psql 직접 실행:" -ForegroundColor White
Write-Host "   psql [connection-string] -f $migrationFile" -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  주의사항:" -ForegroundColor Yellow
Write-Host "   - 프로덕션 환경에서는 반드시 백업 후 실행하세요" -ForegroundColor Red
Write-Host "   - 마이그레이션 실행 전 데이터베이스 상태를 확인하세요" -ForegroundColor Red
Write-Host ""

$confirm = Read-Host "Supabase Dashboard에서 실행하시겠습니까? (Y/N)"
if ($confirm -eq "Y" -or $confirm -eq "y") {
    Write-Host ""
    Write-Host "✅ 마이그레이션 파일을 클립보드에 복사했습니다." -ForegroundColor Green
    Write-Host "   Supabase Dashboard > SQL Editor에서 붙여넣어 실행하세요." -ForegroundColor Green
    
    # 클립보드에 복사
    Get-Content $migrationFile | Set-Clipboard
    Write-Host ""
}














