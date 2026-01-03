/**
 * Prerequisite Mapping Service
 * Phase 3.2: 선수지식 매핑 시스템
 *
 * 콘텐츠 간 선수-후속 관계 그래프 구축 및 학습 순서 최적화
 */

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================
// Types
// ============================================

export type StudentLevel = "beginner" | "intermediate" | "advanced";

export interface Concept {
  id: string;
  name: string;
  nameEn?: string;
  subjectId?: string;
  subjectCategory?: string;
  difficultyLevel: number; // 1-5
  prerequisites: string[]; // 선수 개념 ID 배열
  keywords: string[];
  description?: string;
  curriculumRevision?: string;
  gradeLevel?: number[];
}

export interface ConceptNode {
  concept: Concept;
  depth: number; // 그래프 깊이 (0 = 루트)
  children: ConceptNode[]; // 후속 개념
  parents: ConceptNode[]; // 선수 개념
}

export interface PrerequisiteGraph {
  nodes: Map<string, ConceptNode>;
  roots: string[]; // 선수지식 없는 최상위 개념
  leaves: string[]; // 후속 개념 없는 최하위 개념
  maxDepth: number;
}

export interface OrderedLearningPath {
  order: ConceptPathItem[];
  totalEstimatedHours: number;
  difficultyProgression: number[]; // 난이도 진행 곡선
  reasoning: string;
}

export interface ConceptPathItem {
  conceptId: string;
  conceptName: string;
  order: number;
  difficultyLevel: number;
  estimatedHours: number;
  isPrerequisite: boolean; // 선수지식인지 목표 개념인지
  relatedContentIds: string[];
}

export interface LearningGap {
  conceptId: string;
  conceptName: string;
  gapType: "missing" | "partial" | "weak";
  currentMastery: number; // 0-1 현재 숙달도
  requiredMastery: number; // 0-1 필요 숙달도
  priority: number; // 1-5 해결 우선순위
  affectedTargets: string[]; // 영향받는 목표 콘텐츠
}

export interface RecommendedContent {
  contentId: string;
  contentType: "book" | "lecture";
  title: string;
  conceptsCovered: string[];
  coverageScore: number; // 갭 해소 기여도 0-1
  difficultyFit: "too_easy" | "appropriate" | "challenging" | "too_hard";
  estimatedHours: number;
  priority: number;
  reasoning: string;
}

export interface ContentConceptMapping {
  id: string;
  contentType: "book" | "lecture";
  contentId: string;
  conceptId: string;
  coverageDepth: number; // 0-1
  pageRange?: [number, number];
  episodeRange?: [number, number];
}

export interface StudentConceptMastery {
  conceptId: string;
  masteryLevel: number; // 0-1
  lastAssessedAt: string;
  completedContentIds: string[];
}

// ============================================
// Database Row Types
// ============================================

interface ConceptDbRow {
  id: string;
  name: string;
  name_en: string | null;
  subject_id: string | null;
  subject_category: string | null;
  difficulty_level: number | null;
  prerequisites: string[] | null;
  keywords: string[] | null;
  description: string | null;
  curriculum_revision: string | null;
  grade_level: number[] | null;
}

interface MappingDbRow {
  id: string;
  content_type: string;
  content_id: string;
  concept_id: string;
  coverage_depth: number | null;
  page_range: string | null; // PostgreSQL range type as string
  episode_range: string | null;
}

// ============================================
// PrerequisiteService
// ============================================

export class PrerequisiteService {
  private tenantId: string;

  constructor(tenantId: string) {
    this.tenantId = tenantId;
  }

  // ----------------------------------------
  // Graph Building
  // ----------------------------------------

