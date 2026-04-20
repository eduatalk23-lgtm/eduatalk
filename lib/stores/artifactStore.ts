"use client";

import { create } from "zustand";

export type ArtifactType = "scores" | "plan" | "analysis" | "blueprint" | "generic";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  subtitle?: string;
  props?: unknown;
  /**
   * Phase T-2b: 이 아티팩트의 원본 GUI 경로.
   * 지정 시 ArtifactPanel 헤더에 "원본 보기" 링크 렌더.
   */
  originPath?: string;
  /**
   * Phase C-2: DB-backed artifact 식별. 클라이언트 ephemeral 객체(tool 즉시 열림)
   * 인 경우 null. 버전 탭·히스토리 조회는 persistedId 가 있어야 가능.
   */
  persistedId?: string | null;
  /**
   * Phase C-2: 현재 표시 중인 버전 번호. 서버 hydration 이 끝나면 채워짐.
   */
  versionNo?: number | null;
};

/** Phase C-2: 버전 히스토리 1 행 (API 응답과 동일 필드 + snake→camel 매핑 후). */
export type ArtifactVersionSummary = {
  id: string;
  versionNo: number;
  createdAt: string;
  editedByUserId: string | null;
  /** props 는 전체 포함 — 탭 클릭 시 즉시 전환용. */
  props: unknown;
};

type ArtifactStore = {
  artifact: Artifact | null;
  /** 현재 artifact 의 버전 목록 (DESC). 버전 탭 렌더용. */
  versions: ArtifactVersionSummary[];
  /**
   * Phase C-3: 편집 모드 플래그. true 면 ScoresCard 가 input 으로 렌더된다.
   */
  editMode: boolean;
  /**
   * Phase C-3: 편집 중인 props (unsaved). null 이면 artifact.props 가 SSOT.
   */
  draftProps: unknown;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  isOpen: (id: string) => boolean;
  /** 서버 hydration 이후 버전 목록·현재 버전 업데이트. */
  setVersions: (versions: ArtifactVersionSummary[]) => void;
  /** UI 에서 버전 선택 시 props 교체. editMode 면 draft 포기 후 전환. */
  switchVersion: (versionNo: number, props: unknown) => void;
  /** Phase C-3: 편집 진입. 현재 props 를 draft 로 복제. */
  enterEditMode: () => void;
  /** Phase C-3: draft 변경. 저장 전 로컬 상태. */
  updateDraft: (props: unknown) => void;
  /** Phase C-3: 편집 취소. draft 버리고 읽기 모드 복귀. */
  discardDraft: () => void;
  /**
   * Phase C-3: 저장 성공 후 호출. 새 버전을 active 로, draft 클리어, editMode off.
   * versions 목록 재동기화는 상위 훅(`useArtifactHistory`)이 담당.
   */
  commitDraft: (versionNo: number) => void;
};

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  artifact: null,
  versions: [],
  editMode: false,
  draftProps: null,
  openArtifact: (artifact) =>
    set({ artifact, versions: [], editMode: false, draftProps: null }),
  closeArtifact: () =>
    set({ artifact: null, versions: [], editMode: false, draftProps: null }),
  isOpen: (id) => get().artifact?.id === id,
  setVersions: (versions) => set({ versions }),
  switchVersion: (versionNo, props) => {
    const current = get().artifact;
    if (!current) return;
    set({
      artifact: { ...current, props, versionNo },
      editMode: false,
      draftProps: null,
    });
  },
  enterEditMode: () => {
    const current = get().artifact;
    if (!current) return;
    set({ editMode: true, draftProps: current.props });
  },
  updateDraft: (props) => {
    if (!get().editMode) return;
    set({ draftProps: props });
  },
  discardDraft: () => set({ editMode: false, draftProps: null }),
  commitDraft: (versionNo) => {
    const current = get().artifact;
    const draft = get().draftProps;
    if (!current) return;
    set({
      artifact: { ...current, props: draft, versionNo },
      editMode: false,
      draftProps: null,
    });
  },
}));
