# 생기부 시스템 청사진

## 1. 전체 파이프라인 흐름

```mermaid
flowchart TB
    subgraph INPUT["입력"]
        NEIS["NEIS 데이터<br/>(imported_content)"]
        DRAFT["컨설턴트 초안<br/>(content)"]
        SCORES["내신 성적<br/>(student_internal_scores)"]
        PROFILE["학생 프로필<br/>(target_major, grade)"]
    end

    subgraph RESOLVE["데이터 해석 (pipeline-data-resolver)"]
        R1["resolveRecordData()"]
        R2{"NEIS 있음?"}
        R3["분석 모드<br/>(NEIS 기반)"]
        R4["설계 모드<br/>(수강계획 기반)"]
    end

    subgraph GRADE["Grade Pipeline (학년별 × 3학년)"]
        direction TB
        subgraph GP1["Phase 1-3: 역량 분석"]
            P1["P1: 세특 역량<br/>analyzeSetekWithHighlight()"]
            P2["P2: 창체 역량"]
            P3["P3: 행특 역량 + 집계"]
        end
        subgraph GP2["Phase 4-6: 가이드 생성"]
            P4["P4: 세특 가이드 + 슬롯"]
            P5["P5: 창체 가이드"]
            P6["P6: 행특 가이드"]
        end
        CTX["ctx.analysisContext<br/>가공된 요약만 전달<br/>(issues + feedback + 약점역량)"]
    end

    subgraph SYNTH["Synthesis Pipeline (전 학년 종합)"]
        S1["S1: 스토리라인"]
        S2["S2: 엣지 + 가이드매칭"]
        S3["S3: AI 진단 + 교과적합"]
        S5["S5: 활동요약 + 전략"]
        S6["S6: 면접질문 + 로드맵"]
        AGG["aggregateQualityPatterns()<br/>전 학년 반복 패턴 집계"]
    end

    subgraph DB["데이터베이스 (핵심 테이블)"]
        DB_CACHE["analysis_cache<br/>(LLM 전체 JSON)"]
        DB_TAGS["activity_tags<br/>(역량 태그)"]
        DB_SCORES["competency_scores<br/>(등급 + rubric)"]
        DB_QUALITY["content_quality<br/>(5축 + issues + feedback)"]
        DB_DIAG["diagnosis<br/>(강점/약점)"]
        DB_GUIDE["setek/changche/<br/>haengteuk_guides"]
        DB_EDGE["edges<br/>(레코드 연결)"]
        DB_STRAT["strategies +<br/>interview_questions"]
    end

    subgraph UI["UI (4단계 탭)"]
        UI1["1. RECORD<br/>SetekEditor<br/>ChangcheEditor"]
        UI2["2. DIAGNOSIS<br/>CompetencyAnalysis<br/>QualityScoreBadge<br/>ContextGrid"]
        UI3["3. DESIGN<br/>SetekGuidePanel<br/>CoursePlanEditor<br/>RoadmapEditor"]
        UI4["4. STRATEGY<br/>StrategyEditor<br/>InterviewPanel<br/>MinScorePanel"]
    end

    NEIS --> R1
    DRAFT --> R1
    R1 --> R2
    R2 -->|Yes| R3
    R2 -->|No| R4
    SCORES --> GP1
    PROFILE --> GP1

    R3 --> P1
    P1 --> P2 --> P3
    P3 -->|축적| CTX
    CTX -->|주입| P4
    P4 --> P5 --> P6

    R4 -->|prospective| P4

    P3 -->|DB 저장| DB_CACHE
    P3 -->|DB 저장| DB_TAGS
    P3 -->|DB 저장| DB_SCORES
    P3 -->|DB 저장| DB_QUALITY
    P6 -->|DB 저장| DB_GUIDE

    DB_QUALITY -->|DB 조회| AGG
    AGG -->|반복 패턴| S3
    AGG -->|패턴| S5

    S1 --> S2 --> S3 --> S5 --> S6
    S3 -->|DB 저장| DB_DIAG
    S2 -->|DB 저장| DB_EDGE
    S5 -->|DB 저장| DB_STRAT

    DB_TAGS --> UI2
    DB_SCORES --> UI2
    DB_QUALITY --> UI2
    DB_GUIDE --> UI3
    DB_DIAG --> UI2
    DB_EDGE --> UI2
    DB_STRAT --> UI4

    style GP1 fill:#e8f5e9,stroke:#4caf50
    style GP2 fill:#e3f2fd,stroke:#2196f3
    style CTX fill:#fff3e0,stroke:#ff9800,stroke-width:3px
    style AGG fill:#fff3e0,stroke:#ff9800,stroke-width:3px
    style DB fill:#f3e5f5,stroke:#9c27b0
    style UI fill:#fce4ec,stroke:#e91e63
```

---

## 2. Phase 간 데이터 전달 상세

