# 마이그레이션 타임스탬프 문제 해결

## 문제 개요

**발생 일자**: 2025-01-31  
**문제**: Supabase 마이그레이션 적용 시 타임스탬프 순서 오류 발생

**에러 메시지**:
```
Found local migration files to be inserted before the last migration on remote database.

Rerun the command with --include-all flag to apply these migrations:
supabase/migrations/20250131000000_add_students_parents_insert_policy.sql   
supabase/migrations/20250131000001_revert_students_parents_insert_policy.sql
```

---

## 문제 원인 분석

### 1. 타임스탬프 순서 문제

**원인**:
- 새로 생성한 마이그레이션 파일의 타임스탬프: `20250131000000` (2025-01-31)
- 원격 데이터베이스의 마지막 마이그레이션: `20251212000002` (2025-12-12)
- **새 파일의 타임스탬프가 기존 마이그레이션보다 이전**

**Supabase 마이그레이션 동작 원리**:
- Supabase는 마이그레이션 파일을 타임스탬프 순서대로 적용
- 원격 데이터베이스에 이미 더 최신 타임스탬프의 마이그레이션이 있으면, 이전 타임스탬프의 마이그레이션은 적용하지 않음
- 이는 데이터베이스 스키마의 일관성을 보장하기 위한 안전 장치

### 2. 왜 이런 문제가 발생했는가?

**시나리오**:
1. Phase 2 작업 중 마이그레이션 파일 생성 시 현재 날짜(2025-01-31)를 타임스탬프로 사용
2. 실제 프로젝트의 마지막 마이그레이션은 2025-12-12에 생성됨
3. 타임스탬프가 과거 날짜로 설정되어 순서 문제 발생

**근본 원인**:
- 마이그레이션 파일 생성 시 원격 데이터베이스의 최신 마이그레이션 타임스탬프를 확인하지 않음
- 고정된 날짜(작업 일자)를 타임스탬프로 사용

---

## 해결 방법

### 방법 1: 타임스탬프 수정 (권장)

**절차**:
1. 원격 데이터베이스의 마지막 마이그레이션 타임스탬프 확인
2. 새로운 마이그레이션 파일의 타임스탬프를 마지막 마이그레이션 이후로 설정
3. 파일명도 함께 변경

**실제 적용**:
```bash
# 마지막 마이그레이션 확인
ls -lt supabase/migrations/ | head -5

# 마지막 마이그레이션: 20251212000002_remove_student_plan_unique_constraint.sql
# 새 마이그레이션 타임스탬프: 20251213000000 (마지막 + 1일)
```

**변경 사항**:
- `20250131000000_add_students_parents_insert_policy.sql` 
  → `20251213000000_add_students_parents_insert_policy.sql`
- `20250131000001_revert_students_parents_insert_policy.sql`
  → `20251213000001_revert_students_parents_insert_policy.sql`

### 방법 2: --include-all 플래그 사용 (비권장)

**절차**:
```bash
npx supabase db push --include-all
```

**단점**:
- 타임스탬프 순서가 무시되어 데이터베이스 스키마 일관성 문제 발생 가능
- 마이그레이션 히스토리가 혼란스러워짐
- 프로덕션 환경에서 위험할 수 있음

**권장하지 않는 이유**:
- 마이그레이션 순서는 데이터베이스 스키마 변경의 논리적 순서를 나타냄
- 순서를 무시하면 의존성 문제나 데이터 불일치 발생 가능

---

## 적용 결과

### 마이그레이션 적용 성공

```bash
$ npx supabase db push
Initialising login role...
Connecting to remote database...
Do you want to push these migrations to the remote database?
 • 20251213000000_add_students_parents_insert_policy.sql
 • 20251213000001_revert_students_parents_insert_policy.sql

 [Y/n] Y
Applying migration 20251213000000_add_students_parents_insert_policy.sql...
Applying migration 20251213000001_revert_students_parents_insert_policy.sql...
Finished supabase db push.
```

