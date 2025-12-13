"use client";

import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/cn";

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

type CompletionAnimationProps = {
  show: boolean;
  planTitle?: string;
  studyDuration?: string;
  onAnimationComplete?: () => void;
};

export function CompletionAnimation({
  show,
  planTitle = "학습 플랜",
  studyDuration,
  onAnimationComplete,
}: CompletionAnimationProps) {
  const [confetti, setConfetti] = useState<
    Array<{ id: number; x: number; delay: number; colorIndex: number }>
  >([]);

  useEffect(() => {
    if (show) {
      // 컨페티 생성
      const items = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.3,
        colorIndex: i % CONFETTI_COLORS.length,
      }));
      setConfetti(items);

      // 3초 후 애니메이션 완료 콜백
      const timer = setTimeout(() => {
        onAnimationComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onAnimationComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={onAnimationComplete}
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

          {/* 메인 완료 카드 */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            exit={{ scale: 0, rotate: 180 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 20,
            }}
            className="relative flex max-w-md flex-col items-center gap-6 rounded-2xl bg-white p-8 shadow-2xl px-4"
          >
            {/* 체크 아이콘 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                delay: 0.2,
                type: "spring",
                stiffness: 300,
                damping: 15,
              }}
              className="relative"
            >
              <div className="absolute inset-0 animate-ping rounded-full bg-green-400 opacity-75" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </motion.div>

            {/* 텍스트 */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex flex-col items-center gap-2 text-center"
            >
              <h2 className="text-2xl font-bold text-gray-900">
                🎉 학습 완료!
              </h2>
              <p className="text-sm text-gray-600 line-clamp-2">{planTitle}</p>
              {studyDuration && (
                <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-semibold text-indigo-700">
                    {studyDuration} 동안 학습하셨어요!
                  </span>
                </div>
              )}
            </motion.div>

            {/* 닫기 안내 */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xs text-gray-400"
            >
              아무 곳이나 클릭하여 닫기
            </motion.p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