  /**
   * 특정 콘텐츠 목록에 대한 선수지식 그래프 구축
   */
  async buildPrerequisiteGraph(contentIds: string[]): Promise<PrerequisiteGraph> {
    // Handle empty input early
    if (contentIds.length === 0) {
      return this.createEmptyGraph();
    }

    const supabase = await createSupabaseServerClient();

    // 1. 콘텐츠와 연관된 개념 조회
    const { data: mappings, error: mappingError } = await supabase
      .from("content_concept_mappings")
      .select("concept_id")
      .in("content_id", contentIds);

    if (mappingError) {
      throw new Error(`Failed to fetch concept mappings: ${mappingError.message}`);
    }

    if (!mappings || mappings.length === 0) {
      return this.createEmptyGraph();
    }

    const conceptIds = [...new Set(mappings.map((m) => m.concept_id))];

    // 2. 개념 정보 조회 (선수지식 포함)
    const concepts = await this.fetchConceptsWithPrerequisites(conceptIds);

    // 3. 그래프 구축
    return this.buildGraphFromConcepts(concepts);
  }

  /**
   * 개념들의 선수지식을 재귀적으로 조회
   */
  private async fetchConceptsWithPrerequisites(initialConceptIds: string[]): Promise<Map<string, Concept>> {
    const supabase = await createSupabaseServerClient();
    const conceptMap = new Map<string, Concept>();
    const toFetch = new Set(initialConceptIds);
    const fetched = new Set<string>();

    while (toFetch.size > 0) {
      const currentBatch = [...toFetch];
      toFetch.clear();

      const { data: concepts, error } = await supabase
        .from("content_concepts")
        .select("*")
        .in("id", currentBatch);

      if (error) {
        throw new Error(`Failed to fetch concepts: ${error.message}`);
      }

      for (const row of (concepts as ConceptDbRow[]) || []) {
        const concept = this.mapDbRowToConcept(row);
        conceptMap.set(concept.id, concept);
        fetched.add(concept.id);

        // 선수지식 중 아직 조회하지 않은 것들 추가
        for (const prereqId of concept.prerequisites) {
          if (!fetched.has(prereqId) && !toFetch.has(prereqId)) {
            toFetch.add(prereqId);
          }
        }
      }
    }

    return conceptMap;
  }

  /**
   * 개념 맵에서 그래프 구조 생성
   */
  private buildGraphFromConcepts(concepts: Map<string, Concept>): PrerequisiteGraph {
    const nodes = new Map<string, ConceptNode>();
    const roots: string[] = [];
    const leaves: string[] = [];

    // 1. 노드 생성
    for (const [id, concept] of concepts) {
      nodes.set(id, {
        concept,
        depth: 0,
        children: [],
        parents: [],
      });
    }

    // 2. 관계 연결
    for (const [id, node] of nodes) {
      for (const prereqId of node.concept.prerequisites) {
        const parentNode = nodes.get(prereqId);
        if (parentNode) {
          node.parents.push(parentNode);
          parentNode.children.push(node);
        }
      }
    }

    // 3. 루트/리프 식별 및 깊이 계산
    let maxDepth = 0;
    for (const [id, node] of nodes) {
      if (node.parents.length === 0) {
        roots.push(id);
      }
      if (node.children.length === 0) {
        leaves.push(id);
      }

      // 깊이 계산 (BFS)
      node.depth = this.calculateNodeDepth(node, nodes);
      maxDepth = Math.max(maxDepth, node.depth);
    }

    return { nodes, roots, leaves, maxDepth };
  }

  private calculateNodeDepth(node: ConceptNode, allNodes: Map<string, ConceptNode>): number {
    if (node.parents.length === 0) return 0;

    let maxParentDepth = 0;
    for (const parent of node.parents) {
      const parentDepth = this.calculateNodeDepth(parent, allNodes);
      maxParentDepth = Math.max(maxParentDepth, parentDepth);
    }

    return maxParentDepth + 1;
  }

  private createEmptyGraph(): PrerequisiteGraph {
    return {
      nodes: new Map(),
      roots: [],
      leaves: [],
      maxDepth: 0,
    };
  }

  // ----------------------------------------
  // Learning Order
  // ----------------------------------------

