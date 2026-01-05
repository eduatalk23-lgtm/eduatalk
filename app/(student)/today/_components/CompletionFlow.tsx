"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, X, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NextPlanSuggestion, DailyProgress } from "@/lib/domains/today/services/nextPlanService";
import {
  NextPlanCard,
  AllPlansCompleteCard,
  BreakRecommendedCard,
} from "./NextPlanCard";
import { SatisfactionRating } from "./SatisfactionRating";

interface CompletionFlowProps {
  show: boolean;
  planTitle?: string;
  studyDuration?: string;
  nextSuggestion?: NextPlanSuggestion;
  dailyProgress?: DailyProgress;
  onClose: () => void;
  onStartNextPlan?: (planId: string) => void;
  // 만족도 평가용 props
  planId?: string;
  studentId?: string;
  tenantId?: string;
  contentType?: string;
  subjectType?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  completionRate?: number;
}

const CONFETTI_COLORS = [
  "bg-pink-400",
  "bg-purple-400",
  "bg-blue-400",
  "bg-cyan-400",
  "bg-green-400",
  "bg-yellow-400",
  "bg-orange-400",
  "bg-red-400",
] as const;

/**
 * 학습 완료 후 흐름 컴포넌트
 *
 * 기존 CompletionAnimation을 확장하여:
 * 1. 완료 축하 애니메이션
 * 2. 일일 진행률 표시
 * 3. 다음 플랜 제안
 * 4. 사용자 선택 옵션 제공
 */
