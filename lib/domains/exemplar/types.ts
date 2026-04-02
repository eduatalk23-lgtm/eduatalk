// ============================================
// 합격 생기부 레퍼런스 (Exemplar) 타입 정의
// ============================================

// ============================================
// 1. 교육과정 & 기본 타입
// ============================================

/** 적용 교육과정 */
export type CurriculumRevision = "2009" | "2015" | "2022";

/** 소스 파일 형식 */
export type SourceFileFormat = "pdf" | "docx" | "hwp";

/** 학교 유형 */
export type SchoolCategory =
  | "일반고"
  | "특목고"
  | "자사고"
  | "외고"
  | "과학고"
  | "국제고"
  | "예술고"
  | "체육고"
  | "마이스터고"
  | "특성화고";

/** 창체 활동 유형 (교육과정별 차이 포함) */
export type ActivityType =
  | "autonomy"        // 자율활동 (2009/2015: 자율+자치, 2022: 자율만)
  | "self_governance"  // 자치활동 (2022 개정에서 분리)
  | "club"            // 동아리활동
  | "volunteer"       // 봉사활동 (2022: 창체 영역에서 제거)
  | "career";         // 진로활동

/** 전형 유형 */
export type AdmissionType = "학종" | "교과" | "논술" | "실기" | "특별" | string;

/** 전형 라운드 (student_record_applications.round 와 동일) */
export type AdmissionRound =
  | "early_comprehensive"
  | "early_subject"
  | "early_essay"
  | "early_practical"
  | "early_special"
  | "early_other"
  | "regular_ga"
  | "regular_na"
  | "regular_da"
  | "additional"
  | "special_quota";

/** 과목 유형 */
export type SubjectType =
  | "공통"
  | "일반선택"
  | "진로선택"
  | "융합선택"    // 2022 개정
  | "전문교과";

/** 파싱 오류 */
export interface ParseError {
  section: string;
  message: string;
  severity: "error" | "warning";
}

// ============================================
// 2. DB Row 타입 (테이블별)
// ============================================

