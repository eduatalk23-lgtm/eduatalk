"use client";

// ============================================
// ContextTabContent — 13개 맥락 탭 정의 + 컨텐츠 라우터
// ContextTopSheet에서 사용. layer-view/BottomSheet.tsx에서 추출.
// 탭 구현체는 context-tabs/ 서브디렉토리로 분리됨.
// ============================================

import type { RecordTabData, DiagnosisTabData, StorylineTabData } from "@/lib/domains/student-record/types";
import { CompetencyTab, GuideRateTab, TeacherTab, DiffTab } from "./context-tabs/RecordContextTabs";
import { SummaryTab, StorylineTab, RoadmapTab, InterviewTab } from "./context-tabs/DesignContextTabs";
import { DiagnosisTab, EdgesTab, GrowthTab, CareerFitTab, CourseFitTab } from "./context-tabs/AnalysisContextTabs";
import { PlaceholderTab } from "./context-tabs/shared";

// ── layer-view/types.ts에서 이동한 타입 ──

export interface RecordArea {
  id: string;
  sectionNumber: 6 | 7 | 8 | 9;
  type: "changche" | "setek" | "reading" | "haengteuk";
  label: string;
  grade: number;
  subjectId?: string;
  activityType?: "autonomy" | "club" | "career";
  recordId?: string;
}

export interface LayerGuideAssignment {
  id: string;
  status: string;
  target_subject_id: string | null;
  target_activity_type: string | null;
  ai_recommendation_reason: string | null;
  confirmed_at: string | null;
  exploration_guides?: { id: string; title: string; guide_type?: string };
}

export interface LayerActivityTag {
  id?: string;
  record_type: string;
  record_id: string;
  competency_item?: string;
  evaluation?: string;
  evidence_summary?: string;
  source?: string;
  status?: string;
}

export interface LayerSetekGuide {
  id?: string;
  subject_id: string;
  source: string;
  status: string;
  direction: string;
  keywords: string[];
  competency_focus?: string[];
  cautions?: string | null;
  teacher_points?: string[];
}

// ── 탭 정의 ──

// 카테고리별 그룹화
export const TAB_GROUPS = [
  {
    label: "현황",
    tabs: [
      { id: "competency", emoji: "📊", label: "역량" },
      { id: "guide-rate", emoji: "📈", label: "이행률" },
      { id: "diff", emoji: "🔄", label: "가안 vs 실생기부" },
    ],
  },
  {
    label: "방향",
    tabs: [
      { id: "summary", emoji: "📋", label: "활동 요약" },
      { id: "teacher", emoji: "👩‍🏫", label: "교사 전달" },
      { id: "storyline", emoji: "📖", label: "스토리라인" },
    ],
  },
  {
    label: "분석",
    tabs: [
      { id: "diagnosis", emoji: "🔬", label: "진단" },
      { id: "edges", emoji: "🔗", label: "연결" },
      { id: "growth", emoji: "📈", label: "성장" },
    ],
  },
  {
    label: "입시",
    tabs: [
      { id: "career-fit", emoji: "🎯", label: "진로" },
      { id: "course-fit", emoji: "📚", label: "수강" },
      { id: "roadmap", emoji: "🗺️", label: "로드맵" },
      { id: "interview", emoji: "🎤", label: "면접" },
    ],
  },
] as const;

export type TabId =
  | "competency" | "guide-rate" | "diff"
  | "summary" | "teacher" | "storyline"
  | "diagnosis" | "edges" | "growth"
  | "career-fit" | "course-fit" | "roadmap" | "interview";
// ── 탭 콘텐츠 라우터 ──

export function TabContent({
  tabId,
  studentId,
  currentArea,
  recordByGrade,
  guideAssignments,
  activityTags,
  setekGuides,
  diagnosisData,
  storylineData,
  tenantId,
}: {
  tabId: TabId;
  studentId: string;
  currentArea?: RecordArea | null;
  recordByGrade: Map<number, { data: RecordTabData }>;
  guideAssignments: LayerGuideAssignment[];
  activityTags: LayerActivityTag[];
  setekGuides: LayerSetekGuide[];
  diagnosisData?: DiagnosisTabData | null;
  storylineData?: StorylineTabData | null;
  tenantId?: string;
}) {
  switch (tabId) {
    case "competency":
      return <CompetencyTab tags={activityTags} currentArea={currentArea} />;
    case "guide-rate":
      return <GuideRateTab assignments={guideAssignments} />;
    case "teacher":
      return <TeacherTab guides={setekGuides} currentArea={currentArea} />;
    case "diff":
      return <DiffTab recordByGrade={recordByGrade} currentArea={currentArea} />;
    case "summary":
      return <SummaryTab studentId={studentId} />;
    case "storyline":
      return <StorylineTab data={storylineData} />;
    case "diagnosis":
      return <DiagnosisTab data={diagnosisData} />;
    case "edges":
      return <EdgesTab studentId={studentId} tenantId={tenantId} />;
    case "growth":
      return <GrowthTab data={diagnosisData} />;
    case "career-fit":
      return <CareerFitTab data={diagnosisData} />;
    case "course-fit":
      return <CourseFitTab data={diagnosisData} />;
    case "roadmap":
      return <RoadmapTab data={storylineData} />;
    case "interview":
      return <InterviewTab studentId={studentId} />;
    default:
      return <PlaceholderTab />;
  }
}

