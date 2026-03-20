/**
 * Access 과목명 → subjects.id 매칭 (Levenshtein 유사도)
 *
 * 정확 매칭 우선, 실패 시 유사도 기반 후보 제안.
 */

/** Levenshtein 거리 계산 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

/** 유사도 (0~1, 1 = 완전 일치) */
function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

export interface SubjectRecord {
  id: string;
  name: string;
}

export interface SubjectMatchResult {
  matched: boolean;
  subjectId: string | null;
  subjectName: string | null;
  similarity: number;
  candidates?: Array<{ id: string; name: string; similarity: number }>;
}

/** 한글 과목명 정규화 (로마숫자, 공백 처리) */
function normalizeSubjectName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, "")
    .replace(/Ⅰ/g, "1")
    .replace(/Ⅱ/g, "2")
    .replace(/Ⅲ/g, "3")
    .replace(/I{1,3}/g, (m) => String(m.length));
}

/** 수동 매핑 (Access 과목명 → DB 과목명) */
const MANUAL_MAPPINGS: Record<string, string> = {
  사회문화: "사회·문화",
  "사회·문화": "사회·문화",
  정치와법: "정치와법",
  생활과윤리: "생활과윤리",
  윤리와사상: "윤리와사상",
  한국지리: "한국지리",
  세계지리: "세계지리",
  동아시아사: "동아시아사",
  세계사: "세계사",
  물리학1: "물리학Ⅰ",
  물리학2: "물리학Ⅱ",
  화학1: "화학Ⅰ",
  화학2: "화학Ⅱ",
  생명과학1: "생명과학Ⅰ",
  생명과학2: "생명과학Ⅱ",
  지구과학1: "지구과학Ⅰ",
  지구과학2: "지구과학Ⅱ",
};

export class SubjectMatcher {
  private subjects: SubjectRecord[];
  private normalizedMap: Map<string, SubjectRecord>;

  constructor(subjects: SubjectRecord[]) {
    this.subjects = subjects;
    this.normalizedMap = new Map();
    for (const s of subjects) {
      this.normalizedMap.set(normalizeSubjectName(s.name), s);
    }
  }

  match(accessSubjectName: string): SubjectMatchResult {
    if (!accessSubjectName || !accessSubjectName.trim()) {
      return { matched: false, subjectId: null, subjectName: null, similarity: 0 };
    }

    const normalized = normalizeSubjectName(accessSubjectName);

    // 1. 정확 매칭
    const exact = this.normalizedMap.get(normalized);
    if (exact) {
      return { matched: true, subjectId: exact.id, subjectName: exact.name, similarity: 1 };
    }

    // 2. 수동 매핑
    const manualTarget = MANUAL_MAPPINGS[normalized] ?? MANUAL_MAPPINGS[accessSubjectName.trim()];
    if (manualTarget) {
      const found = this.subjects.find((s) => s.name === manualTarget);
      if (found) {
        return { matched: true, subjectId: found.id, subjectName: found.name, similarity: 1 };
      }
    }

    // 3. 유사도 기반 (threshold: 0.7)
    const candidates = this.subjects
      .map((s) => ({
        id: s.id,
        name: s.name,
        similarity: similarity(normalized, normalizeSubjectName(s.name)),
      }))
      .filter((c) => c.similarity >= 0.5)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3);

    const best = candidates[0];
    if (best && best.similarity >= 0.7) {
      return {
        matched: true,
        subjectId: best.id,
        subjectName: best.name,
        similarity: best.similarity,
        candidates,
      };
    }

    return {
      matched: false,
      subjectId: null,
      subjectName: null,
      similarity: best?.similarity ?? 0,
      candidates,
    };
  }
}

/** 계열 매칭 (Access "계열선택" → career_field 코드) */
const CAREER_FIELD_MAP: Record<string, string> = {
  // Access DB 원본 값 (10종)
  공학계열: "engineering",
  교육계열: "education",
  사회계열: "social_sciences",
  예체능계열: "arts_pe",
  의약계열: "medicine",
  인문계열: "humanities",
  자연계열: "natural_sciences",
  의학계열: "medical",
  미분류: "unclassified",
  전계열: "all_fields",
  // 축약형 호환
  공학: "engineering",
  교육: "education",
  사회: "social_sciences",
  예체능: "arts_pe",
  의약: "medicine",
  인문: "humanities",
  자연: "natural_sciences",
  의학: "medical",
};

export interface CareerFieldRecord {
  id: number;
  code: string;
  name_kor: string;
}

export class CareerFieldMatcher {
  private byCode: Map<string, CareerFieldRecord>;
  private byNameKor: Map<string, CareerFieldRecord>;

  constructor(fields: CareerFieldRecord[]) {
    this.byCode = new Map(fields.map((f) => [f.code, f]));
    this.byNameKor = new Map(fields.map((f) => [f.name_kor, f]));
  }

  /** Access 계열 텍스트 → career_field_id 배열 (쉼표 구분 지원) */
  match(accessCareerField: string): number[] {
    if (!accessCareerField || !accessCareerField.trim()) return [];

    const parts = accessCareerField.split(/[,/]/).map((p) => p.trim());
    const ids: number[] = [];

    for (const part of parts) {
      // 1. 직접 매핑
      const code = CAREER_FIELD_MAP[part];
      if (code) {
        const record = this.byCode.get(code);
        if (record) {
          ids.push(record.id);
          continue;
        }
      }

      // 2. name_kor 직접 매칭
      const byName = this.byNameKor.get(part);
      if (byName) {
        ids.push(byName.id);
        continue;
      }

      // 3. 부분 매칭
      for (const [name, record] of this.byNameKor) {
        if (name.includes(part) || part.includes(name)) {
          ids.push(record.id);
          break;
        }
      }
    }

    return [...new Set(ids)];
  }
}
