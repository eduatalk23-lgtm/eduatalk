# 탐구 가이드 매칭 Phase 2 구현 계획

**작성일**: 2026-04-09
**상태**: 설계 확정, 착수 대기
**선행 작업**: Phase 1 (topic_exploration 151건 재분류) 완료

## 1. 배경 및 목표

### 1.1 문제 정의

김세린 학생(3학년 설계 학년, 물리·천문 지망) 케이스에서 확인된 버그:
- 파이프라인이 완료 상태로 찍혔는데 탐구 가이드 배정 0건
- Layer View의 "탐구 가이드" 레이어가 설계 학년 세특/창체/행특에 아무것도 표시 안 함

### 1.2 루트 원인 (확인됨)

1. **Phase 순서 버그**: `guide_matching`(S2)이 `course_recommendation`(S3)보다 먼저 실행됨. 김세린은 첫 파이프라인 실행 시 `student_course_plans`가 비어 있는 상태에서 guide_matching이 돌아 0건 반환
2. **구조적 갭**:
   - 창체(자율/동아리/진로) 영역용 가이드 유형 부재
   - 창체 slot auto-link 누락 (setek만 지원)
   - 행특 ↔ 탐구 가이드 연결 trace 없음
   - 기존 가이드 풀에서 벗어나는 맞춤 가이드 생성 경로 없음
   - 동아리 12계열 연속성 검증 부재
3. **데이터 갭**:
   - topic_exploration 151건이 subject_mapping 0건으로 파이프라인 매칭에서 제외 (Phase 1에서 해결)
   - 학교 공통 교육프로그램 목록 미구조화 (자율 가이드 few-shot 부재)

### 1.3 목표

Phase 2 완료 시점에 김세린 학생의 Layer View에서:
- **세특 5개** 전체에 가이드 매칭 (기존 풀 + 벡터 + 필요 시 AI 생성)
- **창체 3영역**(자율/동아리/진로) 각각에 적합한 신규 유형 가이드 매칭
- **행특** 셀에 "리더십 근거 가이드 N개" 토글 표시
- 파이프라인 재실행 시 이 모든 것이 자동으로 채워짐

## 2. 5개 의사결정 요약

| # | 결정 | 확정안 |
|---|---|---|
| 1 | topic_exploration 151건 재분류 | Phase 1 완료 — setek 54 / autonomy 55 / club 19 / career 23 |
| 2 | 기존 풀 재활용 vs AI 생성 | 옵션 C Hybrid — 풀 → 벡터 → 조건부 AI 생성 폭포수 |
| 3 | 행특 ↔ 창체 가이드 연계 | 옵션 B 사후 링크 테이블 + Gemini Flash 매칭 |
| 4 | 학교 공통 교육프로그램 | 옵션 A 하드코딩 상수 (school-programs.ts) |
| 5 | 동아리 12계열 연속성 | 옵션 D Smart Reranking (곱셈 가중치 0.5~1.0) |

세부 파라미터는 원 논의 기록 참조.

## 3. 구현 범위

### 3.1 카테고리 A — DB 스키마 (마이그레이션 2~3개)

**마이그레이션 #1**: guide_type 확장 + activity_mappings 테이블
```sql
-- exploration_guides.guide_type CHECK 확장
-- (현재: reading/topic_exploration/subject_performance/experiment/program)
-- (추가: reflection_program/club_deep_dive/career_exploration_project)

-- 신규 테이블
CREATE TABLE exploration_guide_activity_mappings (
  guide_id uuid REFERENCES exploration_guides(id) ON DELETE CASCADE,
  activity_type text CHECK (activity_type IN ('autonomy','club','career')),
  PRIMARY KEY (guide_id, activity_type)
);
```

**마이그레이션 #2**: 행특 ↔ 탐구 가이드 링크 테이블
```sql
CREATE TABLE student_record_haengteuk_guide_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  haengteuk_guide_id uuid REFERENCES student_record_haengteuk_guides(id) ON DELETE CASCADE,
  evaluation_item text NOT NULL,  -- '자기주도성', '리더십' 등
  exploration_guide_assignment_id uuid REFERENCES exploration_guide_assignments(id) ON DELETE CASCADE,
  relevance_score numeric(3,2),
  reasoning text,
  source text DEFAULT 'ai' CHECK (source IN ('ai','consultant')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (haengteuk_guide_id, evaluation_item, exploration_guide_assignment_id)
);
-- RLS: 관리자/컨설턴트만
```

