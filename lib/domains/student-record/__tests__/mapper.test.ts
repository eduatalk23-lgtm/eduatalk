import { describe, it, expect } from "vitest";
import {
  mapSeteks,
  mapChangche,
  mapHaengteuk,
  mapReadings,
  mapAttendance,
  mapAwards,
  mapVolunteer,
  mapGrades,
  mapAllRecords,
} from "../import/mapper";
import type { RecordImportData } from "../import/types";
import type { GradeMapperContext } from "../import/mapper";

// ============================================
// Import Mapper 테스트
// Phase 4.5 — ParsedData → DB Insert 변환
// ============================================

// ── 공통 Fixture ──

const CTX = {
  studentId: "student-1",
  tenantId: "tenant-1",
  subjectIdMap: new Map([
    ["국어", "subj-kor"],
    ["수학", "subj-math"],
    ["영어", "subj-eng"],
    ["미적분", "subj-calc"],
    ["물리학Ⅰ", "subj-physics"],
  ]),
};

const BASE_PARSED: RecordImportData = {
  studentInfo: { name: "홍길동", schoolName: "테스트고등학교", schoolYear: 2024 },
  detailedCompetencies: [],
  creativeActivities: [],
  behavioralCharacteristics: [],
  grades: [],
  attendance: [],
  readingActivities: [],
  awards: [],
  volunteerActivities: [],
  classInfo: [],
};

// ── mapSeteks ──

describe("mapSeteks", () => {
  it("과목 매칭된 세특을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      detailedCompetencies: [
        { grade: "1학년", semester: "1학기", subject: "국어", content: "뛰어난 작문 능력..." },
        { grade: "2학년", semester: "2학기", subject: "수학", content: "수학적 사고력이..." },
      ],
    };
    const result = mapSeteks(parsed, CTX);
    expect(result.items).toHaveLength(2);
    expect(result.skipped).toHaveLength(0);

    expect(result.items[0]).toMatchObject({
      student_id: "student-1",
      tenant_id: "tenant-1",
      grade: 1,
      school_year: 2024,
      semester: 1,
      subject_id: "subj-kor",
      imported_content: "뛰어난 작문 능력...",
      status: "final",
    });

    expect(result.items[1]).toMatchObject({
      grade: 2,
      school_year: 2025,
      semester: 2,
      subject_id: "subj-math",
    });
  });

  it("미매칭 과목은 skipped에 추가", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      detailedCompetencies: [
        { grade: "1학년", semester: "1학기", subject: "미술", content: "..." },
      ],
    };
    const result = mapSeteks(parsed, CTX);
    expect(result.items).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]).toEqual({ subject: "미술", reason: "과목 미매칭" });
  });

  it("학년→school_year 변환: 입학년도 + grade - 1", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      studentInfo: { name: "test", schoolName: "test", schoolYear: 2023 },
      detailedCompetencies: [
        { grade: "3학년", semester: "1학기", subject: "국어", content: "test" },
      ],
    };
    const result = mapSeteks(parsed, CTX);
    expect(result.items[0].school_year).toBe(2025); // 2023 + 3 - 1
  });

  it("빈 세특 → 빈 결과", () => {
    const result = mapSeteks(BASE_PARSED, CTX);
    expect(result.items).toHaveLength(0);
    expect(result.skipped).toHaveLength(0);
  });
});

// ── mapChangche ──

