"use client";

import { create } from "zustand";

export type ArtifactType = "scores" | "plan" | "analysis" | "blueprint" | "generic";

export type Artifact = {
  id: string;
  type: ArtifactType;
  title: string;
  subtitle?: string;
  props?: unknown;
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
