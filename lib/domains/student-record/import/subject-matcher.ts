// ============================================
// 과목명 → subject_id 매칭
// PDF/HTML 에서 추출된 과목명(문자열)을 DB subjects.id 에 매칭
// 미매칭 과목은 올바른 교과/유형으로 자동 생성
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
    // 로마숫자 (유니코드)
    .replace(/Ⅰ/g, "1")
    .replace(/Ⅱ/g, "2")
    .replace(/Ⅲ/g, "3")
    .replace(/Ⅳ/g, "4")
    // 아스키 로마숫자 (끝자리 대소문자 I/II/III/IV)
    .replace(/(?<=\D)IV$/i, "4")
    .replace(/(?<=\D)III$/i, "3")
    .replace(/(?<=\D)II$/i, "2")
    .replace(/(?<=\D)I$/i, "1")
    .replace(/[·‧・]/g, "")
    .replace(/[()]/g, "")
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
// 미매칭 과목 자동 생성 (올바른 교과/유형 배정)
// ============================================

/** 과목명 → { 교과 그룹명, 과목 유형명 } 추론 */
const SUBJECT_CLASSIFICATION: [RegExp, string, string][] = [
  // [패턴, 교과그룹명, 과목유형명]
  // ── 체육 ──
  [/^체육$/, "체육", "공통"],
  [/^운동과\s*건강$/, "체육", "진로선택"],
  [/^스포츠\s*생활/, "체육", "일반선택"],
  // ── 예술 ──
  [/^미술$/, "예술", "공통"],
  [/^음악$/, "예술", "공통"],
  [/^음악\s*감상/, "예술", "진로선택"],
  [/^미술\s*창작/, "예술", "진로선택"],
  [/^미술\s*감상/, "예술", "진로선택"],
  // ── 기술·가정/정보 ──
  [/^정보$/, "기술·가정/정보", "일반선택"],
  [/^인공지능/, "기술·가정/정보", "진로선택"],
  [/^데이터/, "기술·가정/정보", "진로선택"],
  [/^프로그래밍/, "기술·가정/정보", "진로선택"],
  [/^기술.*가정/, "기술·가정/정보", "일반선택"],
  [/^공학\s*일반/, "기술·가정/정보", "진로선택"],
  [/^로봇/, "기술·가정/정보", "진로선택"],
  // ── 제2외국어 ──
  [/일본어|중국어|프랑스어|독일어|스페인어|러시아어|아랍어|베트남어/, "제2외국어", "일반선택"],
  // ── 한문 ──
  [/^한문/, "한문", "일반선택"],
  // ── 교양 ──
  [/^진로와\s*직업$/, "교양", "일반선택"],
  [/^철학$|^논리학$|^심리학$|^환경$|^실용\s*경제$|^논술$/, "교양", "일반선택"],
  // ── 사회 ──
  [/빅\s*히스토리|역사로\s*탐구|사회문제\s*탐구|여행\s*지리/, "사회(역사/도덕 포함)", "진로선택"],
  [/통합사회|정치|경제|지리|윤리|세계사|동아시아|사회·문화/, "사회(역사/도덕 포함)", "일반선택"],
  // ── 과학 ──
  [/과학탐구실험|통합과학|융합과학/, "과학", "공통"],
  [/물리학|화학|생명과학|지구과학/, "과학", "일반선택"],
  [/생활과\s*과학|과학사|융합과학\s*탐구/, "과학", "진로선택"],
  // ── 국어 ──
  [/국어|문학|화법|작문|독서|언어.*매체/, "국어", "일반선택"],
  // ── 수학 ──
  [/수학|미적분|확률.*통계|기하$/, "수학", "일반선택"],
  // ── 영어 ──
  [/영어|English/, "영어", "일반선택"],
  // ── 한국사 ──
  [/한국사/, "한국사", "공통"],
];

let _groupCache: Map<string, string> | null = null;
let _typeCache: Map<string, string> | null = null;

