#!/usr/bin/env tsx
/**
 * docs/ 문서 트리아지 리포트 생성.
 *
 * 사용:
 *   npx tsx scripts/docs-triage.ts              # 리포트 생성
 *   npx tsx scripts/docs-triage.ts --csv        # CSV 출력
 *
 * 판정 기준 (6분류):
 *   ✅ 현행        : 1년 내 수정 + 외부 참조 ≥ 1
 *   🔄 업데이트    : 외부 참조 ≥ 1 but 1년+ 미수정
 *   ⚠️ 낡음        : 본문에 오래된 지표 포함 (v1, 2024, phase1 완료 등)
 *   🗄️ 아카이브    : 외부 참조 0 + 6개월+ 미수정 + 완료 로그 성격
 *   🔗 중복        : 제목/주제 키워드가 다른 문서와 겹침
 *   ❌ 삭제 후보   : 2KB 미만 + 외부 참조 0
 */

import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO = join(__dirname, "..");
const DOCS = join(REPO, "docs");

type Category =
  | "current"
  | "orphan"
  | "update"
  | "stale"
  | "archive"
  | "duplicate"
  | "delete";

const CAT_LABEL: Record<Category, string> = {
  current: "✅ 현행 (참조 有)",
  orphan: "👻 고아 (참조 0)",
  update: "🔄 업데이트",
  stale: "⚠️ 낡음",
  archive: "🗄️ 아카이브",
  duplicate: "🔗 중복",
  delete: "❌ 삭제 후보",
};

interface DocRecord {
  path: string;
  relPath: string;
  sizeKb: number;
  lastModifiedDays: number;
  incomingRefs: number;
  staleSignals: string[];
  duplicateOf?: string;
  category: Category;
  reason: string;
  title: string;
}

function listDocs(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "archive") continue;
    if (entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listDocs(full));
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

function lastCommitDaysAgo(path: string): number {
  try {
    const iso = execSync(
      `git log -1 --format=%aI -- "${relative(REPO, path)}"`,
      { cwd: REPO, encoding: "utf8" }
    ).trim();
    if (!iso) return 0; // 미커밋 = 방금 작성
    const daysMs = Date.now() - new Date(iso).getTime();
    return Math.floor(daysMs / 86400000);
  } catch {
    return 0;
  }
}

function countIncomingRefs(filename: string): number {
  const name = filename.replace(/.*\//, "").replace(/\\/g, "/");
  try {
    const out = execSync(
      `git grep -l --fixed-strings "${name}" -- ':!docs/archive' ':!**/*.log'`,
      { cwd: REPO, encoding: "utf8" }
    );
    return out.split("\n").filter((l) => l && !l.endsWith(name)).length;
  } catch {
    return 0;
  }
}

const STALE_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bv1\.0\b/i, label: "v1.0" },
  { pattern: /2024년/, label: "2024년" },
  { pattern: /phase\s*[12]\s*완료/i, label: "과거 Phase 완료" },
  { pattern: /TODO:\s*제거/i, label: "제거 예정 TODO" },
  { pattern: /deprecated/i, label: "deprecated 자가 선언" },
  { pattern: /예정 \(202[45]/i, label: "과거 예정일" },
];

function detectStaleSignals(content: string): string[] {
  const found: string[] = [];
  for (const { pattern, label } of STALE_PATTERNS) {
    if (pattern.test(content)) found.push(label);
  }
  return found;
}

function extractTitle(content: string, fallback: string): string {
  const m = content.match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : fallback;
}

function extractKeywords(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[\s\-_()·,:]+/)
      .filter((w) => w.length >= 3 && !["guide", "the", "for"].includes(w))
  );
}

function findDuplicates(records: DocRecord[]): void {
  const titleMap = new Map<string, DocRecord[]>();
  for (const r of records) {
    const kw = [...extractKeywords(r.title)].sort().join("|");
    if (!kw) continue;
    const bucket = titleMap.get(kw) ?? [];
    bucket.push(r);
    titleMap.set(kw, bucket);
  }
  for (const bucket of titleMap.values()) {
    if (bucket.length <= 1) continue;
    bucket.sort((a, b) => a.lastModifiedDays - b.lastModifiedDays);
    const newest = bucket[0];
    for (const older of bucket.slice(1)) {
      older.duplicateOf = newest.relPath;
    }
  }
}

