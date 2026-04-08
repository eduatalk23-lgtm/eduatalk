// Re-export stub — 실제 구현은 ../report/actions.ts로 이동됨
// "use server" 제거: 원본 파일이 이미 "use server"이므로 stub에서는 불필요
// (Next.js는 "use server" 파일에서 async function 외 export를 금지)

export { fetchReportData, fetchActiveWarnings } from "../report/actions";
export type { ReportData } from "../report/actions";