  /**
   * 학생 수준 기반 학습 순서 제안
   */
  async suggestLearningOrder(
    contentIds: string[],
    studentLevel: StudentLevel
  ): Promise<OrderedLearningPath> {
    const graph = await this.buildPrerequisiteGraph(contentIds);

    if (graph.nodes.size === 0) {
      return this.createEmptyPath();
    }

    // 위상 정렬 (Topological Sort) - Kahn's Algorithm
    const sortedConcepts = this.topologicalSort(graph);

    // 학생 수준에 맞게 필터링 및 순서 조정
    const filteredConcepts = this.filterByStudentLevel(sortedConcepts, studentLevel, graph);

    // 콘텐츠 매핑 조회
    const contentMappings = await this.getContentMappingsForConcepts(
      filteredConcepts.map((c) => c.id)
    );

    // 경로 생성
    const order = filteredConcepts.map((concept, index) => ({
      conceptId: concept.id,
      conceptName: concept.name,
      order: index + 1,
      difficultyLevel: concept.difficultyLevel,
      estimatedHours: this.estimateConceptHours(concept, studentLevel),
      isPrerequisite: !contentIds.some((cid) =>
        contentMappings.some((m) => m.contentId === cid && m.conceptId === concept.id)
      ),
      relatedContentIds: contentMappings
        .filter((m) => m.conceptId === concept.id)
        .map((m) => m.contentId),
    }));

    const totalEstimatedHours = order.reduce((sum, item) => sum + item.estimatedHours, 0);
    const difficultyProgression = order.map((item) => item.difficultyLevel);

    return {
      order,
      totalEstimatedHours,
      difficultyProgression,
      reasoning: this.generateOrderReasoning(order, studentLevel),
    };
  }

  /**
   * 위상 정렬 수행
   */
  private topologicalSort(graph: PrerequisiteGraph): Concept[] {
    const result: Concept[] = [];
    const visited = new Set<string>();
    const inDegree = new Map<string, number>();

    // 진입 차수 초기화
    for (const [id, node] of graph.nodes) {
      inDegree.set(id, node.parents.length);
    }

    // 진입 차수가 0인 노드부터 시작
    const queue = graph.roots.slice();

    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;

      visited.add(id);
      const node = graph.nodes.get(id);
      if (node) {
        result.push(node.concept);

        // 자식 노드의 진입 차수 감소
        for (const child of node.children) {
          const childId = child.concept.id;
          const newDegree = (inDegree.get(childId) || 0) - 1;
          inDegree.set(childId, newDegree);

          if (newDegree === 0 && !visited.has(childId)) {
            queue.push(childId);
          }
        }
      }
    }

