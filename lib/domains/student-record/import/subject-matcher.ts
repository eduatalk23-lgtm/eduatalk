// ============================================
// 과목명 → subject_id 매칭
// PDF/HTML 에서 추출된 과목명(문자열)을 DB subjects.id 에 매칭
// 미매칭 과목은 자동 생성
// ============================================

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { SubjectMatch, ManualSubjectMapping } from "./types";

interface DbSubject {
  id: string;
  name: string;
}

// ============================================
// 정규화 (과목명 → 비교용 키)
// ============================================

/** 과목명을 정규화 키로 변환 (공백/특수문자 제거, 로마숫자→아라비아) */
function normalizeSubjectName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "")
    .replace(/Ⅰ/g, "1")
    .replace(/Ⅱ/g, "2")
    .replace(/Ⅲ/g, "3")
    .replace(/Ⅳ/g, "4")
    .replace(/[·‧・]/g, "")   // 가운뎃점 제거
    .replace(/\(/g, "")
    .replace(/\)/g, "")
    .toLowerCase();
}

// ============================================
// DB 과목 목록 조회
// ============================================

async function fetchSubjects(): Promise<DbSubject[]> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase Admin 클라이언트를 생성할 수 없습니다.");

  const { data, error } = await supabase
    .from("subjects")
    .select("id, name")
    .order("name");

  if (error) throw new Error(`과목 목록 조회 실패: ${error.message}`);
  return data ?? [];
}

// ============================================
// 미매칭 과목 자동 생성
// ============================================

/** 과목명 → subject_group_id 추론 */
const SUBJECT_GROUP_HINTS: [RegExp, string][] = [
  [/국어|문학|화법|작문|독서|언어|매체/, "국어"],
  [/수학|미적분|확률|통계|기하|대수/, "수학"],
  [/영어|English/, "영어"],
  [/한국사/, "한국사"],
  [/사회|역사|지리|정치|법|경제|윤리|도덕|세계사|동아시아/, "사회(역사/도덕 포함)"],
  [/과학|물리|화학|생명|지구|천문|생물|탐구실험/, "과학"],
];

let _groupCache: Map<string, string> | null = null;

async function getGroupIdMap(): Promise<Map<string, string>> {
  if (_groupCache) return _groupCache;

  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase Admin 클라이언트를 생성할 수 없습니다.");

  const { data } = await supabase
    .from("subject_groups")
    .select("id, name, curriculum_revision_id")
    .order("name");

  _groupCache = new Map();
  // 2022 개정 우선, 이름으로 인덱싱
  for (const g of data ?? []) {
    if (!_groupCache.has(g.name)) {
      _groupCache.set(g.name, g.id);
    }
  }
  return _groupCache;
}

async function inferGroupId(subjectName: string): Promise<string> {
  const groupMap = await getGroupIdMap();

  for (const [pattern, groupName] of SUBJECT_GROUP_HINTS) {
    if (pattern.test(subjectName) && groupMap.has(groupName)) {
      return groupMap.get(groupName)!;
    }
  }

  // fallback: 첫 번째 그룹 사용
  const firstId = groupMap.values().next().value;
  if (firstId) return firstId;
  throw new Error("subject_groups 테이블이 비어있습니다.");
}

async function createSubject(name: string): Promise<DbSubject> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) throw new Error("Supabase Admin 클라이언트를 생성할 수 없습니다.");

  const subjectGroupId = await inferGroupId(name);

  const { data, error } = await supabase
    .from("subjects")
    .insert({ name, subject_group_id: subjectGroupId })
    .select("id, name")
    .single();

  if (error) throw new Error(`과목 생성 실패 (${name}): ${error.message}`);
  return data;
}

// ============================================
// 매칭 실행 (미매칭 시 자동 생성)
// ============================================

/** 파싱된 과목명 배열을 DB subject_id에 매칭. 미매칭 과목은 자동 생성 */
export async function matchSubjects(
  parsedSubjectNames: string[],
): Promise<SubjectMatch[]> {
  const dbSubjects = await fetchSubjects();

  // 정규화 키 → DB 과목 인덱스
  const exactIndex = new Map<string, DbSubject>();
  const normalizedIndex = new Map<string, DbSubject>();

  for (const sub of dbSubjects) {
    exactIndex.set(sub.name, sub);
    normalizedIndex.set(normalizeSubjectName(sub.name), sub);
  }

  // 중복 제거
  const uniqueNames = [...new Set(parsedSubjectNames)];

  const results: SubjectMatch[] = [];

  for (const parsedName of uniqueNames) {
    // 1. 정확 매칭
    const exact = exactIndex.get(parsedName);
    if (exact) {
      results.push({
        parsedName,
        subjectId: exact.id,
        subjectName: exact.name,
        confidence: "exact",
      });
      continue;
    }

    // 2. 정규화 매칭
    const normalizedKey = normalizeSubjectName(parsedName);
    const normalized = normalizedIndex.get(normalizedKey);
    if (normalized) {
      results.push({
        parsedName,
        subjectId: normalized.id,
        subjectName: normalized.name,
        confidence: "normalized",
      });
      continue;
    }

    // 3. 자동 생성
    try {
      const created = createSubject(parsedName);
      const newSubject = await created;
      // 인덱스에 추가 (이후 같은 과목명 중복 생성 방지)
      exactIndex.set(newSubject.name, newSubject);
      normalizedIndex.set(normalizeSubjectName(newSubject.name), newSubject);

      results.push({
        parsedName,
        subjectId: newSubject.id,
        subjectName: newSubject.name,
        confidence: "exact",
      });
    } catch {
      // 생성 실패 시 미매칭으로 처리
      results.push({
        parsedName,
        subjectId: null,
        subjectName: null,
        confidence: "unmatched",
      });
    }
  }

  return results;
}

/** 수동 매핑을 SubjectMatch 배열에 적용 */
export function applyManualMappings(
  matches: SubjectMatch[],
  manualMappings: ManualSubjectMapping[],
): SubjectMatch[] {
  const manualMap = new Map(manualMappings.map((m) => [m.parsedName, m.subjectId]));

  return matches.map((match) => {
    if (match.confidence === "unmatched" && manualMap.has(match.parsedName)) {
      return {
        ...match,
        subjectId: manualMap.get(match.parsedName)!,
        confidence: "normalized" as const,
      };
    }
    return match;
  });
}

/** SubjectMatch 배열 → parsedName → subjectId 맵 */
export function buildSubjectIdMap(matches: SubjectMatch[]): Map<string, string | null> {
  return new Map(matches.map((m) => [m.parsedName, m.subjectId]));
}
