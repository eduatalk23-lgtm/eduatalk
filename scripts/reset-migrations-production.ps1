# Supabase 마이그레이션 새로 시작 스크립트 (프로덕션/원격 환경)
# ⚠️ 주의: 이 스크립트는 프로덕션 데이터를 보존하면서 마이그레이션 히스토리만 정리합니다

Write-Host "=== Supabase 마이그레이션 새로 시작 (프로덕션/원격) ===" -ForegroundColor Cyan
Write-Host ""

# 1단계: 기존 마이그레이션 파일 백업
Write-Host "1단계: 기존 마이그레이션 파일 백업 중..." -ForegroundColor Yellow
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
$backupDir = "supabase/migrations_backup_$timestamp"

if (Test-Path "supabase/migrations") {
    $migrationFiles = Get-ChildItem -Path "supabase/migrations" -Filter "*.sql"
    if ($migrationFiles.Count -gt 0) {
        New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
        Copy-Item -Path "supabase/migrations/*.sql" -Destination $backupDir -Force
        Write-Host "✓ 백업 완료: $backupDir" -ForegroundColor Green
        Write-Host "  백업된 파일 수: $($migrationFiles.Count)" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  마이그레이션 파일이 없습니다." -ForegroundColor Yellow
    }
} else {
    Write-Host "⚠️  마이그레이션 폴더가 없습니다. 생성합니다..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "supabase/migrations" -Force | Out-Null
}

# 2단계: 현재 스키마 덤프 생성 (원격 DB에서)
Write-Host "`n2단계: 현재 데이터베이스 스키마 덤프 생성 중..." -ForegroundColor Yellow
Write-Host "⚠️  원격 데이터베이스에 연결되어 있어야 합니다." -ForegroundColor Yellow
Write-Host ""

$initialMigrationFile = "supabase/migrations/20250131000000_initial_schema.sql"
$initialMigrationVersion = "20250131000000"

Write-Host "초기 마이그레이션 파일 생성: $initialMigrationFile" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 명령을 실행하여 스키마를 덤프하세요:" -ForegroundColor Yellow
Write-Host "  npx supabase db dump --schema public --data-only=false > $initialMigrationFile" -ForegroundColor Gray
Write-Host ""
Write-Host "또는 Supabase Dashboard에서:" -ForegroundColor Yellow
Write-Host "  1. SQL Editor 열기" -ForegroundColor Gray
Write-Host "  2. 다음 쿼리 실행하여 스키마 확인:" -ForegroundColor Gray
Write-Host "     SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" -ForegroundColor Gray
Write-Host ""

$createDump = Read-Host "지금 스키마 덤프를 생성하시겠습니까? (yes/no)"
if ($createDump -eq "yes") {
    Write-Host "스키마 덤프 생성 중..." -ForegroundColor Yellow
    $dumpResult = npx supabase db dump --schema public --data-only=false 2>&1
    if ($LASTEXITCODE -eq 0) {
        $dumpResult | Out-File -FilePath $initialMigrationFile -Encoding UTF8
        Write-Host "✓ 스키마 덤프 생성 완료: $initialMigrationFile" -ForegroundColor Green
        
        # 파일에 헤더 추가
        $headerLines = @(
            "-- Migration: Initial Schema",
            "-- Description: 현재 데이터베이스 스키마를 기반으로 생성된 초기 마이그레이션",
            "-- Date: $(Get-Date -Format 'yyyy-MM-dd')",
            "-- ",
            "-- 주의: 이 파일은 자동 생성되었습니다. 필요시 수정하세요.",
            "-- ",
            ""
        )
        $content = Get-Content $initialMigrationFile -Raw
        $header = $headerLines -join "`n"
        Set-Content -Path $initialMigrationFile -Value ($header + $content) -Encoding UTF8
    } else {
        Write-Host "✗ 스키마 덤프 생성 실패" -ForegroundColor Red
        Write-Host "에러: $dumpResult" -ForegroundColor Red
        Write-Host ""
        Write-Host "수동으로 진행하세요:" -ForegroundColor Yellow
        Write-Host "  1. Supabase Dashboard > SQL Editor에서 스키마 확인" -ForegroundColor Gray
        Write-Host "  2. CREATE TABLE 문들을 복사하여 $initialMigrationFile 에 저장" -ForegroundColor Gray
    }
} else {
    Write-Host "스키마 덤프 생성을 건너뜁니다." -ForegroundColor Yellow
    Write-Host "나중에 수동으로 생성하세요: $initialMigrationFile" -ForegroundColor Gray
}

