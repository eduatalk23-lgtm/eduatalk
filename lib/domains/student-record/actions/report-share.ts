// Re-export stub — 실제 구현은 ../report/share.ts로 이동됨
"use server";

export {
  createReportShareAction,
  fetchSharedReportAction,
  deactivateReportShareAction,
} from "../report/share";

export type {
  ReportShare,
  SharedReportData,
} from "../report/share";
