# Guide Generation Pipeline — 아키텍처 문서

> 최종 갱신: 2026-04-11 (c3.3-v1)

## 1. 파이프라인 전체 흐름

```
generateGuideCore()
  ├─ 1. 입력 준비: 학생 프로필 로드, 난이도 추론, 프롬프트 빌드
  ├─ 2. AI 생성: Gemini advanced (2.5-pro) → 429 시 fast (2.5-flash) fallback
  ├─ 3. 섹션 필터링: selectedSectionKeys 적용
  ├─ 4. 기본 보정: confidence 미지정 → medium 기본값, low 논문 자동 제거
  ├─ 5. Deterministic Validation (c3.2 신규)
  │     ├─ A-L1: Deterministic — outline 밀도/산문 글자수/섹션 누락/번호/confidence
  │     ├─ A-L2: Coherence Check (Flash LLM) — 6규칙 교차 참조 검증
  │     └─ Targeted Repair (DeCRIM) — error 위반 시 위반 섹션만 부분 재생성
  ├─ 6. enrichGuideResources: DB 캐시 → 웹 검색으로 URL 자동 채움
  └─ 7. 반환: { preview, modelId, sourceType }

executeGuideGeneration() [API Route, 5min timeout]
  ├─ generateGuideCore() 호출
  ├─ subject/career/classification 매칭
  ├─ DB 저장 (content, metadata, mappings)
  ├─ 벡터 임베딩 (비동기)
  └─ status: "draft", quality_tier: "ai_draft"

reviewGuideAction() → executeGuideReview() [55s timeout]
  ├─ 6축 AI 리뷰 (Claude/Gemini)
  ├─ quality_score (0~100), quality_tier 결정
  └─ ≥80: ai_reviewed_approved, 60~79: pending_approval, <60: review_failed

improveGuideAction() → executeGuideImprovement() [5min timeout]
  ├─ 리뷰 피드백 기반 전체 개선 (새 버전 생성)
  └─ status: "draft" (review_result 초기화)
```

## 2. 프롬프트 버전 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| `c3.1-v1` | 이전 | 초기 버전. 도서/논문 검증 프롬프트 추가. 6축 리뷰 체계 도입 |
| `c3.2-v1` | 2026-04-11 | 도서 검증 중복 제거 (theory-hints→buildBookVerification 통합). Deterministic Validator 추가. 프롬프트 ~360 토큰 절감 |
| **`c3.3-v1`** | **2026-04-11** | A-L2 Coherence Check (Flash LLM 교차 참조 6규칙). Targeted Repair (DeCRIM 패턴 부분 재생성) |

### c3.2-v1 → c3.3-v1 변경 상세

**신규 모듈:**
- `validators/coherence-checker.ts`: Flash 모델로 6개 교차 참조 규칙 자동 검증
  - OUTLINE_PROSE_ALIGNMENT, MOTIVATION_CONCLUSION_LINK, BOOK_CONTENT_CONSISTENCY
  - SETEK_GUIDE_ALIGNMENT, THEORY_FLOW_CONTINUITY, FOLLOW_UP_RELEVANCE
- `validators/targeted-repair.ts`: DeCRIM 패턴 부분 재생성
  - error 위반 섹션만 추출 → 나머지 섹션 컨텍스트 제공 → 위반 섹션만 재생성 → A-L1 재검증
  - MAX_REPAIR_ATTEMPTS=1 (서버리스 타임아웃 고려)

**파이프라인 흐름 변경:**
- A-L1 (Deterministic) → A-L2 (Coherence, non-fatal) → Repair (error 시, non-fatal) → enrich → 반환
- Coherence/Repair 실패 시 원본 출력 유지 (기존 동작과 동일)

### c3.1-v1 → c3.2-v1 변경 상세

**프롬프트 변경:**
- `theory-development-hints.ts` reading 타입: Chain-of-Verification 24줄 → 3줄 참조로 압축
- `common-prompt-builder.ts` `buildBookVerificationPrompt()`: 자기검증 질문 4개 통합 (기존 "핵심 원칙" → "Chain-of-Verification" 구조화)
- 전후 토큰: ~12,800 → ~12,460 (약 360 토큰 절감, 2.8%)

**코드 변경:**
- `validators/deterministic-validator.ts` 신규: 6가지 규칙 검사 모듈
- `generateGuideCore.ts`: 인라인 검증 120줄 → validator 호출 + 로깅 30줄로 교체

## 3. Deterministic Validator 규칙 명세

