# Supabase 마이그레이션 히스토리 복구 작업

## 작업 일시
2025-12-16

## 문제 상황
1. `cleanup_score_dashboard_dummy.sql` 파일이 타임스탬프 형식을 따르지 않아 마이그레이션으로 인식되지 않음
2. 원격 데이터베이스와 로컬 마이그레이션 히스토리가 불일치
   - 원격에만 있는 마이그레이션: 4개
   - 로컬에만 있는 마이그레이션: 4개

## 해결 방법

### 1. 잘못된 형식의 파일 제거
- `supabase/migrations/cleanup_score_dashboard_dummy.sql` 삭제
  - 이 파일은 마이그레이션이 아닌 유틸리티 스크립트였음
  - 유사한 기능의 TypeScript 스크립트가 `scripts/cleanupScoreDashboardDummy.ts`에 이미 존재

### 2. 마이그레이션 히스토리 복구

#### 원격에만 있던 마이그레이션을 reverted로 표시
```bash
npx supabase migration repair --status reverted 20251214045539
npx supabase migration repair --status reverted 20251214045704
npx supabase migration repair --status reverted 20251214045923
npx supabase migration repair --status reverted 20251215103134
```

#### 로컬에만 있던 마이그레이션을 applied로 표시
```bash
npx supabase migration repair --status applied 20251214133504
npx supabase migration repair --status applied 20251214133942
npx supabase migration repair --status applied 20251215163535
npx supabase migration repair --status applied 20251216133753
```

## 결과
- 마이그레이션 히스토리가 로컬과 원격 간 일치
- `supabase db push` 명령이 정상적으로 실행됨
- "Remote database is up to date." 메시지 확인

## 참고사항
- Supabase 마이그레이션 파일은 반드시 `<timestamp>_name.sql` 형식을 따라야 함
- 마이그레이션 히스토리가 불일치할 경우 `supabase migration repair` 명령으로 수동 복구 가능
- 유틸리티 스크립트는 `supabase/migrations/` 폴더가 아닌 `scripts/` 폴더에 위치해야 함