```mermaid
flowchart LR
    subgraph P13["Phase 1-3: 역량 분석"]
        LLM["LLM 응답<br/>(전체 JSON)"]
        LLM -->|전체 저장| CACHE["analysis_cache"]
        LLM -->|분해| TAGS["activity_tags"]
        LLM -->|분해| COMP["competency_scores"]
        LLM -->|분해| QUAL["content_quality"]
        LLM -->|가공| ACTX["ctx.analysisContext"]
    end

    subgraph FILTER["가공 (collectAnalysisContext)"]
        F1["issues가 있는 레코드만"]
        F2["B- 이하 역량만"]
        F3["reasoning 120자 잘림"]
    end

    subgraph P46["Phase 4-6: 가이드 프롬프트"]
        G_SETEK["세특 가이드<br/>feedback 3건<br/>약점 5건"]
        G_CHANG["창체 가이드<br/>community 우선<br/>feedback 2건"]
        G_HAENG["행특 가이드<br/>community만<br/>feedback 2건"]
    end

    ACTX --> FILTER
    FILTER --> F1 & F2 & F3
    F1 --> G_SETEK & G_CHANG & G_HAENG
    F2 --> G_SETEK & G_CHANG & G_HAENG
    F3 --> G_SETEK & G_CHANG & G_HAENG

    style ACTX fill:#fff3e0,stroke:#ff9800,stroke-width:3px
    style FILTER fill:#fff8e1,stroke:#ffc107
    style P46 fill:#e3f2fd,stroke:#2196f3
```

---

## 3. 학년별 Grade Pipeline 실행 순서

```mermaid
gantt
    title Grade Pipeline (1학년 예시)
    dateFormat X
    axisFormat %s초

    section Phase 1 (세특 역량)
    물리학I 분석     :p1a, 0, 70
    수학I 분석       :p1b, 0, 70
    영어Ⅰ 분석      :p1c, 0, 70
    지구과학I 분석   :p1d, 70, 140
    문학 분석        :p1e, 70, 140
    일본어Ⅰ 분석    :p1f, 70, 140
    나머지 (동시 3건) :p1g, 140, 210

    section Phase 2 (창체 역량)
    자율활동         :p2a, 210, 280
    동아리           :p2b, 210, 280
    진로활동         :p2c, 210, 280

    section Phase 3 (행특 역량)
    행특 분석+집계   :p3a, 280, 350

    section Phase 4 (세특 가이드)
    물리학I 가이드   :p4a, 350, 400
    수학I 가이드     :p4b, 350, 400
    영어Ⅰ 가이드    :p4c, 350, 400
    나머지 가이드    :p4d, 400, 450

    section Phase 5 (창체 가이드)
    창체 방향        :p5a, 450, 500

    section Phase 6 (행특 가이드)
    행특 방향        :p6a, 500, 550
```

---

## 4. DB 테이블 관계

```mermaid
erDiagram
    students ||--o{ student_record_seteks : "has"
    students ||--o{ student_record_changche : "has"
    students ||--o{ student_record_haengteuk : "has"
    students ||--o{ student_internal_scores : "has"

    student_record_seteks ||--o| student_record_analysis_cache : "cached"
    student_record_seteks ||--o{ student_record_activity_tags : "tagged"
    student_record_seteks ||--o| student_record_content_quality : "scored"
    student_record_seteks ||--o| student_record_setek_guides : "guided"

    student_record_changche ||--o| student_record_analysis_cache : "cached"
    student_record_changche ||--o{ student_record_activity_tags : "tagged"
    student_record_changche ||--o| student_record_changche_guides : "guided"

    student_record_haengteuk ||--o| student_record_analysis_cache : "cached"
    student_record_haengteuk ||--o{ student_record_activity_tags : "tagged"
    student_record_haengteuk ||--o| student_record_haengteuk_guides : "guided"

    students ||--o{ student_record_competency_scores : "graded"
    students ||--o| student_record_diagnosis : "diagnosed"
    students ||--o{ student_record_edges : "connected"
    students ||--o{ student_record_storylines : "storylined"
    students ||--o{ student_record_strategies : "strategized"
    students ||--o{ student_record_interview_questions : "interviewed"
    students ||--o{ student_record_analysis_pipelines : "pipelined"

    student_record_analysis_cache {
        uuid record_id PK
        jsonb analysis_result
        text content_hash
        text source
    }

    student_record_content_quality {
        uuid record_id PK
        int overall_score
        text[] issues
        text feedback
        int specificity
        int coherence
        int depth
        int grammar
        int scientific_validity
    }

    student_record_competency_scores {
        uuid student_id
        text competency_item
        text grade_value
        text narrative
        jsonb rubric_scores
    }

    student_record_analysis_pipelines {
        uuid id PK
        text status
        jsonb tasks
        jsonb task_previews
        jsonb task_results
        text pipeline_type
        int grade
    }
```

---

## 5. UI 4단계 탭 구조

