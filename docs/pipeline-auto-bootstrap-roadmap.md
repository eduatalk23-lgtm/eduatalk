# Auto-Bootstrap Roadmap — 파이프라인 자기 기동 설계

**상태**: Phase 1 구현 완료 (2026-04-18)
**목적**: `target_major` 설정만으로 파이프라인이 자기 기동 (AI-first initiation, consultant-refinement)
**대상**: `runFullOrchestration`, Blueprint/Grade/Synthesis 파이프라인 전체

---

## 1. 배경 — 발견된 결함

### 1.1 문제의 실체
cross-run 측정(xrun)을 시작하며 발견: `target_major` 만 설정된 학생에 대해 파이프라인이 **겉으로는 "성공"** 으로 완주하지만 **실제 산출물은 전부 빈 상태**였다.

원인 조사 결과 세 가지 선결 조건이 암묵적 전제로 남아 있었고, 파이프라인은 이를 **silent fallback** 으로 통과시키며 실패를 감추고 있었다.

| 누락 | 파이프라인 반응 | 관측자가 알 수 있었나 |
|------|---------------|-------------------|
| `target_major` 가 비표준 문자열 (예: "데이터사이언스/통계") | `getMajorRecommendedCourses` 가 null fallback → 2/3학년 추천 0건 | 아니오 |
| `student_course_plans` 0건 | `generateProspectiveSetekGuide` 가 `success: false` 반환하지만 태스크는 "완료" 처리 | 아니오 |
| `student_main_explorations` (active) 0건 | Blueprint B1 이 조기 리턴(`"활성 메인 탐구 없음"` preview string) → task "completed" + convergences=0 | 아니오 |

### 1.2 설계 철학 불일치
현재 구조는 **"컨설턴트가 사전에 UI에서 셋업한 학생"** 을 암묵적 전제로 한다.
- `course_recommendation` 태스크는 Synthesis Phase 3 에 있지만, Grade 파이프라인의 P4 `setek_guide` 가 이미 `course_plan` 을 전제로 함 → 순서 상충
- `main_exploration` 자동 생성 경로는 아예 존재하지 않음 — `createMainExploration` 호출자는 `regenerate` API (컨설턴트 수동) / repository / seed 스크립트뿐
- 파이프라인은 이 수동 셋업 없이 돌리면 "조용히 빈 산출물" 을 낸다

### 1.3 철학 전환 결정
사용자 지시에 따라 다음으로 전환:

> **"AI-first initiation, consultant-refinement"** —
> `target_major` 만 설정되면 파이프라인이 스스로 부트스트랩한다.
> 컨설턴트는 AI 초안을 검수·수정할 뿐, 셋업 자체의 책임을 지지 않는다.

---

## 2. 최종 목표 (타협 없는 완전체)

### 2.1 핵심 결정 — R1/R2/R3

각 결정은 **품질·일관성 우선**, 단기 편의·유연성은 감수.

#### R1. Phase 0 실패 시 UX — **Hard Fail + 견고한 재시도**
- LLM 실패 시 `status='failed'` + UI "재시도" 버튼
- Rule-based 템플릿 fallback 은 **컨설턴트/학생을 기만** → 채택 안 함
- `withExtendedRetry` (1s → 10s → 1분 → 5분 → 15분, 5회) 로 Rate limit 분 단위 회복 자동화
- 불완전한 산출물 생성 금지

#### R2. `target_major` 불변식 — **DB CHECK + 애플리케이션 Validator (이중 방어)**
- DB: `students.target_major` CHECK 제약 (ALL_MAJOR_KEYS enforce) 또는 `major_categories` 테이블 + FK
- 애플리케이션: `validateTargetMajor()` 유틸 + repository 단일 쓰기 경로
- 22개 키 변경 시 마이그레이션 동반 — 감사 추적 **장점**