export function CompletionFlow({
  show,
  planTitle = "학습 플랜",
  studyDuration,
  nextSuggestion,
  dailyProgress,
  onClose,
  onStartNextPlan,
  // 만족도 평가용 props
  planId,
  studentId,
  tenantId,
  contentType,
  subjectType,
  estimatedDuration,
  actualDuration,
  completionRate,
}: CompletionFlowProps) {
  const router = useRouter();
  const [confetti, setConfetti] = useState<
    Array<{ id: number; x: number; delay: number; colorIndex: number }>
  >([]);
  const [motionComponents, setMotionComponents] = useState<{
    motion: typeof import("framer-motion").motion;
    AnimatePresence: typeof import("framer-motion").AnimatePresence;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [ratingCompleted, setRatingCompleted] = useState(false);
  const showSatisfactionRating = planId && studentId && !ratingCompleted;

  // 만족도 평가 완료/건너뛰기 핸들러
  const handleRatingComplete = useCallback(() => {
    setRatingCompleted(true);
  }, []);

  const handleRatingSkip = useCallback(() => {
    setRatingCompleted(true);
  }, []);

  // framer-motion 동적 로드
  useEffect(() => {
    if (show && !motionComponents) {
      import("framer-motion")
        .then((mod) => {
          setMotionComponents({
            motion: mod.motion,
            AnimatePresence: mod.AnimatePresence,
          });
          setLoading(false);
        })
        .catch((error) => {
          console.error("[CompletionFlow] framer-motion 로드 실패", error);
          setLoading(false);
        });
    } else if (!show) {
      setLoading(false);
    }
  }, [show, motionComponents]);

  // 컨페티 생성 및 콘텐츠 표시 타이밍
  useEffect(() => {
    if (show) {
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.3,
        colorIndex: i % CONFETTI_COLORS.length,
      }));
      setConfetti(items);

      // 0.5초 후 콘텐츠 표시
      const timer = setTimeout(() => {
        setShowContent(true);
      }, 500);

      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      setRatingCompleted(false); // 다시 열릴 때 평가 상태 리셋
    }
  }, [show]);

  // 다음 플랜 시작 핸들러
  const handleStartNextPlan = useCallback(() => {
    if (nextSuggestion?.plan && onStartNextPlan) {
      onStartNextPlan(nextSuggestion.plan.id);
    }
    onClose();
  }, [nextSuggestion, onStartNextPlan, onClose]);

  // 휴식 후 시작 (추후 알림 기능 연동)
  const handleStartAfterBreak = useCallback(() => {
    // TODO: 알림 설정 기능 연동
    // 현재는 단순히 닫기만 처리
    onClose();
  }, [onClose]);

  // 오늘 학습 종료
  const handleEndToday = useCallback(() => {
    onClose();
    router.push("/today");
  }, [onClose, router]);

  if (!show || loading || !motionComponents) {
    return null;
  }

  const { motion, AnimatePresence } = motionComponents;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        >
          {/* 컨페티 효과 */}
          {confetti.map((item) => (
            <motion.div
              key={item.id}
              initial={{ y: -100, x: `${item.x}vw`, opacity: 1, rotate: 0 }}
              animate={{
                y: "100vh",
                rotate: 360,
                opacity: 0,
              }}
              transition={{
                duration: 2,
                delay: item.delay,
                ease: "easeIn",
              }}
              className={cn(
                "absolute h-3 w-3 rounded-full",
                CONFETTI_COLORS[item.colorIndex]
              )}
            />
          ))}

          {/* 메인 카드 */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
            }}
            className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
          >
            {/* 닫기 버튼 */}
            <button
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>

            {/* 상단 축하 영역 */}
            <div className="bg-gradient-to-br from-green-400 to-green-600 px-6 py-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 300,
                  damping: 15,
                }}
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-lg"
              >
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="text-xl font-bold text-white">학습 완료!</h2>
                <p className="mt-1 text-sm text-green-100 line-clamp-1">
                  {planTitle}
                </p>
                {studyDuration && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                    <span className="text-sm font-medium text-white">
                      {studyDuration} 학습
                    </span>
                  </div>
                )}
              </motion.div>
            </div>

            {/* 진행률 및 다음 플랜 영역 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showContent ? 1 : 0 }}
              transition={{ delay: 0.3 }}
              className="px-6 py-5"
            >
              {/* 만족도 평가 (planId와 studentId가 있고 아직 평가 안 했을 때) */}
              {showSatisfactionRating && planId && studentId && (
                <div className="mb-5">
                  <SatisfactionRating
                    planId={planId}
                    studentId={studentId}
                    tenantId={tenantId}
                    contentType={contentType}
                    subjectType={subjectType}
                    estimatedDuration={estimatedDuration}
                    actualDuration={actualDuration}
                    completionRate={completionRate}
                    onComplete={handleRatingComplete}
                    onSkip={handleRatingSkip}
                  />
                </div>
              )}

              {/* 일일 진행률 */}
              {dailyProgress && dailyProgress.totalCount > 0 && (
                <div className="mb-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">오늘 진행률</span>
                    <span className="font-semibold text-gray-900">
                      {dailyProgress.completedCount}/{dailyProgress.totalCount}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${dailyProgress.completionRate}%` }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className="h-full rounded-full bg-green-500"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500 text-right">
                    {dailyProgress.completionRate}% 완료
                  </p>
                </div>
              )}

              {/* 다음 플랜 제안 */}
              {nextSuggestion && (
                <div className="space-y-3">
                  {nextSuggestion.type === "daily_complete" ? (
                    <AllPlansCompleteCard
                      message={nextSuggestion.message}
                      subMessage={nextSuggestion.subMessage}
                    />
                  ) : nextSuggestion.type === "break_recommended" &&
                    nextSuggestion.plan ? (
                    <BreakRecommendedCard
                      plan={nextSuggestion.plan}
                      message={nextSuggestion.message}
                      subMessage={nextSuggestion.subMessage}
                      suggestedBreakMinutes={nextSuggestion.suggestedBreakMinutes || 10}
                      onStartNow={handleStartNextPlan}
                      onStartAfterBreak={handleStartAfterBreak}
                      onSkip={handleEndToday}
                    />
                  ) : nextSuggestion.plan ? (
                    <div>
                      <p className="mb-2 text-sm font-medium text-gray-700">
                        {nextSuggestion.message}
                      </p>
                      <NextPlanCard
                        plan={nextSuggestion.plan}
                        onStart={handleStartNextPlan}
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {/* 기본 버튼 (다음 플랜이 없는 경우) */}
              {(!nextSuggestion || nextSuggestion.type === "daily_complete") && (
                <button
                  onClick={handleEndToday}
                  className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
                >
                  확인
                </button>
              )}

              {/* 오늘 학습 종료 버튼 (다음 플랜이 있는 경우) */}
              {nextSuggestion &&
                nextSuggestion.type !== "daily_complete" &&
                nextSuggestion.type !== "break_recommended" && (
                  <button
                    onClick={handleEndToday}
                    className="mt-3 w-full text-center text-sm text-gray-500 hover:text-gray-700"
                  >
                    오늘은 여기까지
                  </button>
                )}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
