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
};

type ArtifactStore = {
  artifact: Artifact | null;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
  isOpen: (id: string) => boolean;
};

export const useArtifactStore = create<ArtifactStore>((set, get) => ({
  artifact: null,
  openArtifact: (artifact) => set({ artifact }),
  closeArtifact: () => set({ artifact: null }),
  isOpen: (id) => get().artifact?.id === id,
}));