#### R3. `main_exploration` 품질 — **NEIS 주입 + 재부트스트랩 트리거**
- k≥1 학생: `unifiedInput` 요약(세특 핵심 키워드) 을 LLM 에 함께 전달 → 학생 개별화
- k=0 학생: `target_major` only (기술적 하한)
- Synthesis 1회 완료 후 `hyperedges` / `narrative_arc` 가 쌓이면 자동 재부트스트랩 → v2 main_exploration ("학습한 main_exploration")
- 수렴 가드: 학생당 재부트스트랩 상한 + tier_plan jaccard 임계치

### 2.2 추가 연계성 조치
기존 파이프라인 invariant 보호를 위해 필요.

| 조치 | 이유 |
|------|------|
| **A**. `withExtendedRetry` 내부에서 `updated_at` heartbeat UPDATE | 15분 대기 시 좀비 판정(5분 초과) 회피 |
| **B**. `unifiedInput` 빌더를 Bootstrap 앞으로 공통화 | R3 NEIS 주입을 위해 Grade 이전에 접근 가능해야 함 |
| **C**. 재부트스트랩 수렴 가드 | 자동 cascade 무한 루프 방지 |
| **D**. `desired_career_field` ↔ `target_major` 일관성 검증 | `MAJOR_TO_TIER1` 매핑 불일치 차단 |
| **E**. `parent_version_id` 체인 해석 UI/헬퍼 | `origin` 4종 + 버전 체인 복합 표시 |

---

## 3. 단계적 로드맵

각 Phase 는 **이전 Phase 산출물 위에 증식** 하도록 설계. 각 Phase 끝에서 xrun Run 이 정상 완주하는지 검증 가능.

### Phase 1 — MVP (완료)
**목표**: 진로만 설정되면 파이프라인 자동 동작
**범위**: 신규 4 파일 + 수정 2 파일 + 마이그레이션 0

| 파일 | 역할 |
|------|------|
| `lib/constants/career-classification.ts` | `validateTargetMajor()` 추가 |
| `lib/domains/record-analysis/llm/prompts/mainExplorationSeed.ts` | LLM 프롬프트 (target_major only) |
| `lib/domains/record-analysis/llm/actions/generateMainExplorationSeed.ts` | Flash + Pro fallback |
| `lib/domains/record-analysis/pipeline/bootstrap.ts` | `ensureBootstrap`, `BootstrapError` |
| `app/api/admin/students/[studentId]/bootstrap/route.ts` | 수동 호출용 엔드포인트 |
| `lib/domains/student-record/actions/pipeline-orchestrator-full.ts` | 진입부 L0 체크 → `ensureBootstrap` |

**이 시점 한계**:
- LLM 실패 시 파이프라인 전체 fail (재시도 X)
- NEIS 반영 없음 (target_major only)
- Phase 0 실행 추적 어려움 (pipeline row 없음)

### Phase 2 — 관측성·정합성 (1~2일)
**목표**: Bootstrap 을 1급 파이프라인으로 승격

- `pipelineType="bootstrap"` 신설
- `student_record_analysis_pipelines` row INSERT → `updated_at` heartbeat
- `idx_unique_running_bootstrap_pipeline` 동시성 보호
- `PIPELINE_RERUN_CASCADE.bootstrap` cascade 소유
- UI: Bootstrap 섹션 + 실패 시 재시도 버튼
- **조치 A** 부분 수행: heartbeat UPDATE 메커니즘 정립

### Phase 3 — 품질·Override 보존 (2~3일)
**목표**: k≥1 개별화 + 컨설턴트 수정 보호

- 마이그레이션: `main_explorations.origin`, `edited_by_consultant_at` 컬럼
- Backfill: 기존 `source='consultant'` → `origin='consultant'`
- `withExtendedRetry` 5회 (Phase 2 heartbeat 선행이라 가능)
- **조치 B**: `unifiedInput` 빌더를 Bootstrap 앞으로 공통화 (k≥1 분기)
- `ensureMainExploration` 가드: `origin='auto_bootstrap' AND edited_by_consultant_at IS NULL` 만 덮어쓰기
- UI: "AI 자동 생성 초안" 뱃지

