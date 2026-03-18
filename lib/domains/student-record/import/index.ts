// ============================================
// 생기부 Import 모듈 — Public API
// ============================================

// 타입
export type {
  ImportFileFormat,
  ExtractedContent,
  RecordImportData,
  SubjectMatch,
  ManualSubjectMapping,
  ImportPreviewData,
  ImportExecuteOptions,
  ImportResult,
  ImportPhase,
  ImportProgress,
} from "./types";

// 클라이언트 (브라우저 전용)
export {
  detectFileFormat,
  validateImportFile,
  extractContent,
  ACCEPT_FILE_TYPES,
} from "./extractor";

// 클라이언트 (HTML 직접 파싱 / Gemini 호출)
export { parseNeisHtml } from "./html-parser";
export { parseRecordContent } from "./parser";

// 서버 전용
export { matchSubjects, applyManualMappings, buildSubjectIdMap } from "./subject-matcher";
export { mapAllRecords } from "./mapper";
export type { MappedRecordData } from "./mapper";
export { executeImport } from "./importer";
