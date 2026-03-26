# 우회학과 데이터 갱신 체계 설계

> 작성일: 2026-03-26 | 상태: 설계 완료, 미구현

## 1. 현황

| 데이터 | 건수 | 출처 | 최초 생성 | 갱신 주기 |
|--------|------|------|----------|----------|
| 학과 정보 | 3,658 (46개 대학) | 탐구DB_ver2_4.accdb | 2026-03-20 | **없음** |
| 교육과정 | 44,375 | Access DB + enrichment 16개 | 2026-03-20 | enrichment만 stale_at 180일 |
| 분류 코드 | 191 | KEDI 분류 | 2026-03-20 | **없음** |
| 사전매핑 페어 | 5 | Access DB | 2026-03-20 | **없음** |

### 문제점
- 대학 학과는 매년 신설/폐과/통합/명칭 변경 발생
- 교육과정은 매 학기 변경
- 1회 임포트 후 정적 데이터로 운영 중
- 갱신 메커니즘 부재

---

## 2. 핵심 원칙

```
1. 삭제하지 않는다 — soft-delete + 비활성화
2. 기존 분석 결과를 보호한다 — FK 무결성 유지
3. 축적된 피드백/enrichment를 보존한다 — 갱신 시 유실 방지
4. 변경을 감지하고 알린다 — diff 기반, 무효화 표시
```

---

## 3. 갱신 시 위험 & 대응

| 위험 | 시나리오 | 대응 |
|------|---------|------|
| FK 깨짐 | 학과 삭제 → candidates/feedback FK 위반 | soft-delete (is_active=false), 물리 삭제 금지 |
| Enrichment 유실 | 학과 교체 → 웹검색 교육과정 삭제 | 학과 교체가 아닌 버전 관리, prev_department_id 연결 |
| 분석 결과 무효화 | 교육과정 변경 → 기존 유사도 점수 부정확 | candidates에 stale 플래그 + UI 재분석 안내 |
| 피드백 분리 | 학과명 변경 → 피드백 패턴 미매칭 | prev_department_id로 피드백 상속 |
| 중복 생성 | 동일 학과가 다른 ID로 재임포트 | 대학명+학과명 복합 유니크 키로 diff |

---

## 4. DB 스키마 변경

### 4-1. university_departments 확장

```sql
ALTER TABLE university_departments
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN data_year INTEGER,              -- 데이터 기준 연도 (예: 2026)
  ADD COLUMN prev_department_id UUID         -- 통합/명칭변경 시 이전 학과 참조
    REFERENCES university_departments(id) ON DELETE SET NULL,
  ADD COLUMN deactivated_at TIMESTAMPTZ,     -- soft-delete 시각
  ADD COLUMN deactivation_reason TEXT;       -- 폐과/통합/명칭변경

CREATE INDEX idx_ud_is_active ON university_departments(is_active) WHERE is_active = true;
CREATE INDEX idx_ud_data_year ON university_departments(data_year);
```

### 4-2. bypass_major_candidates stale 플래그

```sql
ALTER TABLE bypass_major_candidates
  ADD COLUMN is_stale BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN stale_reason TEXT;              -- "교육과정 갱신됨" 등
```

### 4-3. department_refresh_log (갱신 이력)

```sql
CREATE TABLE department_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_year INTEGER NOT NULL,
  source TEXT NOT NULL,                      -- 'university_info_api' | 'manual_csv' | 'kedi'
  summary JSONB NOT NULL,                    -- { added: 15, deactivated: 3, renamed: 2, curriculum_refreshed: 50 }
  executed_by UUID REFERENCES user_profiles(id),
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## 5. 갱신 파이프라인

### 5-1. 학과 정보 연간 갱신 (3월, 신학기)

```
입력: 신규 연도 데이터 (대학알리미 CSV / 한국교육개발원 API)
  ↓
Step 1: Diff 생성
  - 신규 CSV의 (대학명, 학과명) vs 기존 DB
  - 분류: NEW / MATCH / MISSING_IN_NEW / NAME_CHANGED
  ↓
Step 2: 변경 적용
  - NEW → INSERT (is_active=true, data_year=신규연도)
  - MATCH → UPDATE data_year (학과명/분류 변경 시 함께 업데이트)
  - MISSING_IN_NEW → soft-delete (is_active=false, deactivated_at, reason='폐과 추정')
  - NAME_CHANGED → INSERT 신규 + prev_department_id = 기존 ID + 기존 soft-delete
  ↓
Step 3: 연쇄 처리
  - 비활성화된 학과의 candidates → is_stale=true, stale_reason="학과 비활성화"
  - 명칭변경 학과 → 피드백 패턴 상속 (prev_department_id 기준)
  ↓
