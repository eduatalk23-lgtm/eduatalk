# Cross-subject Theme Extractor (H1 / L3-A) — 설계 문서

**목표**: 학년 내 여러 레코드(세특·창체·행특)를 한 프롬프트에 일괄 주입하여 과목 교차 테마(예: "사회적 약자"가 수학+경제+사회에 반복)를 감지.

## 배경

현 Phase 1-3은 **레코드 1건당 1회 LLM 호출**. 같은 학년 내 과목 간 교차 참조 경로 자체가 없어 F16(진로과잉도배), 과목 횡단 테마, 심화 궤적 등이 구조적으로 감지 불가. 현대 LLM 컨텍스트(1M 토큰)는 학생 생기부 전체를 한 번에 볼 수 있는데 이 가능성을 활용하지 못함.

## 파이프라인 배치

```
기존: P1 세특 → P2 창체 → P3 행특 → P4 세특가이드+슬롯 → P5 창체가이드 → P6 행특가이드
신규: P1 → P2 → P3 → [P3.5 테마추출] → P4 → P5 → P6
                        ↑
                   신규 Phase
```

- **선행 조건**: `competency_haengteuk` 완료 (즉 P1~P3 전부)
- **후행 의존**: `setek_guide`, `changche_guide`, `haengteuk_guide` — 테마를 프롬프트에 주입 가능
- **병렬성**: slot_generation과는 병렬 가능 (slot_generation도 P3 이후)

## 데이터 흐름

```
Input:
  - resolvedRecords (P1-3에서 이미 로드됨)
  - activity_tags + competency_scores + content_quality (DB 조회)
  - profileCard (이전 학년 맥락)
  - careerContext (목표 전공)

↓ LLM 호출 (1회, advanced 모델)

Output:
  - themes[]: 테마 클러스터
  - crossSubjectPatternCount: ≥2과목 반복 테마 수
  - dominantThemeIds: 학년 전체를 관통하는 상위 3개

↓ 저장

ctx.gradeThemes = GradeThemeExtractionResult
(DB 저장은 선택: student_record_grade_themes 테이블)
```

## 출력 스키마

```typescript
export interface GradeTheme {
  /** 안정적 식별자 (slug) */
  id: string;
  /** 사람 읽을 수 있는 테마명 */
  label: string;
  /** 테마를 표현하는 키워드 */
  keywords: string[];
  /** 이 테마가 등장한 레코드 */
  records: Array<{
    recordId: string;
    recordType: "setek" | "changche" | "haengteuk" | "personal_setek";
    subjectName?: string;
    evidenceSnippet: string; // 원문 100자 이하
  }>;
  /** 해당 테마가 등장한 과목명 목록 (중복 제거) */
  affectedSubjects: string[];
  /** 몇 개 과목에 걸쳐 있는가 */
  subjectCount: number;
  /** 1→2→3학년 변화 신호 (선행 학년 데이터 있을 때만) */
  evolutionSignal?: "deepening" | "stagnant" | "pivot" | "new";
  /** 0~1, 감지 확신도 */
  confidence: number;
}

export interface GradeThemeExtractionResult {
  themes: GradeTheme[];
  themeCount: number;
  crossSubjectPatternCount: number; // subjectCount >= 2
  dominantThemeIds: string[];       // 상위 3개 테마 id
  elapsedMs: number;
}
```

## 프롬프트 구조 (초안)

```
# 시스템 프롬프트
당신은 대입 컨설팅 전문가로, 한 학년의 생기부 전체를 읽고 **과목 간 반복되는 테마**와 **심화 궤적**을 추출합니다.

## 분석 원칙
1. 테마는 "단어"가 아닌 "탐구 대상·관점·문제의식" 단위로 묶습니다. 
   예: "사회적 약자 이해"는 수학의 통계 분석, 경제의 분배 문제, 사회의 복지 정책 모두를 포괄.
2. ≥2개 과목·활동에서 반복 등장해야 유의미한 테마로 인정.
3. 단순 주제 일치가 아닌 **문제 의식의 연속성**이 있어야 함.
4. 각 테마는 evidenceSnippet으로 원문을 인용 (최대 100자).
5. 선행 학년 profileCard가 주어지면, 해당 관심사와의 연속성(deepening/stagnant/pivot) 판정.

## 금지 사항
- 테마 난립 금지 (최대 6개)
- 1과목에만 등장하는 주제는 테마로 분류하지 말 것 (해당 레코드의 개별 강점으로 분류)

# 사용자 프롬프트
## 학생 정보
- 학년: {grade}
- 목표 전공: {targetMajor}

## 이전 학년 누적 (profileCard)
{profileCardMarkdown | "없음"}

## 이번 학년 레코드
### 세특 (N건)
- [과목: 수학 | id: r1] {content_preview}
- [과목: 경제 | id: r2] {content_preview}
...

### 창체 (N건)
...

### 행특 (N건)
...

## 사전 분석된 역량·품질 데이터
각 레코드별 역량 태그·점수·품질 이슈 요약 (gradeThemes 판단 보조)

# 응답 형식
```json
{
  "themes": [
    {
      "id": "social-minority",
      "label": "사회적 약자 이해",
      "keywords": ["복지", "불평등", "분배"],
      "records": [...],
      "affectedSubjects": ["수학", "경제", "사회"],
      "subjectCount": 3,
      "evolutionSignal": "deepening",
      "confidence": 0.9
    }
  ],
  "dominantThemeIds": ["social-minority", "..."]
}
```
```

