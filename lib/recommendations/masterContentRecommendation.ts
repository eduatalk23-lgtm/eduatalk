import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWeakSubjects } from "@/lib/metrics/getWeakSubjects";
import { getRiskIndexBySubject, getSchoolScoreSummary, getMockScoreSummary } from "@/lib/scheduler/scoreLoader";
import { searchMasterBooks, searchMasterLectures } from "@/lib/data/contentMasters";
import { MasterBook, MasterLecture } from "@/lib/types/plan";

type SupabaseServerClient = Awaited<
  ReturnType<typeof createSupabaseServerClient>
>;

export type RecommendedMasterContent = {
  id: string;
  contentType: "book" | "lecture";
  title: string;
  subject_category: string | null;
  subject: string | null;
  semester: string | null;
  revision: string | null;
  publisher?: string | null;
  platform?: string | null;
  difficulty_level: string | null;
  reason: string; // 추천 이유 (구체적인 성적 정보 포함)
  priority: number; // 우선순위 (낮을수록 높음)
  scoreDetails?: {
    // 성적 상세 정보 (추천 이유에 사용)
    schoolGrade?: number | null;
    schoolAverageGrade?: number | null;
    mockPercentile?: number | null;
    mockGrade?: number | null;
    riskScore?: number;
  };
};

/**
 * 성적 수준에 따른 추천 개수 결정
 */
function getRecommendationCount(riskScore: number, hasWeakSubject: boolean): { books: number; lectures: number } {
  if (hasWeakSubject) {
    // 취약 과목: 위험도에 따라 조정
    if (riskScore >= 70) return { books: 3, lectures: 2 }; // 매우 위험
    if (riskScore >= 50) return { books: 2, lectures: 2 }; // 위험
    return { books: 2, lectures: 1 }; // 보통
  } else {
    // Risk Index 기반: 위험도에 따라 조정
    if (riskScore >= 60) return { books: 2, lectures: 1 };
    return { books: 1, lectures: 1 };
  }
}

/**
 * 성적 수준에 따른 적절한 난이도 결정
 */
function getRecommendedDifficultyLevel(
  schoolGrade: number | null,
  mockGrade: number | null
): string | null {
  // 등급이 낮을수록(숫자가 클수록) 기초 난이도 추천
  const avgGrade = schoolGrade && mockGrade 
    ? (schoolGrade + mockGrade) / 2
    : schoolGrade || mockGrade;

  if (avgGrade === null) return null;

  if (avgGrade >= 6) return "기초"; // 6등급 이상: 기초
  if (avgGrade >= 4) return "기본"; // 4-5등급: 기본
  if (avgGrade >= 2) return "심화"; // 2-3등급: 심화
  return "최상"; // 1등급: 최상
}

/**
 * 추천 이유 생성 (구체적인 성적 정보 포함)
 */
function buildRecommendationReason(
  subject: string,
  isWeakSubject: boolean,
  riskInfo: { riskScore: number; reasons: string[] } | undefined,
  schoolSummary: { recentGrade: number | null; averageGrade: number | null } | undefined,
  mockSummary: { recentPercentile: number | null; recentGrade: number | null } | undefined
): string {
  const reasons: string[] = [];

  if (isWeakSubject) {
    reasons.push(`취약 과목 "${subject}"`);
  } else if (riskInfo) {
    reasons.push(`위험도 높은 과목 "${subject}"`);
  }

  // 구체적인 성적 정보 추가
  if (schoolSummary?.averageGrade !== null) {
    reasons.push(`내신 평균 ${schoolSummary.averageGrade.toFixed(2)}등급`);
  }
  if (schoolSummary?.recentGrade !== null && schoolSummary.averageGrade !== null) {
    if (schoolSummary.recentGrade > schoolSummary.averageGrade) {
      const decline = schoolSummary.recentGrade - schoolSummary.averageGrade;
      reasons.push(`최근 ${decline.toFixed(2)}단계 하락`);
    }
  }
  if (mockSummary?.recentPercentile !== null) {
    reasons.push(`모의고사 백분위 ${mockSummary.recentPercentile.toFixed(2)}%`);
  }
  if (mockSummary?.recentGrade !== null) {
    reasons.push(`모의고사 ${mockSummary.recentGrade.toFixed(2)}등급`);
  }
  if (riskInfo && riskInfo.riskScore >= 50) {
    reasons.push(`위험도 ${riskInfo.riskScore.toFixed(2)}점`);
  }

  return reasons.length > 0 ? reasons.join(", ") : `"${subject}" 과목 추천`;
}

