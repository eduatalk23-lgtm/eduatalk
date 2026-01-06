# 관리자 영역 플랜 생성 사이드 이펙트 분석

**작성일**: 2026-01-06  
**상태**: 분석 완료, 구현 대기

## 발견된 핵심 문제

### 3개의 분리된 AI 플랜 생성 경로

| 경로 | 파일 | 사용 액션 | 웹 검색 지원 |
|------|------|---------|-------------|
| A. `/admin/plan-creation` | plan-creation/ | `generateBatchPlansWithAI()` | ✅ |
| B. 학생 목록 배치 모달 | BatchAIPlanModalContent | `generateBatchPlansWithAI()` | ✅ |
| C. 학생 개별 모달 | AdminAIPlanModal | `generateHybridPlanCompleteAction()` | ❌ |

**문제**: 경로 C에서 웹 검색 UI는 있으나 실제 연결 안됨

## 권장 해결책: 접근법 B (최소 변경)

AdminAIPlanModal에 WebSearchResultsPanel 통합:

```typescript
// import 추가
import { WebSearchResultsPanel } from "@/components/plan";

// 결과 표시 추가
{generationResult?.webSearchResults?.results &&
 generationResult.webSearchResults.results.length > 0 && (
  <WebSearchResultsPanel
    results={generationResult.webSearchResults.results}
    searchQueries={generationResult.webSearchResults.searchQueries}
    className="mt-4"
  />
)}
```

## 수정 완료 파일

- `app/(admin)/admin/students/[id]/plans/_components/AdminAIPlanModal.tsx`
  - 하이브리드 모드: 웹 검색 미지원 안내 UI로 변경
  - AI-only 모드: AIPlanGeneratorPanel 통해 웹 검색 결과 표시 (이전 작업에서 완료)

## 관련 문서

- `docs/2025-02-02-admin-plan-creation-unified-section-plan.md`
- `docs/2025-01-15-admin-ai-plan-web-search-content-investigation.md`
- `docs/2026-01-06_llm-provider-change-to-gemini.md`

## 선행 완료 작업

학생 영역 웹 검색 결과 표시 구현 완료:
- `lib/domains/plan/llm/actions/generatePlan.ts` - results 필드 추가
- `lib/domains/plan/llm/actions/streamPlan.ts` - webSearchResults 이벤트 추가
- `app/(student)/.../useStreamingGeneration.ts` - 상태 관리
- `app/(student)/.../AIPlanGeneratorPanel.tsx` - WebSearchResultsPanel 통합
