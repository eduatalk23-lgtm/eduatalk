/**
 * SlotEditorPanel 관련 상수
 *
 * @module slot-editor/constants
 */

import {
  BookOpen,
  Video,
  FileText,
  Clock,
  ClipboardList,
  User,
  Sparkles,
  Package,
} from "lucide-react";
import type { SlotType } from "@/lib/types/content-selection";
import type { SourceTab } from "./types";

export const SLOT_TYPE_CONFIG: Record<
  SlotType,
  { icon: typeof BookOpen; label: string; color: string }
> = {
  book: { icon: BookOpen, label: "교재", color: "blue" },
  lecture: { icon: Video, label: "강의", color: "green" },
  custom: { icon: FileText, label: "커스텀", color: "purple" },
  self_study: { icon: Clock, label: "자습", color: "orange" },
  test: { icon: ClipboardList, label: "테스트", color: "red" },
};

// DB subject_groups 테이블의 실제 name 값과 일치해야 함
export const DEFAULT_SUBJECT_CATEGORIES = [
  "국어",
  "수학",
  "영어",
  "과학",
  "사회(역사/도덕 포함)",
  "한국사",
];

export const SOURCE_TAB_CONFIG: Record<
  SourceTab,
  { label: string; icon: typeof User }
> = {
  student: { label: "내 콘텐츠", icon: User },
  recommended: { label: "추천", icon: Sparkles },
  master: { label: "마스터 검색", icon: Package },
};