describe("mapChangche", () => {
  it("3가지 창체 활동유형을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      creativeActivities: [
        { grade: "1학년", category: "자율활동", hours: 34, content: "학급 회의..." },
        { grade: "1학년", category: "동아리활동", hours: 68, content: "과학부..." },
        { grade: "1학년", category: "진로활동", hours: 24, content: "진로 탐색..." },
      ],
    };
    const result = mapChangche(parsed, CTX);
    expect(result).toHaveLength(3);
    expect(result[0].activity_type).toBe("autonomy");
    expect(result[1].activity_type).toBe("club");
    expect(result[2].activity_type).toBe("career");
    expect(result[0].hours).toBe(34);
  });

  it("알 수 없는 카테고리는 무시", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      creativeActivities: [
        { grade: "1학년", category: "봉사활동", hours: 20, content: "..." },
      ],
    };
    const result = mapChangche(parsed, CTX);
    expect(result).toHaveLength(0);
  });

  it("hours가 0이면 null로 저장", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      creativeActivities: [
        { grade: "1학년", category: "자율활동", hours: 0, content: "test" },
      ],
    };
    const result = mapChangche(parsed, CTX);
    expect(result[0].hours).toBeNull();
  });
});

// ── mapHaengteuk ──

describe("mapHaengteuk", () => {
  it("행특을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      behavioralCharacteristics: [
        { grade: "1학년", content: "학교 생활에 적극적으로 참여..." },
        { grade: "2학년", content: "리더십을 발휘하여..." },
      ],
    };
    const result = mapHaengteuk(parsed, CTX);
    expect(result).toHaveLength(2);
    expect(result[0].grade).toBe(1);
    expect(result[0].school_year).toBe(2024);
    expect(result[0].status).toBe("final");
    expect(result[1].grade).toBe(2);
    expect(result[1].school_year).toBe(2025);
  });
});

// ── mapReadings ──

describe("mapReadings", () => {
  it("독서활동을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      readingActivities: [
        { grade: "1학년", subjectArea: "국어", bookTitle: "데미안", author: "헤르만 헤세" },
        { grade: "2학년", subjectArea: "", bookTitle: "사피엔스", author: "" },
      ],
    };
    const result = mapReadings(parsed, CTX);
    expect(result).toHaveLength(2);
    expect(result[0].book_title).toBe("데미안");
    expect(result[0].author).toBe("헤르만 헤세");
    expect(result[0].subject_area).toBe("국어");
    // author 빈 문자열 → null
    expect(result[1].author).toBeNull();
    // subjectArea 빈 문자열 → "공통" 기본값
    expect(result[1].subject_area).toBe("공통");
  });
});

// ── mapAttendance ──

describe("mapAttendance", () => {
  it("출결 + 학반정보 병합", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      attendance: [
        { grade: "1학년", sickAbsence: 2, unauthorizedAbsence: 0, authorizedAbsence: 1, lateness: 3, earlyLeave: 1, classAbsence: 0 },
      ],
      classInfo: [
        { grade: "1학년", className: "3", studentNumber: "15", homeroomTeacher: "김교사" },
      ],
    };
    const result = mapAttendance(parsed, CTX);
    expect(result).toHaveLength(1);
    expect(result[0].absence_sick).toBe(2);
    expect(result[0].absence_unauthorized).toBe(0);
    expect(result[0].absence_other).toBe(1);
    expect(result[0].lateness_sick).toBe(3);
    expect(result[0].early_leave_sick).toBe(1);
    expect(result[0].homeroom_teacher).toBe("김교사");
    expect(result[0].class_name).toBe("3");
    expect(result[0].student_number).toBe("15");
  });

  it("학반정보 없으면 null", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      attendance: [
        { grade: "2학년", sickAbsence: 0, unauthorizedAbsence: 0, authorizedAbsence: 0, lateness: 0, earlyLeave: 0, classAbsence: 0 },
      ],
    };
    const result = mapAttendance(parsed, CTX);
    expect(result[0].homeroom_teacher).toBeNull();
    expect(result[0].class_name).toBeNull();
    expect(result[0].student_number).toBeNull();
  });
});

// ── mapAwards ──

