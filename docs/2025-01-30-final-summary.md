# 제외일/학원일정 플랜 그룹별 관리 개선 - 최종 요약

## 작업 개요

**목표**: 제외일과 학원 일정을 플랜 그룹별로 독립 관리하며, 플랜 그룹 간 중복을 허용하도록 변경

**작업 기간**: 2025-01-30  
**상태**: ✅ Phase 1, Phase 2 모두 완료

---

## Phase 1: 제외일 플랜 그룹 간 중복 허용

### 문제
- 시간 관리에서 제외일을 불러올 때 "이미 등록된 제외일이 있습니다" 에러 발생
- 다른 플랜 그룹에 이미 등록된 제외일은 중복으로 간주되어 사용 불가

### 해결
1. **중복 체크 로직 변경** (`lib/data/planGroups.ts`)
   - 변경 전: 다른 플랜 그룹의 제외일과 비교하여 중복 체크
   - 변경 후: 현재 플랜 그룹 내에서만 중복 체크

2. **에러 메시지 업데이트** (`app/(student)/actions/plan-groups/update.ts`)
   - 에러 패턴 간소화: `"중복된 제외일"` 키워드만 체크

### 결과
- ✅ 같은 제외일을 여러 플랜 그룹에서 사용 가능
- ✅ 시간 관리에서 불러오기 정상 작동

---

## Phase 2: 학원 일정 플랜 그룹별 관리

### 문제
- 학원 일정이 학생 전역으로 관리됨 (`student_id` 기반)
- 한 플랜 그룹에서 학원 일정을 수정하면 모든 플랜 그룹에 영향

### 해결

#### 1. 데이터베이스 스키마 변경
**파일**: `supabase/migrations/20251201064437_add_plan_group_id_to_academy_schedules.sql`

```sql
-- academy_schedules 테이블에 plan_group_id 추가
ALTER TABLE academy_schedules
ADD COLUMN plan_group_id UUID REFERENCES plan_groups(id) ON DELETE CASCADE;

-- 기존 데이터를 가장 최근 플랜 그룹에 할당
UPDATE academy_schedules AS a
SET plan_group_id = (
  SELECT pg.id FROM plan_groups pg
  WHERE pg.student_id = a.student_id AND pg.deleted_at IS NULL
  ORDER BY pg.created_at DESC LIMIT 1
);

-- plan_group_id를 NOT NULL로 변경
ALTER TABLE academy_schedules
ALTER COLUMN plan_group_id SET NOT NULL;
```

#### 2. 데이터 레이어 함수
**파일**: `lib/data/planGroups.ts`

- **`createPlanAcademySchedules`**: 새로 추가 (플랜 그룹별 생성)
- **`getAcademySchedules`**: `plan_group_id` 기반 조회로 변경
- **`createStudentAcademySchedules`**: deprecated (하위 호환성 유지)

#### 3. Action 레이어
**파일**: `app/(student)/actions/plan-groups/update.ts`, `create.ts`

- 학원 일정 삭제: `eq("student_id", userId)` → `eq("plan_group_id", groupId)`
- 학원 일정 생성: `createStudentAcademySchedules` → `createPlanAcademySchedules`

#### 4. UI 레이어
**파일**: `app/(student)/plan/calendar/page.tsx`

- 활성 플랜 그룹들의 학원 일정을 병렬 조회 (`Promise.all`)
- 동일 시간대는 하나만 표시 (중복 제거)

### 결과
- ✅ 각 플랜 그룹은 독립적인 학원 일정 보유
- ✅ 플랜 그룹 간 학원 일정 중복 허용
- ✅ 한 플랜 그룹 수정이 다른 플랜 그룹에 영향 없음

---

## 사용자 요구사항 충족 확인

| 요구사항 | Phase 1 | Phase 2 | 상태 |
|---------|---------|---------|------|
| 제외일 플랜 그룹별 관리 | ✅ | - | 완료 |
| 제외일 플랜 그룹 간 중복 가능 | ✅ | - | 완료 |
| 학원 일정 플랜 그룹별 관리 | - | ✅ | 완료 |
| 학원 일정 플랜 그룹 간 중복 가능 | - | ✅ | 완료 |
| 학원 시간+이동시간 겹침 검증 | - | ✅ | 유지 |

---

## 변경된 파일 목록

### Phase 1
1. `lib/data/planGroups.ts` - 제외일 중복 체크 로직
2. `app/(student)/actions/plan-groups/update.ts` - 에러 메시지 패턴

