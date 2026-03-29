// ============================================
// Agent UI State — 클라이언트 → 서버 전달용 스냅샷
// 에이전트가 사용자의 현재 화면 상태를 인식하기 위한 타입
// ============================================

/** 클라이언트 UI 상태 스냅샷 (매 에이전트 요청 시 전달) */
export interface UIStateSnapshot {
  /** GlobalLayerBar 활성 탭: neis | draft | analysis | guide | direction | memo | chat */
  activeLayerTab: string;
  /** 학년도 필터: "all" 또는 특정 학년도 숫자 */
  viewMode: "all" | number;
  /** TOC 활성 섹션 ID: sec-7-setek, sec-diagnosis-analysis 등 */
  activeSection: string;
  /** 사이드바 단계: record | diagnosis | design | strategy */
  activeStage: string;
  /** ContextGrid/바텀시트에 열린 과목 (없으면 null) */
  focusedSubject: {
    subjectId: string;
    subjectName: string;
    schoolYear: number;
  } | null;
  /** 사이드패널 활성 앱: memo | chat | agent | connections | null */
  sidePanelApp: string | null;
  /** 컨텍스트 그리드 바텀시트 열림 여부 */
  bottomSheetOpen: boolean;
  /** 컨텍스트 탑시트 열림 여부 */
  topSheetOpen: boolean;
}

/** 시스템 프롬프트에 주입할 UI 상태 텍스트 블록 생성 */
export function buildUIContextBlock(uiState: UIStateSnapshot | null): string {
  if (!uiState) return "";

  const TAB_LABELS: Record<string, string> = {
    neis: "NEIS 원문",
    draft: "가안",
    analysis: "분석",
    guide: "가이드",
    direction: "방향",
    memo: "메모",
    chat: "논의",
  };

  const STAGE_LABELS: Record<string, string> = {
    record: "📋 기록",
    diagnosis: "🔍 진단",
    design: "📐 설계",
    strategy: "🎯 전략",
  };

  const lines: string[] = ["\n## 현재 사용자 화면 상태"];
  lines.push(`- 활성 탭: ${TAB_LABELS[uiState.activeLayerTab] ?? uiState.activeLayerTab}`);
  lines.push(`- 보기 모드: ${uiState.viewMode === "all" ? "전체 학년" : `${uiState.viewMode}학년도`}`);
  lines.push(`- 현재 단계: ${STAGE_LABELS[uiState.activeStage] ?? uiState.activeStage}`);

  if (uiState.focusedSubject) {
    lines.push(
      `- 포커스 과목: ${uiState.focusedSubject.subjectName} (${uiState.focusedSubject.schoolYear}학년도)`,
    );
  }

  if (uiState.bottomSheetOpen) lines.push("- 컨텍스트 그리드 바텀시트 열림");
  if (uiState.topSheetOpen) lines.push("- 컨텍스트 탑시트 열림");

  lines.push("");
  lines.push("## 맥락 인식 규칙");
  lines.push('- "이 과목", "현재 과목" 등의 지시어는 포커스 과목을 의미합니다.');
  lines.push('- "지금 보고 있는", "현재 탭" 등은 활성 탭/섹션을 참조합니다.');
  lines.push("- 포커스 과목이 없으면 사용자에게 어떤 과목을 의미하는지 확인하세요.");

  return lines.join("\n");
}