**마이그레이션 #3**: Phase 1 tentative_* 컬럼 승격 후 DROP (Wave 2 이후 실행)

### 3.2 카테고리 B — guide 도메인

**B1. `lib/domains/guide/section-config.ts` 확장**
- 3종 신규 guide_type에 대한 섹션 정의 추가
- `reflection_program`: 학교프로그램 개요 → 적용 교과 이론 → 사회 동향 분석 → 인문학적 성찰 → 공동체 기여
- `club_deep_dive`: 주제 → 지속성 기록 → 탐구 설계 → 협업 과정 → 산출물 → 심화 방향
- `career_exploration_project`: 관심 분야 → 자기주도 조사 → 진로 계획 구체화 → 학과·직업 연계

**B2. `lib/domains/student-record/evaluation-criteria/school-programs.ts` 신규**
```typescript
export interface SchoolCommonProgram {
  code: string;
  name: string;
  category: "legal" | "community" | "career" | "safety";
  description: string;
  relatedCompetencies: CompetencyItemCode[];
  exampleThemes: string[];
  academicHooks: string[];
}

export const SCHOOL_COMMON_PROGRAMS: readonly SchoolCommonProgram[] = [
  // 12~15개 프로그램
];
```

**B3. 신규 프롬프트 3개**
- `lib/domains/guide/llm/prompts/reflection-program.ts` — 학교프로그램 few-shot 주입
- `lib/domains/guide/llm/prompts/club-deep-dive.ts` — 지속성 + 계열 연속성 강조
- `lib/domains/guide/llm/prompts/career-exploration-project.ts` — 자기주도 조사 강조

**B4. `auto-recommend.ts` 확장**
- activity_type 매칭 분기 추가 (신규 `exploration_guide_activity_mappings` 사용)
- `input`에 `activityType?: "autonomy"|"club"|"career"` 파라미터 추가

**B5. `area-resolver.ts` 수정**
- `targetActivityType: null` 하드코딩 제거
- guide_type → activity_type 자동 추론 + activity_mappings 조회

### 3.3 카테고리 C — 12계열 분류 & 연속성 엔진

**C1. `lib/domains/student-record/evaluation-criteria/club-lineage.ts`**
```typescript
export type Lineage12 =
  | "humanities" | "languages" | "social_science" | "commerce"  // 문과 4
  | "natural_science" | "engineering" | "medical" | "health"    // 이과 6
  | "life_science" | "agriculture"
  | "arts_sports" | "education";                                 // 기타 2

export const LINEAGE_12_DEFINITIONS: Record<Lineage12, {
  label: string;
  track: "humanities" | "science" | "other";
  keywords: string[]; // 동아리 이름 매칭용
}> = { ... };

// 기존 8 career_fields → 12계열 매핑
export const CAREER_FIELD_TO_LINEAGE_12: Record<string, Lineage12[]> = { ... };
```

**C2. `classifyClubByName(name: string): Lineage12 | null`**
- 동아리 이름 keyword 매칭으로 12계열 추론
- 매칭 실패 시 null 반환 (중립 처리)

**C3. `computeClubContinuityScore()`**
- 입력: 학생의 `changche[activity_type=club]` 히스토리 + 추천 후보 가이드의 lineage
- 전환 규칙:
  - 1→2학년: 문·이과 전환 OK (score 0.85)
  - 2→3학년: 같은 계열만 (불일치 시 0.5, 같으면 1.0)
- 히스토리 없으면 1.0 (중립)
- 전학생/1학년도 1.0

### 3.4 카테고리 D — record-analysis 파이프라인 (핵심)

**D1. `runGuideMatching` 3단계 폭포수 구조 (phase-s2-edges.ts:145)**
```
1. 풀 매칭 (classification + subject + activity_type)
   ↓ (결과가 N건 이상이면 종료)
2. 벡터 검색 fallback
   ↓ (여전히 부족하면)
3. AI 생성 (조건 만족 시): 설계 학년 + storyline 존재 + 매칭 < 3건
```

