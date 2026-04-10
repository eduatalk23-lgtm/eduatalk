/**
 * M2: versionDiff 유틸리티 단위 테스트
 *
 * @module __tests__/lib/domains/guide/utils/versionDiff.test
 */

import { describe, it, expect } from "vitest";
import {
  compareVersions,
  diffSentences,
  countMetaChanges,
} from "@/lib/domains/guide/utils/versionDiff";
import type { GuideDetail } from "@/lib/domains/guide/types";

// ============================================================
// 테스트 헬퍼
// ============================================================

function makeGuide(overrides: Partial<GuideDetail> = {}): GuideDetail {
  return {
    id: "guide-1",
    legacy_id: null,
    tenant_id: null,
    guide_type: "topic_exploration",
    curriculum_year: "2022",
    subject_area: "수학",
    subject_select: "미적분",
    unit_major: null,
    unit_minor: null,
    title: "테스트 가이드",
    book_title: null,
    book_author: null,
    book_publisher: null,
    book_year: null,
    status: "draft",
    source_type: "manual",
    source_reference: null,
    parent_guide_id: null,
    content_format: "html",
    quality_score: null,
    quality_tier: null,
    registered_by: null,
    registered_at: null,
    ai_model_version: null,
    ai_prompt_version: null,
    version: 1,
    is_latest: true,
    original_guide_id: null,
    parent_version_id: null,
    version_message: null,
    review_result: null,
    agent_question: null,
    created_at: "2026-04-10T10:00:00Z",
    updated_at: "2026-04-10T10:00:00Z",
    difficulty_level: null,
    difficulty_auto: true,
    content: null,
    subjects: [],
    career_fields: [],
    classifications: [],
    ...overrides,
  };
}

// ============================================================
// diffSentences 테스트
// ============================================================

describe("diffSentences", () => {
  it("동일한 문장 배열 → 전부 equal", () => {
    const sentences = ["가나다.", "라마바."];
    const hunks = diffSentences(sentences, sentences);
    expect(hunks.every((h) => h.type === "equal")).toBe(true);
  });

  it("빈 배열 비교 → 빈 결과", () => {
    const hunks = diffSentences([], []);
    expect(hunks).toHaveLength(0);
  });

  it("전부 추가 (old 빈 배열)", () => {
    const hunks = diffSentences([], ["새 문장."]);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe("add");
    expect(hunks[0].text).toBe("새 문장.");
  });

  it("전부 삭제 (new 빈 배열)", () => {
    const hunks = diffSentences(["기존 문장."], []);
    expect(hunks).toHaveLength(1);
    expect(hunks[0].type).toBe("remove");
    expect(hunks[0].text).toBe("기존 문장.");
  });

  it("중간에 문장 추가 감지", () => {
    const old = ["첫 문장.", "마지막 문장."];
    const next = ["첫 문장.", "새로 추가된 문장.", "마지막 문장."];
    const hunks = diffSentences(old, next);

    expect(hunks.some((h) => h.type === "add" && h.text.includes("새로 추가된"))).toBe(true);
    expect(hunks.filter((h) => h.type === "equal")).toHaveLength(2);
  });

  it("문장 삭제 감지", () => {
    const old = ["A.", "B.", "C."];
    const next = ["A.", "C."];
    const hunks = diffSentences(old, next);

    expect(hunks.some((h) => h.type === "remove" && h.text === "B.")).toBe(true);
  });

  it("문장 교체 감지 (remove + add)", () => {
    const old = ["원래 문장."];
    const next = ["변경된 문장."];
    const hunks = diffSentences(old, next);

    expect(hunks.some((h) => h.type === "remove")).toBe(true);
    expect(hunks.some((h) => h.type === "add")).toBe(true);
  });
});

// ============================================================
// compareVersions 테스트
// ============================================================

