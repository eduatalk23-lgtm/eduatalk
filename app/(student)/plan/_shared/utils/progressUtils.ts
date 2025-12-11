/**
 * Progress Utilities
 * 
 * Shared progress calculation functions used across
 * the plan directory components.
 */

export type ProgressColor = "green" | "blue" | "orange" | "red";

/**
 * Calculate percentage from completed and total counts
 */
export function calculateProgressPercentage(completed: number, total: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Get the appropriate color for a progress indicator
 */
export function getProgressColor(completed: number, total: number): ProgressColor {
  if (completed === total && total > 0) return "green";
  if (completed > 0) return "blue";
  return "orange";
}

/**
 * Get progress status text
 */
export function getProgressStatusText(completed: number, total: number): string {
  const percentage = calculateProgressPercentage(completed, total);
  
  if (completed === 0) {
    return "시작 전";
  } else if (completed >= total) {
    return "완료";
  } else if (percentage >= 50) {
    return "진행 중";
  } else {
    return "시작됨";
  }
}

/**
 * Format progress display string
 */
export function formatProgressDisplay(
  completed: number, 
  total: number, 
  options: { showPercentage?: boolean; showCount?: boolean } = {}
): string {
  const { showPercentage = true, showCount = true } = options;
  const percentage = calculateProgressPercentage(completed, total);
  
  const parts: string[] = [];
  
  if (showCount) {
    parts.push(`${completed}/${total}`);
  }
  
  if (showPercentage) {
    parts.push(`${percentage}%`);
  }
  
  return parts.join(" ");
}