/** exemplar_records */
export interface ExemplarRecord {
  id: string;
  tenant_id: string;
  anonymous_id: string;
  school_name: string;
  school_category: SchoolCategory | null;
  enrollment_year: number;
  graduation_year: number | null;
  curriculum_revision: CurriculumRevision;
  source_file_path: string;
  source_file_format: SourceFileFormat;
  parse_quality_score: number | null;
  parse_errors: ParseError[];
  raw_content: string | null;
  raw_content_by_page: Record<string, string> | null;
  parsed_at: string | null;
  parsed_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/** exemplar_admissions */
export interface ExemplarAdmission {
  id: string;
  exemplar_id: string;
  university_name: string;
  department: string | null;
  admission_type: string | null;
  admission_round: AdmissionRound | null;
  admission_year: number;
  is_primary: boolean;
  notes: string | null;
  created_at: string;
}

/** exemplar_enrollment */
export interface ExemplarEnrollment {
  id: string;
  exemplar_id: string;
  grade: number;
  class_name: string | null;
  student_number: string | null;
  homeroom_teacher: string | null;
  enrollment_status: string | null;
  enrollment_date: string | null;
  notes: string | null;
}

/** exemplar_attendance */
export interface ExemplarAttendance {
  id: string;
  exemplar_id: string;
  grade: number;
  school_days: number | null;
  absence_sick: number;
  absence_unauthorized: number;
  absence_other: number;
  lateness_sick: number;
  lateness_unauthorized: number;
  lateness_other: number;
  early_leave_sick: number;
  early_leave_unauthorized: number;
  early_leave_other: number;
  class_absence_sick: number;
  class_absence_unauthorized: number;
  class_absence_other: number;
  notes: string | null;
}

/** exemplar_awards */
export interface ExemplarAward {
  id: string;
  exemplar_id: string;
  grade: number;
  award_name: string;
  award_level: string | null;
  award_date: string | null;
  awarding_body: string | null;
  participants: string | null;
}

/** exemplar_certifications */
export interface ExemplarCertification {
  id: string;
  exemplar_id: string;
  cert_name: string;
  cert_level: string | null;
  cert_number: string | null;
  issuing_org: string | null;
  cert_date: string | null;
}

/** exemplar_career_aspirations (2009/2015 교육과정만 해당) */
export interface ExemplarCareerAspiration {
  id: string;
  exemplar_id: string;
  grade: number;
  student_aspiration: string | null;
  parent_aspiration: string | null;
  reason: string | null;
  special_skills_hobbies: string | null;
}

/** exemplar_creative_activities (창체 특기사항) */
export interface ExemplarCreativeActivity {
  id: string;
  exemplar_id: string;
  grade: number;
  activity_type: ActivityType;
  activity_name: string | null;
  hours: number | null;
  content: string;
  content_bytes: number;
}

/** exemplar_volunteer_records (봉사활동 실적 상세) */
export interface ExemplarVolunteerRecord {
  id: string;
  exemplar_id: string;
  grade: number;
  activity_date: string | null;
  location: string | null;
  description: string | null;
  hours: number | null;
  cumulative_hours: number | null;
}

/** exemplar_grades (교과 성적) */
export interface ExemplarGrade {
  id: string;
  exemplar_id: string;
  grade: number;
  semester: number;
  subject_name: string;
  subject_type: SubjectType | null;
  credit_hours: number | null;
  raw_score: number | null;
  class_average: number | null;
  std_dev: number | null;
  rank_grade: number | null;
  achievement_level: string | null;
  total_students: number | null;
  class_rank: number | null;
  achievement_ratio: Record<string, number> | null;
  matched_subject_id: string | null;
}

/** exemplar_seteks (세특) */
export interface ExemplarSetek {
  id: string;
  exemplar_id: string;
  grade: number;
  semester: number;
  subject_name: string;
  content: string;
  content_bytes: number;
  matched_subject_id: string | null;
}

/** exemplar_pe_art_grades (체육/예술) */
export interface ExemplarPeArtGrade {
  id: string;
  exemplar_id: string;
  grade: number;
  semester: number;
  subject_name: string;
  credit_hours: number | null;
  achievement_level: string | null;
  content: string | null;
}

/** exemplar_reading (독서활동) */
export interface ExemplarReading {
  id: string;
  exemplar_id: string;
  grade: number;
  subject_area: string;
  book_description: string;
  book_title: string | null;
  author: string | null;
}

/** exemplar_haengteuk (행동특성 및 종합의견) */
export interface ExemplarHaengteuk {
  id: string;
  exemplar_id: string;
  grade: number;
  content: string;
  content_bytes: number;
}

/** exemplar_narrative_embeddings */
export interface ExemplarNarrativeEmbedding {
  id: string;
  exemplar_id: string;
  source_table: string;
  source_id: string;
  content_hash: string;
  content_preview: string | null;
  embedding_model: string;
  created_at: string;
}

/** exemplar_guide_links */
export interface ExemplarGuideLink {
  id: string;
  exemplar_id: string;
  guide_id: string;
  source_type: string;
  source_id: string | null;
  match_confidence: number | null;
  created_at: string;
}

// ============================================
// 3. 통합 조회 타입 (JOIN 결과)
// ============================================

/** 합격 생기부 전체 데이터 (모든 child 테이블 포함) */
export interface ExemplarFullRecord {
  record: ExemplarRecord;
  admissions: ExemplarAdmission[];
  enrollment: ExemplarEnrollment[];
  attendance: ExemplarAttendance[];
  awards: ExemplarAward[];
  certifications: ExemplarCertification[];
  careerAspirations: ExemplarCareerAspiration[];
  creativeActivities: ExemplarCreativeActivity[];
  volunteerRecords: ExemplarVolunteerRecord[];
  grades: ExemplarGrade[];
  seteks: ExemplarSetek[];
  peArtGrades: ExemplarPeArtGrade[];
  reading: ExemplarReading[];
  haengteuk: ExemplarHaengteuk[];
}

/** 벡터 검색 결과 */
export interface ExemplarSearchResult {
  embedding_id: string;
  exemplar_id: string;
  source_table: string;
  source_id: string;
  content: string;
  university_name: string | null;
  department: string | null;
  admission_year: number | null;
  similarity: number;
}

// ============================================
// 4. PDF 파싱 출력 스키마 (Claude API → JSON)
// ============================================

/** PDF 파싱 결과 — 이 JSON이 DB에 저장됨 */
export interface ExemplarParsedData {
  /** 파싱 메타데이터 */
  metadata: {
    sourceFilePath: string;
    sourceFileFormat: SourceFileFormat;
    parseQualityScore: number;
    parseErrors: ParseError[];
    parsedBy: string;
  };

  /** 학생 기본 정보 (익명화 전) */
  studentInfo: {
    name: string;              // 익명화 전 원본 이름 (anonymous_id 생성용)
    schoolName: string;
    schoolCategory?: SchoolCategory;
    enrollmentYear: number;    // 고1 입학 연도
    graduationYear?: number;
    curriculumRevision?: CurriculumRevision;
  };