**D2. Phase 순서 버그 수정**
- 옵션: `runGuideMatching` 내부에서 `refreshCoursePlanData(ctx)` 선호출 추가
- 또는 pipeline-config.ts의 phase 순서에서 `guide_matching`을 `course_recommendation` 이후로 이동
- **권장**: refresh 방식 (phase 순서 변경은 다른 의존성에 영향)

**D3. 창체 slot auto-link 확장**
- phase-s2-edges.ts:222-235에 `changche` 분기 추가
- area.targetActivityType 있으면 `student_record_changche`에서 `activity_type` 매칭으로 slot 찾아 `linked_record_type="changche"` 링크

**D4. 12계열 연속성 점수 통합**
- `runGuideMatching`의 sort 단계에서 `finalScore = matchScore × continuityScore`
- 학생의 club 히스토리를 한 번 조회, 후보 가이드마다 score 계산

**D5. `runHaengteukGuideLinking` 신규 task**
- 위치: Synthesis Phase 2 내부, guide_matching 완료 후
- 동작: Gemini Flash 1회로 8 evaluation items × N assignments 매칭
- 결과: `student_record_haengteuk_guide_links` insert

**D6. AI 가이드 생성 연동**
- `generateGuideCore`(from guide 도메인)을 동적 import로 호출
- 트리거: D1의 Step 3 조건 충족 시
- storyline/보완방향/설계방향을 프롬프트 컨텍스트로 주입
- 생성물은 `status='pending_approval'` + `student_id` (학생 전용)
- 컨설턴트 승인 시 `student_id = null` + `status='approved'`로 공용 풀 승격 (후속 작업)

**D7. 0건 결과 idempotency 재고**
- `runGuideMatching` 결과가 0건이고 `ctx.coursePlanData` 부재 시: `tasks.guide_matching = "pending"` 유지 (재시도 가능)
- 현재는 0건도 completed로 찍혀서 재실행 시 스킵되는 버그가 있음

### 3.5 카테고리 E — UI (Layer View)

**E1. 행특 셀 "근거 가이드" 토글**
- 컴포넌트: `HaengteukGuideLinkDropdown.tsx`
- 8개 evaluationItem 각각에 관련 가이드 목록
- 컨설턴트 모드: add/remove/reasoning 편집 가능

**E2. 가이드 카드에 12계열 연속성 배지**
- 녹색 ✅ "계열 연속 — 이과/공학"
- 황색 ⚠️ "계열 불연속 — 2→3학년 규칙 위반"
- 회색 "이력 없음 — 중립"

**E3. AI 생성 가이드 승인 큐 (관리자 페이지)**
- 새 페이지: `/admin/guides/pending-approval`
- 목록: `status='pending_approval' AND student_id IS NOT NULL`
- 액션: 승인 (→ 공용 승격) / 거부 (→ archived)
- 24h 초과 시 알림

### 3.6 카테고리 F — Phase 1 완료 작업

**F1. `scripts/apply-topic-exploration-reclassification.ts`**
- `tentative_guide_type`이 있는 가이드의 `guide_type`을 실제로 변경
- `tentative_activity_type`이 있으면 `exploration_guide_activity_mappings` 에 insert
- 완료 후 `tentative_*` 컬럼 값 전부 NULL로 클리어

**F2. 마이그레이션 #3**: `tentative_*` 컬럼 DROP

## 4. 실행 순서 (Wave 기반)

### Wave 1 — 기초 데이터 (병렬, ~0.5일)
- [ ] A1 마이그레이션 #1 (guide_type 확장 + activity_mappings)
- [ ] A2 마이그레이션 #2 (haengteuk_guide_links)
- [ ] B2 school-programs.ts 상수
- [ ] C1 club-lineage.ts 상수

**종속성**: 없음

### Wave 2 — Phase 1 완결 (~0.5일)
- [ ] F1 apply-topic-exploration-reclassification.ts 작성 + 실행
- [ ] B1 section-config.ts 3종 섹션 추가
- [ ] A3 마이그레이션 #3 (tentative_* DROP)

