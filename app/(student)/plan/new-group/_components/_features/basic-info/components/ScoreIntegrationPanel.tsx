"use client";

import { useEffect, useState, useCallback } from "react";
import { AlertTriangle, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, RefreshCw, GraduationCap, Target } from "lucide-react";
import {
  getStudentScoreProfile,
  type StudentScoreProfile,
  type SubjectScoreInfo,
  type ScoreTrend,
} from "@/lib/domains/analysis/actions";
import { cn } from "@/lib/cn";

interface ScoreIntegrationPanelProps {
  studentId?: string;
  onWeakSubjectsChange?: (subjects: string[]) => void;
  onTargetGradesChange?: (grades: Record<string, number>) => void;
  className?: string;
  collapsed?: boolean;
}

const TrendIcon = ({ trend }: { trend: ScoreTrend }) => {
  switch (trend) {
    case "improving":
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    case "declining":
      return <TrendingDown className="h-4 w-4 text-red-500" />;
    default:
      return <Minus className="h-4 w-4 text-gray-400" />;
  }
};

const getTrendLabel = (trend: ScoreTrend) => {
  switch (trend) {
    case "improving":
      return "상승";
    case "declining":
      return "하락";
    default:
      return "유지";
  }
};

const getGradeColor = (grade: number | null) => {
  if (grade === null) return "text-gray-400";
  if (grade <= 2) return "text-blue-600";
  if (grade <= 4) return "text-green-600";
  if (grade <= 6) return "text-yellow-600";
  return "text-red-600";
};

const getRiskColor = (riskScore: number) => {
  if (riskScore >= 80) return "bg-red-100 text-red-700 border-red-200";
  if (riskScore >= 60) return "bg-orange-100 text-orange-700 border-orange-200";
  if (riskScore >= 40) return "bg-yellow-100 text-yellow-700 border-yellow-200";
  return "bg-green-100 text-green-700 border-green-200";
};