    return result;
  }

  /**
   * 학생 수준에 따라 개념 필터링
   */
  private filterByStudentLevel(
    concepts: Concept[],
    level: StudentLevel,
    _graph: PrerequisiteGraph
  ): Concept[] {
    const levelThresholds = {
      beginner: { min: 1, max: 3 },
      intermediate: { min: 2, max: 4 },
      advanced: { min: 3, max: 5 },
    };

    const threshold = levelThresholds[level];

    // 난이도가 너무 쉬운 것은 제외 (선수지식으로 필요한 경우 제외)
    return concepts.filter((concept) => {
      // 고급 학생에게 너무 쉬운 개념은 제외
      if (level === "advanced" && concept.difficultyLevel < threshold.min) {
        return false;
      }
      return true;
    });
  }

  private estimateConceptHours(concept: Concept, level: StudentLevel): number {
    const baseHours = concept.difficultyLevel * 0.5; // 기본: 난이도 * 0.5시간

    const levelMultiplier = {
      beginner: 1.5,
      intermediate: 1.0,
      advanced: 0.7,
    };

    return Math.round(baseHours * levelMultiplier[level] * 10) / 10;
  }

  private generateOrderReasoning(order: ConceptPathItem[], level: StudentLevel): string {
    const prereqCount = order.filter((item) => item.isPrerequisite).length;
    const targetCount = order.length - prereqCount;

    if (prereqCount === 0) {
      return `${level === "advanced" ? "고급" : level === "intermediate" ? "중급" : "초급"} 학습자를 위한 ${targetCount}개 개념 학습 순서입니다.`;
    }

    return `${level === "advanced" ? "고급" : level === "intermediate" ? "중급" : "초급"} 학습자를 위해 ${prereqCount}개의 선수 개념을 먼저 학습한 후, ${targetCount}개의 목표 개념을 학습하는 순서입니다.`;
  }

  private createEmptyPath(): OrderedLearningPath {
    return {
      order: [],
      totalEstimatedHours: 0,
      difficultyProgression: [],
      reasoning: "분석할 콘텐츠가 없습니다.",
    };
  }

  // ----------------------------------------
  // Gap Analysis
  // ----------------------------------------

  /**
   * 학생의 미충족 선수지식 식별
   */
  async identifyGaps(studentId: string, targetContentId: string): Promise<LearningGap[]> {
    // 1. 목표 콘텐츠의 필요 개념 조회
    const requiredConcepts = await this.getRequiredConcepts(targetContentId);

    if (requiredConcepts.length === 0) {
      return [];
    }

    // 2. 학생의 개념 숙달도 조회
    const studentMastery = await this.getStudentMastery(studentId, requiredConcepts.map((c) => c.id));

    // 3. 갭 분석
    const gaps: LearningGap[] = [];

    for (const concept of requiredConcepts) {
      const mastery = studentMastery.get(concept.id);
      const currentMastery = mastery?.masteryLevel ?? 0;
      const requiredMastery = this.calculateRequiredMastery(concept.difficultyLevel);

      if (currentMastery < requiredMastery) {
        gaps.push({
          conceptId: concept.id,
          conceptName: concept.name,
          gapType: this.determineGapType(currentMastery, requiredMastery),
          currentMastery,
          requiredMastery,
          priority: this.calculateGapPriority(concept, currentMastery, requiredMastery),
          affectedTargets: [targetContentId],
        });
      }
    }

    // 우선순위로 정렬
    return gaps.sort((a, b) => b.priority - a.priority);
  }

  private async getRequiredConcepts(contentId: string): Promise<Concept[]> {
    const supabase = await createSupabaseServerClient();

    // 콘텐츠의 개념 매핑 조회
    const { data: mappings, error: mappingError } = await supabase
      .from("content_concept_mappings")
      .select("concept_id")
      .eq("content_id", contentId);

    if (mappingError || !mappings || mappings.length === 0) {
      return [];
    }

    const conceptIds = mappings.map((m) => m.concept_id);

    // 개념 및 선수지식 조회
    const concepts = await this.fetchConceptsWithPrerequisites(conceptIds);

    return [...concepts.values()];
  }

  private async getStudentMastery(
    studentId: string,
    conceptIds: string[]
  ): Promise<Map<string, StudentConceptMastery>> {
    const supabase = await createSupabaseServerClient();

    // 학생이 완료한 콘텐츠 조회
    const { data: completedPlans } = await supabase
      .from("student_plans")
      .select("content_id, completed_at")
      .eq("student_id", studentId)
      .eq("is_completed", true)
      .not("content_id", "is", null);

    if (!completedPlans || completedPlans.length === 0) {
      return new Map();
    }

    const completedContentIds = completedPlans.map((p) => p.content_id);

    // 완료한 콘텐츠의 개념 매핑 조회
    const { data: mappings } = await supabase
      .from("content_concept_mappings")
      .select("concept_id, content_id, coverage_depth")
      .in("content_id", completedContentIds)
      .in("concept_id", conceptIds);

    // 숙달도 계산
    const masteryMap = new Map<string, StudentConceptMastery>();

    for (const conceptId of conceptIds) {
      const conceptMappings = (mappings || []).filter((m) => m.concept_id === conceptId);

      if (conceptMappings.length === 0) {
        continue;
      }

      // 가장 높은 커버리지를 숙달도로 사용
      const maxCoverage = Math.max(...conceptMappings.map((m) => m.coverage_depth || 0));

      masteryMap.set(conceptId, {
        conceptId,
        masteryLevel: maxCoverage,
        lastAssessedAt: new Date().toISOString(),
        completedContentIds: conceptMappings.map((m) => m.content_id),
      });
    }

    return masteryMap;
  }

  private calculateRequiredMastery(difficultyLevel: number): number {
    // 난이도가 높을수록 더 높은 선수지식 숙달 필요
    const baseRequired = 0.5;
    const difficultyBonus = (difficultyLevel - 1) * 0.1; // 1-5 → 0-0.4
    return Math.min(0.9, baseRequired + difficultyBonus);
  }

  private determineGapType(current: number, required: number): "missing" | "partial" | "weak" {
    if (current === 0) return "missing";
    if (current < required * 0.5) return "partial";
    return "weak";
  }

  private calculateGapPriority(concept: Concept, current: number, required: number): number {
    // 기본 우선순위: 숙달도 격차 기반
    const gap = required - current;
    let priority = Math.ceil(gap * 5);

    // 선수지식이 많은 개념은 먼저 해결해야 함
    if (concept.prerequisites.length > 2) {
      priority = Math.min(5, priority + 1);
    }

    return Math.max(1, Math.min(5, priority));
  }

  // ----------------------------------------
  // Content Recommendations
  // ----------------------------------------

  /**
   * 갭 해소를 위한 콘텐츠 추천
   */
  async recommendGapFillers(gaps: LearningGap[]): Promise<RecommendedContent[]> {
    if (gaps.length === 0) {
      return [];
    }

    const conceptIds = gaps.map((g) => g.conceptId);

    // 개념을 다루는 콘텐츠 조회
    const contentMappings = await this.getContentMappingsForConcepts(conceptIds);

    if (contentMappings.length === 0) {
      return [];
    }

    // 콘텐츠별 점수 계산
    const contentScores = new Map<string, { mapping: ContentConceptMapping; score: number; concepts: string[] }>();

    for (const mapping of contentMappings) {
      const gap = gaps.find((g) => g.conceptId === mapping.conceptId);
      if (!gap) continue;

      const existing = contentScores.get(mapping.contentId);
      const conceptContribution = mapping.coverageDepth * gap.priority;

      if (existing) {
        existing.score += conceptContribution;
        existing.concepts.push(mapping.conceptId);
      } else {
        contentScores.set(mapping.contentId, {
          mapping,
          score: conceptContribution,
          concepts: [mapping.conceptId],
        });
      }
    }

    // 콘텐츠 상세 정보 조회
    const contentIds = [...contentScores.keys()];
    const contentDetails = await this.getContentDetails(contentIds);

    // 추천 목록 생성
    const recommendations: RecommendedContent[] = [];

    for (const [contentId, scoreData] of contentScores) {
      const details = contentDetails.get(contentId);
      if (!details) continue;

      const avgGapDifficulty =
        gaps.reduce((sum, g) => sum + (scoreData.concepts.includes(g.conceptId) ? 1 : 0), 0) /
        scoreData.concepts.length;

      recommendations.push({
        contentId,
        contentType: scoreData.mapping.contentType,
        title: details.title,
        conceptsCovered: scoreData.concepts,
        coverageScore: Math.min(1, scoreData.score / 5),
        difficultyFit: this.assessDifficultyFit(details.difficultyLevel, avgGapDifficulty),
        estimatedHours: details.estimatedHours || 10,
        priority: Math.ceil(scoreData.score),
        reasoning: this.generateRecommendationReasoning(scoreData.concepts, gaps),
      });
    }

    // 점수로 정렬
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  private async getContentMappingsForConcepts(conceptIds: string[]): Promise<ContentConceptMapping[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_concept_mappings")
      .select("*")
      .in("concept_id", conceptIds);

    if (error || !data) {
      return [];
    }

    return (data as MappingDbRow[]).map((row) => this.mapDbRowToMapping(row));
  }

  private async getContentDetails(
    contentIds: string[]
  ): Promise<Map<string, { title: string; difficultyLevel: number; estimatedHours: number }>> {
    const supabase = await createSupabaseServerClient();
    const details = new Map<string, { title: string; difficultyLevel: number; estimatedHours: number }>();

    // 도서 조회
    const { data: books } = await supabase
      .from("master_books")
      .select("id, title, difficulty_level, total_pages")
      .in("id", contentIds);

    for (const book of books || []) {
      details.set(book.id, {
        title: book.title,
        difficultyLevel: book.difficulty_level || 3,
        estimatedHours: (book.total_pages || 100) / 10,
      });
    }

    // 강의 조회
    const { data: lectures } = await supabase
      .from("master_lectures")
      .select("id, title, difficulty_level, total_duration")
      .in("id", contentIds);

    for (const lecture of lectures || []) {
      details.set(lecture.id, {
        title: lecture.title,
        difficultyLevel: lecture.difficulty_level || 3,
        estimatedHours: (lecture.total_duration || 600) / 60,
      });
    }

    return details;
  }

  private assessDifficultyFit(
    contentDifficulty: number,
    targetDifficulty: number
  ): "too_easy" | "appropriate" | "challenging" | "too_hard" {
    const diff = contentDifficulty - targetDifficulty;

    if (diff < -1) return "too_easy";
    if (diff <= 0.5) return "appropriate";
    if (diff <= 1.5) return "challenging";
    return "too_hard";
  }

  private generateRecommendationReasoning(conceptIds: string[], gaps: LearningGap[]): string {
    const gapNames = gaps
      .filter((g) => conceptIds.includes(g.conceptId))
      .map((g) => g.conceptName)
      .slice(0, 3);

    if (gapNames.length === 0) {
      return "관련 개념 학습에 도움이 됩니다.";
    }

    return `${gapNames.join(", ")} 개념 학습에 효과적입니다.`;
  }

  // ----------------------------------------
  // Concept Management
  // ----------------------------------------

  /**
   * 개념 조회
   */
  async getConcept(conceptId: string): Promise<Concept | null> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_concepts")
      .select("*")
      .eq("id", conceptId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapDbRowToConcept(data as ConceptDbRow);
  }

  /**
   * 과목별 개념 목록 조회
   */
  async getConceptsBySubject(subjectCategory: string): Promise<Concept[]> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_concepts")
      .select("*")
      .eq("subject_category", subjectCategory)
      .order("difficulty_level", { ascending: true });

    if (error || !data) {
      return [];
    }

    return (data as ConceptDbRow[]).map((row) => this.mapDbRowToConcept(row));
  }

  /**
   * 개념 생성
   */
  async createConcept(concept: Omit<Concept, "id">): Promise<string> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_concepts")
      .insert({
        name: concept.name,
        name_en: concept.nameEn,
        subject_id: concept.subjectId,
        subject_category: concept.subjectCategory,
        difficulty_level: concept.difficultyLevel,
        prerequisites: concept.prerequisites,
        keywords: concept.keywords,
        description: concept.description,
        curriculum_revision: concept.curriculumRevision,
        grade_level: concept.gradeLevel,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create concept: ${error.message}`);
    }

    return data.id;
  }

  /**
   * 콘텐츠-개념 매핑 생성
   */
  async createContentMapping(mapping: Omit<ContentConceptMapping, "id">): Promise<string> {
    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from("content_concept_mappings")
      .insert({
        content_type: mapping.contentType,
        content_id: mapping.contentId,
        concept_id: mapping.conceptId,
        coverage_depth: mapping.coverageDepth,
        page_range: mapping.pageRange ? `[${mapping.pageRange[0]},${mapping.pageRange[1]})` : null,
        episode_range: mapping.episodeRange
          ? `[${mapping.episodeRange[0]},${mapping.episodeRange[1]})`
          : null,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Failed to create mapping: ${error.message}`);
    }

    return data.id;
  }

  // ----------------------------------------
  // Helpers
  // ----------------------------------------

  private mapDbRowToConcept(row: ConceptDbRow): Concept {
    return {
      id: row.id,
      name: row.name,
      nameEn: row.name_en ?? undefined,
      subjectId: row.subject_id ?? undefined,
      subjectCategory: row.subject_category ?? undefined,
      difficultyLevel: row.difficulty_level ?? 3,
      prerequisites: row.prerequisites ?? [],
      keywords: row.keywords ?? [],
      description: row.description ?? undefined,
      curriculumRevision: row.curriculum_revision ?? undefined,
      gradeLevel: row.grade_level ?? undefined,
    };
  }

  private mapDbRowToMapping(row: MappingDbRow): ContentConceptMapping {
    return {
      id: row.id,
      contentType: row.content_type as "book" | "lecture",
      contentId: row.content_id,
      conceptId: row.concept_id,
      coverageDepth: row.coverage_depth ?? 0,
      pageRange: row.page_range ? this.parseRange(row.page_range) : undefined,
      episodeRange: row.episode_range ? this.parseRange(row.episode_range) : undefined,
    };
  }

  private parseRange(rangeStr: string): [number, number] | undefined {
    // PostgreSQL range format: [1,10) or (1,10]
    const match = rangeStr.match(/[\[(](\d+),(\d+)[\])]/);
    if (match) {
      return [parseInt(match[1], 10), parseInt(match[2], 10)];
    }
    return undefined;
  }

  // ----------------------------------------
  // Static Utilities
  // ----------------------------------------

  /**
   * 그래프를 시각화용 데이터로 변환
   */
  static graphToVisualizationData(graph: PrerequisiteGraph): {
    nodes: Array<{ id: string; label: string; depth: number; difficulty: number }>;
    edges: Array<{ from: string; to: string }>;
  } {
    const nodes: Array<{ id: string; label: string; depth: number; difficulty: number }> = [];
    const edges: Array<{ from: string; to: string }> = [];

    for (const [id, node] of graph.nodes) {
      nodes.push({
        id,
        label: node.concept.name,
        depth: node.depth,
        difficulty: node.concept.difficultyLevel,
      });

      for (const child of node.children) {
        edges.push({ from: id, to: child.concept.id });
      }
    }

    return { nodes, edges };
  }

  /**
   * 학습 경로의 난이도 곡선 분석
   */
  static analyzeDifficultyProgression(path: OrderedLearningPath): {
    isSmooth: boolean;
    maxJump: number;
    recommendations: string[];
  } {
    if (path.difficultyProgression.length < 2) {
      return { isSmooth: true, maxJump: 0, recommendations: [] };
    }

    let maxJump = 0;
    const recommendations: string[] = [];

    for (let i = 1; i < path.difficultyProgression.length; i++) {
      const jump = path.difficultyProgression[i] - path.difficultyProgression[i - 1];

      if (jump > maxJump) {
        maxJump = jump;
      }

      if (jump > 1.5) {
        recommendations.push(
          `${path.order[i - 1].conceptName}와 ${path.order[i].conceptName} 사이에 중간 단계 학습을 추가하세요.`
        );
      }
    }

    return {
      isSmooth: maxJump <= 1.5,
      maxJump,
      recommendations,
    };
  }
}

