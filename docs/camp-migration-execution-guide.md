# 캠프 기능 마이그레이션 실행 가이드

## 📋 개요

캠프 템플릿 및 초대 기능을 위한 데이터베이스 마이그레이션 실행 가이드입니다.

**마이그레이션 파일**: `supabase/migrations/20250201000000_add_camp_tables.sql`

---

## 🚀 실행 방법

### 방법 1: Supabase Dashboard (권장)

1. **Supabase Dashboard 접속**
   - https://app.supabase.com 접속
   - 프로젝트 선택

2. **SQL Editor 열기**
   - 좌측 메뉴에서 **SQL Editor** 클릭

3. **마이그레이션 SQL 실행**
   - `supabase/migrations/20250201000000_add_camp_tables.sql` 파일 내용을 복사
   - SQL Editor에 붙여넣기
   - **Run** 버튼 클릭

4. **실행 결과 확인**
   - 성공 메시지 확인
   - 에러가 발생하면 에러 메시지 확인

### 방법 2: Supabase CLI (설치된 경우)

```powershell
# 프로젝트 루트에서 실행
cd c:\project

# 마이그레이션 적용
npx supabase db push

# 또는 특정 마이그레이션만 실행
npx supabase migration up
```

### 방법 3: PowerShell 스크립트 사용

```powershell
# 프로젝트 루트에서 실행
.\scripts\execute-camp-migration.ps1
```

스크립트가 마이그레이션 파일을 클립보드에 복사해줍니다.

---

## ✅ 실행 후 확인

### 1. 테이블 생성 확인

Supabase Dashboard > Database > Tables에서 다음 테이블들이 생성되었는지 확인:

- ✅ `camp_templates` - 캠프 템플릿 테이블
- ✅ `camp_invitations` - 캠프 초대 테이블
- ✅ `plan_groups` 테이블에 다음 컬럼 추가:
  - `plan_type` (text)
  - `camp_template_id` (uuid)
  - `camp_invitation_id` (uuid)

### 2. SQL로 확인

```sql
-- 테이블 존재 확인
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('camp_templates', 'camp_invitations')
ORDER BY table_name;

-- plan_groups 컬럼 확인
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'plan_groups' 
  AND column_name IN ('plan_type', 'camp_template_id', 'camp_invitation_id')
ORDER BY column_name;

-- 인덱스 확인
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN ('camp_templates', 'camp_invitations', 'plan_groups')
  AND indexname LIKE '%camp%'
ORDER BY tablename, indexname;
```

### 3. 애플리케이션 테스트

마이그레이션 실행 후 다음 기능을 테스트:

1. **캠프 초대 목록 조회**
   - `/camp` 페이지 접속
   - 초대 목록이 정상적으로 표시되는지 확인

2. **캠프 참여**
   - `/camp/[invitationId]` 페이지 접속
   - 캠프 참여 플로우가 정상적으로 동작하는지 확인

---

## ⚠️ 주의사항

1. **백업 필수**
   - 프로덕션 환경에서는 반드시 데이터베이스 백업 후 실행
   - Supabase Dashboard > Database > Backups에서 백업 생성

2. **마이그레이션 순서**
   - 현재 마이그레이션 파일: `20250201000000_add_camp_tables.sql`
   - 기존 마이그레이션: `20250131000000_initial_schema.sql` 이후에 실행되어야 함

3. **에러 처리**
   - `duplicate_column` 에러는 무시됨 (이미 컬럼이 존재하는 경우)
   - 다른 에러 발생 시 에러 메시지를 확인하고 수정

---

## 🔍 문제 해결

### 에러: relation "plan_groups" does not exist

**원인**: `plan_groups` 테이블이 아직 생성되지 않음

**해결**: 
- 먼저 `20250131000000_initial_schema.sql` 마이그레이션이 실행되었는지 확인
- `plan_groups` 테이블이 존재하는지 확인

### 에러: relation "tenants" does not exist

**원인**: 기본 테이블들이 생성되지 않음

**해결**:
- 초기 스키마 마이그레이션이 먼저 실행되어야 함
- Supabase Dashboard에서 테이블 목록 확인

### 에러: duplicate key value violates unique constraint

**원인**: 인덱스가 이미 존재함

**해결**:
- `CREATE INDEX IF NOT EXISTS` 구문을 사용하므로 일반적으로 발생하지 않음
- 발생 시 해당 인덱스를 먼저 삭제 후 재실행

---

## 📝 마이그레이션 내용 요약

### 생성되는 테이블

1. **camp_templates**
   - 캠프 템플릿 정보 저장
   - 템플릿 데이터 (WizardData JSON) 포함

2. **camp_invitations**
   - 학생별 캠프 초대 정보 저장
   - 초대 상태 관리 (pending, accepted, declined)

### 수정되는 테이블

1. **plan_groups**
   - `plan_type` 컬럼 추가 (individual, integrated, camp)
   - `camp_template_id` 컬럼 추가
   - `camp_invitation_id` 컬럼 추가

### 생성되는 인덱스

- `idx_camp_templates_tenant_id`
- `idx_camp_templates_status`
- `idx_camp_invitations_student_id`
- `idx_camp_invitations_status`
- `idx_camp_invitations_template_id`
- `idx_plan_groups_plan_type`
- `idx_plan_groups_camp_template_id`

---

## ✅ 완료 체크리스트

- [ ] 데이터베이스 백업 완료
- [ ] 마이그레이션 파일 확인 (`20250201000000_add_camp_tables.sql`)
- [ ] 마이그레이션 실행
- [ ] 테이블 생성 확인
- [ ] 컬럼 추가 확인
- [ ] 인덱스 생성 확인
- [ ] 애플리케이션 테스트

---

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. Supabase Dashboard의 에러 로그
2. 마이그레이션 파일의 SQL 문법
3. 데이터베이스 연결 상태














