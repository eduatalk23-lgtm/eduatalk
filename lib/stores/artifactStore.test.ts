import { describe, expect, it, beforeEach } from "vitest";
import { useArtifactStore } from "./artifactStore";

function resetStore() {
  useArtifactStore.setState({
    artifact: null,
    versions: [],
    editMode: false,
    draftProps: null,
  });
}

describe("artifactStore — Phase C-3 edit flow", () => {
  beforeEach(() => resetStore());

  it("enterEditMode: 현재 props 를 draft 로 복제 + editMode on", () => {
    const initialProps = { rows: [{ rawScore: 90, rankGrade: 2 }] };
    useArtifactStore.setState({
      artifact: {
        id: "a1",
        type: "scores",
        title: "성적",
        props: initialProps,
        persistedId: "art-1",
        versionNo: 1,
      },
    });

    useArtifactStore.getState().enterEditMode();

    const state = useArtifactStore.getState();
    expect(state.editMode).toBe(true);
    expect(state.draftProps).toBe(initialProps);
  });

  it("enterEditMode: artifact 없으면 no-op", () => {
    useArtifactStore.getState().enterEditMode();
    expect(useArtifactStore.getState().editMode).toBe(false);
  });

  it("updateDraft: editMode 에서만 draft 갱신", () => {
    useArtifactStore.setState({
      artifact: {
        id: "a1",
        type: "scores",
        title: "성적",
        props: { n: 1 },
        persistedId: "art-1",
      },
      editMode: true,
      draftProps: { n: 1 },
    });

    useArtifactStore.getState().updateDraft({ n: 2 });
    expect(useArtifactStore.getState().draftProps).toEqual({ n: 2 });
  });

  it("updateDraft: editMode off 면 무시", () => {
    useArtifactStore.setState({
      artifact: { id: "a1", type: "scores", title: "성적", props: { n: 1 } },
      editMode: false,
      draftProps: null,
    });

    useArtifactStore.getState().updateDraft({ n: 99 });
    expect(useArtifactStore.getState().draftProps).toBe(null);
  });

  it("discardDraft: draft 버리고 editMode off", () => {
    useArtifactStore.setState({
      artifact: { id: "a1", type: "scores", title: "성적", props: { n: 1 } },
      editMode: true,
      draftProps: { n: 999 },
    });

    useArtifactStore.getState().discardDraft();

    const state = useArtifactStore.getState();
    expect(state.editMode).toBe(false);
    expect(state.draftProps).toBe(null);
    expect(state.artifact?.props).toEqual({ n: 1 });
  });

  it("commitDraft: 새 버전으로 artifact.props 교체 + versionNo 갱신", () => {
    useArtifactStore.setState({
      artifact: {
        id: "a1",
        type: "scores",
        title: "성적",
        props: { n: 1 },
        persistedId: "art-1",
        versionNo: 1,
      },
      editMode: true,
      draftProps: { n: 42 },
    });

    useArtifactStore.getState().commitDraft(2);

    const state = useArtifactStore.getState();
    expect(state.artifact?.props).toEqual({ n: 42 });
    expect(state.artifact?.versionNo).toBe(2);
    expect(state.editMode).toBe(false);
    expect(state.draftProps).toBe(null);
  });

  it("switchVersion: editMode 중이었어도 draft 자동 discard", () => {
    useArtifactStore.setState({
      artifact: {
        id: "a1",
        type: "scores",
        title: "성적",
        props: { n: 2 },
        persistedId: "art-1",
        versionNo: 2,
      },
      editMode: true,
      draftProps: { n: 999 },
    });

    useArtifactStore.getState().switchVersion(1, { n: 1 });

    const state = useArtifactStore.getState();
    expect(state.artifact?.props).toEqual({ n: 1 });
    expect(state.artifact?.versionNo).toBe(1);
    expect(state.editMode).toBe(false);
    expect(state.draftProps).toBe(null);
  });

  it("closeArtifact: 편집 상태도 완전 초기화", () => {
    useArtifactStore.setState({
      artifact: { id: "a1", type: "scores", title: "성적", props: { n: 1 } },
      editMode: true,
      draftProps: { n: 99 },
      versions: [
        { id: "v1", versionNo: 1, createdAt: "2026-01-01", editedByUserId: null, props: { n: 1 } },
      ],
    });

    useArtifactStore.getState().closeArtifact();

    const state = useArtifactStore.getState();
    expect(state.artifact).toBe(null);
    expect(state.editMode).toBe(false);
    expect(state.draftProps).toBe(null);
    expect(state.versions).toEqual([]);
  });

  it("openArtifact: 이전 편집 상태 자동 리셋", () => {
    useArtifactStore.setState({
      artifact: { id: "a1", type: "scores", title: "이전", props: { n: 0 } },
      editMode: true,
      draftProps: { n: 999 },
    });

    useArtifactStore.getState().openArtifact({
      id: "a2",
      type: "scores",
      title: "신규",
      props: { n: 5 },
    });

    const state = useArtifactStore.getState();
    expect(state.artifact?.id).toBe("a2");
    expect(state.editMode).toBe(false);
    expect(state.draftProps).toBe(null);
  });
});
