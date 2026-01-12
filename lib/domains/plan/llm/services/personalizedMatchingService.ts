/**
 * Personalized Content Matching Service
 * Phase 3.3: 맞춤형 콘텐츠 매칭 시스템
 *
 * 학생 수준, 학습 패턴, 선수지식 기반 콘텐츠 매칭 및 추천
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentDifficultyService, type StoredDifficultyAnalysis } from "./contentDifficultyService";
import { PrerequisiteService, type LearningGap } from "./prerequisiteService";

// ============================================
// Types
// ============================================

export type DifficultyFit = "too_easy" | "appropriate" | "challenging" | "too_hard";

export interface MatchFactor {
  name: string;
  weight: number;
  score: number; // 0-100
  contribution: number; // weight * score
  reason: string;
}

export interface MatchScore {
  contentId: string;
  contentType: "book" | "lecture";
  title: string;
  totalScore: number; // 0-100
  factors: MatchFactor[];
  difficultyFit: DifficultyFit;
  estimatedCompletionTime: number; // hours
  recommendationReason: string;
}

export interface StudentProfile {
  id: string;
  currentLevel: number; // 1-5
  weakSubjects: string[];
  strongSubjects: string[];
  averageStudyPace: number; // pages or episodes per hour
  recentInterests: string[]; // recent subject categories
  completedContentIds: string[];
  learningVelocity: number; // 0.5-2.0 (1.0 = average)
}

export interface ContentCandidate {
  id: string;
  type: "book" | "lecture";
  title: string;
  subject: string;
  subjectCategory: string;
  difficultyLevel: number;
  totalUnits: number; // pages or episodes
  estimatedHours: number;
  publishedAt?: string;
  averageRating?: number;
  completionRate?: number; // peer success rate
}

export interface MatchingOptions {
  maxResults?: number;
  includeAlreadyOwned?: boolean;
  subjectFilter?: string[];
  difficultyRange?: { min: number; max: number };
  excludeContentIds?: string[];
}

export interface MatchingResult {
  matches: MatchScore[];
  studentProfile: StudentProfile;
  analysisTimestamp: string;
  totalCandidates: number;
  matchingCriteria: string;
}

// ============================================
// Matching Factor Weights
// ============================================

export const MATCH_FACTOR_WEIGHTS = {
  difficultyAlignment: 25,
  weakSubjectTarget: 20,
  paceAlignment: 15,
  prerequisiteMet: 15,
  recentInterest: 10,
  peerSuccess: 10,
  freshness: 5,
} as const;

// ============================================
// PersonalizedMatchingService
// ============================================

export class PersonalizedMatchingService {
  private tenantId: string;
  private difficultyService: ContentDifficultyService;
  private prerequisiteService: PrerequisiteService;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.difficultyService = new ContentDifficultyService(tenantId);
    this.prerequisiteService = new PrerequisiteService(tenantId);
  }

  // ----------------------------------------
  // Main Matching API
  // ----------------------------------------

  /**
   * 학생에게 맞춤형 콘텐츠 추천
   */
  async findMatchingContent(
    studentId: string,
    options: MatchingOptions = {}
  ): Promise<MatchingResult> {
    const {
      maxResults = 10,
      includeAlreadyOwned = false,
      subjectFilter,
      difficultyRange,
      excludeContentIds = [],
    } = options;

    // 1. 학생 프로필 구축
    const studentProfile = await this.buildStudentProfile(studentId);

    // 2. 콘텐츠 후보 조회
    const candidates = await this.getContentCandidates({
      subjectFilter,
      difficultyRange,
      excludeContentIds: includeAlreadyOwned
        ? excludeContentIds
        : [...excludeContentIds, ...studentProfile.completedContentIds],
    });

    if (candidates.length === 0) {
      return {
        matches: [],
        studentProfile,
        analysisTimestamp: new Date().toISOString(),
        totalCandidates: 0,
        matchingCriteria: this.buildMatchingCriteria(options),
      };
    }

    // 3. 각 콘텐츠에 대해 매칭 점수 계산
    const matchScores: MatchScore[] = [];

    for (const candidate of candidates) {
      const score = await this.calculateMatchScore(studentProfile, candidate);
      matchScores.push(score);
    }

    // 4. 점수로 정렬하고 상위 결과 반환
    matchScores.sort((a, b) => b.totalScore - a.totalScore);
    const topMatches = matchScores.slice(0, maxResults);

    return {
      matches: topMatches,
      studentProfile,
      analysisTimestamp: new Date().toISOString(),
      totalCandidates: candidates.length,
      matchingCriteria: this.buildMatchingCriteria(options),
    };
  }

  /**
   * 특정 콘텐츠의 학생 적합도 분석
   */
  async analyzeContentFit(
    studentId: string,
    contentId: string,
    contentType: "book" | "lecture"
  ): Promise<MatchScore | null> {
    const studentProfile = await this.buildStudentProfile(studentId);
    const candidate = await this.getContentById(contentId, contentType);

    if (!candidate) {
      return null;
    }

    return this.calculateMatchScore(studentProfile, candidate);
  }

  /**
   * 약점 과목 기반 콘텐츠 추천
   */
  async findWeaknessFillers(
    studentId: string,
    maxResults: number = 5
  ): Promise<MatchScore[]> {
    const studentProfile = await this.buildStudentProfile(studentId);

    if (studentProfile.weakSubjects.length === 0) {
      return [];
    }

    // 약점 과목 필터로 매칭
    const result = await this.findMatchingContent(studentId, {
      maxResults,
      subjectFilter: studentProfile.weakSubjects,
      difficultyRange: {
        min: Math.max(1, studentProfile.currentLevel - 0.5),
        max: studentProfile.currentLevel + 1,
      },
    });

    return result.matches;
  }

  /**
   * 선수지식 갭 해소 콘텐츠 추천
   */
  async findGapFillers(
    studentId: string,
    targetContentId: string,
    maxResults: number = 5
  ): Promise<MatchScore[]> {
    // 선수지식 갭 식별
    const gaps = await this.prerequisiteService.identifyGaps(studentId, targetContentId);

    if (gaps.length === 0) {
      return [];
    }

    // 갭 해소 콘텐츠 추천
    const recommendations = await this.prerequisiteService.recommendGapFillers(gaps);

    // 매칭 점수로 변환
    const studentProfile = await this.buildStudentProfile(studentId);
    const matchScores: MatchScore[] = [];

    for (const rec of recommendations.slice(0, maxResults)) {
      const candidate = await this.getContentById(rec.contentId, rec.contentType);
      if (candidate) {
        const score = await this.calculateMatchScore(studentProfile, candidate);
        // 갭 해소 관련 추가 정보
        score.recommendationReason = `${rec.reasoning} (갭 해소 기여도: ${Math.round(rec.coverageScore * 100)}%)`;
        matchScores.push(score);
      }
    }

    return matchScores;
  }

  // ----------------------------------------
  // Profile Building
  // ----------------------------------------

  /**
   * 학생 프로필 구축
   */
  async buildStudentProfile(studentId: string): Promise<StudentProfile> {
    const supabase = await createSupabaseServerClient();

    // 1. 기본 학생 정보 조회
    const { data: student } = await supabase
      .from("students")
      .select("id, grade_level")
      .eq("id", studentId)
      .single();

    // 2. 완료한 콘텐츠 조회
    const { data: completedPlans } = await supabase
      .from("student_plan")
      .select("content_id, content_subject, simple_completed_at, total_duration_seconds")
      .eq("student_id", studentId)
      .eq("status", "completed")
      .not("content_id", "is", null)
      .order("simple_completed_at", { ascending: false })
      .limit(100);

    const completedContentIds = completedPlans?.map((p) => p.content_id).filter(Boolean) || [];

    // 3. 과목별 성적 조회
    const { data: scores } = await supabase
      .from("scores")
      .select("subject, score, exam_type")
      .eq("student_id", studentId)
      .order("exam_date", { ascending: false })
      .limit(20);

    // 4. 약점/강점 과목 분석
    const subjectPerformance = this.analyzeSubjectPerformance(scores || []);

    // 5. 학습 속도 분석
    const learningPace = this.calculateLearningPace(completedPlans || []);

    // 6. 최근 관심 분야 분석
    const recentInterests = this.extractRecentInterests(completedPlans || []);

    // 7. 현재 수준 추정
    const currentLevel = this.estimateCurrentLevel(subjectPerformance, student?.grade_level);

    return {
      id: studentId,
      currentLevel,
      weakSubjects: subjectPerformance.weak,
      strongSubjects: subjectPerformance.strong,
      averageStudyPace: learningPace.pagesPerHour,
      recentInterests,
      completedContentIds,
      learningVelocity: learningPace.velocity,
    };
  }

  private analyzeSubjectPerformance(
    scores: Array<{ subject: string; score: number; exam_type: string }>
  ): { weak: string[]; strong: string[] } {
    if (scores.length === 0) {
      return { weak: [], strong: [] };
    }

    // 과목별 평균 점수 계산
    const subjectScores = new Map<string, { total: number; count: number }>();

    for (const score of scores) {
      const existing = subjectScores.get(score.subject) || { total: 0, count: 0 };
      subjectScores.set(score.subject, {
        total: existing.total + score.score,
        count: existing.count + 1,
      });
    }

    // 평균 계산 및 분류
    const averages: Array<{ subject: string; avg: number }> = [];
    for (const [subject, data] of subjectScores) {
      averages.push({ subject, avg: data.total / data.count });
    }

    averages.sort((a, b) => b.avg - a.avg);

    // 상위 30%는 강점, 하위 30%는 약점
    const strongCount = Math.max(1, Math.floor(averages.length * 0.3));
    const weakCount = Math.max(1, Math.floor(averages.length * 0.3));

    return {
      strong: averages.slice(0, strongCount).map((a) => a.subject),
      weak: averages.slice(-weakCount).map((a) => a.subject),
    };
  }

  private calculateLearningPace(
    completedPlans: Array<{ content_id: string; total_duration_seconds: number | null }>
  ): { pagesPerHour: number; velocity: number } {
    const plansWithDuration = completedPlans.filter(
      (p) => p.total_duration_seconds && p.total_duration_seconds > 0
    );

    if (plansWithDuration.length === 0) {
      return { pagesPerHour: 10, velocity: 1.0 }; // 기본값
    }

    // 평균 학습 시간 계산 (초 → 시간)
    const avgDurationHours =
      plansWithDuration.reduce((sum, p) => sum + (p.total_duration_seconds || 0), 0) /
      plansWithDuration.length /
      3600;

    // 예상 학습 속도 (페이지/시간) - 기본 10페이지/시간 기준
    const pagesPerHour = avgDurationHours > 0 ? 10 / avgDurationHours : 10;

    // 학습 속도 배수 (1.0 = 평균)
    const velocity = Math.max(0.5, Math.min(2.0, pagesPerHour / 10));

    return { pagesPerHour: Math.round(pagesPerHour * 10) / 10, velocity };
  }

  private extractRecentInterests(
    completedPlans: Array<{ content_subject: string | null; simple_completed_at: string | null }>
  ): string[] {
    // 최근 30개 플랜의 과목 추출
    const recentSubjects = completedPlans
      .slice(0, 30)
      .map((p) => p.content_subject)
      .filter((s): s is string => Boolean(s));

    // 빈도 계산
    const frequency = new Map<string, number>();
    for (const subject of recentSubjects) {
      frequency.set(subject, (frequency.get(subject) || 0) + 1);
    }

    // 빈도순 정렬하여 상위 3개 반환
    return [...frequency.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([subject]) => subject);
  }

  private estimateCurrentLevel(
    subjectPerformance: { weak: string[]; strong: string[] },
    gradeLevel?: number
  ): number {
    // 기본 학년 기반 수준
    let baseLevel = gradeLevel ? Math.min(gradeLevel, 3) + 1 : 3; // 고1=2, 고2=3, 고3=4

    // 성적 기반 조정
    const strongCount = subjectPerformance.strong.length;
    const weakCount = subjectPerformance.weak.length;

    if (strongCount > weakCount * 2) {
      baseLevel = Math.min(5, baseLevel + 0.5);
    } else if (weakCount > strongCount * 2) {
      baseLevel = Math.max(1, baseLevel - 0.5);
    }

    return Math.round(baseLevel * 10) / 10;
  }

  // ----------------------------------------
  // Content Candidates
  // ----------------------------------------

  private async getContentCandidates(options: {
    subjectFilter?: string[];
    difficultyRange?: { min: number; max: number };
    excludeContentIds?: string[];
  }): Promise<ContentCandidate[]> {
    const supabase = await createSupabaseServerClient();
    const candidates: ContentCandidate[] = [];

    // 도서 조회
    let bookQuery = supabase.from("master_books").select("*");

    if (options.subjectFilter && options.subjectFilter.length > 0) {
      bookQuery = bookQuery.in("subject", options.subjectFilter);
    }
    if (options.excludeContentIds && options.excludeContentIds.length > 0) {
      bookQuery = bookQuery.not("id", "in", `(${options.excludeContentIds.join(",")})`);
    }
    if (options.difficultyRange) {
      bookQuery = bookQuery
        .gte("difficulty_level", options.difficultyRange.min)
        .lte("difficulty_level", options.difficultyRange.max);
    }

    const { data: books } = await bookQuery.limit(100);

    for (const book of books || []) {
      candidates.push({
        id: book.id,
        type: "book",
        title: book.title,
        subject: book.subject || "",
        subjectCategory: book.subject_category || "",
        difficultyLevel: book.difficulty_level || 3,
        totalUnits: book.total_pages || 100,
        estimatedHours: (book.total_pages || 100) / 10,
        publishedAt: book.created_at,
      });
    }

    // 강의 조회
    let lectureQuery = supabase.from("master_lectures").select("*");

    if (options.subjectFilter && options.subjectFilter.length > 0) {
      lectureQuery = lectureQuery.in("subject", options.subjectFilter);
    }
    if (options.excludeContentIds && options.excludeContentIds.length > 0) {
      lectureQuery = lectureQuery.not("id", "in", `(${options.excludeContentIds.join(",")})`);
    }
    if (options.difficultyRange) {
      lectureQuery = lectureQuery
        .gte("difficulty_level", options.difficultyRange.min)
        .lte("difficulty_level", options.difficultyRange.max);
    }

    const { data: lectures } = await lectureQuery.limit(100);

    for (const lecture of lectures || []) {
      candidates.push({
        id: lecture.id,
        type: "lecture",
        title: lecture.title,
        subject: lecture.subject || "",
        subjectCategory: lecture.subject_category || "",
        difficultyLevel: lecture.difficulty_level || 3,
        totalUnits: lecture.total_episodes || 20,
        estimatedHours: (lecture.total_duration || 600) / 60,
        publishedAt: lecture.created_at,
      });
    }

    return candidates;
  }

  private async getContentById(
    contentId: string,
    contentType: "book" | "lecture"
  ): Promise<ContentCandidate | null> {
    const supabase = await createSupabaseServerClient();

    if (contentType === "book") {
      const { data: book } = await supabase
        .from("master_books")
        .select("*")
        .eq("id", contentId)
        .single();

      if (!book) return null;

      return {
        id: book.id,
        type: "book",
        title: book.title,
        subject: book.subject || "",
        subjectCategory: book.subject_category || "",
        difficultyLevel: book.difficulty_level || 3,
        totalUnits: book.total_pages || 100,
        estimatedHours: (book.total_pages || 100) / 10,
        publishedAt: book.created_at,
      };
    } else {
      const { data: lecture } = await supabase
        .from("master_lectures")
        .select("*")
        .eq("id", contentId)
        .single();

      if (!lecture) return null;

      return {
        id: lecture.id,
        type: "lecture",
        title: lecture.title,
        subject: lecture.subject || "",
        subjectCategory: lecture.subject_category || "",
        difficultyLevel: lecture.difficulty_level || 3,
        totalUnits: lecture.total_episodes || 20,
        estimatedHours: (lecture.total_duration || 600) / 60,
        publishedAt: lecture.created_at,
      };
    }
  }

  // ----------------------------------------
  // Score Calculation
  // ----------------------------------------

  /**
   * 매칭 점수 계산
   */
  private async calculateMatchScore(
    student: StudentProfile,
    content: ContentCandidate
  ): Promise<MatchScore> {
    const factors: MatchFactor[] = [];

    // 1. 난이도 적합성 (25%)
    const difficultyFactor = this.calculateDifficultyFactor(student, content);
    factors.push(difficultyFactor);

    // 2. 약점 과목 타겟 (20%)
    const weakSubjectFactor = this.calculateWeakSubjectFactor(student, content);
    factors.push(weakSubjectFactor);

    // 3. 학습 속도 적합성 (15%)
    const paceFactor = this.calculatePaceFactor(student, content);
    factors.push(paceFactor);

    // 4. 선수지식 충족 (15%)
    const prerequisiteFactor = await this.calculatePrerequisiteFactor(student, content);
    factors.push(prerequisiteFactor);

    // 5. 최근 관심사 (10%)
    const interestFactor = this.calculateInterestFactor(student, content);
    factors.push(interestFactor);

    // 6. 동료 성공률 (10%)
    const peerFactor = await this.calculatePeerSuccessFactor(content);
    factors.push(peerFactor);

    // 7. 최신성 (5%)
    const freshnessFactor = this.calculateFreshnessFactor(content);
    factors.push(freshnessFactor);

    // 총점 계산
    const totalScore = factors.reduce((sum, f) => sum + f.contribution, 0);

    // 난이도 적합성 판단
    const difficultyFit = this.determineDifficultyFit(student.currentLevel, content.difficultyLevel);

    // 예상 완료 시간
    const estimatedCompletionTime = content.estimatedHours / student.learningVelocity;

    return {
      contentId: content.id,
      contentType: content.type,
      title: content.title,
      totalScore: Math.round(totalScore * 10) / 10,
      factors,
      difficultyFit,
      estimatedCompletionTime: Math.round(estimatedCompletionTime * 10) / 10,
      recommendationReason: this.generateRecommendationReason(factors, difficultyFit),
    };
  }

  private calculateDifficultyFactor(student: StudentProfile, content: ContentCandidate): MatchFactor {
    const weight = MATCH_FACTOR_WEIGHTS.difficultyAlignment;
    const levelDiff = Math.abs(student.currentLevel - content.difficultyLevel);

    let score: number;
    let reason: string;

    if (levelDiff <= 0.5) {
      score = 100;
      reason = "난이도가 현재 수준에 매우 적합합니다";
    } else if (levelDiff <= 1) {
      score = 75;
      reason = "난이도가 현재 수준에 적합합니다";
    } else if (levelDiff <= 1.5) {
      score = 50;
      reason = content.difficultyLevel > student.currentLevel
        ? "약간 도전적인 난이도입니다"
        : "약간 쉬운 난이도입니다";
    } else {
      score = 25;
      reason = content.difficultyLevel > student.currentLevel
        ? "현재 수준보다 어려울 수 있습니다"
        : "현재 수준보다 쉬울 수 있습니다";
    }

    return {
      name: "난이도 적합성",
      weight,
      score,
      contribution: (weight * score) / 100,
      reason,
    };
  }

  private calculateWeakSubjectFactor(student: StudentProfile, content: ContentCandidate): MatchFactor {
    const weight = MATCH_FACTOR_WEIGHTS.weakSubjectTarget;

    const isWeakSubject =
      student.weakSubjects.includes(content.subject) ||
      student.weakSubjects.includes(content.subjectCategory);

    let score: number;
    let reason: string;

    if (isWeakSubject) {
      score = 100;
      reason = "약점 과목 보완에 효과적입니다";
    } else if (student.strongSubjects.includes(content.subject)) {
      score = 30;
      reason = "이미 강점인 과목입니다";
    } else {
      score = 60;
      reason = "일반 과목입니다";
    }

    return {
      name: "약점 과목 타겟",
      weight,
      score,
      contribution: (weight * score) / 100,
      reason,
    };
  }

  private calculatePaceFactor(student: StudentProfile, content: ContentCandidate): MatchFactor {
    const weight = MATCH_FACTOR_WEIGHTS.paceAlignment;

    // 콘텐츠의 예상 학습 시간과 학생의 학습 속도 비교
    const adjustedHours = content.estimatedHours / student.learningVelocity;

    let score: number;
    let reason: string;

    if (adjustedHours <= 20) {
      score = 90;
      reason = "적절한 분량입니다 (약 20시간 이내)";
    } else if (adjustedHours <= 40) {
      score = 70;
      reason = "중간 분량입니다 (약 20-40시간)";
    } else if (adjustedHours <= 60) {
      score = 50;
      reason = "다소 많은 분량입니다 (약 40-60시간)";
    } else {
      score = 30;
      reason = "상당한 분량입니다 (60시간 이상)";
    }

    return {
      name: "학습 속도 적합성",
      weight,
      score,
      contribution: (weight * score) / 100,
      reason,
    };
  }

  private async calculatePrerequisiteFactor(
    student: StudentProfile,
    content: ContentCandidate
  ): Promise<MatchFactor> {
    const weight = MATCH_FACTOR_WEIGHTS.prerequisiteMet;

    try {
      // 선수지식 갭 확인
      const gaps = await this.prerequisiteService.identifyGaps(student.id, content.id);

      let score: number;
      let reason: string;

      if (gaps.length === 0) {
        score = 100;
        reason = "선수지식이 모두 충족되어 바로 시작 가능합니다";
      } else if (gaps.length <= 2) {
        score = 60;
        reason = `${gaps.length}개의 선수지식이 필요합니다`;
      } else {
        score = 30;
        reason = `${gaps.length}개의 선수지식이 필요합니다 (사전 학습 권장)`;
      }

      return {
        name: "선수지식 충족",
        weight,
        score,
        contribution: (weight * score) / 100,
        reason,
      };
    } catch {
      // 선수지식 분석 실패 시 중립 점수
      return {
        name: "선수지식 충족",
        weight,
        score: 70,
        contribution: (weight * 70) / 100,
        reason: "선수지식 분석 불가 (기본 점수 적용)",
      };
    }
  }

  private calculateInterestFactor(student: StudentProfile, content: ContentCandidate): MatchFactor {
    const weight = MATCH_FACTOR_WEIGHTS.recentInterest;

    const isRecentInterest =
      student.recentInterests.includes(content.subject) ||
      student.recentInterests.includes(content.subjectCategory);

    let score: number;
    let reason: string;

    if (isRecentInterest) {
      score = 100;
      reason = "최근 학습 관심사와 일치합니다";
    } else {
      score = 50;
      reason = "새로운 영역의 콘텐츠입니다";
    }

    return {
      name: "최근 관심사",
      weight,
      score,
      contribution: (weight * score) / 100,
      reason,
    };
  }

  private async calculatePeerSuccessFactor(content: ContentCandidate): Promise<MatchFactor> {
    const weight = MATCH_FACTOR_WEIGHTS.peerSuccess;

    // 실제로는 동료 학생들의 완료율을 조회해야 함
    // 여기서는 기본값 사용
    const completionRate = content.completionRate || 0.7;

    let score: number;
    let reason: string;

    if (completionRate >= 0.8) {
      score = 100;
      reason = "다른 학생들의 완료율이 높습니다";
    } else if (completionRate >= 0.6) {
      score = 70;
      reason = "다른 학생들의 완료율이 보통입니다";
    } else {
      score = 40;
      reason = "다른 학생들의 완료율이 낮습니다";
    }

    return {
      name: "동료 성공률",
      weight,
      score,
      contribution: (weight * score) / 100,
      reason,
    };
  }

  private calculateFreshnessFactor(content: ContentCandidate): MatchFactor {
    const weight = MATCH_FACTOR_WEIGHTS.freshness;

    const publishedAt = content.publishedAt ? new Date(content.publishedAt) : null;
    const now = new Date();

    let score: number;
    let reason: string;

    if (!publishedAt) {
      score = 50;
      reason = "출시일 정보 없음";
    } else {
      const monthsOld = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24 * 30);

      if (monthsOld <= 6) {
        score = 100;
        reason = "최신 콘텐츠입니다";
      } else if (monthsOld <= 12) {
        score = 80;
        reason = "비교적 최신 콘텐츠입니다";
      } else if (monthsOld <= 24) {
        score = 60;
        reason = "1-2년 된 콘텐츠입니다";
      } else {
        score = 40;
        reason = "출시된 지 오래된 콘텐츠입니다";
      }
    }

    return {
      name: "최신성",
      weight,
      score,
      contribution: (weight * score) / 100,
      reason,
    };
  }

  private determineDifficultyFit(studentLevel: number, contentDifficulty: number): DifficultyFit {
    const diff = contentDifficulty - studentLevel;

    if (diff < -1) return "too_easy";
    if (diff <= 0.5) return "appropriate";
    if (diff <= 1.5) return "challenging";
    return "too_hard";
  }

  private generateRecommendationReason(factors: MatchFactor[], difficultyFit: DifficultyFit): string {
    // 상위 2개 긍정 요인 추출
    const topFactors = factors
      .filter((f) => f.score >= 70)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2);

    if (topFactors.length === 0) {
      return "기본 추천입니다.";
    }

    const reasons = topFactors.map((f) => f.reason).join(". ");

    const difficultyNote =
      difficultyFit === "appropriate"
        ? ""
        : difficultyFit === "challenging"
          ? " (도전적인 난이도)"
          : difficultyFit === "too_easy"
            ? " (쉬운 편)"
            : " (어려울 수 있음)";

    return reasons + difficultyNote;
  }

  private buildMatchingCriteria(options: MatchingOptions): string {
    const criteria: string[] = [];

    if (options.subjectFilter && options.subjectFilter.length > 0) {
      criteria.push(`과목: ${options.subjectFilter.join(", ")}`);
    }

    if (options.difficultyRange) {
      criteria.push(`난이도: ${options.difficultyRange.min}-${options.difficultyRange.max}`);
    }

    if (!options.includeAlreadyOwned) {
      criteria.push("이미 보유한 콘텐츠 제외");
    }

    return criteria.length > 0 ? criteria.join(" | ") : "전체 콘텐츠 대상";
  }

  // ----------------------------------------
  // Static Utilities
  // ----------------------------------------

  /**
   * 매칭 점수를 등급으로 변환
   */
  static scoreToGrade(score: number): "A" | "B" | "C" | "D" | "F" {
    if (score >= 85) return "A";
    if (score >= 70) return "B";
    if (score >= 55) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  /**
   * 등급별 설명
   */
  static gradeDescription(grade: "A" | "B" | "C" | "D" | "F"): string {
    const descriptions = {
      A: "매우 적합한 콘텐츠입니다",
      B: "적합한 콘텐츠입니다",
      C: "보통 수준의 적합도입니다",
      D: "다소 맞지 않을 수 있습니다",
      F: "적합하지 않은 콘텐츠입니다",
    };
    return descriptions[grade];
  }

  /**
   * 난이도 적합성 라벨
   */
  static difficultyFitLabel(fit: DifficultyFit): string {
    const labels = {
      too_easy: "너무 쉬움",
      appropriate: "적정",
      challenging: "도전적",
      too_hard: "너무 어려움",
    };
    return labels[fit];
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 학생에게 맞춤형 콘텐츠 추천
 */
export async function findMatchingContent(
  tenantId: string,
  studentId: string,
  options?: MatchingOptions
): Promise<MatchingResult> {
  const service = new PersonalizedMatchingService(tenantId);
  return service.findMatchingContent(studentId, options);
}

/**
 * 특정 콘텐츠의 학생 적합도 분석
 */
export async function analyzeContentFit(
  tenantId: string,
  studentId: string,
  contentId: string,
  contentType: "book" | "lecture"
): Promise<MatchScore | null> {
  const service = new PersonalizedMatchingService(tenantId);
  return service.analyzeContentFit(studentId, contentId, contentType);
}

/**
 * 약점 과목 기반 콘텐츠 추천
 */
export async function findWeaknessFillers(
  tenantId: string,
  studentId: string,
  maxResults?: number
): Promise<MatchScore[]> {
  const service = new PersonalizedMatchingService(tenantId);
  return service.findWeaknessFillers(studentId, maxResults);
}

/**
 * 선수지식 갭 해소 콘텐츠 추천
 */
export async function findGapFillers(
  tenantId: string,
  studentId: string,
  targetContentId: string,
  maxResults?: number
): Promise<MatchScore[]> {
  const service = new PersonalizedMatchingService(tenantId);
  return service.findGapFillers(studentId, targetContentId, maxResults);
}

/**
 * 학생 프로필 조회
 */
export async function getStudentProfile(tenantId: string, studentId: string): Promise<StudentProfile> {
  const service = new PersonalizedMatchingService(tenantId);
  return service.buildStudentProfile(studentId);
}