## 모델 선택

- **advanced** (Gemini 2.5 Pro) — 학년 전체 컨텍스트(6~7K 토큰) + 의미 수준 추론 필요
- 실패 시 fallback은 불필요 (이 Phase 실패해도 P4~P6은 profileCard만으로 동작 가능 — graceful degradation)

## 통합 지점

### 1. `setek_guide`/`changche_guide`/`haengteuk_guide` 프롬프트
- `ctx.gradeThemes.dominantThemeIds`를 주입 → 가이드가 테마 일관성을 강화/약화 방향 제시

### 2. Synthesis S3 (diagnosis)
- 현재 `aggregateQualityPatterns` 주입 → `gradeThemes` 추가 주입으로 서사 판단 보강
- F16(진로과잉도배) 감지: subjectCount 편중도 확인

### 3. (나중) Narrative ProfileCard (H2/L3-B)
- 학년이 끝날 때 `gradeThemes` → `profileCard.careerTrajectory` 갱신

## 타임아웃 & 비용

- 토큰 추정: input 6~7K, output 1~2K → ~8~9K total
- Gemini 2.5 Pro: 약 10~30초
- 타임아웃: 120s (diagnosis와 동일 여유)

## DB 저장 여부

**초기엔 ctx 메모리만**. 이유:
- UI 소비 설계 필요 (별도 과제)
- 재실행 정책 복잡도 증가 (P1-3 재실행 시 테마도 재계산해야 함)
- 프로덕션 검증 후 영속화 단계로 진화

**향후 테이블 스키마** (참고):
```sql
CREATE TABLE student_record_grade_themes (
  id UUID PRIMARY KEY,
  student_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  grade INTEGER NOT NULL,
  school_year INTEGER NOT NULL,
  theme_id TEXT NOT NULL,
  theme_label TEXT NOT NULL,
  keywords TEXT[],
  affected_records JSONB,
  affected_subjects TEXT[],
  subject_count INTEGER,
  evolution_signal TEXT,
  confidence NUMERIC(3,2),
  pipeline_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: tenant + admin/consultant
-- UNIQUE(student_id, grade, theme_id)
```

## 블로커 & 완화 전략

### 블로커 1: P3 → P3.5 DB 동기화
`collectAnalysisContext()`가 비동기로 DB에 저장하므로 P3.5 진입 시 최신 데이터 미반영 가능.

**완화**: `runCrossSubjectThemeExtractionForGrade()` 진입 시 명시적 `await` 동기화. 또는 ctx.analysisContext를 사용 (이미 수집됨, DB 미의존).

### 블로커 2: 테마 일관성 편차
같은 학생 반복 호출 시 테마 label이 달라질 수 있음.

**완화**: id는 slug 기반(`social-minority`, `financial-literacy` 등), 프롬프트에 "id는 영문 lowercase slug로"

### 블로커 3: 레코드 건수 많은 경우(15건+)
토큰 초과 위험.

**완화**: 건수 > 12 시 content 요약본(500자 → 200자) 사용. 초과 건수는 `truncationWarning`에 기록.

## 구현 단계

| 단계 | 파일 | 상태 |
|-----|------|------|
| 1. 타입 정의 | `llm/types.ts` | 📝 대기 |
| 2. 프롬프트 | `llm/prompts/crossSubjectThemes.ts` | 📝 대기 |
| 3. LLM 액션 | `llm/actions/extractThemes.ts` | 📝 대기 |
| 4. 태스크 러너 | `pipeline-task-runners-theme-extraction.ts` | 📝 대기 |
| 5. Phase 통합 | `pipeline-grade-phases.ts` + config | 📝 대기 |
| 6. 다운스트림 주입 | setek/changche/haengteuk guide 프롬프트 | 📝 대기 |
| 7. 단위 테스트 | `__tests__/extractThemes.test.ts` | 📝 대기 |

## 검증 전략

1. **단위**: extractThemes 액션에 골든셋 2~3개 투입 → 예상 테마 감지율
2. **통합**: 골든셋 기존 50샘플에 테마 추출 확장 후 F16 감지율 측정
3. **회귀**: `pnpm test lib/domains/record-analysis` 추가 suite

## 관련 메모리

- `record-analysis-architecture-upgrade-roadmap.md` — H1 상세
- `golden-dataset-tier2-multi-record-patterns.md` — F10/F16 검증 맥락
- `pipeline-level4-phase2-handoff.md` — 가이드 쪽 L2 coherence 참조