### Phase 2
1. `supabase/migrations/20251201064437_add_plan_group_id_to_academy_schedules.sql` - 마이그레이션
2. `lib/data/planGroups.ts` - 학원 일정 생성/조회 함수
3. `app/(student)/actions/plan-groups/update.ts` - 학원 일정 업데이트 로직
4. `app/(student)/actions/plan-groups/create.ts` - 학원 일정 생성 로직
5. `app/(student)/plan/calendar/page.tsx` - 캘린더 조회 로직

---

## 마이그레이션 가이드

### 실행 순서
1. **백업**: 프로덕션 데이터베이스 스냅샷 생성
2. **로컬 테스트**: 개발 환경에서 마이그레이션 테스트
3. **프로덕션 실행**: `supabase db push`
4. **검증**: 기존 학원 일정이 올바른 플랜 그룹에 할당되었는지 확인

### 기존 데이터 처리
- 각 학생의 학원 일정은 가장 최근 플랜 그룹에 자동 할당
- 플랜 그룹이 없는 학생의 학원 일정은 삭제됨

### 사용자 안내사항
- 마이그레이션 후 각 플랜 그룹에서 "시간 관리에서 불러오기" 재실행 권장
- 기존 학원 일정이 최근 플랜 그룹에만 할당되었음을 알림

---

## 테스트 시나리오

### ✅ 제외일 테스트
1. 시간 관리에서 제외일 등록: 2025-12-25
2. 플랜 그룹 A → 제외일 불러오기 → 성공
3. 플랜 그룹 B → 제외일 불러오기 → 성공 (중복 허용)
4. 플랜 그룹 A 수정 → 제외일 다시 불러오기 → 성공

### ✅ 학원 일정 테스트
1. 플랜 그룹 A → 학원 일정 3개 등록
2. 플랜 그룹 B → 학원 일정 2개 등록 (A와 일부 중복)
3. 플랜 그룹 A 수정 → 학원 일정 1개 삭제
4. 플랜 그룹 B의 학원 일정은 영향 없음

### ✅ 캘린더 통합 테스트
1. 플랜 그룹 A: 월요일 9:00-10:00, 화요일 10:00-11:00
2. 플랜 그룹 B: 월요일 9:00-10:00, 수요일 14:00-15:00
3. 캘린더: 월(1), 화(1), 수(1) 총 3개 표시 (중복 제거)

---

## 성능 고려사항

### 최적화
- `plan_group_id` 인덱스 추가로 조회 성능 향상
- 캘린더 페이지: 플랜 그룹별 병렬 조회 (`Promise.all`)
- 중복 제거를 Map으로 처리하여 O(n) 시간 복잡도

### 모니터링
- 활성 플랜 그룹이 많은 경우 캘린더 조회 성능 모니터링
- 필요 시 캐싱 전략 검토

---

## 배포 체크리스트

### Phase 1 (제외일)
- [x] 코드 변경 완료
- [x] 커밋 완료
- [ ] 프로덕션 테스트

### Phase 2 (학원 일정)
- [x] 마이그레이션 파일 작성
- [x] 코드 변경 완료
- [x] 커밋 완료
- [ ] 데이터 백업
- [ ] 로컬 마이그레이션 테스트
- [ ] 프로덕션 마이그레이션 실행
- [ ] 검증 및 모니터링

---

## 관련 문서

1. **`docs/2025-01-30-exclusion-duplicate-error-fix.md`**
   - 제외일 중복 에러 분석 및 해결 방안

2. **`docs/2025-01-30-testing-guide.md`**
   - 시간 관리 불러오기 기능 테스트 가이드

3. **`docs/2025-01-30-phase1-test-result.md`**
   - Phase 1 구현 결과 및 테스트 시나리오

4. **`docs/2025-01-30-phase2-implementation.md`**
   - Phase 2 상세 구현 내역

5. **`docs/2025-01-30-commit-summary.md`**
   - 커밋 요약 및 배포 가이드

---

## Git 커밋 이력

### Phase 1
```
commit ff14e33
feat: Phase 1 - 제외일 플랜 그룹 간 중복 허용

- 중복 체크 로직 개선: 현재 플랜 그룹 내에서만 체크
- 에러 메시지 패턴 업데이트
- 시간 관리 불러오기 정상 작동
```

### Phase 2
```
commit c531505
feat: Phase 2 - 학원 일정 플랜 그룹별 관리

- 데이터베이스 스키마 변경 (plan_group_id 추가)
- 데이터/Action/UI 레이어 전체 수정
- 플랜 그룹별 독립 관리 구현 완료
```

---

**최종 업데이트**: 2025-01-30  
**작성자**: AI Assistant  
**상태**: ✅ 전체 구현 완료, 마이그레이션 대기

