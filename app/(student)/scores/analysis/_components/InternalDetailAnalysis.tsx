"use client";

import { useMemo, useState } from "react";
import { calculateGPATrend, calculateSubjectRanking, analyzeWeakPoints } from "@/lib/analysis/scoreAnalyzer";
import { enrichInternalScores } from "@/lib/utils/scoreTransform";
import type { InternalScoreWithRelations } from "@/lib/types/scoreAnalysis";
import InternalGPAChart from "./InternalGPAChart";
import InternalSubjectTable from "./InternalSubjectTable";

type InternalDetailAnalysisProps = {
  studentId: string;
  tenantId: string;
  scores: InternalScoreWithRelations[];
};

export default function InternalDetailAnalysis({
  studentId,
  tenantId,
  scores,
}: InternalDetailAnalysisProps) {
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  
  // 중복 제거: 한 번만 변환
  const enrichedScores = useMemo(
    () => enrichInternalScores(scores),
    [scores]
  );

  // 필터링된 성적
  const filteredScores = useMemo(() => {
    let filtered = enrichedScores;
    
    if (filterGrade !== "all") {
      const gradeNum = parseInt(filterGrade);
      filtered = filtered.filter((s) => s.grade === gradeNum);
    }
    
    if (filterSemester !== "all") {
      const semesterNum = parseInt(filterSemester);
      filtered = filtered.filter((s) => s.semester === semesterNum);
    }
    
    return filtered;
  }, [enrichedScores, filterGrade, filterSemester]);

  // GPA 추이 계산
  const gpaTrend = useMemo(() => calculateGPATrend(filteredScores), [filteredScores]);

  // 과목별 순위 계산
  const subjectRanking = useMemo(() => {
    return calculateSubjectRanking(filteredScores);
  }, [filteredScores]);

  // 취약 과목 분석
  const weakSubjects = useMemo(() => {
    return analyzeWeakPoints(filteredScores);
  }, [filteredScores]);
  
  // 사용 가능한 학년 및 학기 목록
  const availableGrades = useMemo(() => {
    const grades = new Set<number>();
    enrichedScores.forEach((s) => {
      if (s.grade) grades.add(s.grade);
    });
    return Array.from(grades).sort();
  }, [enrichedScores]);
  
  const availableSemesters = useMemo(() => {
    const semesters = new Set<number>();
    enrichedScores.forEach((s) => {
      if (s.semester) semesters.add(s.semester);
    });
    return Array.from(semesters).sort();
  }, [enrichedScores]);

  if (scores.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12">
        <div className="flex flex-col gap-2 text-center">
          <p className="text-gray-600">내신 성적 데이터가 없습니다.</p>
          <p className="text-sm text-gray-500">
            성적 입력 페이지에서 성적을 입력하세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 필터 */}
      <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">필터</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
              학년
            </label>
            <select
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">전체</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade.toString()}>
                  {grade}학년
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="block text-sm font-medium text-gray-700">
              학기
            </label>
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">전체</option>
              {availableSemesters.map((semester) => (
                <option key={semester} value={semester.toString()}>
                  {semester}학기
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* GPA 추이 차트 */}
      <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          GPA 추이
        </h2>
        <InternalGPAChart data={gpaTrend} scores={filteredScores} />
      </div>

      {/* 과목별 성적 테이블 */}
      <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
        <h2 className="text-lg font-semibold text-gray-900">
          과목별 성적 상세
        </h2>
        <InternalSubjectTable scores={filteredScores} ranking={subjectRanking} />
      </div>

      {/* 취약 과목 분석 */}
      {weakSubjects.length > 0 && (
        <div className="flex flex-col gap-4 bg-white rounded-lg border border-gray-200 p-4 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            취약 과목 분석 (5등급 이하)
          </h2>
          <div className="flex flex-col gap-3">
            {weakSubjects.map((subject) => (
              <div
                key={subject.subject_id}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-gray-900">
                    {subject.subject_name}
                  </p>
                  <p className="text-xs text-gray-600">
                    {subject.subject_group_name}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-semibold text-red-700">
                    평균 {subject.average_grade.toFixed(1)}등급
                  </p>
                  {subject.recent_grade && (
                    <p className="text-xs text-gray-600">
                      최근 {subject.recent_grade}등급
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 성적 요약 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1 bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">전체 과목 수</p>
          <p className="text-2xl font-bold text-gray-900">
            {subjectRanking.length}
          </p>
        </div>
        <div className="flex flex-col gap-1 bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">평균 GPA</p>
          <p className="text-2xl font-bold text-gray-900">
            {gpaTrend.length > 0
              ? (
                  gpaTrend.reduce((sum, t) => sum + t.gpa, 0) / gpaTrend.length
                ).toFixed(2)
              : "N/A"}
          </p>
        </div>
        <div className="flex flex-col gap-1 bg-white rounded-lg border border-gray-200 p-4">
          <p className="text-sm text-gray-600">취약 과목 수</p>
          <p className="text-2xl font-bold text-red-600">
            {weakSubjects.length}
          </p>
        </div>
      </div>
    </div>
  );
}