// ============================================
// Convenience Functions
// ============================================

/**
 * 콘텐츠의 선수지식 그래프 조회
 */
export async function getPrerequisiteGraph(
  tenantId: string,
  contentIds: string[]
): Promise<PrerequisiteGraph> {
  const service = new PrerequisiteService(tenantId);
  return service.buildPrerequisiteGraph(contentIds);
}

/**
 * 학습 순서 제안
 */
export async function suggestLearningOrder(
  tenantId: string,
  contentIds: string[],
  studentLevel: StudentLevel
): Promise<OrderedLearningPath> {
  const service = new PrerequisiteService(tenantId);
  return service.suggestLearningOrder(contentIds, studentLevel);
}

/**
 * 학습 갭 식별
 */
export async function identifyLearningGaps(
  tenantId: string,
  studentId: string,
  targetContentId: string
): Promise<LearningGap[]> {
  const service = new PrerequisiteService(tenantId);
  return service.identifyGaps(studentId, targetContentId);
}

/**
 * 갭 해소 콘텐츠 추천
 */
export async function recommendGapFillers(
  tenantId: string,
  gaps: LearningGap[]
): Promise<RecommendedContent[]> {
  const service = new PrerequisiteService(tenantId);
  return service.recommendGapFillers(gaps);
}