describe("compareVersions", () => {
  it("동일 버전 비교 → 모든 섹션 unchanged, 메타 변경 없음", () => {
    const guide = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: "탐구 동기입니다.",
        theory_sections: [],
        reflection: "고찰입니다.",
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });

    const diff = compareVersions(guide, guide);

    expect(diff.stats.addedSections).toBe(0);
    expect(diff.stats.removedSections).toBe(0);
    expect(diff.stats.modifiedSections).toBe(0);
    expect(diff.stats.totalCharDelta).toBe(0);
    expect(diff.sections.every((s) => s.type === "unchanged")).toBe(true);
    expect(countMetaChanges(diff.meta)).toBe(0);
  });

  it("content가 null인 버전 비교 → 빈 섹션", () => {
    const older = makeGuide({ content: null });
    const newer = makeGuide({ content: null, version: 2 });

    const diff = compareVersions(older, newer);

    expect(diff.sections).toHaveLength(0);
    expect(diff.stats.totalCharDelta).toBe(0);
  });

  it("섹션 추가 감지", () => {
    const older = makeGuide({ content: null });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: "새로운 탐구 동기.",
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    expect(diff.stats.addedSections).toBe(1);
    expect(diff.sections[0].type).toBe("added");
    expect(diff.sections[0].label).toBe("탐구 동기");
    expect(diff.sections[0].charDelta).toBeGreaterThan(0);
  });

  it("섹션 삭제 감지", () => {
    const older = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: "탐구 동기.",
        theory_sections: [],
        reflection: "고찰.",
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: "탐구 동기.",
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    expect(diff.stats.removedSections).toBe(1);
    const removedSection = diff.sections.find((s) => s.type === "removed");
    expect(removedSection).toBeDefined();
    expect(removedSection!.label).toBe("탐구 고찰");
  });

  it("섹션 수정 감지 + hunks 생성", () => {
    const older = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: "기존 탐구 동기 내용입니다.",
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: "수정된 탐구 동기 내용입니다. 추가된 문장.",
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    expect(diff.stats.modifiedSections).toBe(1);
    const modified = diff.sections.find((s) => s.type === "modified");
    expect(modified).toBeDefined();
    expect(modified!.hunks).toBeDefined();
    expect(modified!.hunks!.length).toBeGreaterThan(0);
  });

  it("메타 변경 감지 — title, status, qualityScore", () => {
    const older = makeGuide({
      title: "원래 제목",
      status: "draft",
      quality_score: 72,
    });
    const newer = makeGuide({
      version: 2,
      title: "수정된 제목",
      status: "approved",
      quality_score: 85,
    });

    const diff = compareVersions(older, newer);

    expect(diff.meta.title).not.toBeNull();
    expect(diff.meta.title!.old).toBe("원래 제목");
    expect(diff.meta.title!.new).toBe("수정된 제목");

    expect(diff.meta.status).not.toBeNull();
    expect(diff.meta.status!.old).toBe("draft");
    expect(diff.meta.status!.new).toBe("approved");

    expect(diff.meta.qualityScore).not.toBeNull();
    expect(diff.meta.qualityScore!.old).toBe(72);
    expect(diff.meta.qualityScore!.new).toBe(85);

    expect(countMetaChanges(diff.meta)).toBe(3);
  });

  it("메타 변경 없음 — 같은 값", () => {
    const guide = makeGuide({ title: "동일" });
    const diff = compareVersions(guide, { ...guide, version: 2 });
    expect(countMetaChanges(diff.meta)).toBe(0);
  });

  it("theory_sections diff 감지", () => {
    const older = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: null,
        theory_sections: [
          { order: 1, title: "이론 1", content: "기존 이론 내용" },
        ],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: null,
        theory_sections: [
          { order: 1, title: "이론 1", content: "수정된 이론 내용" },
          { order: 2, title: "이론 2", content: "새 이론" },
        ],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    // theory_1 수정됨, theory_2 추가됨
    expect(diff.stats.modifiedSections).toBe(1);
    expect(diff.stats.addedSections).toBe(1);
    expect(diff.sections.find((s) => s.key === "theory_2" && s.type === "added")).toBeDefined();
  });

  it("content_sections diff 감지", () => {
    const older = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: null,
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [
          { key: "motive", label: "동기", content: "기존", content_format: "plain" },
        ],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: null,
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [
          { key: "motive", label: "동기", content: "수정됨", content_format: "plain" },
          { key: "method", label: "방법", content: "새 섹션", content_format: "plain" },
        ],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    expect(diff.stats.modifiedSections).toBe(1);
    expect(diff.stats.addedSections).toBe(1);
  });

  it("timeDeltaMs 정확 계산", () => {
    const older = makeGuide({ created_at: "2026-04-10T10:00:00Z" });
    const newer = makeGuide({
      version: 2,
      created_at: "2026-04-10T12:00:00Z",
    });

    const diff = compareVersions(older, newer);

    // 2시간 = 7,200,000ms
    expect(diff.timeDeltaMs).toBe(7200000);
  });

  it("HTML 태그 제거 후 비교", () => {
    const older = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: "<p>기존 <strong>동기</strong>입니다.</p>",
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: "<p>기존 <strong>동기</strong>입니다.</p>",
        theory_sections: [],
        reflection: null,
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    // HTML 태그만 다르고 텍스트는 같으므로 unchanged
    expect(diff.sections[0].type).toBe("unchanged");
  });

  it("totalCharDelta 정확 계산 (추가+삭제+수정 혼합)", () => {
    const older = makeGuide({
      content: {
        guide_id: "guide-1",
        motivation: "12345",    // 5자 → 삭제 예정
        theory_sections: [],
        reflection: "abcdef",   // 6자 → 수정 → 8자
        impression: null,
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T10:00:00Z",
        updated_at: "2026-04-10T10:00:00Z",
      },
    });
    const newer = makeGuide({
      version: 2,
      content: {
        guide_id: "guide-1",
        motivation: null,       // 삭제: -5
        theory_sections: [],
        reflection: "abcdefgh", // 수정: +2
        impression: "xyz",      // 추가: +3
        summary: null,
        follow_up: null,
        book_description: null,
        related_papers: [],
        related_books: [],
        image_paths: [],
        guide_url: null,
        setek_examples: [],
        raw_source: null,
        content_sections: [],
        created_at: "2026-04-10T11:00:00Z",
        updated_at: "2026-04-10T11:00:00Z",
      },
    });

    const diff = compareVersions(older, newer);

    // -5 + 2 + 3 = 0
    expect(diff.stats.totalCharDelta).toBe(0);
    expect(diff.stats.removedSections).toBe(1);
    expect(diff.stats.modifiedSections).toBe(1);
    expect(diff.stats.addedSections).toBe(1);
  });
});

// ============================================================
// countMetaChanges 테스트
// ============================================================

describe("countMetaChanges", () => {
  it("변경 없으면 0", () => {
    expect(
      countMetaChanges({
        title: null,
        status: null,
        guideType: null,
        sourceType: null,
        difficultyLevel: null,
        qualityScore: null,
        subjectArea: null,
        subjectSelect: null,
        bookTitle: null,
      }),
    ).toBe(0);
  });

  it("모든 필드 변경 시 9", () => {
    expect(
      countMetaChanges({
        title: { old: "a", new: "b" },
        status: { old: "draft", new: "approved" },
        guideType: { old: "reading", new: "experiment" },
        sourceType: { old: "manual", new: "ai_keyword" },
        difficultyLevel: { old: "basic", new: "advanced" },
        qualityScore: { old: 50, new: 80 },
        subjectArea: { old: "수학", new: "과학" },
        subjectSelect: { old: "미적분", new: "물리학" },
        bookTitle: { old: null, new: "새 도서" },
      }),
    ).toBe(9);
  });
});
