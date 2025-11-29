import { cn } from "@/lib/cn";
import { Check, Clock, Play } from "lucide-react";

interface CampFlowStep {
  id: string;
  label: string;
  description: string;
  status: "completed" | "active" | "pending";
}

interface CampFlowIndicatorProps {
  currentStep: "participation" | "review" | "planning" | "activation";
  invitation: {
    status: string;
    isDraft: boolean;
    hasPlans: boolean;
    planGroupStatus: string | null;
  };
  className?: string;
}

export function CampFlowIndicator({ currentStep, invitation, className }: CampFlowIndicatorProps) {
  const getSteps = (): CampFlowStep[] => {
    const steps: CampFlowStep[] = [
      {
        id: "participation",
        label: "참여 정보 제출",
        description: "캠프 프로그램 참여 정보를 입력합니다",
        status: invitation.status === "pending" && invitation.isDraft 
          ? "active" 
          : invitation.status === "accepted" || invitation.hasPlans
          ? "completed"
          : "pending"
      },
      {
        id: "review",
        label: "관리자 검토",
        description: "제출된 정보를 검토하고 플랜을 생성합니다",
        status: invitation.status === "accepted" && !invitation.hasPlans
          ? "active"
          : invitation.hasPlans
          ? "completed"
          : "pending"
      },
      {
        id: "planning",
        label: "플랜 생성 완료",
        description: "학습 플랜이 생성되었습니다",
        status: invitation.hasPlans && invitation.planGroupStatus !== "active"
          ? "active"
          : invitation.planGroupStatus === "active"
          ? "completed"
          : "pending"
      },
      {
        id: "activation",
        label: "학습 시작",
        description: "플랜이 활성화되어 학습을 시작할 수 있습니다",
        status: invitation.planGroupStatus === "active"
          ? "completed"
          : invitation.hasPlans
          ? "active"
          : "pending"
      },
    ];

    return steps;
  };

  const steps = getSteps();

  const getStepIcon = (status: CampFlowStep["status"]) => {
    switch (status) {
      case "completed":
        return <Check className="h-4 w-4 text-white" />;
      case "active":
        return <Clock className="h-4 w-4 text-white" />;
      case "pending":
        return <div className="h-2 w-2 rounded-full bg-gray-400" />;
    }
  };

  const getStepColor = (status: CampFlowStep["status"]) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "active":
        return "bg-indigo-500";
      case "pending":
        return "bg-gray-300";
    }
  };

  return (
    <div className={cn("rounded-lg border border-gray-200 bg-white p-4", className)}>
      <h3 className="mb-4 text-sm font-semibold text-gray-900">진행 상태</h3>
      
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* Icon */}
            <div className={cn(
              "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
              getStepColor(step.status)
            )}>
              {getStepIcon(step.status)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className={cn(
                  "text-sm font-semibold",
                  step.status === "active" ? "text-indigo-600" : "text-gray-900"
                )}>
                  {step.label}
                </h4>
                {step.status === "active" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                    <Play className="h-3 w-3" />
                    진행 중
                  </span>
                )}
                {step.status === "completed" && (
                  <span className="text-xs text-green-600">완료</span>
                )}
              </div>
              <p className={cn(
                "mt-0.5 text-xs",
                step.status === "pending" ? "text-gray-400" : "text-gray-600"
              )}>
                {step.description}
              </p>
            </div>

            {/* Connector line (except for last item) */}
            {index < steps.length - 1 && (
              <div className={cn(
                "absolute left-[31px] mt-10 h-6 w-0.5",
                step.status === "completed" ? "bg-green-500" : "bg-gray-200"
              )} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact version for cards
export function CampFlowCompact({ invitation }: { invitation: CampFlowIndicatorProps["invitation"] }) {
  const getCurrentStepLabel = () => {
    if (invitation.status === "pending" && invitation.isDraft) {
      return { label: "참여 정보 작성 중", color: "text-yellow-600", bgColor: "bg-yellow-100" };
    }
    if (invitation.status === "accepted" && !invitation.hasPlans) {
      return { label: "관리자 검토 중", color: "text-blue-600", bgColor: "bg-blue-100" };
    }
    if (invitation.hasPlans && invitation.planGroupStatus !== "active") {
      return { label: "플랜 생성 완료", color: "text-indigo-600", bgColor: "bg-indigo-100" };
    }
    if (invitation.planGroupStatus === "active") {
      return { label: "학습 진행 중", color: "text-green-600", bgColor: "bg-green-100" };
    }
    return { label: "대기 중", color: "text-gray-600", bgColor: "bg-gray-100" };
  };

  const stepInfo = getCurrentStepLabel();

  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
      stepInfo.bgColor,
      stepInfo.color
    )}>
      <div className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      {stepInfo.label}
    </div>
  );
}

