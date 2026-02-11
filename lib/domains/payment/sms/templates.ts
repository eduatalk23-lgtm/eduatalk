/** 납부 예정 알림 (D-3) */
export function getPreDueMessage(vars: {
  studentName: string;
  programName: string;
  amount: number;
  dueDate: string;
}): string {
  return `[TimeLevelUp] ${vars.studentName}님, ${vars.programName} 수강료 ${vars.amount.toLocaleString()}원 납부기한이 ${vars.dueDate}입니다. 기한 내 납부 부탁드립니다.`;
}

/** 연체 독촉 알림 */
export function getOverdueMessage(vars: {
  studentName: string;
  amount: number;
  daysPastDue: number;
}): string {
  return `[TimeLevelUp] ${vars.studentName}님, 수강료 ${vars.amount.toLocaleString()}원이 ${vars.daysPastDue}일 연체 중입니다. 납부 부탁드립니다.`;
}

/** 수강 만료 예정 알림 */
export function getExpiryWarningMessage(vars: {
  studentName: string;
  programName: string;
  daysUntilExpiry: number;
}): string {
  return `[TimeLevelUp] ${vars.studentName}님의 ${vars.programName} 프로그램이 ${vars.daysUntilExpiry}일 후 종료됩니다. 연장을 원하시면 문의해 주세요.`;
}