**종속성**: Wave 1 완료

### Wave 3 — 가이드 도메인 확장 (~1.5일)
- [ ] B3 3종 신규 프롬프트
- [ ] B4 auto-recommend.ts activity_type 분기
- [ ] B5 area-resolver.ts 하드코딩 제거
- [ ] C2 classifyClubByName()
- [ ] C3 computeClubContinuityScore()

**종속성**: Wave 1 완료

### Wave 4 — 파이프라인 대수술 (~2.5일)
- [ ] D2 Phase 순서 버그 fix (refreshCoursePlanData 선호출)
- [ ] D1 runGuideMatching 3단계 폭포수
- [ ] D3 창체 slot auto-link
- [ ] D4 12계열 연속성 통합
- [ ] D5 runHaengteukGuideLinking 신규 task
- [ ] D6 AI 가이드 생성 연동
- [ ] D7 0건 idempotency 재고

**종속성**: Wave 3 완료

### Wave 5 — UI (~2일)
- [ ] E1 행특 셀 근거 가이드 토글
- [ ] E2 12계열 연속성 배지
- [ ] E3 AI 가이드 승인 큐

**종속성**: Wave 4 API 확정

### Wave 6 — 검증 (~1일)
- [ ] 김세린 end-to-end 회귀 테스트
- [ ] `__tests__/pipeline-phase-s2-edges.test.ts` snapshot 업데이트
- [ ] 신규 태스크 테스트 작성 (runHaengteukGuideLinking, classifyClubByName 등)

**총 공수**: ~8일 (풀타임)

## 5. 리스크 및 완화

| 리스크 | 영향 | 완화 |
|---|---|---|
| Phase 순서 변경이 다른 phase 의존에 영향 | 고 | `refreshCoursePlanData(ctx)` 선호출 방식 선호 — 순서 유지 |
| 8→12 계열 매핑 품질 | 중 | 초기 penalty 범위 0.7~1.0 (완만) 후 데이터 보고 튜닝 |
| AI 가이드 승인 큐 체증 | 중 | Q2-1 트리거 조건 보수적 유지, 24h 초과 시 알림 |
| 기존 snapshot 테스트 깨짐 | 중 | Wave 4 전에 snapshot 업데이트 계획 |
| RLS 누락으로 행특 링크 조회 실패 | 중 | 마이그레이션 #2에 RLS 정책 포함 필수 |
| `generateGuideCore` 의존성 무겁다 | 저 | 동적 import 사용 (record-analysis에서 guide 도메인 서버 전용 코드 로드) |

## 6. 성공 기준

Phase 2 완료 후 김세린 파이프라인 재실행 시:

1. `runGuideMatching` 결과: 세특 5개 영역 × 각 3건 이상 + 창체 자율/동아리/진로 각 2건 이상 = **총 18건 이상 배정**
2. `student_record_haengteuk_guide_links`: 3학년 행특 8개 평가항목 중 **최소 5개 항목**에 연결된 탐구 가이드 존재
3. Layer View:
   - "탐구 가이드" 레이어에서 세특/창체 각 셀에 카드 렌더링
   - 행특 셀에 "🔗 근거 가이드 N개" 토글 동작
   - 12계열 연속성 배지 표시
4. AI 생성 가이드: 최소 1건이 `pending_approval` 상태로 생성 (storyline 기반)
5. 재실행 시 모든 데이터 idempotent하게 재생성 (cleanup cascade 정상 동작)

## 7. 관련 문서

- `lib/domains/record-analysis/CLAUDE.md` — 파이프라인 규칙 (Phase 구조, LLM Actions, DB 테이블)
- `lib/domains/guide/CLAUDE.md` — 가이드 도메인 규칙 (벡터 검색, 섹션 설정, 품질 티어)
- `docs/student-record-blueprint.md` — 파이프라인 시각화 다이어그램
- `lib/domains/student-record/evaluation-criteria/defaults.ts` — CHANGCHE_ACTIVITY_CONFIGS, HAENGTEUK_EVAL_ITEMS

## 8. 변경 이력

- 2026-04-09 — Phase 1 완료, 5개 의사결정 확정, Phase 2 계획 문서 최초 작성
