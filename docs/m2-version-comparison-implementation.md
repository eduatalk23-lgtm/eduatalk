# M2: 버전 비교 + AI 맥락 분석 — 구현 완료 문서

> 작성일: 2026-04-10  
> 상태: Layer 1 ✅ + Layer 2 ✅ → 수동 검증 대기  
> 목적: 다른 세션에서 M2 맥락을 이해하고 후속 작업을 이어갈 수 있도록 정리

---

## 1. 전체 요약

가이드 CMS에 **두 버전 간 차이를 시각적으로 확인하고, AI가 변경 맥락을 분석**하는 기능을 추가했습니다.

```
Layer 1 (결정론적) — 즉시 실행, 100% 결정론
├── 메타 변경 (제목, 상태, 난이도, 품질점수 등)
├── 섹션별 diff (문장 단위 LCS 알고리즘)
└── 요약 통계 (추가/삭제/수정 섹션 수, 글자수 변화)

Layer 2 (AI 맥락 분석) — opt-in 버튼, Gemini Flash
├── 변경 맥락 추론 (changeNarrative)
├── 개선 영역 (improvementAreas)
├── 퇴보 위험 (regressionRisks)
├── 다음 편집 제안 (suggestedNextEdits)
└── 종합 판단 (improved / regressed / lateral)
```

---

## 2. 변경 파일 목록

### 신규 파일 (5개)

| 파일 | 역할 |
|------|------|
| `lib/domains/guide/utils/versionDiff.ts` | LCS 기반 문장 단위 diff 유틸리티 (~346줄) |
| `app/(admin)/admin/guides/[id]/_components/VersionCompareModal.tsx` | 비교 모달 UI (Layer1 통계/diff + Layer2 AI 분석) |
| `lib/domains/guide/llm/prompts/version-comparison.ts` | AI 분석용 시스템/유저 프롬프트 빌더 |
| `lib/domains/guide/llm/actions/analyzeVersionDiff.ts` | AI 분석 서버 액션 (Gemini fast) |
| `__tests__/lib/domains/guide/utils/versionDiff.test.ts` | 21개 단위 테스트 |

### 수정 파일 (3개)

| 파일 | 변경 내용 |
|------|----------|
| `lib/domains/guide/actions/crud.ts` | `compareVersionsAction` 서버 액션 추가 (~40줄) |
| `lib/domains/guide/llm/types.ts` | `versionAnalysisSchema` Zod 스키마 추가 (~35줄) |
| `app/(admin)/admin/guides/[id]/_components/GuideVersionHistory.tsx` | "비교" 버튼 + `VersionCompareModal` 연동 |

---

## 3. 아키텍처

```
사용자 플로우:
  가이드 상세 → 버전 히스토리 패널 → "비교" 버튼 클릭
  → VersionCompareModal 열림
  → Layer 1: compareVersionsAction → versionDiff.compareVersions()
  → (선택) Layer 2: "AI 맥락 분석" 버튼 → analyzeVersionDiffAction → Gemini Flash

데이터 흐름:
  GuideVersionHistory
    └─ compareTarget state → VersionCompareModal
        ├─ [Layer 1] useQuery → compareVersionsAction
        │   ├─ findGuideById(A, B) 병렬 조회
        │   └─ compareVersions(older, newer) → VersionDiff
        └─ [Layer 2] onClick → analyzeVersionDiffAction
            ├─ geminiQuotaTracker.getQuotaStatus() 확인
            ├─ compareVersions() → diff 계산
            ├─ buildVersionComparisonSystemPrompt()
            ├─ buildVersionComparisonUserPrompt(diff)
            └─ generateObjectWithRateLimit(fast) → VersionAnalysisOutput
```

---

## 4. 핵심 설계 결정

| # | 결정 | 선택 | 이유 |
|---|------|------|------|
| 1 | Diff 알고리즘 | 자체 LCS 구현 | 외부 `diff` 패키지 미설치 상태, 번들 최소화 |
| 2 | 텍스트 전처리 | `stripHtml()` 후 비교 | `<p>`, `<strong>` 등 서식 변경만으로 "수정"으로 잡히는 것 방지 |
| 3 | 데이터 정규화 | `extractSections()` | 레거시 필드(`motivation`, `theory_sections`) + 새 `content_sections` 동시 지원 |
| 4 | AI 모델 | Gemini Flash (fast tier) | 비교 분석은 지연 시간 우선, 비용 효율적 |
| 5 | AI 호출 방식 | opt-in 버튼 | 기본은 결정론적 diff만, AI는 사용자가 명시적으로 요청 |
| 6 | 변경 없음 처리 | 서버 short-circuit | diff 결과 변경 0건이면 AI 호출 생략 (비용 절약) |
| 7 | UI 형태 | 모달 | 현재 페이지 컨텍스트 유지, 향후 전용 페이지 확장 가능 |
| 8 | 비교 대상 | 하이브리드 | 기본 직전 버전 자동 선택 + 드롭다운으로 임의 변경 가능 |