  /** 합격 정보 (파일명/폴더명에서 추출) */
  admissions: {
    universityName: string;
    department?: string;
    admissionType?: AdmissionType;
    admissionRound?: AdmissionRound;
    admissionYear: number;
    isPrimary?: boolean;
  }[];

  /** 학적사항 */
  enrollment: {
    grade: number;
    className?: string;
    studentNumber?: string;
    homeroomTeacher?: string;
    enrollmentStatus?: string;
    enrollmentDate?: string;
  }[];

  /** 출결상황 */
  attendance: {
    grade: number;
    schoolDays?: number;
    absenceSick: number;
    absenceUnauthorized: number;
    absenceOther: number;
    latenessSick: number;
    latenessUnauthorized: number;
    latenessOther: number;
    earlyLeaveSick: number;
    earlyLeaveUnauthorized: number;
    earlyLeaveOther: number;
    classAbsenceSick: number;
    classAbsenceUnauthorized: number;
    classAbsenceOther: number;
    notes?: string;
  }[];

  /** 수상경력 */
  awards: {
    grade: number;
    awardName: string;
    awardLevel?: string;
    awardDate?: string;
    awardingBody?: string;
    participants?: string;
  }[];

  /** 자격증 */
  certifications: {
    certName: string;
    certLevel?: string;
    certNumber?: string;
    issuingOrg?: string;
    certDate?: string;
  }[];

  /** 진로희망사항 (2009/2015 교육과정) */
  careerAspirations: {
    grade: number;
    studentAspiration?: string;
    parentAspiration?: string;
    reason?: string;
    specialSkillsHobbies?: string;
  }[];

  /** 창의적 체험활동 특기사항 */
  creativeActivities: {
    grade: number;
    activityType: ActivityType;
    activityName?: string;
    hours?: number;
    content: string;
  }[];

  /** 봉사활동 실적 (날짜/기관/시간 상세) */
  volunteerRecords: {
    grade: number;
    activityDate?: string;
    location?: string;
    description?: string;
    hours?: number;
    cumulativeHours?: number;
  }[];

  /** 교과 성적 */
  grades: {
    grade: number;
    semester: number;
    subjectName: string;
    subjectType?: SubjectType;
    creditHours?: number;
    rawScore?: number;
    classAverage?: number;
    stdDev?: number;
    rankGrade?: number;
    achievementLevel?: string;
    totalStudents?: number;
    classRank?: number;
    achievementRatio?: Record<string, number>;
  }[];

  /** 세부능력 및 특기사항 (교과 세특) */
  seteks: {
    grade: number;
    semester: number;
    subjectName: string;
    content: string;
  }[];

  /** 체육/예술 성적 */
  peArtGrades: {
    grade: number;
    semester: number;
    subjectName: string;
    creditHours?: number;
    achievementLevel?: string;
    content?: string;
  }[];

  /** 독서활동 */
  reading: {
    grade: number;
    subjectArea: string;
    bookDescription: string;
    bookTitle?: string;
    author?: string;
  }[];

  /** 행동특성 및 종합의견 */
  haengteuk: {
    grade: number;
    content: string;
  }[];

  /** 전체 OCR 원문 (페이지별) */
  rawContentByPage?: Record<string, string>;
}

// ============================================
// 5. Import 파이프라인 타입
// ============================================

/** 배치 파싱 진행 상태 */
export type ExemplarImportPhase =
  | "idle"
  | "scanning"       // 파일 목록 스캔
  | "reading_pdf"    // PDF 읽기 + OCR
  | "parsing"        // AI 구조화
  | "extracting_meta" // 파일명에서 메타데이터 추출
  | "saving"         // DB 저장
  | "embedding"      // 벡터 임베딩 생성
  | "complete"
  | "error";

/** 배치 Import 진행 상태 */
export interface ExemplarImportProgress {
  phase: ExemplarImportPhase;
  currentFile: string;
  currentIndex: number;
  totalFiles: number;
  successCount: number;
  failedCount: number;
  errors: { file: string; message: string }[];
}

/** Import 실행 옵션 */
export interface ExemplarImportOptions {
  tenantId: string;
  filePaths: string[];
  overwriteExisting?: boolean;
  skipEmbedding?: boolean;
}

/** Import 단일 파일 결과 */
export interface ExemplarImportFileResult {
  filePath: string;
  success: boolean;
  exemplarId?: string;
  parseQualityScore?: number;
  error?: string;
  counts: {
    admissions: number;
    enrollment: number;
    attendance: number;
    awards: number;
    certifications: number;
    careerAspirations: number;
    creativeActivities: number;
    volunteerRecords: number;
    grades: number;
    seteks: number;
    peArtGrades: number;
    reading: number;
    haengteuk: number;
  };
}
