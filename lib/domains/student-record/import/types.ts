// ============================================
// 생기부 Import 파이프라인 타입 정의
// Phase 4.5 — PDF / HTML / 이미지 → AI 파싱 → DB 저장
// ============================================

// ============================================
// 1. 입력 형식
// ============================================

/** 지원 파일 형식 */
export type ImportFileFormat = "pdf" | "html" | "image";

/** 파일에서 추출된 콘텐츠 (클라이언트 → 서버 전송용) */
export type ExtractedContent =
  | { format: "pdf"; pages: string[] } // base64 이미지 배열
  | { format: "html"; text: string }   // HTML → 텍스트 추출
  | { format: "image"; images: string[] }; // base64 이미지 배열

// ============================================
// 2. Gemini 파싱 출력 (Structured Output)
// ============================================

/** Gemini가 반환하는 구조화된 생기부 데이터 */
export interface RecordImportData {
  /** 학생 인적사항 */
  studentInfo: {
    name: string;
    schoolName: string;
    schoolYear: number; // 입학년도
  };

  /** 교과 세특 (과목별 세부능력 및 특기사항) */
  detailedCompetencies: {
    grade: string;     // "1학년", "2학년", "3학년"
    semester: string;  // "1학기", "2학기"
    subject: string;   // "국어", "수학" 등
    content: string;
  }[];

  /** 창의적 체험활동 (자율/동아리/진로) */
  creativeActivities: {
    grade: string;
    category: string;  // "자율활동", "동아리활동", "진로활동"
    hours: number;     // 활동 시간
    content: string;
  }[];

  /** 행동특성 및 종합의견 */
  behavioralCharacteristics: {
    grade: string;
    content: string;
  }[];

  /** 교과 성적 */
  grades: {
    grade: string;
    semester: string;
    subject: string;
    subjectType: string;       // "일반선택", "진로선택", "공통" 등
    creditHours: number;
    rawScore: number;
    classAverage: number;
    standardDeviation: number;
    achievementLevel: string;  // A, B, C, D, E
    totalStudents: number;
    rankGrade: number;
    /** 성취도별 분포비율 (진로선택 과목) */
    achievementRatioA?: number;
    achievementRatioB?: number;
    achievementRatioC?: number;
    achievementRatioD?: number;
    achievementRatioE?: number;
  }[];

  /** 출결 상황 */
  attendance: {
    grade: string;
    authorizedAbsence: number;
    sickAbsence: number;
    unauthorizedAbsence: number;
    lateness: number;
    earlyLeave: number;
    classAbsence: number;
  }[];

  /** 독서활동 */
  readingActivities: {
    grade: string;
    subjectArea: string;       // 교과 또는 "공통"
    bookTitle: string;
    author: string;
  }[];

  /** 수상경력 */
  awards: {
    grade: string;
    semester: string;          // "1학기", "2학기"
    awardName: string;
    awardDate: string;         // "2024.07.24."
    awardOrg: string;
    participants: string;
  }[];

  /** 봉사활동실적 */
  volunteerActivities: {
    grade: string;
    activityDate: string;      // "2024.03.04 ~ 2024.07.19" 또는 "2024.04.08."
    location: string;
    content: string;
    hours: number;
    cumulativeHours: number;
  }[];

  /** 학반정보 (반/번호/담임) */
  classInfo: {
    grade: string;
    className: string;
    studentNumber: string;
    homeroomTeacher: string;
  }[];
}

// ============================================
// 3. 과목 매칭 결과
// ============================================

export interface SubjectMatch {
  parsedName: string;         // PDF에서 추출된 과목명
  subjectId: string | null;   // 매칭된 subjects.id (null = 미매칭)
  subjectName: string | null; // 매칭된 과목 DB명
  confidence: "exact" | "normalized" | "unmatched";
}

/** 수동 매핑 (사용자가 미매칭 과목을 직접 선택) */
export interface ManualSubjectMapping {
  parsedName: string;
  subjectId: string;
}

// ============================================
// 4. Import 미리보기 (Preview)
// ============================================

export interface ImportPreviewData {
  /** 파싱된 원본 데이터 */
  parsed: RecordImportData;

  /** 과목 매칭 결과 */
  subjectMatches: SubjectMatch[];

  /** 카테고리별 건수 요약 */
  summary: {
    setekCount: number;
    changcheCount: number;
    haengteukCount: number;
    readingCount: number;
    attendanceCount: number;
    gradeCount: number;
    unmatchedSubjectCount: number;
    awardCount: number;
    volunteerCount: number;
    classInfoCount: number;
  };
}

// ============================================
// 5. Import 실행 옵션
// ============================================

export interface ImportExecuteOptions {
  studentId: string;
  tenantId: string;
  schoolYear: number;
  overwriteExisting: boolean;
  manualMappings: ManualSubjectMapping[];
}

// ============================================
// 6. Import 결과
// ============================================

export interface ImportResult {
  success: boolean;
  error?: string;
  counts: {
    seteks: number;
    changche: number;
    haengteuk: number;
    readings: number;
    attendance: number;
    grades: number;
    awards: number;
    volunteer: number;
  };
  skipped: {
    reason: string;
    items: string[];
  }[];
}

// ============================================
// 7. 파이프라인 진행 상태 (클라이언트용)
// ============================================

export type ImportPhase =
  | "idle"
  | "extracting"    // 파일에서 콘텐츠 추출 중
  | "parsing"       // Gemini AI 파싱 중
  | "matching"      // 과목명 매칭 중
  | "previewing"    // 미리보기 표시
  | "importing"     // DB 저장 중
  | "complete"
  | "error";

export interface ImportProgress {
  phase: ImportPhase;
  message: string;
  percent: number;  // 0~100
}