| 규칙 ID | 심각도 | 기준 | 검사 내용 |
|---------|--------|------|----------|
| `OUTLINE_TOTAL_MIN` | error | ≥40 | content_sections outline 전체 항목 수 |
| `OUTLINE_DEPTH0_MIN` | error | ≥5 | depth=0 대주제 수 |
| `OUTLINE_TIPS_MIN` | warning | ≥6 | tip 포함 항목 수 |
| `OUTLINE_RESOURCES_MIN` | warning | ≥5 | resources 포함 항목 수 |
| `PROSE_LENGTH_MIN` | error/warn | 섹션별 | content_sections ≥800자, motivation ≥200자 등 |
| `REQUIRED_SECTION_MISSING` | error | — | Core + 선택 섹션 누락 |
| `OUTLINE_NUMBERING_DISCONTINUOUS` | warning | 연속 | depth-0 번호 불연속 |
| `BOOK_TITLE_MISSING` | error | — | reading 타입 bookTitle 누락 |
| `BOOK_CONFIDENCE_LOW` | error | — | bookConfidence = "low" |
| `BOOK_CONFIDENCE_MISSING` | warning | — | bookTitle 있는데 confidence 없음 |
| `PAPER_CONFIDENCE_LOW` | error | — | 논문 confidence = "low" |
| `PAPER_CONFIDENCE_MISSING` | warning | — | 논문 confidence 미지정 |

**severity 정책:**
- `error`: 향후 repair 루프 트리거 대상 (현재는 로그만)
- `warning`: 로그 기록, 통과 허용

## 4. A-L2 Coherence Check 규칙 명세

| 규칙 ID | 검사 내용 | error 조건 | warning 조건 |
|---------|----------|-----------|-------------|
| `OUTLINE_PROSE_ALIGNMENT` | outline 대주제 ↔ 산문 정합 | 대주제가 산문에서 미언급 | 피상적 다룸 |
| `MOTIVATION_CONCLUSION_LINK` | 동기 질문 ↔ 결론 답변 | 핵심 질문 무시 | 간접적 연결 |
| `BOOK_CONTENT_CONSISTENCY` | 도서 내용 ↔ 본문 (reading 전용) | 정반대 서술 | 과도한 단순화 |
| `SETEK_GUIDE_ALIGNMENT` | 세특 예시 ↔ 가이드 내용 | 무관한 활동 서술 | 부정확한 반영 |
| `THEORY_FLOW_CONTINUITY` | 이론 섹션 간 논리 흐름 | 전제-결론 모순 | 갑작스러운 전환 |
| `FOLLOW_UP_RELEVANCE` | 후속 탐구 ↔ 본문 | 무관한 주제 제안 | 약한 연결 |

## 5. Targeted Repair (DeCRIM) 흐름

```
error 위반 감지
  → extractRepairTargetKeys: 위반 섹션 key 추출
  → buildRepairUserPrompt:
      - 유지 섹션 (컨텍스트, 수정 금지)
      - 수리 대상 섹션 + 위반 내역
  → Flash 모델 재생성 (위반 섹션만)
  → Integrate: 원본에 수리 결과 병합
  → Monitor: A-L1 재검증 (남은 위반 확인)
```

- MAX_REPAIR_ATTEMPTS = 1 (서버리스 타임아웃 + API 비용 고려)
- Repair/Coherence 실패 시 원본 유지 (non-fatal)

## 6. 향후 확장 계획

- **MAX_REPAIR_ATTEMPTS 조정**: 프로덕션 데이터 기반으로 2~3회까지 확장 검토
- **Repair 후 A-L2 재검증**: 현재는 A-L1만 재검증. 교차 참조도 재확인하도록 확장 가능
- **Repair 성공률 대시보드**: 로그 기반 모니터링 (repair 시도 vs 성공 비율)

## 5. 파일 구조

```
lib/domains/guide/llm/
├── actions/
│   ├── generateGuideCore.ts     # 생성 핵심 (c3.2-v1)
│   ├── executeGuideGeneration.ts # DB 저장 오케스트레이터
│   ├── reviewGuide.ts           # 6축 AI 리뷰
│   └── improveGuide.ts          # 피드백 기반 개선
├── prompts/
│   ├── common-prompt-builder.ts  # 마스터 시스템 프롬프트 (~19.7KB)
│   ├── theory-development-hints.ts # 8개 유형별 이론 전개 (~11.4KB)
│   ├── keyword-guide.ts          # 키워드 소스
│   ├── clone-variant.ts          # 클론 소스
│   ├── extraction-guide.ts       # PDF/URL 소스
│   └── review.ts                 # 리뷰 프롬프트
├── validators/
│   ├── deterministic-validator.ts # A-L1: 구조적 품질 검증 (c3.2)
│   ├── coherence-checker.ts       # A-L2: LLM 교차 참조 검증 (c3.3)
│   └── targeted-repair.ts         # DeCRIM 부분 재생성 (c3.3)
└── services/
    └── enrich-sources.ts         # 출처 URL 자동 수집
```