export function ScoreIntegrationPanel({
  studentId,
  onWeakSubjectsChange,
  onTargetGradesChange,
  className,
  collapsed: initialCollapsed = false,
}: ScoreIntegrationPanelProps) {
  const [profile, setProfile] = useState<StudentScoreProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed);
  const [targetGrades, setTargetGrades] = useState<Record<string, number>>({});
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const result = await getStudentScoreProfile(studentId);

    if (result.success && result.data) {
      setProfile(result.data);

      // 취약 과목 콜백
      if (onWeakSubjectsChange) {
        onWeakSubjectsChange(result.data.weakSubjects.map((s) => s.subjectName));
      }
    } else {
      setError(result.error || "성적 정보를 불러올 수 없습니다.");
    }

    setIsLoading(false);
  }, [studentId, onWeakSubjectsChange]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleTargetGradeChange = (subjectId: string, grade: number) => {
    const newGrades = { ...targetGrades, [subjectId]: grade };
    setTargetGrades(newGrades);
    onTargetGradesChange?.(newGrades);
  };

  if (isLoading) {
    return (
      <div className={cn("rounded-lg border bg-white p-4", className)}>
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-gray-500">성적 정보 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("rounded-lg border border-yellow-200 bg-yellow-50 p-4", className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={fetchProfile}
            className="rounded p-1 text-yellow-600 hover:bg-yellow-100"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  if (!profile || profile.totalScoreCount === 0) {
    return (
      <div className={cn("rounded-lg border border-gray-200 bg-gray-50 p-4", className)}>
        <div className="flex items-center gap-2 text-gray-500">
          <GraduationCap className="h-5 w-5" />
          <span className="text-sm">등록된 성적이 없습니다. 성적을 입력하면 AI가 더 정확한 플랜을 추천합니다.</span>
        </div>
      </div>
    );
  }

  const displaySubjects = showAllSubjects ? profile.allSubjects : profile.weakSubjects;

  return (
    <div className={cn("rounded-lg border bg-white", className)}>
      {/* 헤더 */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
      >
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-primary" />
          <span className="font-medium">성적 연동</span>
          {profile.weakSubjects.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              취약 과목 {profile.weakSubjects.length}개
            </span>
          )}
        </div>
        {isCollapsed ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        )}
      </button>

      {!isCollapsed && (
        <div className="border-t p-4">
          {/* 성적 요약 */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-xs text-blue-600">내신 평균</div>
              <div className={cn("text-2xl font-bold", getGradeColor(profile.overallAverageGrade))}>
                {profile.overallAverageGrade !== null ? `${profile.overallAverageGrade}등급` : "-"}
              </div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-xs text-purple-600">모의고사 평균</div>
              <div className={cn("text-2xl font-bold", getGradeColor(profile.mockAverageGrade))}>
                {profile.mockAverageGrade !== null ? `${profile.mockAverageGrade}등급` : "-"}
              </div>
            </div>
          </div>

          {/* 취약 과목 섹션 */}
          {profile.weakSubjects.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-gray-700">집중 관리 필요 과목</span>
              </div>
              <div className="space-y-2">
                {profile.weakSubjects.slice(0, 3).map((subject) => (
                  <WeakSubjectCard
                    key={subject.subjectId}
                    subject={subject}
                    targetGrade={targetGrades[subject.subjectId]}
                    onTargetGradeChange={handleTargetGradeChange}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 전체 과목 토글 */}
          <div className="border-t pt-3">
            <button
              onClick={() => setShowAllSubjects(!showAllSubjects)}
              className="flex w-full items-center justify-between text-sm text-gray-500 hover:text-gray-700"
            >
              <span>{showAllSubjects ? "취약 과목만 보기" : `전체 과목 보기 (${profile.allSubjects.length}개)`}</span>
              {showAllSubjects ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showAllSubjects && (
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto">
                {profile.allSubjects.map((subject) => (
                  <SubjectRow
                    key={subject.subjectId}
                    subject={subject}
                    targetGrade={targetGrades[subject.subjectId]}
                    onTargetGradeChange={handleTargetGradeChange}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 안내 메시지 */}
          <div className="mt-4 rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
            <p>성적 데이터를 기반으로 AI가 취약 과목을 분석하고, 플랜 생성 시 해당 과목에 더 많은 학습 시간을 배정합니다.</p>
          </div>
        </div>
      )}
    </div>
  );
}

// 취약 과목 카드
function WeakSubjectCard({
  subject,
  targetGrade,
  onTargetGradeChange,
}: {
  subject: SubjectScoreInfo;
  targetGrade?: number;
  onTargetGradeChange: (subjectId: string, grade: number) => void;
}) {
  return (
    <div className={cn("rounded-lg border p-3", getRiskColor(subject.riskScore))}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{subject.subjectName}</span>
            <span className="text-xs opacity-70">{subject.subjectGroup}</span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-sm">
            <span>평균 {subject.averageGrade}등급</span>
            <div className="flex items-center gap-1">
              <TrendIcon trend={subject.trend} />
              <span className="text-xs">{getTrendLabel(subject.trend)}</span>
            </div>
          </div>
        </div>

        {/* 목표 등급 설정 */}
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 opacity-60" />
          <select
            value={targetGrade || ""}
            onChange={(e) => onTargetGradeChange(subject.subjectId, Number(e.target.value))}
            className="rounded border bg-white px-2 py-1 text-sm"
          >
            <option value="">목표</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
              <option key={g} value={g}>
                {g}등급
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

// 일반 과목 행
function SubjectRow({
  subject,
  targetGrade,
  onTargetGradeChange,
}: {
  subject: SubjectScoreInfo;
  targetGrade?: number;
  onTargetGradeChange: (subjectId: string, grade: number) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-gray-50 p-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{subject.subjectName}</span>
        <span className="text-xs text-gray-400">{subject.subjectGroup}</span>
        {subject.isWeak && (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-600">취약</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className={cn("text-sm font-medium", getGradeColor(subject.averageGrade))}>
            {subject.averageGrade}등급
          </span>
          <TrendIcon trend={subject.trend} />
        </div>
        <select
          value={targetGrade || ""}
          onChange={(e) => onTargetGradeChange(subject.subjectId, Number(e.target.value))}
          className="rounded border bg-white px-1.5 py-0.5 text-xs"
        >
          <option value="">목표</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
