# 마이그레이션 히스토리 수정 스크립트
# 원격 DB의 오래된 마이그레이션들을 reverted로 표시하고
# 로컬 통합 마이그레이션들을 applied로 표시

Write-Host "=== 마이그레이션 히스토리 수정 시작 ===" -ForegroundColor Cyan

# 1단계: 원격의 오래된 마이그레이션들을 reverted로 표시
Write-Host "`n1단계: 오래된 마이그레이션들을 reverted로 표시..." -ForegroundColor Yellow

$oldMigrations = @(
    "20250101000000", "20250102000000", "20250103000000", "20250104000000", 
    "20250105000000", "20250106000000", "20250107000000", "20250107000001", 
    "20250107000002", "20250107000003", "20250107000004", "20250108000000", 
    "20250108000001", "20250109000000", "20250109000001", "20250110000000", 
    "20250110000001", "20250110000002", "20250113000000", "20250114000000", 
    "20250115000000", "20250116000000", "20250117000000", "20250118000000", 
    "20250119000000", "20250119000001", "20250120000000", "20250121000000", 
    "20250122000000", "20250123000000", "20250124000000", "20250125000000", 
    "20250126000000", "20250126000001", "20250127000000", "20250127000001", 
    "20250128000000", "20250129000000", "20250129000001", "20250130000000", 
    "20250201000000", "20251120202638", "20251120203457", "20251121000000", 
    "20251122000000", "20251122000001", "20251122000002", "20251122000003", 
    "20251122000004", "20251122000005", "20251123000000", "20251124000000", 
    "20251125000000", "20251126000000", "20251126000001", "20251126000002"
)

$revertedCommand = "npx supabase migration repair --status reverted " + ($oldMigrations -join " ")
Write-Host "실행 명령: $revertedCommand" -ForegroundColor Gray

$result1 = Invoke-Expression $revertedCommand
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 1단계 완료" -ForegroundColor Green
} else {
    Write-Host "✗ 1단계 실패 (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "에러: $result1" -ForegroundColor Red
    exit 1
}

# 2단계: 로컬 통합 마이그레이션들을 applied로 표시
Write-Host "`n2단계: 로컬 통합 마이그레이션들을 applied로 표시..." -ForegroundColor Yellow

$newMigrations = @(
    "20250131000000", "20250131000001", "20250131000002", "20250131000003", 
    "20250131000004", "20250131000005", "20250131000006", "20250131000007", 
    "20250131000008"
)

$appliedCommand = "npx supabase migration repair --status applied " + ($newMigrations -join " ")
Write-Host "실행 명령: $appliedCommand" -ForegroundColor Gray

$result2 = Invoke-Expression $appliedCommand
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ 2단계 완료" -ForegroundColor Green
} else {
    Write-Host "✗ 2단계 실패 (Exit Code: $LASTEXITCODE)" -ForegroundColor Red
    Write-Host "에러: $result2" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== 마이그레이션 히스토리 수정 완료 ===" -ForegroundColor Cyan
Write-Host "이제 'npx supabase db push' 명령을 실행할 수 있습니다." -ForegroundColor Green