/**
 * 최신 개정판 우선 정렬
 */
function sortByRevision<T extends { revision?: string | null; updated_at?: string | null }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    // revision이 있는 경우 우선 (최신 개정판)
    if (a.revision && !b.revision) return -1;
    if (!a.revision && b.revision) return 1;
    
    // revision 숫자 비교 (2024 > 2023)
    if (a.revision && b.revision) {
      const revA = parseInt(a.revision) || 0;
      const revB = parseInt(b.revision) || 0;
      if (revA !== revB) return revB - revA; // 높은 revision 우선
    }
    
    // updated_at으로 정렬 (최신순)
    if (a.updated_at && b.updated_at) {
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }
    
    return 0;
  });
}

/**
 * 서비스 마스터 콘텐츠 추천 생성 (개선 버전)
 * - 취약 과목 기반 추천 (성적 수준에 따른 동적 개수 조정)
 * - Risk Index 기반 추천 (구체적인 성적 정보 포함)
 * - 난이도 매칭 (성적 수준에 맞는 난이도 추천)
 * - 최신 개정판 우선 정렬
 * - 필수 과목 보장 (국어, 수학, 영어)
 * - 성적 데이터 부족 시 기본 추천 제공
 */
export async function getRecommendedMasterContents(
  supabase: SupabaseServerClient,
  studentId: string,
  tenantId: string | null,
  requestedSubjectCounts?: Map<string, number>
): Promise<RecommendedMasterContent[]> {
  const recommendations: RecommendedMasterContent[] = [];

  try {
    // 이번 주 범위 계산
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // 취약 과목, Risk Index, 성적 요약 조회
    const [weakSubjectsData, riskIndexMap, schoolSummaryMap, mockSummaryMap] = await Promise.all([
      getWeakSubjects(supabase, studentId, weekStart, weekEnd),
      getRiskIndexBySubject(studentId),
      getSchoolScoreSummary(studentId),
      getMockScoreSummary(studentId),
    ]);

    const weakSubjects = weakSubjectsData.weakSubjects;
    const riskSubjects = Array.from(riskIndexMap.entries())
      .filter(([_, risk]) => risk.riskScore >= 30)
      .map(([subject, _]) => subject)
      .sort((a, b) => {
        const riskA = riskIndexMap.get(a)?.riskScore || 0;
        const riskB = riskIndexMap.get(b)?.riskScore || 0;
        return riskB - riskA; // 높은 위험도 순
      });

    // 필수 과목 (국어, 수학, 영어)
    const requiredSubjects = ["국어", "수학", "영어"];
    
    // 성적 데이터가 있는지 확인
    const hasScoreData = weakSubjects.length > 0 || riskSubjects.length > 0 || 
                         schoolSummaryMap.size > 0 || mockSummaryMap.size > 0;

    // 추천 콘텐츠 수집
    const contentMap = new Map<string, RecommendedMasterContent>();

    // 1. 취약 과목 기반 추천 (우선순위 1-20)
    console.log("[recommendations/masterContent] 추천 시작:", {
      studentId,
      tenantId,
      weakSubjectsCount: weakSubjects.length,
      riskSubjectsCount: riskSubjects.length,
      hasScoreData,
      requestedSubjectCounts: requestedSubjectCounts ? Object.fromEntries(requestedSubjectCounts) : null,
    });
    
    for (let i = 0; i < weakSubjects.length && i < 5; i++) {
      const subject = weakSubjects[i];
      const riskInfo = riskIndexMap.get(subject);
      const riskScore = riskInfo?.riskScore || 0;
      const schoolSummary = schoolSummaryMap.get(subject);
      const mockSummary = mockSummaryMap.get(subject);
      
      // 성적 수준에 따른 추천 개수 결정
      const { books: bookCount, lectures: lectureCount } = getRecommendationCount(riskScore, true);
      
      // 적절한 난이도 결정
      const recommendedDifficulty = getRecommendedDifficultyLevel(
        schoolSummary?.recentGrade || null,
        mockSummary?.recentGrade || null
      );

      // 최대 개수로 검색 (난이도 필터링은 정렬 후 적용)
      console.log(`[recommendations/masterContent] 취약 과목 "${subject}" 마스터 콘텐츠 조회 시작:`, {
        subject,
        tenantId,
        studentId,
      });
      
      const [booksResult, lecturesResult] = await Promise.all([
        searchMasterBooks({
          subject_category: subject,
          tenantId,
          limit: 10, // 더 많이 가져와서 필터링
        }, supabase),
        searchMasterLectures({
          subject_category: subject,
          tenantId,
          limit: 10,
        }, supabase),
      ]);
      
      console.log(`[recommendations/masterContent] 취약 과목 "${subject}" 마스터 콘텐츠 조회 결과:`, {
        subject,
        booksCount: booksResult.data.length,
        lecturesCount: lecturesResult.data.length,
        booksTotal: booksResult.total,
        lecturesTotal: lecturesResult.total,
      });
      
      console.log(`[recommendations/masterContent] 취약 과목 "${subject}" 검색 결과:`, {
        subject,
        riskScore,
        recommendedDifficulty,
        requestedBookCount: bookCount,
        requestedLectureCount: lectureCount,
        foundBooks: booksResult.data.length,
        foundLectures: lecturesResult.data.length,
        totalBooks: booksResult.total || 0,
        totalLectures: lecturesResult.total || 0,
      });

      // 최신 개정판 우선 정렬
      const sortedBooks = sortByRevision(booksResult.data);
      const sortedLectures = sortByRevision(lecturesResult.data);

      // 난이도 매칭: 추천 난이도가 있으면 우선, 없으면 모든 난이도
      const filteredBooks = recommendedDifficulty
        ? sortedBooks.filter(b => b.difficulty_level === recommendedDifficulty || !b.difficulty_level)
            .concat(sortedBooks.filter(b => b.difficulty_level !== recommendedDifficulty && b.difficulty_level))
        : sortedBooks;
      
      const filteredLectures = recommendedDifficulty
        ? sortedLectures.filter(l => l.difficulty_level === recommendedDifficulty || !l.difficulty_level)
            .concat(sortedLectures.filter(l => l.difficulty_level !== recommendedDifficulty && l.difficulty_level))
        : sortedLectures;

      // 교재 추천
      const addedBooks = [];
      for (const book of filteredBooks.slice(0, bookCount)) {
        const key = `book:${book.id}`;
        if (!contentMap.has(key)) {
          const reason = buildRecommendationReason(
            subject,
            true,
            riskInfo,
            schoolSummary,
            mockSummary
          );
          
          contentMap.set(key, {
            id: book.id,
            contentType: "book",
            title: book.title,
            subject_category: book.subject_category,
            subject: book.subject,
            semester: book.semester,
            revision: book.revision,
            publisher: book.publisher,
            difficulty_level: book.difficulty_level,
            reason,
            priority: i * 4 + 1, // 취약 과목당 4개 슬롯 (교재 2-3개, 강의 1-2개)
            scoreDetails: {
              schoolGrade: schoolSummary?.recentGrade || null,
              schoolAverageGrade: schoolSummary?.averageGrade || null,
              mockPercentile: mockSummary?.recentPercentile || null,
              mockGrade: mockSummary?.recentGrade || null,
              riskScore: riskInfo?.riskScore,
            },
          });
          addedBooks.push(book.id);
        }
      }
      
      // 강의 추천
      const addedLectures = [];
      for (const lecture of filteredLectures.slice(0, lectureCount)) {
        const key = `lecture:${lecture.id}`;
        if (!contentMap.has(key)) {
          const reason = buildRecommendationReason(
            subject,
            true,
            riskInfo,
            schoolSummary,
            mockSummary
          );
          
          contentMap.set(key, {
            id: lecture.id,
            contentType: "lecture",
            title: lecture.title,
            subject_category: lecture.subject_category,
            subject: lecture.subject,
            semester: lecture.semester,
            revision: lecture.revision,
            platform: lecture.platform,
            difficulty_level: lecture.difficulty_level,
            reason,
            priority: i * 4 + 2 + (filteredLectures.indexOf(lecture) % 2), // 강의는 +2, +3
            scoreDetails: {
              schoolGrade: schoolSummary?.recentGrade || null,
              schoolAverageGrade: schoolSummary?.averageGrade || null,
              mockPercentile: mockSummary?.recentPercentile || null,
              mockGrade: mockSummary?.recentGrade || null,
              riskScore: riskInfo?.riskScore,
            },
          });
          addedLectures.push(lecture.id);
        }
      }
      
      // 콘텐츠 부족 이유 분석
      if (addedBooks.length < bookCount || addedLectures.length < lectureCount) {
        console.warn(`[recommendations/masterContent] 취약 과목 "${subject}" 콘텐츠 부족:`, {
          subject,
          requestedBookCount: bookCount,
          requestedLectureCount: lectureCount,
          addedBookCount: addedBooks.length,
          addedLectureCount: addedLectures.length,
          availableBooks: filteredBooks.length,
          availableLectures: filteredLectures.length,
          reason: filteredBooks.length < bookCount 
            ? `교재 부족: 요청 ${bookCount}개, 사용 가능 ${filteredBooks.length}개`
            : filteredLectures.length < lectureCount
            ? `강의 부족: 요청 ${lectureCount}개, 사용 가능 ${filteredLectures.length}개`
            : "중복 제거로 인한 부족",
        });
      }
    }

    // 2. Risk Index 기반 추천 (우선순위 21-40)
    let riskPriorityOffset = 21;
    for (let i = 0; i < riskSubjects.length && i < 5; i++) {
      const subject = riskSubjects[i];
      if (weakSubjects.includes(subject)) continue; // 이미 추가됨

      const riskInfo = riskIndexMap.get(subject);
      const riskScore = riskInfo?.riskScore || 0;
      const schoolSummary = schoolSummaryMap.get(subject);
      const mockSummary = mockSummaryMap.get(subject);
      
      // 성적 수준에 따른 추천 개수 결정
      const { books: bookCount, lectures: lectureCount } = getRecommendationCount(riskScore, false);
      
      // 적절한 난이도 결정
      const recommendedDifficulty = getRecommendedDifficultyLevel(
        schoolSummary?.recentGrade || null,
        mockSummary?.recentGrade || null
      );

      const [booksResult, lecturesResult] = await Promise.all([
        searchMasterBooks({
          subject_category: subject,
          tenantId,
          limit: 10,
        }, supabase),
        searchMasterLectures({
          subject_category: subject,
          tenantId,
          limit: 10,
        }, supabase),
      ]);

      // 최신 개정판 우선 정렬
      const sortedBooks = sortByRevision(booksResult.data);
      const sortedLectures = sortByRevision(lecturesResult.data);

      // 난이도 매칭
      const filteredBooks = recommendedDifficulty
        ? sortedBooks.filter(b => b.difficulty_level === recommendedDifficulty || !b.difficulty_level)
            .concat(sortedBooks.filter(b => b.difficulty_level !== recommendedDifficulty && b.difficulty_level))
        : sortedBooks;
      
      const filteredLectures = recommendedDifficulty
        ? sortedLectures.filter(l => l.difficulty_level === recommendedDifficulty || !l.difficulty_level)
            .concat(sortedLectures.filter(l => l.difficulty_level !== recommendedDifficulty && l.difficulty_level))
        : sortedLectures;

      // 교재 추천
      for (const book of filteredBooks.slice(0, bookCount)) {
        const key = `book:${book.id}`;
        if (!contentMap.has(key)) {
          const reason = buildRecommendationReason(
            subject,
            false,
            riskInfo,
            schoolSummary,
            mockSummary
          );
          
          contentMap.set(key, {
            id: book.id,
            contentType: "book",
            title: book.title,
            subject_category: book.subject_category,
            subject: book.subject,
            semester: book.semester,
            revision: book.revision,
            publisher: book.publisher,
            difficulty_level: book.difficulty_level,
            reason,
            priority: riskPriorityOffset,
            scoreDetails: {
              schoolGrade: schoolSummary?.recentGrade || null,
              schoolAverageGrade: schoolSummary?.averageGrade || null,
              mockPercentile: mockSummary?.recentPercentile || null,
              mockGrade: mockSummary?.recentGrade || null,
              riskScore: riskInfo?.riskScore,
            },
          });
          riskPriorityOffset++;
        }
      }

      // 강의 추천
      for (const lecture of filteredLectures.slice(0, lectureCount)) {
        const key = `lecture:${lecture.id}`;
        if (!contentMap.has(key)) {
          const reason = buildRecommendationReason(
            subject,
            false,
            riskInfo,
            schoolSummary,
            mockSummary
          );
          
          contentMap.set(key, {
            id: lecture.id,
            contentType: "lecture",
            title: lecture.title,
            subject_category: lecture.subject_category,
            subject: lecture.subject,
            semester: lecture.semester,
            revision: lecture.revision,
            platform: lecture.platform,
            difficulty_level: lecture.difficulty_level,
            reason,
            priority: riskPriorityOffset,
            scoreDetails: {
              schoolGrade: schoolSummary?.recentGrade || null,
              schoolAverageGrade: schoolSummary?.averageGrade || null,
              mockPercentile: mockSummary?.recentPercentile || null,
              mockGrade: mockSummary?.recentGrade || null,
              riskScore: riskInfo?.riskScore,
            },
          });
          riskPriorityOffset++;
        }
      }
    }

    // 3. 필수 과목 (국어, 수학, 영어) 각 1개씩 보장 (우선순위 41-50)
    let requiredPriorityOffset = 41;
    for (const requiredSubject of requiredSubjects) {
      // 이미 해당 과목이 포함되어 있는지 확인
      const hasSubject = Array.from(contentMap.values()).some(
        (c) => c.subject_category === requiredSubject
      );

      if (!hasSubject) {
        const schoolSummary = schoolSummaryMap.get(requiredSubject);
        const mockSummary = mockSummaryMap.get(requiredSubject);
        const riskInfo = riskIndexMap.get(requiredSubject);
        
        // 적절한 난이도 결정
        const recommendedDifficulty = getRecommendedDifficultyLevel(
          schoolSummary?.recentGrade || null,
          mockSummary?.recentGrade || null
        );

        const [booksResult, lecturesResult] = await Promise.all([
          searchMasterBooks({
            subject_category: requiredSubject,
            tenantId,
            limit: 5,
          }),
          searchMasterLectures({
            subject_category: requiredSubject,
            tenantId,
            limit: 5,
          }),
        ]);

        // 최신 개정판 우선 정렬
        const sortedBooks = sortByRevision(booksResult.data);
        const sortedLectures = sortByRevision(lecturesResult.data);

        // 난이도 매칭
        const filteredBooks = recommendedDifficulty
          ? sortedBooks.filter(b => b.difficulty_level === recommendedDifficulty || !b.difficulty_level)
              .concat(sortedBooks.filter(b => b.difficulty_level !== recommendedDifficulty && b.difficulty_level))
          : sortedBooks;
        
        const filteredLectures = recommendedDifficulty
          ? sortedLectures.filter(l => l.difficulty_level === recommendedDifficulty || !l.difficulty_level)
              .concat(sortedLectures.filter(l => l.difficulty_level !== recommendedDifficulty && l.difficulty_level))
          : sortedLectures;

        // 교재 우선, 없으면 강의
        if (filteredBooks.length > 0) {
          const book = filteredBooks[0];
          const key = `book:${book.id}`;
          if (!contentMap.has(key)) {
            const reason = hasScoreData
              ? buildRecommendationReason(requiredSubject, false, riskInfo, schoolSummary, mockSummary)
              : `필수 과목 "${requiredSubject}"`;
            
            contentMap.set(key, {
              id: book.id,
              contentType: "book",
              title: book.title,
              subject_category: book.subject_category,
              subject: book.subject,
              semester: book.semester,
              revision: book.revision,
              publisher: book.publisher,
              difficulty_level: book.difficulty_level,
              reason,
              priority: requiredPriorityOffset,
              scoreDetails: schoolSummary || mockSummary ? {
                schoolGrade: schoolSummary?.recentGrade || null,
                schoolAverageGrade: schoolSummary?.averageGrade || null,
                mockPercentile: mockSummary?.recentPercentile || null,
                mockGrade: mockSummary?.recentGrade || null,
                riskScore: riskInfo?.riskScore,
              } : undefined,
            });
            requiredPriorityOffset++;
          }
        } else if (filteredLectures.length > 0) {
          const lecture = filteredLectures[0];
          const key = `lecture:${lecture.id}`;
          if (!contentMap.has(key)) {
            const reason = hasScoreData
              ? buildRecommendationReason(requiredSubject, false, riskInfo, schoolSummary, mockSummary)
              : `필수 과목 "${requiredSubject}"`;
            
            contentMap.set(key, {
              id: lecture.id,
              contentType: "lecture",
              title: lecture.title,
              subject_category: lecture.subject_category,
              subject: lecture.subject,
              semester: lecture.semester,
              revision: lecture.revision,
              platform: lecture.platform,
              difficulty_level: lecture.difficulty_level,
              reason,
              priority: requiredPriorityOffset,
              scoreDetails: schoolSummary || mockSummary ? {
                schoolGrade: schoolSummary?.recentGrade || null,
                schoolAverageGrade: schoolSummary?.averageGrade || null,
                mockPercentile: mockSummary?.recentPercentile || null,
                mockGrade: mockSummary?.recentGrade || null,
                riskScore: riskInfo?.riskScore,
              } : undefined,
            });
            requiredPriorityOffset++;
          }
        }
      }
    }

    // 4. 성적 데이터가 부족한 경우 기본 추천 제공 (우선순위 51-60)
    if (!hasScoreData && contentMap.size < 3) {
      // 필수 과목 중 빠진 것들에 대해 기본 추천
      for (const requiredSubject of requiredSubjects) {
        const hasSubject = Array.from(contentMap.values()).some(
          (c) => c.subject_category === requiredSubject
        );

        if (!hasSubject) {
          console.log(`[recommendations/masterContent] 필수 과목 "${requiredSubject}" 기본 추천 조회:`, {
            subject: requiredSubject,
            tenantId,
            studentId,
          });
          
          const [booksResult, lecturesResult] = await Promise.all([
            searchMasterBooks({
              subject_category: requiredSubject,
              tenantId,
              limit: 3,
            }, supabase),
            searchMasterLectures({
              subject_category: requiredSubject,
              tenantId,
              limit: 3,
            }, supabase),
          ]);
          
          console.log(`[recommendations/masterContent] 필수 과목 "${requiredSubject}" 기본 추천 조회 결과:`, {
            subject: requiredSubject,
            booksCount: booksResult.data.length,
            lecturesCount: lecturesResult.data.length,
          });

          // 최신 개정판 우선 정렬
          const sortedBooks = sortByRevision(booksResult.data);
          const sortedLectures = sortByRevision(lecturesResult.data);

          // 교재 우선
          if (sortedBooks.length > 0) {
            const book = sortedBooks[0];
            const key = `book:${book.id}`;
            if (!contentMap.has(key)) {
              contentMap.set(key, {
                id: book.id,
                contentType: "book",
                title: book.title,
                subject_category: book.subject_category,
                subject: book.subject,
                semester: book.semester,
                revision: book.revision,
                publisher: book.publisher,
                difficulty_level: book.difficulty_level,
                reason: `필수 과목 "${requiredSubject}" (성적 데이터가 없어 기본 추천)`,
                priority: 51 + requiredSubjects.indexOf(requiredSubject),
              });
            }
          } else if (sortedLectures.length > 0) {
            const lecture = sortedLectures[0];
            const key = `lecture:${lecture.id}`;
            if (!contentMap.has(key)) {
              contentMap.set(key, {
                id: lecture.id,
                contentType: "lecture",
                title: lecture.title,
                subject_category: lecture.subject_category,
                subject: lecture.subject,
                semester: lecture.semester,
                revision: lecture.revision,
                platform: lecture.platform,
                difficulty_level: lecture.difficulty_level,
                reason: `필수 과목 "${requiredSubject}" (성적 데이터가 없어 기본 추천)`,
                priority: 51 + requiredSubjects.indexOf(requiredSubject),
              });
            }
          }
        }
      }
    }

    // 교과별 개수 파라미터가 있는 경우 필터링
    let finalRecommendations = Array.from(contentMap.values()).sort((a, b) => a.priority - b.priority);
    
    if (requestedSubjectCounts && requestedSubjectCounts.size > 0) {
      const filtered: RecommendedMasterContent[] = [];
      const subjectCounts = new Map<string, number>();
      
      // 교과별로 요청된 개수만큼만 추출
      for (const [subject, requestedCount] of requestedSubjectCounts) {
        const subjectRecommendations = finalRecommendations.filter(
          (r) => r.subject_category === subject
        );
        const toTake = Math.min(requestedCount, subjectRecommendations.length);
        subjectCounts.set(subject, toTake);
        
        // 요청된 개수보다 적은 경우 경고
        if (toTake < requestedCount) {
          console.warn(`[recommendations/masterContent] 교과 "${subject}" 추천 부족:`, {
            subject,
            requestedCount,
            availableCount: subjectRecommendations.length,
            reason: subjectRecommendations.length === 0 
              ? "해당 교과의 추천 콘텐츠가 없음"
              : `요청된 ${requestedCount}개보다 ${subjectRecommendations.length}개만 사용 가능`,
          });
        }
        
        for (let i = 0; i < toTake; i++) {
          filtered.push(subjectRecommendations[i]);
        }
      }
      
      // 필터링 후 결과가 없으면 전체 추천에서 최소한 기본 추천 제공
      // 서비스 마스터에 등록된 콘텐츠가 있으면 최소한 추천이 나와야 함
      if (filtered.length === 0 && finalRecommendations.length > 0) {
        // 전체 추천 중 우선순위가 높은 것들을 선택 (최대 3개)
        const fallbackCount = Math.min(3, finalRecommendations.length);
        for (let i = 0; i < fallbackCount; i++) {
          filtered.push(finalRecommendations[i]);
        }
        console.warn(`[recommendations/masterContent] 요청한 교과의 추천이 없어 전체 추천 중 ${fallbackCount}개 제공`);
      }
      
      finalRecommendations = filtered;
    }
    
    // 최종 추천 결과 로깅
    console.log("[recommendations/masterContent] 최종 추천 결과:", {
      totalRecommendations: finalRecommendations.length,
      bySubject: Array.from(
        finalRecommendations.reduce((acc, r) => {
          const count = acc.get(r.subject_category) || 0;
          acc.set(r.subject_category, count + 1);
          return acc;
        }, new Map<string, number>())
      ).map(([subject, count]) => ({ subject, count })),
      byType: finalRecommendations.reduce((acc, r) => {
        acc[r.contentType] = (acc[r.contentType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    });
    
    // 우선순위 순으로 정렬
    return finalRecommendations.sort((a, b) => a.priority - b.priority);
  } catch (error) {
    console.error("[recommendations/masterContent] 마스터 콘텐츠 추천 생성 실패", error);
    // 에러 발생 시에도 기본 추천 제공
    try {
      const requiredSubjects = ["국어", "수학", "영어"];
      const fallbackRecommendations: RecommendedMasterContent[] = [];
      
      for (const subject of requiredSubjects) {
        const [booksResult] = await Promise.all([
          searchMasterBooks({
            subject_category: subject,
            tenantId,
            limit: 1,
          }, supabase),
        ]);

        if (booksResult.data.length > 0) {
          const book = sortByRevision(booksResult.data)[0];
          fallbackRecommendations.push({
            id: book.id,
            contentType: "book",
            title: book.title,
            subject_category: book.subject_category,
            subject: book.subject,
            semester: book.semester,
            revision: book.revision,
            publisher: book.publisher,
            difficulty_level: book.difficulty_level,
            reason: `필수 과목 "${subject}" (기본 추천)`,
            priority: 100 + fallbackRecommendations.length,
          });
        }
      }
      
      return fallbackRecommendations;
    } catch (fallbackError) {
      console.error("[recommendations/masterContent] 기본 추천 생성 실패", fallbackError);
      return [];
    }
  }
}