**결과**:
- ✅ `students_insert_own` 정책 생성 완료
- ✅ `parent_users_insert_own` 정책 생성 완료
- ✅ 마이그레이션 히스토리 정상 기록

---

## 향후 예방 방안

### 1. 마이그레이션 파일 생성 시 체크리스트

**작업 전 확인**:
- [ ] 원격 데이터베이스의 마지막 마이그레이션 타임스탬프 확인
- [ ] 새 마이그레이션 타임스탬프가 마지막 마이그레이션 이후인지 확인
- [ ] 파일명이 타임스탬프와 일치하는지 확인

**확인 방법**:
```bash
# 로컬 마이그레이션 파일 목록 확인
ls -lt supabase/migrations/ | head -5

# 또는 Supabase CLI로 확인
npx supabase migration list
```

### 2. 마이그레이션 타임스탬프 생성 규칙

**권장 규칙**:
1. **현재 시간 사용**: `date +"%Y%m%d%H%M%S"` 명령어로 현재 시간 사용
2. **마지막 마이그레이션 + 1분**: 마지막 타임스탬프의 분 단위에 +1
3. **일관된 형식**: `YYYYMMDDHHMMSS` 형식 유지

**예시**:
```bash
# 현재 시간으로 타임스탬프 생성
TIMESTAMP=$(date +"%Y%m%d%H%M%S")
echo "${TIMESTAMP}_add_feature.sql"

# 또는 마지막 마이그레이션 + 1분
LAST_MIGRATION="20251212000002"
NEW_TIMESTAMP="20251213000000"  # 날짜 +1, 시간 00:00:00
```

### 3. 자동화 스크립트 제안

**마이그레이션 파일 생성 스크립트**:
```bash
#!/bin/bash
# create-migration.sh

# 마지막 마이그레이션 파일 찾기
LAST_MIGRATION=$(ls -t supabase/migrations/*.sql | head -1 | xargs basename)
LAST_TIMESTAMP=$(echo $LAST_MIGRATION | cut -d'_' -f1)

# 새 타임스탬프 생성 (마지막 + 1일)
YEAR=${LAST_TIMESTAMP:0:4}
MONTH=${LAST_TIMESTAMP:4:2}
DAY=${LAST_TIMESTAMP:6:2}

# 다음 날짜 계산 (간단한 버전)
NEW_DAY=$((10#$DAY + 1))
if [ $NEW_DAY -gt 31 ]; then
  NEW_DAY=1
  MONTH=$((10#$MONTH + 1))
fi

NEW_TIMESTAMP="${YEAR}${MONTH}$(printf "%02d" $NEW_DAY)000000"

# 마이그레이션 이름 입력
read -p "Migration name: " MIGRATION_NAME
FILENAME="${NEW_TIMESTAMP}_${MIGRATION_NAME}.sql"

# 파일 생성
cat > "supabase/migrations/${FILENAME}" << EOF
-- ============================================
-- Migration: ${MIGRATION_NAME}
-- Date: $(date +"%Y-%m-%d")
-- ============================================

EOF

echo "Created: supabase/migrations/${FILENAME}"
```

### 4. 문서화 개선

**마이그레이션 파일 생성 가이드**:
- 마이그레이션 파일 생성 전 원격 마이그레이션 확인 필수
- 타임스탬프는 항상 최신 마이그레이션 이후로 설정
- `--include-all` 플래그는 비상시에만 사용

---

## 참고 자료

- [Supabase 마이그레이션 가이드](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [RLS 정책 개선 TODO](./rls-policy-improvement-todo.md) - Phase 2 작업
- [RLS 정책 분석 문서](./rls-policy-analysis.md) - 정책 설계

---

**작성 일자**: 2025-01-31  
**해결 일자**: 2025-01-31  
**관련 이슈**: Phase 2 마이그레이션 적용 문제