async function getGroupIdByName(groupName: string): Promise<string | null> {
  if (!_groupCache) {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return null;
    const { data } = await supabase.from("subject_groups").select("id, name").order("name");
    _groupCache = new Map();
    for (const g of data ?? []) {
      if (!_groupCache.has(g.name)) _groupCache.set(g.name, g.id);
    }
  }
  return _groupCache.get(groupName) ?? null;
}

async function getTypeIdByName(typeName: string): Promise<string | null> {
  if (!_typeCache) {
    const supabase = createSupabaseAdminClient();
    if (!supabase) return null;
    const { data } = await supabase.from("subject_types").select("id, name").order("name");
    _typeCache = new Map();
    for (const t of data ?? []) {
      if (!_typeCache.has(t.name)) _typeCache.set(t.name, t.id);
    }
  }
  return _typeCache.get(typeName) ?? null;
}

async function createSubject(name: string): Promise<DbSubject | null> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) return null;

  // 패턴 매칭으로 교과/유형 추론
  let groupName = "과학"; // fallback
  let typeName = "일반선택";

  for (const [pattern, gn, tn] of SUBJECT_CLASSIFICATION) {
    if (pattern.test(name)) {
      groupName = gn;
      typeName = tn;
      break;
    }
  }

  const groupId = await getGroupIdByName(groupName);
  const typeId = await getTypeIdByName(typeName);

  if (!groupId) return null;

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name,
      subject_group_id: groupId,
      ...(typeId ? { subject_type_id: typeId } : {}),
    })
    .select("id, name")
    .single();

  if (error) return null;
  return data;
}

// ============================================
// 매칭 실행
// ============================================

/** 파싱된 과목명 배열을 DB subject_id에 매칭. 미매칭은 올바른 교과로 자동 생성 */
export async function matchSubjects(
  parsedSubjectNames: string[],
): Promise<SubjectMatch[]> {
  const dbSubjects = await fetchSubjects();

  // 정규화 키 → DB 과목 인덱스
  const exactIndex = new Map<string, DbSubject>();
  const normalizedIndex = new Map<string, DbSubject>();

  for (const sub of dbSubjects) {
    // 같은 이름 과목이 여러 개(2015/2022 개정 등)일 경우 첫 번째만 사용
    if (!exactIndex.has(sub.name)) exactIndex.set(sub.name, sub);
    const nk = normalizeSubjectName(sub.name);
    if (!normalizedIndex.has(nk)) normalizedIndex.set(nk, sub);
  }

  const uniqueNames = [...new Set(parsedSubjectNames)];
  const results: SubjectMatch[] = [];

  for (const parsedName of uniqueNames) {
    // 1. 정확 매칭
    const exact = exactIndex.get(parsedName);
    if (exact) {
      results.push({ parsedName, subjectId: exact.id, subjectName: exact.name, confidence: "exact" });
      continue;
    }

    // 2. 정규화 매칭
    const normalizedKey = normalizeSubjectName(parsedName);
    const normalized = normalizedIndex.get(normalizedKey);
    if (normalized) {
      results.push({ parsedName, subjectId: normalized.id, subjectName: normalized.name, confidence: "normalized" });
      continue;
    }

    // 3. 자동 생성 (올바른 교과/유형 배정)
    const created = await createSubject(parsedName);
    if (created) {
      exactIndex.set(created.name, created);
      normalizedIndex.set(normalizeSubjectName(created.name), created);
      results.push({ parsedName, subjectId: created.id, subjectName: created.name, confidence: "exact" });
    } else {
      results.push({ parsedName, subjectId: null, subjectName: null, confidence: "unmatched" });
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
      return { ...match, subjectId: manualMap.get(match.parsedName)!, confidence: "normalized" as const };
    }
    return match;
  });
}

/** SubjectMatch 배열 → parsedName → subjectId 맵 */
export function buildSubjectIdMap(matches: SubjectMatch[]): Map<string, string | null> {
  return new Map(matches.map((m) => [m.parsedName, m.subjectId]));
}
