# 마이그레이션 최종 체크리스트

## ✅ 완료된 작업

### 1. 마이그레이션 SQL 생성
- [x] `20250108000000_create_missing_tables.sql` 생성
  - student_analysis 테이블
  - student_scores 테이블
  - student_daily_schedule 테이블
  - student_content_progress 컬럼 추가
- [x] `20250108000001_add_tenant_id_to_existing_tables.sql` 생성
  - student_study_sessions에 tenant_id 추가
  - student_goals에 tenant_id 추가
  - student_goal_progress에 tenant_id 추가
  - student_history에 tenant_id 추가

### 2. 코드 수정
- [x] `app/actions/scores.ts` - tenant_id 추가
- [x] `app/analysis/_utils.ts` - tenant_id 추가
- [x] `app/actions/progress.ts` - tenant_id 및 새 컬럼 사용
- [x] `app/actions/schedule.ts` - tenant_id 추가 및 student_daily_schedule 지원
- [x] `app/(student)/today/actions/todayActions.ts` - tenant_id 및 새 컬럼 사용
- [x] `lib/data/studentScores.ts` - 통합 성적 함수 추가

### 3. 문서 작성
- [x] `docs/schema_migration_summary.md` - 변경 요약
- [x] `docs/migration_execution_guide.md` - 실행 가이드

## 📋 실행 전 확인 사항

### Supabase 연결 확인
- [ ] Supabase 프로젝트에 접속 가능한지 확인
- [ ] 데이터베이스 백업 (선택사항이지만 권장)

### 기존 데이터 확인
- [ ] students 테이블에 tenant_id가 있는지 확인
- [ ] tenants 테이블이 존재하는지 확인
- [ ] 기존 데이터가 있는 경우 백업 권장

## 🚀 실행 단계

### Step 1: 마이그레이션 파일 확인
```bash
# 마이그레이션 파일 위치 확인
ls -la supabase/migrations/20250108*.sql
```

### Step 2: Supabase CLI로 실행 (권장)
```bash
cd supabase
supabase db push
```

### Step 3: 또는 Dashboard에서 실행
1. Supabase Dashboard → SQL Editor
2. `20250108000000_create_missing_tables.sql` 내용 복사하여 실행
3. `20250108000001_add_tenant_id_to_existing_tables.sql` 내용 복사하여 실행

### Step 4: 실행 결과 확인
```sql
-- 테이블 생성 확인
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('student_analysis', 'student_scores', 'student_daily_schedule');

-- 컬럼 추가 확인
SELECT column_name FROM information_schema.columns
WHERE table_name = 'student_content_progress'
AND column_name IN ('plan_id', 'start_page_or_time', 'end_page_or_time', 'last_updated');
```

## 🧪 테스트 체크리스트

마이그레이션 실행 후 다음 기능들을 테스트하세요:

### 성적 관리
- [ ] 성적 추가 (`/scores/new`)
- [ ] 성적 수정 (`/scores/[id]/edit`)
- [ ] 성적 삭제
- [ ] 성적 대시보드 조회 (`/scores/dashboard`)

### 취약 과목 분석
- [ ] 분석 페이지 조회 (`/analysis`)
- [ ] Risk Index 계산
- [ ] 분석 데이터 저장

### 일일 스케줄
- [ ] 스케줄 생성 (`/schedule/[date]`)
- [ ] 스케줄 조회
- [ ] 스케줄 수정/삭제

### 학습 진행률
- [ ] 진행률 업데이트 (`/plan/[id]/progress`)
- [ ] 진행률 조회
- [ ] plan_id 연결 확인

### 학습 세션
- [ ] 세션 시작/종료
- [ ] 세션 기록 조회

### 학습 목표
- [ ] 목표 생성/수정/삭제
- [ ] 목표 진행률 추적

## ⚠️ 주의사항

1. **실행 순서**: 반드시 `20250108000000` → `20250108000001` 순서로 실행
2. **데이터 백업**: 기존 데이터가 있는 경우 백업 권장
3. **에러 처리**: 마이그레이션 실패 시 롤백 방법 참고 (`docs/migration_execution_guide.md`)
4. **테스트**: 마이그레이션 후 모든 기능 테스트 필수

## 📞 문제 발생 시

1. 에러 메시지 확인
2. `docs/migration_execution_guide.md`의 "문제 해결" 섹션 참고
3. Supabase 로그 확인
4. 필요시 롤백 실행

## ✨ 완료 후

마이그레이션이 성공적으로 완료되면:
1. 애플리케이션 재시작
2. 모든 기능 테스트
3. 에러 로그 모니터링
4. 성능 확인

