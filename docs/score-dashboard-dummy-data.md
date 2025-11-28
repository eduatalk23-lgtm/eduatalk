# 성적 대시보드 API 테스트용 더미 데이터 가이드

## 📋 개요

이 문서는 성적 분석 + 수시/정시 전략 대시보드 API (`GET /api/students/:id/score-dashboard`)를 검증하기 위한 더미 데이터 생성 및 테스트 방법을 설명합니다.

---

## 🎯 생성되는 더미 데이터 패턴

### 학생 A - 정시 우위 (MOCK_ADVANTAGE)

**설계 목표**: 모의고사 성적이 내신 환산 백분위보다 +10 이상 높게

- **내신 성적**:
  - 전체 GPA: 약 3.0 (중간 정도)
  - 등급 분포: 대부분 3등급, 일부 4등급
  - 예상 내신 환산 백분위: 약 70

- **모의고사 성적**:
  - 평균 백분위: 약 85
  - 국어/수학/탐구(상위2) 평균 백분위: 84~87
  - 차이: +15 (모의고사가 내신보다 높음)

- **기대 전략 결과**: `strategyResult.type = "MOCK_ADVANTAGE"`

### 학생 B - 수시 우위 (INTERNAL_ADVANTAGE)

**설계 목표**: 내신 성적이 모의고사 평백보다 -10 이하로 낮게

- **내신 성적**:
  - 전체 GPA: 약 1.8 (상위권)
  - 등급 분포: 대부분 2등급, 일부 1등급
  - 예상 내신 환산 백분위: 약 85

- **모의고사 성적**:
  - 평균 백분위: 약 65
  - 국어/수학/탐구(상위2) 평균 백분위: 63~67
  - 차이: -20 (내신이 모의고사보다 높음)

- **기대 전략 결과**: `strategyResult.type = "INTERNAL_ADVANTAGE"`

### 학생 C - 균형형 (BALANCED)

**설계 목표**: 내신 환산 백분위와 모의고사 평백 차이가 -5 ~ +5 사이

- **내신 성적**:
  - 전체 GPA: 약 2.5
  - 등급 분포: 2등급과 3등급 혼합
  - 예상 내신 환산 백분위: 약 80

- **모의고사 성적**:
  - 평균 백분위: 약 78
  - 국어/수학/탐구(상위2) 평균 백분위: 76~80
  - 차이: -2 (거의 비슷)

- **기대 전략 결과**: `strategyResult.type = "BALANCED"`

---

## 📊 각 학생별 실제 데이터

### 학생 A (정시 우위)

| 항목 | 값 |
|------|-----|
| 이름 | 더미학생A_정시우위 |
| 내신 GPA | 약 3.0 |
| 내신 환산 백분위 | 약 70 (예상) |
| 모의고사 평백 | 약 85 |
| 차이 (mock - internal) | +15 |
| 최종 전략 | MOCK_ADVANTAGE |

### 학생 B (수시 우위)

| 항목 | 값 |
|------|-----|
| 이름 | 더미학생B_수시우위 |
| 내신 GPA | 약 1.8 |
| 내신 환산 백분위 | 약 85 (예상) |
| 모의고사 평백 | 약 65 |
| 차이 (mock - internal) | -20 |
| 최종 전략 | INTERNAL_ADVANTAGE |

### 학생 C (균형형)

| 항목 | 값 |
|------|-----|
| 이름 | 더미학생C_균형형 |
| 내신 GPA | 약 2.5 |
| 내신 환산 백분위 | 약 80 (예상) |
| 모의고사 평백 | 약 78 |
| 차이 (mock - internal) | -2 |
| 최종 전략 | BALANCED |

---

## 🚀 사용 방법

### 1. 마이그레이션 실행

더미 데이터 태깅을 위한 컬럼 추가:

```bash
# Supabase Studio → SQL Editor에서 실행
# 또는 Supabase CLI 사용
supabase db push
```

필요한 마이그레이션:
- `supabase/migrations/20251201000002_add_notes_to_score_tables.sql`

### 2. 더미 데이터 생성

**TypeScript 스크립트 사용 (권장)**:

```bash
npm run seed:score-dashboard-dummy
```

**SQL 파일 사용**:

```sql
-- sql/seed_score_dashboard_dummy.sql (필요시 작성)
-- Supabase Studio → SQL Editor에서 실행
```

**출력 예시**:

```
📌 더미학생A_정시우위 (MOCK_ADVANTAGE)
   Student ID: abc123...
   Tenant ID: def456...
   Term ID: ghi789...
   API URL: http://localhost:3000/api/students/abc123.../score-dashboard?tenantId=def456...&termId=ghi789...
```

