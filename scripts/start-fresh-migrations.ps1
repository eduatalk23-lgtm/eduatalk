# Supabase 마이그레이션 새로 시작 스크립트
# 현재 데이터베이스 스키마를 기반으로 새로운 초기 마이그레이션 생성
# 프로덕션/원격 환경에서 사용

Write-Host "=== Supabase 마이그레이션 새로 시작 ===" -ForegroundColor Cyan
Write-Host ""

# 1단계: 기존 마이그레이션 파일 백업
Write-Host "1단계: 기존 마이그레이션 파일 백업 중..." -ForegroundColor Yellow
$backupDir = "supabase/migrations_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (Test-Path "supabase/migrations") {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    Copy-Item -Path "supabase/migrations/*" -Destination $backupDir -Recurse -Force
    Write-Host "✓ 백업 완료: $backupDir" -ForegroundColor Green
} else {
    Write-Host "⚠️  마이그레이션 폴더가 없습니다." -ForegroundColor Yellow
}

# 2단계: 현재 스키마 덤프 생성
Write-Host "`n2단계: 현재 데이터베이스 스키마 덤프 생성 중..." -ForegroundColor Yellow
$schemaDumpFile = "supabase/migrations/$(Get-Date -Format 'yyyyMMddHHmmss')_initial_schema.sql"
New-Item -ItemType Directory -Path "supabase/migrations" -Force | Out-Null

# Supabase CLI를 사용하여 스키마 덤프 생성
Write-Host "스키마 덤프 명령 실행 중..." -ForegroundColor Gray
$dumpResult = npx supabase db dump --schema public --data-only=false 2>&1
if ($LASTEXITCODE -eq 0) {
    $dumpResult | Out-File -FilePath $schemaDumpFile -Encoding UTF8
    Write-Host "✓ 스키마 덤프 생성 완료: $schemaDumpFile" -ForegroundColor Green
} else {
    Write-Host "✗ 스키마 덤프 생성 실패" -ForegroundColor Red
    Write-Host "대안: 수동으로 스키마를 생성하거나 기존 마이그레이션을 통합하세요." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "수동 방법:" -ForegroundColor Cyan
    Write-Host "1. Supabase Dashboard에서 SQL Editor 사용" -ForegroundColor Gray
    Write-Host "2. 'Show create table' 쿼리로 스키마 추출" -ForegroundColor Gray
    Write-Host "3. 추출한 스키마를 $schemaDumpFile 에 저장" -ForegroundColor Gray
}

# 3단계: 마이그레이션 히스토리 리셋 (선택사항)
Write-Host "`n3단계: 마이그레이션 히스토리 리셋 (선택사항)..." -ForegroundColor Yellow
Write-Host "원격 데이터베이스의 마이그레이션 히스토리를 리셋하시겠습니까?" -ForegroundColor Cyan
Write-Host "⚠️  주의: 이 작업은 원격 데이터베이스의 supabase_migrations.schema_migrations 테이블을 수정합니다." -ForegroundColor Red
$resetHistory = Read-Host "마이그레이션 히스토리를 리셋하시겠습니까? (yes/no)"

if ($resetHistory -eq "yes") {
    Write-Host "마이그레이션 히스토리 리셋 중..." -ForegroundColor Yellow
    
    # 기존 마이그레이션들을 reverted로 표시
    Write-Host "기존 마이그레이션들을 reverted로 표시하는 중..." -ForegroundColor Gray
    Write-Host "⚠️  수동으로 처리해야 합니다:" -ForegroundColor Yellow
    Write-Host "   npx supabase migration repair --status reverted <migration_version>" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "또는 SQL로 직접 처리:" -ForegroundColor Cyan
    Write-Host "   DELETE FROM supabase_migrations.schema_migrations;" -ForegroundColor Gray
    Write-Host "   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)" -ForegroundColor Gray
    Write-Host "   VALUES ('$(Get-Date -Format 'yyyyMMddHHmmss')', 'initial_schema', ARRAY[]::text[]);" -ForegroundColor Gray
} else {
    Write-Host "마이그레이션 히스토리 리셋을 건너뜁니다." -ForegroundColor Yellow
}

Write-Host "`n=== 작업 완료 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Green
Write-Host "1. 생성된 초기 마이그레이션 파일을 검토하세요: $schemaDumpFile" -ForegroundColor Gray
Write-Host "2. 필요시 마이그레이션 파일을 수정하세요" -ForegroundColor Gray
Write-Host "3. 'npx supabase db push' 명령으로 마이그레이션을 적용하세요" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  주의사항:" -ForegroundColor Yellow
Write-Host "- 프로덕션 환경에서는 데이터 백업을 먼저 수행하세요" -ForegroundColor Red
Write-Host "- 마이그레이션 히스토리 리셋은 신중하게 진행하세요" -ForegroundColor Red