describe("mapAwards", () => {
  it("수상경력을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      awards: [
        { grade: "1학년", semester: "1학기", awardName: "교내 수학경시대회 금상", awardDate: "2024.06.15.", awardOrg: "테스트고등학교", participants: "1학년 전체(320명)" },
      ],
    };
    const result = mapAwards(parsed, CTX);
    expect(result).toHaveLength(1);
    expect(result[0].award_name).toBe("교내 수학경시대회 금상");
    // 날짜 변환: . → -, 끝 - 제거
    expect(result[0].award_date).toBe("2024-06-15");
    expect(result[0].awarding_body).toBe("테스트고등학교");
    expect(result[0].participants).toBe("1학년 전체(320명)");
  });

  it("빈 문자열 필드 → null", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      awards: [
        { grade: "1학년", semester: "1학기", awardName: "상장", awardDate: "", awardOrg: "", participants: "" },
      ],
    };
    const result = mapAwards(parsed, CTX);
    expect(result[0].award_date).toBeNull();
    expect(result[0].awarding_body).toBeNull();
    expect(result[0].participants).toBeNull();
  });
});

// ── mapVolunteer ──

describe("mapVolunteer", () => {
  it("봉사활동을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      volunteerActivities: [
        { grade: "1학년", activityDate: "2024.03.04~2024.07.19", location: "00복지관", content: "노인 돌봄", hours: 20, cumulativeHours: 20 },
      ],
    };
    const result = mapVolunteer(parsed, CTX);
    expect(result).toHaveLength(1);
    expect(result[0].hours).toBe(20);
    expect(result[0].cumulative_hours).toBe(20);
    expect(result[0].location).toBe("00복지관");
    expect(result[0].description).toBe("노인 돌봄");
  });

  it("빈 필드 → null", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      volunteerActivities: [
        { grade: "1학년", activityDate: "", location: "", content: "", hours: 8, cumulativeHours: 0 },
      ],
    };
    const result = mapVolunteer(parsed, CTX);
    expect(result[0].activity_date).toBeNull();
    expect(result[0].location).toBeNull();
    expect(result[0].description).toBeNull();
    expect(result[0].cumulative_hours).toBeNull();
  });
});

// ── mapGrades ──