---

## 5. 핵심 타입 정의

### `VersionDiff` (Layer 1 출력)

```typescript
// lib/domains/guide/utils/versionDiff.ts

interface VersionDiff {
  meta: MetaDiff;           // 9개 메타 필드 변경 (title, status, guideType 등)
  sections: SectionDiff[];  // 섹션별 diff (added/removed/modified/unchanged)
  stats: {
    addedSections: number;
    removedSections: number;
    modifiedSections: number;
    totalCharDelta: number;
  };
  timeDeltaMs: number;      // 두 버전 간 시간 차이 (ms)
}

interface SectionDiff {
  key: string;       // "motivation", "theory_1", "cs_motive" 등
  label: string;     // 한글 표시명
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  charDelta: number;
  hunks?: DiffHunk[];  // 문장 단위 add/remove/equal
}
```

### `VersionAnalysisOutput` (Layer 2 출력)

```typescript
// lib/domains/guide/llm/types.ts — versionAnalysisSchema

interface VersionAnalysisOutput {
  changeNarrative: string;        // "이 편집의 전반적 맥락과 목적을 2~3문장으로 설명"
  improvementAreas: string[];     // 최대 5개
  regressionRisks: string[];      // 최대 3개 (없으면 빈 배열)
  suggestedNextEdits: string[];   // 최대 3개
  overallVerdict: 'improved' | 'regressed' | 'lateral';
}
```

---

## 6. 검증 현황

| 항목 | 상태 | 비고 |
|------|------|------|
| `tsc --noEmit` | ✅ exit code 0 | M2 신규 파일 에러 없음 |
| `vitest` (versionDiff.test.ts) | ✅ 21/21 통과 (3ms) | diffSentences, compareVersions, countMetaChanges |
| 수동 검증 (모달 동작) | ⬜ 미완 | 프로덕션/스테이징 배포 후 확인 필요 |
| AI 분석 정확성 | ⬜ 미완 | 실제 가이드 데이터로 AI 응답 품질 확인 필요 |

---

## 7. 후속 작업 (선택)

| 우선순위 | 작업 | 설명 |
|---------|------|------|
| P1 | 수동 검증 | 배포 후 모달 열기/닫기, diff 정확성, AI 분석 응답 확인 |
| P2 | 전용 비교 페이지 | `/admin/guides/[id]/compare?a=v1&b=v2` — 긴 diff 확인용 |
| P3 | AI 분석 스트리밍 | 현재 전체 결과 한번에 반환 → `useObject` 스트리밍으로 전환 |
| P3 | diff 내보내기 | 비교 결과를 PDF/마크다운으로 내보내기 기능 |

---

## 8. 관련 기존 시스템 참조

| 항목 | 파일 | 설명 |
|------|------|------|
| 버전 관리 | `lib/domains/guide/repository.ts` | `findVersionHistory`, `createNewVersion`, `revertToVersion` |
| AI 리뷰 | `lib/domains/guide/llm/actions/reviewGuide.ts` | Claude → Gemini fallback 패턴 |
| Rate limit | `lib/domains/plan/llm/ai-sdk.ts` | `generateObjectWithRateLimit`, `ModelTier` |
| Quota 추적 | `lib/domains/plan/llm/providers/gemini.ts` | `geminiQuotaTracker` |
| Guide 타입 | `lib/domains/guide/types.ts` | `GuideDetail`, `ExplorationGuide`, `ContentSection` |
| DB 마이그레이션 | `20260410500000_guide_awaiting_input.sql` | `awaiting_input` 상태 추가 (배포 대기 중) |

---

## 9. `versionDiff.ts` 내부 알고리즘 요약

```
1. extractSections(guide) → NormalizedSection[]
   - 레거시: motivation, theory_sections[n], reflection, impression, follow_up
   - content_sections: [{key, label, content}]
   - HTML 태그 제거 (stripHtml)

2. diffSections(oldSections, newSections) → SectionDiff[]
   - key 기준 매칭 (Map 사용)
   - 양쪽 존재: 텍스트 같으면 unchanged, 다르면 modified
   - 한쪽만 존재: added 또는 removed

3. diffSentences(oldText, newText) → DiffHunk[]
   - 문장 분리 (정규식: /[.!?。！？]\s+/ 기준)
   - LCS (Longest Common Subsequence) 역추적
   - add/remove/equal 생성

4. compareMeta(older, newer) → MetaDiff
   - 9개 필드 비교 (title, status, guideType, sourceType, difficultyLevel 등)
   - 값이 같으면 null, 다르면 {old, new}
```