Step 4: 검증 리포트 생성
  - 추가/비활성화/명칭변경 건수
  - FK 무결성 확인
  - 컨설턴트 알림 (대시보드 또는 이메일)
```

### 5-2. 교육과정 주기적 갱신 (6개월, stale 기반)

```
트리거: stale_at < now() 인 department_curriculum 행 존재
  ↓
Step 1: stale 학과 식별
  - SELECT DISTINCT department_id FROM department_curriculum WHERE stale_at < now()
  ↓
Step 2: Re-enrichment 실행
  - enrichDepartmentsBatch(staleIds, { forceRefresh: true, maxTier: 3 })
  - 기존 데이터: 새 데이터의 confidence가 더 높으면 교체, 아니면 유지
  ↓
Step 3: 연쇄 처리
  - 교육과정이 변경된 학과 → 관련 candidates에 is_stale=true
  ↓
Step 4: 갱신 로그 기록
  - department_refresh_log에 summary 저장
```

### 5-3. 분류 코드 갱신 (필요 시, 수동)

```
빈도: 교육부 KEDI 분류 체계 변경 시 (2~3년 주기)
방식: 수동 CSV 임포트
주의: mid_classification 변경 시 → 피드백 패턴 재매핑 필요
```

---

## 6. 갱신 주기 정리

| 데이터 | 주기 | 트리거 | 방식 |
|--------|------|--------|------|
| 학과 정보 | **연 1회** (3월) | 수동 + 배치 스크립트 | diff-based import |
| 교육과정 (import) | **연 1회** | Access DB 재임포트 시 | CSV diff |
| 교육과정 (enrichment) | **6개월 자동** | stale_at 만료 | re-enrichment 배치 |
| 분류 코드 | **필요 시** | KEDI 변경 | 수동 CSV |
| 사전매핑 페어 | **반기 1회** | 피드백 축적 기반 제안 | 수동 검토 + 자동 제안 |

---

## 7. UI 알림 체계

### 컨설턴트 대시보드

```
[알림] 2026년 학과 데이터가 갱신되었습니다
- 신설: 15개 학과 (서울대 데이터사이언스학부 외 14개)
- 폐과: 3개 학과
- 명칭변경: 2개 학과
→ 기존 분석 결과 중 5건이 재분석이 필요합니다 [재분석 실행]
```

### 우회학과 후보 목록

```
[경고 뱃지] 이 후보의 교육과정이 갱신되었습니다. 재분석을 권장합니다.
→ [재분석] 버튼 클릭 → 해당 후보만 재계산
```

---

## 8. 배치 스크립트 설계

### scripts/bypass-dept-refresh.ts

```
사용법:
  npx tsx scripts/bypass-dept-refresh.ts --dry-run        # diff만 확인
  npx tsx scripts/bypass-dept-refresh.ts --csv=data.csv   # CSV 기반 갱신
  npx tsx scripts/bypass-dept-refresh.ts --stale           # stale 교육과정 재수집
  npx tsx scripts/bypass-dept-refresh.ts --report          # 갱신 현황 리포트

옵션:
  --dry-run     실제 DB 변경 없이 diff 결과만 출력
  --year=2027   갱신 대상 연도 (기본: 현재)
  --force       stale_at 무시하고 강제 재수집
```

---

## 9. 데이터 소스 후보

| 소스 | 내용 | 접근 방식 |
|------|------|----------|
| **대학알리미** (academyinfo.go.kr) | 전체 대학 학과 목록 | 공개 데이터, CSV 다운로드 |
| **한국교육개발원 (KEDI)** | 학과 분류 체계 | 공공 API |
| **대학 홈페이지** | 교육과정 상세 | enrichment (웹검색) |
| **대입정보포털 (adiga.kr)** | 모집단위, 전형 정보 | 크롤링 필요 |
| **Access DB 재수집** | 탐구DB 신버전 | 수동 임포트 |

---

## 10. 구현 우선순위

| 순위 | 항목 | 효과 | 난이도 |
|------|------|------|--------|
| 1 | DB 스키마 변경 (is_active, data_year, is_stale) | 갱신 인프라 기반 | 낮음 |
| 2 | stale 교육과정 자동 re-enrichment 배치 | 교육과정 자동 최신화 | 낮음 (배치 스크립트 이미 있음) |
| 3 | 학과 diff 임포트 스크립트 | 연간 갱신 실행 | 중간 |
| 4 | candidates stale 감지 + UI 경고 | 컨설턴트 알림 | 중간 |
| 5 | 대학알리미 데이터 자동 수집 | 수동 작업 제거 | 높음 |
