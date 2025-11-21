export type Goal = {
  id: string;
  student_id: string;
  goal_type: "range" | "exam" | "weekly" | "monthly" | "weak_subject";
  title: string;
  description: string | null;
  subject: string | null;
  content_id: string | null;
  start_date: string;
  end_date: string;
  expected_amount: number | null;
  target_score: number | null;
  created_at: string;
};

export type GoalProgress = {
  id: string;
  goal_id: string;
  student_id: string;
  plan_id: string | null;
  session_id: string | null;
  progress_amount: number | null;
  recorded_at: string;
};

export type GoalProgressResult = {
  currentAmount: number;
  expectedAmount: number;
  progressPercentage: number;
  status: "scheduled" | "in_progress" | "completed" | "failed";
  daysRemaining: number | null;
  daysUntilStart: number | null;
  dailyRequiredAmount: number | null; // 하루에 필요한 학습량
  recent3DaysAmount: number; // 최근 3일 학습량
};

// 목표 달성률 계산
export function calculateGoalProgress(
  goal: Goal,
  progressRows: GoalProgress[],
  today: Date = new Date()
): GoalProgressResult {
  const todayDate = today.toISOString().slice(0, 10);
  const startDate = new Date(goal.start_date);
  const endDate = new Date(goal.end_date);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  // 현재 달성량 계산
  const currentAmount = progressRows.reduce(
    (sum, row) => sum + (row.progress_amount || 0),
    0
  );

  const expectedAmount = goal.expected_amount || 0;
  const progressPercentage =
    expectedAmount > 0 ? Math.min(100, Math.round((currentAmount / expectedAmount) * 100)) : 0;

  // 상태 계산
  let status: "scheduled" | "in_progress" | "completed" | "failed";
  if (today < startDate) {
    status = "scheduled";
  } else if (progressPercentage >= 100) {
    status = "completed";
  } else if (today > endDate) {
    status = "failed";
  } else {
    status = "in_progress";
  }

  // 날짜 계산
  const daysUntilStart = today < startDate ? Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
  const daysRemaining = today <= endDate ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;

  // 하루에 필요한 학습량 계산
  let dailyRequiredAmount: number | null = null;
  if (status === "in_progress" && daysRemaining !== null && daysRemaining > 0) {
    const remainingAmount = expectedAmount - currentAmount;
    dailyRequiredAmount = Math.ceil(remainingAmount / daysRemaining);
  }

  // 최근 3일 학습량 계산
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(today.getDate() - 3);
  const recent3DaysAmount = progressRows
    .filter((row) => {
      const recordedDate = new Date(row.recorded_at);
      return recordedDate >= threeDaysAgo;
    })
    .reduce((sum, row) => sum + (row.progress_amount || 0), 0);

  return {
    currentAmount,
    expectedAmount,
    progressPercentage,
    status,
    daysRemaining,
    daysUntilStart,
    dailyRequiredAmount,
    recent3DaysAmount,
  };
}

// 목표 상태 라벨
export function getGoalStatusLabel(status: GoalProgressResult["status"]): string {
  switch (status) {
    case "scheduled":
      return "예정";
    case "in_progress":
      return "진행중";
    case "completed":
      return "완료";
    case "failed":
      return "미달성";
    default:
      return "알 수 없음";
  }
}

// 목표 타입 라벨
export function getGoalTypeLabel(goalType: Goal["goal_type"]): string {
  switch (goalType) {
    case "range":
      return "단원/범위";
    case "exam":
      return "시험 대비";
    case "weekly":
      return "주간 목표";
    case "monthly":
      return "월간 목표";
    default:
      return goalType;
  }
}

// 목표 타입 색상
export function getGoalTypeColor(goalType: Goal["goal_type"]): string {
  switch (goalType) {
    case "range":
      return "bg-blue-100 text-blue-800";
    case "exam":
      return "bg-red-100 text-red-800";
    case "weekly":
      return "bg-green-100 text-green-800";
    case "monthly":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}