function classify(r: Omit<DocRecord, "category" | "reason">): {
  category: Category;
  reason: string;
} {
  if (r.duplicateOf) {
    return {
      category: "duplicate",
      reason: `"${r.duplicateOf}"와 주제 중복`,
    };
  }
  if (r.sizeKb < 2 && r.incomingRefs === 0) {
    return { category: "delete", reason: `${r.sizeKb}KB + 참조 없음` };
  }
  if (r.staleSignals.length >= 2) {
    return {
      category: "stale",
      reason: `낡은 지표: ${r.staleSignals.join(", ")}`,
    };
  }
  if (r.incomingRefs === 0 && r.lastModifiedDays > 180) {
    return {
      category: "archive",
      reason: `참조 0 + ${r.lastModifiedDays}일 미수정`,
    };
  }
  if (r.lastModifiedDays > 365 && r.incomingRefs >= 1) {
    return {
      category: "update",
      reason: `${r.lastModifiedDays}일 미수정 but 참조 ${r.incomingRefs}건`,
    };
  }
  if (r.incomingRefs === 0) {
    return {
      category: "orphan",
      reason: `${r.lastModifiedDays}일 전 수정이나 어디서도 참조되지 않음`,
    };
  }
  return {
    category: "current",
    reason: `${r.lastModifiedDays}일 전 수정 + 참조 ${r.incomingRefs}건`,
  };
}

function main() {
  const files = listDocs(DOCS);
  const records: DocRecord[] = [];

  for (const path of files) {
    const relPath = relative(REPO, path);
    const content = readFileSync(path, "utf8");
    const stat = statSync(path);
    const base = {
      path,
      relPath,
      sizeKb: +(stat.size / 1024).toFixed(1),
      lastModifiedDays: lastCommitDaysAgo(path),
      incomingRefs: countIncomingRefs(relPath),
      staleSignals: detectStaleSignals(content),
      title: extractTitle(content, relPath),
    };
    records.push({ ...base, category: "current", reason: "" });
  }

  findDuplicates(records);

  for (const r of records) {
    const { category, reason } = classify(r);
    r.category = category;
    r.reason = reason;
  }

  const mode = process.argv[2];
  if (mode === "--csv") {
    console.log("category,path,size_kb,last_modified_days,incoming_refs,reason");
    for (const r of records.sort((a, b) => a.category.localeCompare(b.category))) {
      console.log(
        [
          r.category,
          r.relPath,
          r.sizeKb,
          r.lastModifiedDays,
          r.incomingRefs,
          `"${r.reason.replace(/"/g, '""')}"`,
        ].join(",")
      );
    }
    return;
  }

  const byCategory: Record<Category, DocRecord[]> = {
    current: [],
    orphan: [],
    update: [],
    stale: [],
    archive: [],
    duplicate: [],
    delete: [],
  };
  for (const r of records) byCategory[r.category].push(r);

  console.log(`# docs/ 트리아지 리포트\n`);
  console.log(
    `총 ${records.length}개 문서. 생성: ${new Date().toISOString().slice(0, 10)}\n`
  );

  const summary = Object.entries(byCategory)
    .map(([cat, list]) => `- ${CAT_LABEL[cat as Category]}: ${list.length}건`)
    .join("\n");
  console.log(`## 요약\n\n${summary}\n`);

  for (const cat of Object.keys(byCategory) as Category[]) {
    const list = byCategory[cat];
    if (!list.length) continue;
    console.log(`\n## ${CAT_LABEL[cat]} (${list.length}건)\n`);
    console.log("| 파일 | 크기 | 최종수정 | 참조 | 사유 |");
    console.log("|---|---|---|---|---|");
    for (const r of list.sort((a, b) => a.lastModifiedDays - b.lastModifiedDays)) {
      console.log(
        `| \`${r.relPath}\` | ${r.sizeKb}KB | ${r.lastModifiedDays}d | ${r.incomingRefs} | ${r.reason} |`
      );
    }
  }
}

main();