# 3단계: 기존 마이그레이션 파일 정리
Write-Host "`n3단계: 기존 마이그레이션 파일 정리 중..." -ForegroundColor Yellow
if (Test-Path "supabase/migrations") {
    $filesToKeep = @($initialMigrationFile)
    $allFiles = Get-ChildItem -Path "supabase/migrations" -Filter "*.sql"
    
    foreach ($file in $allFiles) {
        $shouldKeep = $false
        foreach ($keepFile in $filesToKeep) {
            if ($file.FullName -eq (Resolve-Path $keepFile).Path) {
                $shouldKeep = $true
                break
            }
        }
        if (-not $shouldKeep) {
            Write-Host "  삭제: $($file.Name)" -ForegroundColor Gray
            Remove-Item $file.FullName -Force
        }
    }
    Write-Host "✓ 마이그레이션 파일 정리 완료" -ForegroundColor Green
}

# 4단계: 마이그레이션 히스토리 리셋 SQL 생성
Write-Host "`n4단계: 마이그레이션 히스토리 리셋 SQL 생성 중..." -ForegroundColor Yellow
$resetSqlFile = "supabase/migrations_reset_$timestamp.sql"

$resetSqlLines = @(
    "-- ============================================",
    "-- Supabase 마이그레이션 히스토리 리셋 SQL",
    "-- 생성일: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "-- ",
    "-- 주의사항:",
    "-- 1. 이 SQL은 프로덕션 데이터베이스에서 실행하기 전에 반드시 백업을 수행하세요",
    "-- 2. 이 작업은 마이그레이션 히스토리만 삭제하며, 실제 데이터는 보존됩니다",
    "-- 3. 실행 후 새로운 마이그레이션을 적용할 수 있습니다",
    "-- ",
    "-- 실행 방법:",
    "-- Supabase Dashboard > SQL Editor에서 이 파일의 내용을 실행하세요",
    "-- ============================================",
    "",
    "-- 기존 마이그레이션 히스토리 삭제",
    "DELETE FROM supabase_migrations.schema_migrations;",
    "",
    "-- 새로운 초기 마이그레이션으로 등록",
    "INSERT INTO supabase_migrations.schema_migrations (version, name, statements)",
    "VALUES ('$initialMigrationVersion', 'initial_schema', ARRAY[]::text[]);",
    "",
    "-- 확인 쿼리",
    "SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC;"
)

$resetSqlLines | Out-File -FilePath $resetSqlFile -Encoding UTF8
Write-Host "✓ 리셋 SQL 생성 완료: $resetSqlFile" -ForegroundColor Green

# 5단계: 실행 안내
Write-Host "`n=== 작업 완료 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "다음 단계를 진행하세요:" -ForegroundColor Green
Write-Host ""
Write-Host "1. 초기 마이그레이션 파일 검토:" -ForegroundColor Yellow
Write-Host "   $initialMigrationFile" -ForegroundColor Gray
Write-Host ""
Write-Host "2. 마이그레이션 히스토리 리셋:" -ForegroundColor Yellow
Write-Host "   Supabase Dashboard > SQL Editor에서 다음 파일 실행:" -ForegroundColor Gray
Write-Host "   $resetSqlFile" -ForegroundColor Gray
Write-Host ""
Write-Host "3. 마이그레이션 적용 확인:" -ForegroundColor Yellow
Write-Host "   npx supabase migration list" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  중요:" -ForegroundColor Red
Write-Host "- 프로덕션 환경에서는 반드시 데이터 백업을 먼저 수행하세요" -ForegroundColor Red
Write-Host "- 마이그레이션 히스토리 리셋은 신중하게 진행하세요" -ForegroundColor Red
Write-Host "- 팀원들과 사전에 협의하세요" -ForegroundColor Red
Write-Host ""
Write-Host "백업 위치: $backupDir" -ForegroundColor Cyan