### Phase 4 — 자기진화 (재부트스트랩, 3~5일)
**목표**: Synthesis 결과 → Phase 0 자동 재실행

- 재부트스트랩 트리거: Synthesis 완료 후 조건부
- **조치 C**: 수렴 가드 (학생당 상한 + tier_plan jaccard 임계)
- `origin="auto_bootstrap_v2"` + `parent_version_id` 체인 연결
- Cross-run manifest: v2 생성이 `readsFromPreviousRun` 에 표시
- **조치 E**: UI 체인 히스토리 뷰어

### Phase 5 — 데이터 모델 엄격화 (1주+)
**목표**: DB composite invariant 달성

- `major_categories` 테이블 신설 (22행) + `tier1_code` 컬럼
- `students.target_major_id FK` (자유 텍스트 → FK 전환)
- `desired_career_field` generated column 로 자동 유도 → 불일치 원천 차단
- **조치 D** 최종 해결: DB 레벨 composite invariant
- `career-classification.ts` 상수 → DB seed 로 이관
- Feature flag + backfill 스크립트

---

## 4. 크기 요약

| Phase | 신규 | 수정 | 마이그 | 소요 | 달성 상태 |
|-------|------|------|------|------|----------|
| 1 (MVP) | 4 | 2 | 0 | 반일 | ✅ 완료 |
| 2 (관측) | 3 | 5 | 1 | 1~2일 | 대기 |
| 3 (품질) | 2 | 6 | 1 | 2~3일 | 대기 |
| 4 (자기진화) | 2 | 4 | 0 | 3~5일 | 대기 |
| 5 (데이터모델) | 3 | 10 | 2 | 1주+ | 대기 |
| **합계** | **14** | **27** | **4** | **약 3주** | — |

---

## 5. 리스크 및 미해결 질문

- **R1-UX**: `withExtendedRetry` 15분 대기 동안 클라이언트 연결 유지 → Phase 0 자체를 백그라운드 작업으로 분리할지 (Phase 2 에서 결정)
- **R3-cascade**: 재부트스트랩 후 Blueprint/Grade/Synthesis 를 어디까지 재실행? (Phase 4 에서 결정)
- **R5-override tolerance**: 컨설턴트가 theme_label 한 글자만 고쳐도 "override" 로 볼 것인가? 섬세한 기준 (Phase 3 에서 결정)
- **R7-체인 무결성**: 김세린/인제고 같은 기존 reference 학생의 `parent_version_id` 체인이 `origin` backfill 로 깨지지 않는지 검증 필요 (Phase 3 선행)
- **Rate limit 격리**: Phase 0 의 Flash 호출이 Synthesis 단계의 Flash 호출과 rate limit 을 공유 → 병목 가능성 (Phase 2/3 에서 cache/큐로 완화)

---

## 6. Phase 1 구현 검증 결과

**xrun-seed-01 학생** (2학년, 수리·통계+컴퓨터·정보, 세특 4/창체 3/독서 3/행특 1) 기준 실측:

| 지표 | 변경 전 | Phase 1 후 |
|------|--------|-----------|
| main_exploration LLM 자동 생성 | 불가 | 10.8s 완주 |
| course_plan 자동 생성 | 28건 (수동 API 호출 시) | 28건 (Bootstrap 자동) |
| Blueprint convergences | 0 | **4** |
| Blueprint milestones | 0 | **2** |

**결론**: Phase 1 만으로 "진로만 있으면 파이프라인 자동 기동" 의 핵심 목표 달성. Phase 2 이후는 품질·정합성·추적성을 단계적 강화.

---

## 7. 변경 로그

| 날짜 | 내용 |
|------|------|
| 2026-04-18 | Phase 1 구현 완료. xrun Run 1 로 Blueprint convergences=4 검증. Phase 2~5 는 별도 차수. |