describe("mapGrades", () => {
  const GRADE_CTX: GradeMapperContext = {
    ...CTX,
    subjectDetailMap: new Map([
      ["subj-kor", { id: "subj-kor", name: "국어", subject_group_id: "grp-1", subject_type_id: "type-1" }],
      ["subj-math", { id: "subj-math", name: "수학", subject_group_id: "grp-1", subject_type_id: "type-1" }],
      ["subj-calc", { id: "subj-calc", name: "미적분", subject_group_id: "grp-1", subject_type_id: null }],
    ]),
    curriculumRevisionId: "curr-2022",
    defaultSubjectTypeId: "type-default",
  };

  it("일반과목 성적을 올바르게 변환", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "1학년", semester: "1학기", subject: "국어", subjectType: "국어",
          creditHours: 3, rawScore: 92, classAverage: 78.5, standardDeviation: 12.3,
          achievementLevel: "A", totalStudents: 320, rankGrade: 2,
        },
      ],
    };
    const result = mapGrades(parsed, GRADE_CTX);
    expect(result.items).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
    const item = result.items[0];
    expect(item.grade).toBe(1);
    expect(item.semester).toBe(1);
    expect(item.credit_hours).toBe(3);
    expect(item.raw_score).toBe(92);
    expect(item.avg_score).toBe(78.5);
    expect(item.std_dev).toBe(12.3);
    expect(item.achievement_level).toBe("A");
    expect(item.total_students).toBe(320);
    expect(item.rank_grade).toBe(2);
    expect(item.subject_id).toBe("subj-kor");
    expect(item.subject_group_id).toBe("grp-1");
    expect(item.subject_type_id).toBe("type-1");
    expect(item.curriculum_revision_id).toBe("curr-2022");
  });

  it("진로선택 과목 성취도별 분포비율 포함", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "2학년", semester: "1학기", subject: "수학", subjectType: "수학",
          creditHours: 3, rawScore: 95, classAverage: 80, standardDeviation: 0,
          achievementLevel: "A", totalStudents: 150, rankGrade: 0,
          achievementRatioA: 85.2, achievementRatioB: 14.8, achievementRatioC: 0,
        },
      ],
    };
    const result = mapGrades(parsed, GRADE_CTX);
    expect(result.items[0].achievement_ratio_a).toBe(85.2);
    expect(result.items[0].achievement_ratio_b).toBe(14.8);
    expect(result.items[0].achievement_ratio_c).toBe(0);
    expect(result.items[0].achievement_ratio_d).toBeNull();
    expect(result.items[0].achievement_ratio_e).toBeNull();
  });

  it("subject_type_id null → defaultSubjectTypeId 사용", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "2학년", semester: "1학기", subject: "미적분", subjectType: "수학",
          creditHours: 3, rawScore: 88, classAverage: 70, standardDeviation: 15,
          achievementLevel: "A", totalStudents: 100, rankGrade: 1,
        },
      ],
    };
    const result = mapGrades(parsed, GRADE_CTX);
    expect(result.items[0].subject_type_id).toBe("type-default");
  });

  it("미매칭 과목 → skipped", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "1학년", semester: "1학기", subject: "체육", subjectType: "체육",
          creditHours: 2, rawScore: 0, classAverage: 0, standardDeviation: 0,
          achievementLevel: "A", totalStudents: 0, rankGrade: 0,
        },
      ],
    };
    const result = mapGrades(parsed, GRADE_CTX);
    expect(result.items).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe("과목 미매칭");
  });

  it("subjectDetailMap에 없으면 '과목 상세 정보 없음' 스킵", () => {
    const ctxMissing: GradeMapperContext = {
      ...GRADE_CTX,
      subjectIdMap: new Map([["물리학Ⅰ", "subj-physics"]]),
      subjectDetailMap: new Map(), // physics detail 없음
    };
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "1학년", semester: "1학기", subject: "물리학Ⅰ", subjectType: "과학",
          creditHours: 3, rawScore: 85, classAverage: 70, standardDeviation: 10,
          achievementLevel: "B", totalStudents: 100, rankGrade: 3,
        },
      ],
    };
    const result = mapGrades(parsed, ctxMissing);
    expect(result.skipped[0].reason).toBe("과목 상세 정보 없음");
  });

  it("rawScore 0 → null (falsy 값)", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "1학년", semester: "1학기", subject: "국어", subjectType: "국어",
          creditHours: 2, rawScore: 0, classAverage: 0, standardDeviation: 0,
          achievementLevel: "P", totalStudents: 0, rankGrade: 0,
        },
      ],
    };
    const result = mapGrades(parsed, GRADE_CTX);
    expect(result.items[0].raw_score).toBeNull();
    expect(result.items[0].avg_score).toBeNull();
    expect(result.items[0].rank_grade).toBeNull();
  });
});

// ── mapAllRecords ──

describe("mapAllRecords", () => {
  it("gradeCtx 없으면 grades는 빈 배열", () => {
    const parsed: RecordImportData = {
      ...BASE_PARSED,
      grades: [
        {
          grade: "1학년", semester: "1학기", subject: "국어", subjectType: "국어",
          creditHours: 3, rawScore: 90, classAverage: 75, standardDeviation: 10,
          achievementLevel: "A", totalStudents: 300, rankGrade: 1,
        },
      ],
    };
    const result = mapAllRecords(parsed, CTX);
    expect(result.grades.items).toHaveLength(0);
    expect(result.grades.skipped).toHaveLength(0);
  });

  it("전체 매핑 결과 구조 검증", () => {
    const result = mapAllRecords(BASE_PARSED, CTX);
    expect(result).toHaveProperty("seteks");
    expect(result).toHaveProperty("changche");
    expect(result).toHaveProperty("haengteuk");
    expect(result).toHaveProperty("readings");
    expect(result).toHaveProperty("attendance");
    expect(result).toHaveProperty("grades");
    expect(result).toHaveProperty("awards");
    expect(result).toHaveProperty("volunteer");
  });
});
