"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Trophy, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  LevelBadge,
  XPProgressBar,
  StreakDisplay,
  AchievementBadge,
  AchievementUnlockModal,
} from "@/components/gamification";
import {
  getGamificationDashboard,
  markAchievementsNotified,
  calculateLevelFromXp,
} from "@/lib/domains/gamification";
import type {
  GamificationDashboard,
  AchievementWithDefinition,
} from "@/lib/domains/gamification/types";

interface GamificationWidgetProps {
  studentId: string;
  tenantId: string;
  className?: string;
}

// 세션 스토리지 키 - 이미 표시한 업적 추적
const SHOWN_ACHIEVEMENTS_KEY = "gamification_shown_achievements";

// 세션 스토리지에서 이미 표시한 업적 ID 조회
function getShownAchievements(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const stored = sessionStorage.getItem(SHOWN_ACHIEVEMENTS_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
}

// 세션 스토리지에 표시한 업적 ID 추가
function addShownAchievements(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    const current = getShownAchievements();
    ids.forEach((id) => current.add(id));
    sessionStorage.setItem(SHOWN_ACHIEVEMENTS_KEY, JSON.stringify([...current]));
  } catch {
    // 스토리지 오류 무시
  }
}

export function GamificationWidget({
  studentId,
  tenantId,
  className,
}: GamificationWidgetProps) {
  const [dashboard, setDashboard] = useState<GamificationDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unnotifiedAchievements, setUnnotifiedAchievements] = useState<AchievementWithDefinition[]>([]);

  // 모달 라이프사이클 보호용 refs
  const modalShownRef = useRef(false);
  const acknowledgeInProgressRef = useRef(false);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const result = await getGamificationDashboard(studentId, tenantId);
        if (result.success && result.data) {
          setDashboard(result.data);

          // 이미 표시한 업적 필터링 (세션 레벨 중복 방지)
          const shownIds = getShownAchievements();
          const newUnnotified = result.data.unnotifiedAchievements.filter(
            (a) => !shownIds.has(a.id)
          );

          // 모달 표시 조건:
          // 1. 새로운 알림 안 된 업적이 있음
          // 2. 이 컴포넌트 라이프사이클에서 모달이 아직 표시되지 않음
          // 3. acknowledge 처리 중이 아님
          if (
            newUnnotified.length > 0 &&
            !modalShownRef.current &&
            !acknowledgeInProgressRef.current
          ) {
            setUnnotifiedAchievements(newUnnotified);
            setShowUnlockModal(true);
            modalShownRef.current = true;
          }
        }
      } catch (error) {
        console.error("Failed to load gamification dashboard:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboard();
  }, [studentId, tenantId]);

  const handleAcknowledgeAchievements = useCallback(
    async (achievementIds: string[]) => {
      if (acknowledgeInProgressRef.current) return;

      acknowledgeInProgressRef.current = true;

      // Optimistic update: 세션 스토리지에 즉시 추가
      addShownAchievements(achievementIds);

      // Optimistic update: 로컬 상태도 즉시 클리어
      setUnnotifiedAchievements([]);

      try {
        await markAchievementsNotified(studentId, achievementIds);
      } catch (error) {
        console.error("Failed to mark achievements as notified:", error);
        // 롤백하지 않음 - 이 세션에서는 다시 표시되지 않아야 함
      } finally {
        acknowledgeInProgressRef.current = false;
      }
    },
    [studentId]
  );

  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-xl p-4 shadow-sm animate-pulse", className)}>
        <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
        <div className="h-16 bg-gray-200 rounded" />
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const { stats, recentAchievements } = dashboard;
  const levelInfo = calculateLevelFromXp(stats.totalXp);

  return (
    <>
      <div className={cn("bg-white rounded-xl shadow-sm overflow-hidden", className)}>
        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h3 className="font-semibold text-gray-900">내 성과</h3>
          </div>
          <Link
            href="/dashboard/achievements"
            className="text-sm text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            전체보기
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Level and XP */}
          <div className="flex items-center gap-4">
            <LevelBadge level={stats.currentLevel} size="lg" showLabel={false} />
            <div className="flex-1">
              <XPProgressBar
                levelInfo={levelInfo}
                totalXp={stats.totalXp}
                size="sm"
                showDetails={false}
              />
              <div className="flex items-center justify-between mt-1 text-xs text-gray-500">
                <span>Lv.{stats.currentLevel}</span>
                <span>{stats.totalXp.toLocaleString()} XP</span>
              </div>
            </div>
          </div>

          {/* Streak */}
          <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-3">
            <StreakDisplay
              currentStreak={stats.currentStreak}
              longestStreak={stats.longestStreak}
              streakProtectionCount={stats.streakProtectionCount}
              size="sm"
              showDetails={false}
            />
            <div className="text-right">
              <div className="text-xs text-gray-500">총 학습 시간</div>
              <div className="font-semibold text-gray-900">
                {Math.floor(stats.totalStudyMinutes / 60)}시간 {stats.totalStudyMinutes % 60}분
              </div>
            </div>
          </div>

          {/* Recent Achievements */}
          {recentAchievements.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-2">최근 획득 업적</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {recentAchievements.slice(0, 4).map((achievement) => (
                  <AchievementBadge
                    key={achievement.id}
                    achievement={achievement.definition}
                    earned
                    earnedAt={achievement.earnedAt}
                    size="sm"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Stats summary */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalPlansCompleted}
              </div>
              <div className="text-xs text-gray-500">완료한 플랜</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {dashboard.achievements.length}
              </div>
              <div className="text-xs text-gray-500">획득 업적</div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievement Unlock Modal */}
      {showUnlockModal && unnotifiedAchievements.length > 0 && (
        <AchievementUnlockModal
          achievements={unnotifiedAchievements}
          onClose={() => setShowUnlockModal(false)}
          onAcknowledge={handleAcknowledgeAchievements}
        />
      )}
    </>
  );
}