### 3. API 테스트

**명령줄에서 직접 테스트**:

```bash
npm run test:score-dashboard <studentId> <tenantId> <termId>
```

**예시**:

```bash
npm run test:score-dashboard abc123... def456... ghi789...
```

**브라우저에서 테스트**:

```
http://localhost:3000/api/students/{studentId}/score-dashboard?tenantId={tenantId}&termId={termId}
```

### 4. 더미 데이터 삭제

**TypeScript 스크립트 사용 (권장)**:

```bash
npm run cleanup:score-dashboard-dummy
```

**SQL 파일 사용**:

```bash
# Supabase Studio → SQL Editor에서 실행
# 또는 Supabase CLI 사용
supabase db execute -f sql/cleanup_score_dashboard_dummy.sql
```

---

## 📝 스크립트 상세 설명

### seedScoreDashboardDummy.ts

**기능**:
- 필요한 메타데이터 자동 조회 (테넌트, 교육과정, 교과, 과목 등)
- 학생 A/B/C 생성
- 각 학생의 내신 성적 및 모의고사 성적 생성
- 모든 데이터에 `DUMMY_SCORE_TEST` 태그 추가

**생성 데이터**:
- `students`: 3명
- `student_terms`: 3개 (각 학생당 1개)
- `student_internal_scores`: 15개 (각 학생당 5과목)
- `student_mock_scores`: 15개 (각 학생당 5과목)

### cleanupScoreDashboardDummy.ts

**기능**:
- `DUMMY_SCORE_TEST` 태그가 있는 모든 더미 데이터 삭제
- 삭제 순서: 내신 성적 → 모의고사 성적 → 학생 학기 → 학생

### testScoreDashboard.ts

**기능**:
- API 호출 및 응답 출력
- 내신 분석, 모의고사 분석, 전략 분석 결과 확인

---

## 🔍 태깅 규칙

모든 더미 데이터는 다음 태그로 식별됩니다:

- `students.memo = 'DUMMY_SCORE_TEST'`
- `student_terms.notes = 'DUMMY_SCORE_TEST'`
- `student_internal_scores.notes = 'DUMMY_SCORE_TEST'`
- `student_mock_scores.notes = 'DUMMY_SCORE_TEST'`

이 태그 하나로 모든 더미 데이터를 식별하고 삭제할 수 있습니다.

---

## ⚠️ 주의사항

1. **실제 데이터와 충돌 방지**: 더미 데이터는 명확한 태그로 구분되므로 실제 데이터와 충돌하지 않습니다.

2. **마이그레이션 필수**: 더미 데이터 생성 전에 `20251201000002_add_notes_to_score_tables.sql` 마이그레이션을 실행해야 합니다.

3. **메타데이터 필요**: 더미 데이터 생성 시 다음 메타데이터가 필요합니다:
   - 최소 1개의 테넌트
   - 교육과정 개정 (2015개정 또는 2022개정)
   - 교과 그룹 (국어, 수학, 영어, 사회, 과학)
   - 과목 구분 (공통, 일반선택)
   - 각 교과 그룹의 최소 1개 과목

4. **테스트 환경 권장**: 프로덕션 환경에서는 더미 데이터 생성/삭제를 주의해서 사용하세요.

---

## 📚 관련 파일

- **마이그레이션**: `supabase/migrations/20251201000002_add_notes_to_score_tables.sql`
- **생성 스크립트**: `scripts/seedScoreDashboardDummy.ts`
- **삭제 스크립트**: `scripts/cleanupScoreDashboardDummy.ts`
- **테스트 스크립트**: `scripts/testScoreDashboard.ts`
- **SQL 삭제 파일**: `sql/cleanup_score_dashboard_dummy.sql`
- **API 엔드포인트**: `app/api/students/[id]/score-dashboard/route.ts`

---

## 🎯 검증 체크리스트

더미 데이터 생성 후 다음을 확인하세요:

- [ ] 학생 A의 `strategyResult.type`이 `"MOCK_ADVANTAGE"`인가?
- [ ] 학생 B의 `strategyResult.type`이 `"INTERNAL_ADVANTAGE"`인가?
- [ ] 학생 C의 `strategyResult.type`이 `"BALANCED"`인가?
- [ ] 내신 분석 결과 (GPA, Z-Index)가 정상적으로 계산되는가?
- [ ] 모의고사 분석 결과 (평백, 표준점수 합, 등급 합)가 정상적으로 계산되는가?
- [ ] 전략 분석 메시지가 적절한가?

---

**마지막 업데이트**: 2025-12-01