```mermaid
flowchart TB
    subgraph CLIENT["StudentRecordClient.tsx"]
        TABS["4단계 탭 전환"]
    end

    subgraph TAB1["1. RECORD (기록 입력)"]
        direction LR
        T1A["SetekEditor<br/>세특 편집"]
        T1B["ChangcheEditor<br/>창체 편집"]
        T1C["HaengteukEditor<br/>행특 편집"]
        T1D["ReadingEditor<br/>독서 편집"]
        T1E["ImportDialog<br/>NEIS 임포트"]
    end

    subgraph TAB2["2. DIAGNOSIS (진단 분석)"]
        direction LR
        T2A["CompetencyAnalysis<br/>역량 등급 + 루브릭"]
        T2B["QualityScoreBadge<br/>품질 점수 + 이슈"]
        T2C["HighlightedSetekView<br/>원문 하이라이트"]
        T2D["ContextGrid<br/>교차 분석"]
        T2E["RecordWarningPanel<br/>경고 엔진"]
    end

    subgraph TAB3["3. DESIGN (설계)"]
        direction LR
        T3A["SetekGuidePanel<br/>세특 방향"]
        T3B["ChangcheGuidePanel<br/>창체 방향"]
        T3C["CoursePlanEditor<br/>수강 계획"]
        T3D["RoadmapEditor<br/>학기별 로드맵"]
        T3E["BypassMajorPanel<br/>우회학과"]
    end

    subgraph TAB4["4. STRATEGY (전략)"]
        direction LR
        T4A["StrategyEditor<br/>보완전략"]
        T4B["InterviewPanel<br/>면접 예상질문"]
        T4C["MinScorePanel<br/>수능최저 시뮬"]
        T4D["ApplicationBoard<br/>입시 지원 현황"]
    end

    TABS --> TAB1
    TABS --> TAB2
    TABS --> TAB3
    TABS --> TAB4

    TAB1 -->|"NEIS 임포트 후<br/>파이프라인 실행"| TAB2
    TAB2 -->|"역량 분석 결과<br/>→ 가이드 자동 생성"| TAB3
    TAB3 -->|"가이드 기반<br/>→ 전략 수립"| TAB4

    style TAB1 fill:#e8f5e9,stroke:#4caf50
    style TAB2 fill:#e3f2fd,stroke:#2196f3
    style TAB3 fill:#fff3e0,stroke:#ff9800
    style TAB4 fill:#fce4ec,stroke:#e91e63
```

---

## 6. LLM 호출 맵

```mermaid
flowchart LR
    subgraph MODELS["모델"]
        ADV["Gemini 2.5 Pro<br/>(advanced)"]
        STD["Gemini 2.5 Flash<br/>(standard)"]
    end

    subgraph ANALYSIS["역량 분석 (1회성)"]
        A1["analyzeSetekWithHighlight<br/>T=0.3, 16K tokens"]
    end

    subgraph GUIDES["가이드 생성 (반복)"]
        G1["generateSetekGuide<br/>T=0.3, 32K tokens"]
        G2["generateChangcheGuide<br/>T=0.3, 32K tokens"]
        G3["generateHaengteukGuide<br/>T=0.3, 32K tokens"]
    end

    subgraph SYNTH_LLM["종합 분석"]
        S1["generateAiDiagnosis<br/>T=0.5, 16K tokens"]
        S2["suggestStrategies<br/>T=0.7, 8K tokens"]
        S3["generateInterviewQuestions<br/>T=0.5, 8K tokens"]
        S4["generateAiRoadmap<br/>T=0.5, 16K tokens"]
    end

    ADV --> A1
    STD --> G1 & G2 & G3
    STD --> S1 & S2 & S3 & S4

    subgraph FUTURE["향후 모델 분리 (준비됨)"]
        OPUS["Claude Opus<br/>진로교과 역량 + 로드맵"]
        SONNET["Claude Sonnet<br/>비진로교과 + 가이드"]
    end

    style FUTURE fill:#f5f5f5,stroke:#9e9e9e,stroke-dasharray:5
```

---

## 7. 비용 구조

```mermaid
pie title 학생 1명 전체 파이프라인 비용 ($3.44, 현재 Gemini)
    "역량 분석 (1회성)" : 1.60
    "가이드 생성" : 1.52
    "Synthesis" : 0.31
```

```mermaid
pie title 월간 반복 비용 구조 (가이드 재생성 + Synthesis)
    "가이드 재생성 (~5건/월)" : 0.26
    "Synthesis 재실행 (~1회/월)" : 0.31
```

---

## 8. 증분 캐시 플로우

```mermaid
flowchart LR
    REC["레코드 content"] --> HASH["computeRecordContentHash()"]
    HASH --> CHECK{"DB cache에<br/>같은 hash?"}
    CHECK -->|Yes| SKIP["LLM 스킵<br/>(비용 $0)"]
    CHECK -->|No| LLM["LLM 호출<br/>(비용 발생)"]
    LLM --> SAVE["DB에 저장<br/>+ hash 갱신"]

    style SKIP fill:#e8f5e9,stroke:#4caf50
    style LLM fill:#fff3e0,stroke:#ff9800
```

> **핵심**: 레코드 내용이 변경되지 않으면 재실행해도 LLM 호출 0건, 비용 $0.
> content_hash = `SHA256(content + targetMajor + takenSubjects)`
