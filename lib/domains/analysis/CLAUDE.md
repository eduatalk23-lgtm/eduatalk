# Analysis Domain Rules

## Scope
학습 분석 도메인. 과목별 Risk Index 계산, 학습 패턴 분석(시간대/요일/과목), 성과 예측, 조기 경고, 적응형 리스케줄링을 담당한다.

## Architecture
```
analysis/
├── index.ts              # Public API (모든 export 집약)
├── types.ts              # Risk Index 관련 타입 (ScoreRow, SubjectRiskAnalysis 등)
├── utils.ts              # Risk Index 계산 핵심 (fetchAllScores, calculateRiskIndex, saveRiskAnalysis)
├── actions/
│   ├── index.ts              # Actions barrel
│   ├── riskIndex.ts          # recalculateRiskIndex (Server Action)
│   └── getStudentScoreProfile.ts  # 성적 프로필 조회 (Server Action)
└── services/
    ├── learningPatternService.ts       # 학습 패턴 분석 (시간대/요일/과목 완료율)
    ├── predictionService.ts            # Phase 4.1 — 주간 성과/번아웃/과목 어려움 예측
    ├── earlyWarningService.ts          # Phase 4.2 — 조기 경고 감지/관리
    └── adaptiveReschedulingService.ts  # Phase 4.3 — 일정 자동 조정 제안
```

## Enforced Rules

1. **에러 시 빈 결과 반환**: `fetchAllScores`, `fetchProgressMap`, `fetchPlansForSubject` 등 데이터 조회 함수는 에러 시 `logActionError` 후 빈 배열/객체를 반환한다. throw 하지 않는다.
2. **Risk Score 범위 0-100**: `calculateRiskIndex`의 결과는 반드시 `Math.min(100, Math.max(0, riskScore))`로 클램프. 등급은 낮을수록 좋음 (1등급=최고).
3. **Service 간 의존 순서**: `adaptiveReschedulingService` / `predictionService` → `learningPatternService`. earlyWarningService → predictionService. 역방향 import 금지.
4. **delete + insert 패턴**: `saveRiskAnalysis`, `saveLearningPatterns`는 기존 행 삭제 후 새로 삽입한다. upsert가 아님 — student_id 기준 전체 교체.
5. **tenant_id 필수 조회**: Risk 저장 시 학생의 `tenant_id`를 `students` 테이블에서 조회한 후 삽입. 누락 시 조용히 리턴(throw 아님).
6. **레거시 호환**: `app/(student)/analysis/_actions.ts`, `_utils.ts`는 deprecated 래퍼. 새 코드는 반드시 `@/lib/domains/analysis`에서 직접 import.

## DB Tables
- **읽기**: `internal_scores`, `mock_scores`, `student_plan`, `student_content_progress`, `students`, `books`, `lectures`, `student_custom_contents`, `subjects`
- **쓰기**: `student_risk_analysis`, `student_learning_patterns`, `student_predictions`, `early_warnings`, `warning_actions`

## Tests
```bash
pnpm test __tests__/lib/domains/analysis
```

## Related Domains
- `score`: 내신/모의고사 성적 데이터 소스 (`getInternalScores`, `getMockScores`)
- `plan`: 학습 플랜 데이터 조회 (`student_plan` 테이블)
- `content`: 콘텐츠 메타데이터 (`books`, `lectures` 과목 매핑)
- `scheduling`: 적응형 리스케줄링이 일정 조정 제안 시 참조
