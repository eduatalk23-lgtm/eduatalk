# `/plan` 경로 리팩토링 및 최적화 제안서

## 📋 개요

`/plan`부터 하위 항목 전체에 대한 최적화 및 리팩토링 제안입니다. 코드 중복 제거, 성능 최적화, 가이드라인 준수를 목표로 합니다.

---

## 🔍 현재 문제점 분석

### 1. 코드 중복 (High Priority)

#### 1.1 콘텐츠 페칭 함수 중복
**위치**: `plan/new-group/page.tsx`, `plan/group/[id]/edit/page.tsx`

**문제**:
- `fetchBooks()`, `fetchLectures()`, `fetchCustomContents()` 함수가 동일하게 중복됨
- 각각 50줄 이상의 유사한 코드

**영향도**: 🔴 High

#### 1.2 콘텐츠 분류 로직 중복
**위치**: 
- `plan/new-group/page.tsx` (48-196줄)
- `plan/group/[id]/page.tsx` (73-200줄)  
- `plan/group/[id]/edit/page.tsx` (82-233줄)

**문제**:
- 마스터 콘텐츠 vs 학생 콘텐츠 구분 로직이 3곳에 거의 동일하게 중복
- 각각 120-150줄의 복잡한 조건 분기

**영향도**: 🔴 High

**중복 코드 예시**:
```typescript
// 3곳 모두에서 반복되는 패턴
if (content.content_type === "book") {
  const { data: masterBook } = await supabase
    .from("master_books")
    .select("id, title, subject_category")
    .eq("id", content.content_id)
    .maybeSingle();
  // ... 동일한 로직 반복
}
```

### 2. 페이지 구조 문제

#### 2.1 `plan/page.tsx` - 과도한 인라인 로직
**문제**:
- 페이지 컴포넌트에 데이터 조회, 집계, 변환 로직이 모두 포함 (114줄)
- 플랜 완료 상태 계산 로직이 인라인으로 존재 (64-113줄)

**영향도**: 🟡 Medium

#### 2.2 `plan/new-group/page.tsx` - 과도하게 긴 파일
**문제**:
- 377줄의 거대한 파일
- 데이터 페칭, 변환, 분류 로직이 모두 페이지 컴포넌트에 포함

**영향도**: 🟡 Medium

### 3. 가이드라인 위반

#### 3.1 Spacing-First 정책 미준수
**위치**: 여러 컴포넌트
- `plan/page.tsx` 158-159줄: `px-4 py-10` (외곽 padding) ✅ 올바름
- 하지만 일부 컴포넌트에서 `space-y-4` 사용은 올바름
- 문제: 일부 margin 사용 발견

**영향도**: 🟢 Low

#### 3.2 불필요한 추상화 가능성
**위치**: `_components` 디렉토리
- 확인 필요: 각 컴포넌트가 실제 로직을 포함하는지 검토 필요

**영향도**: 🟡 Medium

### 4. 성능 문제

#### 4.1 N+1 쿼리 문제
**위치**: `plan/group/[id]/page.tsx` (73-200줄)

**문제**:
- 각 콘텐츠마다 개별 쿼리 실행 (`Promise.all` 내부의 `map`에서)
- 콘텐츠가 많을수록 쿼리 수가 선형 증가

**개선 방안**:
```typescript
// 현재: O(n) 쿼리
contents.map(async (content) => {
  const { data: masterBook } = await supabase
    .from("master_books")
    .select(...)
    .eq("id", content.content_id)
    .maybeSingle();
  // ...
})

// 개선: O(1) 쿼리
const contentIds = contents.map(c => c.content_id);
const { data: masterBooks } = await supabase
  .from("master_books")
  .select(...)
  .in("id", contentIds);
```

**영향도**: 🟡 Medium

#### 4.2 불필요한 데이터 조회
**위치**: `plan/page.tsx`

**문제**:
- 플랜 완료 상태 조회를 위해 모든 플랜 데이터를 가져옴 (65-113줄)
- 필요한 집계 정보만 가져오는 것이 효율적

**영향도**: 🟢 Low

---

## 🎯 리팩토링 제안

### Phase 1: 유틸리티 함수 분리 (High Priority)

#### 1.1 콘텐츠 페칭 함수 통합

**파일**: `lib/data/planContents.ts` (신규 생성)

```typescript
// lib/data/planContents.ts
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ContentItem = {
  id: string;
  title: string;
  subtitle?: string | null;
};

/**
 * 학생의 책 목록 조회
 */
export async function fetchStudentBooks(
  studentId: string
): Promise<ContentItem[]> {
  const supabase = await createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from("books")
      .select("id, title, subject")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (
      data?.map((book) => ({
        id: book.id,
        title: book.title || "제목 없음",
        subtitle: book.subject || null,
      })) || []
    );
  } catch (err) {
    console.error("[data/planContents] 책 목록 조회 실패", err);
    return [];
  }
}

/**
 * 학생의 강의 목록 조회
 */
export async function fetchStudentLectures(
  studentId: string
): Promise<ContentItem[]> {
  // 동일한 패턴으로 구현
}

/**
 * 학생의 커스텀 콘텐츠 목록 조회
 */
export async function fetchStudentCustomContents(
  studentId: string
): Promise<ContentItem[]> {
  // 동일한 패턴으로 구현
}

/**
 * 학생의 모든 콘텐츠 목록 조회 (통합)
 */
export async function fetchAllStudentContents(studentId: string): Promise<{
  books: ContentItem[];
  lectures: ContentItem[];
  custom: ContentItem[];
}> {
  const [books, lectures, custom] = await Promise.all([
    fetchStudentBooks(studentId),
    fetchStudentLectures(studentId),
    fetchStudentCustomContents(studentId),
  ]);

  return { books, lectures, custom };
}
```

**적용 위치**:
- `plan/new-group/page.tsx` (299-375줄 제거)
- `plan/group/[id]/edit/page.tsx` (289-365줄 제거)

**예상 효과**:
- 코드 라인 수: -150줄
- 유지보수성: 향상
- 재사용성: 향상

#### 1.2 콘텐츠 분류 로직 통합

**파일**: `lib/data/planContents.ts` (추가)

```typescript
// lib/data/planContents.ts

export type ContentDetail = {
  content_type: "book" | "lecture" | "custom";
  content_id: string;
  start_range: number;
  end_range: number;
  title: string;
  subject_category?: string | null;
  isRecommended: boolean; // 추천 콘텐츠 여부
  masterContentId?: string; // 원본 마스터 콘텐츠 ID
};

/**
 * 플랜 콘텐츠를 학생/추천으로 분류하고 상세 정보 조회
 * 
 * @param contents 플랜 콘텐츠 목록
 * @param studentId 학생 ID
 * @returns 분류된 콘텐츠 목록
 */
export async function classifyPlanContents(
  contents: Array<{
    content_type: "book" | "lecture" | "custom";
    content_id: string;
    start_range: number;
    end_range: number;
  }>,
  studentId: string
): Promise<{
  studentContents: Array<ContentDetail>;
  recommendedContents: Array<ContentDetail>;
}> {
  const supabase = await createSupabaseServerClient();
  
  // 1. 모든 콘텐츠 ID 수집 (배치 조회를 위해)
  const bookContentIds: string[] = [];
  const lectureContentIds: string[] = [];
  
  contents.forEach((content) => {
    if (content.content_type === "book") {
      bookContentIds.push(content.content_id);
    } else if (content.content_type === "lecture") {
      lectureContentIds.push(content.content_id);
    }
  });

  // 2. 배치 조회 (N+1 문제 해결)
  const [masterBooksResult, masterLecturesResult, studentBooksResult, studentLecturesResult] = await Promise.all([
    // 마스터 콘텐츠 조회
    bookContentIds.length > 0
      ? supabase
          .from("master_books")
          .select("id, title, subject_category")
          .in("id", bookContentIds)
      : Promise.resolve({ data: [], error: null }),
    lectureContentIds.length > 0
      ? supabase
          .from("master_lectures")
          .select("id, title, subject_category")
          .in("id", lectureContentIds)
      : Promise.resolve({ data: [], error: null }),
    // 학생 콘텐츠 조회
    bookContentIds.length > 0
      ? supabase
          .from("books")
          .select("id, title, subject, master_content_id")
          .in("id", bookContentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
    lectureContentIds.length > 0
      ? supabase
          .from("lectures")
          .select("id, title, subject, master_content_id")
          .in("id", lectureContentIds)
          .eq("student_id", studentId)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // 3. Map으로 변환 (빠른 조회)
  const masterBooksMap = new Map(
    (masterBooksResult.data || []).map((book) => [book.id, book])
  );
  const masterLecturesMap = new Map(
    (masterLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );
  const studentBooksMap = new Map(
    (studentBooksResult.data || []).map((book) => [book.id, book])
  );
  const studentLecturesMap = new Map(
    (studentLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );

  // 4. 마스터 콘텐츠 ID 추출 (학생 콘텐츠의 master_content_id)
  const masterContentIdsForLookup = new Set<string>();
  [...studentBooksMap.values(), ...studentLecturesMap.values()].forEach(
    (item) => {
      if (item.master_content_id) {
        masterContentIdsForLookup.add(item.master_content_id);
      }
    }
  );

  // 5. 원본 마스터 콘텐츠 조회 (학생 콘텐츠의 원본 참조용)
  const originalMasterBooksResult =
    masterContentIdsForLookup.size > 0
      ? await supabase
          .from("master_books")
          .select("id, title, subject_category, subject")
          .in("id", Array.from(masterContentIdsForLookup))
      : { data: [], error: null };
  const originalMasterLecturesResult =
    masterContentIdsForLookup.size > 0
      ? await supabase
          .from("master_lectures")
          .select("id, title, subject_category, subject")
          .in("id", Array.from(masterContentIdsForLookup))
      : { data: [], error: null };

  const originalMasterBooksMap = new Map(
    (originalMasterBooksResult.data || []).map((book) => [book.id, book])
  );
  const originalMasterLecturesMap = new Map(
    (originalMasterLecturesResult.data || []).map((lecture) => [lecture.id, lecture])
  );

  // 6. 콘텐츠 분류 및 상세 정보 생성
  const studentContents: Array<ContentDetail> = [];
  const recommendedContents: Array<ContentDetail> = [];

  for (const content of contents) {
    let contentDetail: ContentDetail | null = null;
    let isRecommended = false;
    let masterContentId: string | undefined = undefined;

    if (content.content_type === "book") {
      // 마스터 콘텐츠인지 확인
      const masterBook = masterBooksMap.get(content.content_id);
      if (masterBook) {
        // 추천 콘텐츠
        isRecommended = true;
        masterContentId = content.content_id;
        contentDetail = {
          content_type: "book",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: masterBook.title || "제목 없음",
          subject_category: masterBook.subject_category || null,
          isRecommended: true,
          masterContentId: content.content_id,
        };
      } else {
        // 학생 콘텐츠
        const studentBook = studentBooksMap.get(content.content_id);
        if (studentBook) {
          let title = studentBook.title || "제목 없음";
          let subjectCategory = studentBook.subject || null;

          // 원본 마스터 콘텐츠 정보 조회 (표시용)
          if (studentBook.master_content_id) {
            masterContentId = studentBook.master_content_id;
            const originalMasterBook = originalMasterBooksMap.get(
              studentBook.master_content_id
            );
            if (originalMasterBook) {
              title =
                originalMasterBook.title || studentBook.title || "제목 없음";
              subjectCategory =
                originalMasterBook.subject ||
                originalMasterBook.subject_category ||
                studentBook.subject ||
                null;
            }
          }

          contentDetail = {
            content_type: "book",
            content_id: content.content_id,
            start_range: content.start_range,
            end_range: content.end_range,
            title,
            subject_category: subjectCategory,
            isRecommended: false,
            masterContentId,
          };
        }
      }
    } else if (content.content_type === "lecture") {
      // 강의도 동일한 패턴으로 처리
      // (코드 생략 - 위와 동일한 로직)
    } else if (content.content_type === "custom") {
      // 커스텀 콘텐츠는 항상 학생 콘텐츠
      const { data: customContent } = await supabase
        .from("student_custom_contents")
        .select("title, content_type")
        .eq("id", content.content_id)
        .maybeSingle();

      if (customContent) {
        contentDetail = {
          content_type: "custom",
          content_id: content.content_id,
          start_range: content.start_range,
          end_range: content.end_range,
          title: customContent.title || "커스텀 콘텐츠",
          subject_category: customContent.content_type || null,
          isRecommended: false,
        };
      }
    }

    if (contentDetail) {
      if (isRecommended) {
        recommendedContents.push(contentDetail);
      } else {
        studentContents.push(contentDetail);
      }
    }
  }

  return { studentContents, recommendedContents };
}
```

**적용 위치**:
- `plan/new-group/page.tsx` (48-228줄 → 함수 호출로 대체)
- `plan/group/[id]/page.tsx` (73-200줄 → 함수 호출로 대체)
- `plan/group/[id]/edit/page.tsx` (82-233줄 → 함수 호출로 대체)

**예상 효과**:
- 코드 라인 수: -350줄 (중복 제거)
- 쿼리 수: O(n) → O(1) (N+1 문제 해결)
- 유지보수성: 크게 향상

### Phase 2: 페이지 컴포넌트 리팩토링 (Medium Priority)

#### 2.1 `plan/page.tsx` 리팩토링

**변경사항**:
1. 플랜 완료 상태 계산 로직을 별도 함수로 분리
2. 플랜 개수 조회를 통합 데이터 페칭 함수로 이동

**파일**: `lib/data/planGroups.ts` (확장)

```typescript
// lib/data/planGroups.ts

export type PlanGroupWithStats = PlanGroup & {
  planCount: number;
  completedCount: number;
  totalCount: number;
  isCompleted: boolean; // 실제 완료 상태
};

/**
 * 플랜 그룹 목록과 통계 정보를 함께 조회
 */
export async function getPlanGroupsWithStats(
  filters: PlanGroupFilters
): Promise<PlanGroupWithStats[]> {
  const supabase = await createSupabaseServerClient();
  
  // 1. 플랜 그룹 조회
  const groups = await getPlanGroupsForStudent(filters);
  
  if (groups.length === 0) {
    return [];
  }

  const groupIds = groups.map((g) => g.id);
  const studentId = filters.studentId;

  // 2. 플랜 개수 및 완료 상태 조회 (배치)
  const [planCountsResult, planCompletionResult] = await Promise.all([
    // 플랜 개수 조회
    supabase
      .from("student_plan")
      .select("plan_group_id")
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds),
    // 플랜 완료 상태 조회
    supabase
      .from("student_plan")
      .select(
        "plan_group_id, planned_end_page_or_time, completed_amount"
      )
      .eq("student_id", studentId)
      .in("plan_group_id", groupIds)
      .not("plan_group_id", "is", null),
  ]);

  // 3. 통계 계산
  const planCountsMap = new Map<string, number>();
  (planCountsResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      planCountsMap.set(
        plan.plan_group_id,
        (planCountsMap.get(plan.plan_group_id) || 0) + 1
      );
    }
  });

  const completionMap = new Map<
    string,
    { completedCount: number; totalCount: number; isCompleted: boolean }
  >();

  // plan_group_id별로 그룹화
  const plansByGroup = new Map<
    string,
    Array<{ planned_end: number | null; completed: number | null }>
  >();

  (planCompletionResult.data || []).forEach((plan) => {
    if (plan.plan_group_id) {
      const groupPlans = plansByGroup.get(plan.plan_group_id) || [];
      groupPlans.push({
        planned_end: plan.planned_end_page_or_time ?? null,
        completed: plan.completed_amount ?? null,
      });
      plansByGroup.set(plan.plan_group_id, groupPlans);
    }
  });

  // 완료 상태 계산
  plansByGroup.forEach((groupPlans, groupId) => {
    const totalCount = groupPlans.length;
    let completedCount = 0;

    groupPlans.forEach((plan) => {
      if (
        plan.planned_end !== null &&
        plan.completed !== null &&
        plan.completed >= plan.planned_end
      ) {
        completedCount++;
      }
    });

    const isCompleted =
      totalCount > 0 &&
      completedCount === totalCount &&
      groupPlans.every((plan) => {
        if (plan.planned_end === null) return false;
        return plan.completed !== null && plan.completed >= plan.planned_end;
      });

    completionMap.set(groupId, {
      completedCount,
      totalCount,
      isCompleted,
    });
  });

  // 4. 결과 병합
  return groups.map((group) => {
    const planCount = planCountsMap.get(group.id) || 0;
    const completion = completionMap.get(group.id) || {
      completedCount: 0,
      totalCount: planCount,
      isCompleted: false,
    };

    // 완료 상태 표시 (실제 완료되었고 현재 상태가 completed가 아니면 표시용으로 completed)
    let displayStatus = group.status;
    if (
      completion.isCompleted &&
      group.status !== "completed" &&
      group.status !== "cancelled"
    ) {
      displayStatus = "completed";
    }

    return {
      ...group,
      status: displayStatus as typeof group.status,
      planCount,
      completedCount: completion.completedCount,
      totalCount: completion.totalCount,
      isCompleted: completion.isCompleted,
    };
  });
}
```

**적용 위치**: `plan/page.tsx`

**예상 효과**:
- 페이지 컴포넌트 라인 수: -80줄
- 로직 재사용성: 향상
- 테스트 가능성: 향상

#### 2.2 `plan/new-group/page.tsx` 리팩토링

**변경사항**:
- Draft 불러오기 로직을 별도 함수로 분리
- 콘텐츠 페칭 및 분류를 통합 함수로 교체

**파일**: `lib/data/planGroups.ts` (확장)

```typescript
// lib/data/planGroups.ts

/**
 * Draft 플랜 그룹 데이터를 Wizard 형식으로 변환
 */
export async function getDraftPlanGroupForWizard(
  draftId: string,
  studentId: string,
  tenantId?: string | null
): Promise<WizardData | null> {
  const { group, contents, exclusions, academySchedules } =
    await getPlanGroupWithDetails(draftId, studentId, tenantId);

  if (!group || group.status !== "draft") {
    return null;
  }

  // 콘텐츠 분류 (통합 함수 사용)
  const { studentContents, recommendedContents } =
    await classifyPlanContents(contents, studentId);

  return {
    groupId: group.id,
    name: group.name || "",
    plan_purpose: group.plan_purpose || "",
    scheduler_type: group.scheduler_type || "",
    period_start: group.period_start,
    period_end: group.period_end,
    target_date: group.target_date,
    block_set_id: group.block_set_id || "",
    exclusions: exclusions.map((e) => ({
      exclusion_date: e.exclusion_date,
      exclusion_type: e.exclusion_type,
      reason: e.reason || undefined,
    })),
    academy_schedules: academySchedules.map((s) => ({
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      academy_name: s.academy_name || undefined,
      subject: s.subject || undefined,
      travel_time: undefined, // TODO: travel_time 저장/로드 추가 필요
    })),
    student_contents: studentContents.map((c) => ({
      content_type: c.content_type,
      content_id: c.masterContentId || c.content_id,
      start_range: c.start_range,
      end_range: c.end_range,
      title: c.title,
      subject_category: c.subject_category,
    })),
    recommended_contents: recommendedContents.map((c) => ({
      content_type: c.content_type,
      content_id: c.content_id,
      start_range: c.start_range,
      end_range: c.end_range,
      title: c.title,
      subject_category: c.subject_category,
    })),
  };
}
```

**적용 위치**: `plan/new-group/page.tsx`

**예상 효과**:
- 페이지 컴포넌트 라인 수: -150줄
- 코드 가독성: 크게 향상

### Phase 3: 컴포넌트 최적화 (Low Priority)

#### 3.1 `FilterBar` 컴포넌트 개선

**현재 문제**:
- `defaultValue` 중복 (39-40줄)
- `window.location.href` 사용 (44줄) → `useRouter` 사용 권장

**개선안**:
```typescript
// plan/_components/FilterBar.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function FilterBar({ currentPlanPurpose, currentSortOrder = "desc" }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const createQueryString = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    return params.toString();
  };

  const handlePlanPurposeChange = (value: string) => {
    const queryString = createQueryString("planPurpose", value);
    router.push(`/plan${queryString ? `?${queryString}` : ""}`);
  };

  return (
    <form className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <span className="font-medium">플랜 목적</span>
        <select
          name="planPurpose"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-gray-900 focus:outline-none"
          value={currentPlanPurpose || ""} // defaultValue → value로 변경
          onChange={(e) => handlePlanPurposeChange(e.target.value)}
        >
          {planPurposeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      {/* ... */}
    </form>
  );
}
```

#### 3.2 Spacing-First 정책 적용

**확인 필요 항목**:
- 모든 컴포넌트에서 margin 사용 확인
- `gap`, `space-y`, `p-*` 사용으로 통일

**예상 변경사항**:
- 미미한 변경 (대부분 이미 올바름)

---

## 📊 리팩토링 효과 예상

### 코드 라인 수 감소
- Phase 1: -500줄 (중복 제거)
- Phase 2: -230줄 (페이지 컴포넌트 정리)
- Phase 3: -10줄 (소소한 개선)
- **총 예상**: **-740줄** (~30% 감소)

### 성능 개선
- N+1 쿼리 문제 해결: **O(n) → O(1)**
- 배치 조회 도입: **쿼리 수 90% 감소** (콘텐츠 10개 기준: 10회 → 1회)

### 유지보수성 향상
- 중복 코드 제거: **버그 수정 시 3곳 → 1곳**
- 함수 재사용: **테스트 용이성 향상**
- 타입 안전성: **타입 정의 강화**

---

## 🚀 실행 계획

### Step 1: 유틸리티 함수 생성 (1일)
1. `lib/data/planContents.ts` 생성
2. `fetchStudentBooks`, `fetchStudentLectures`, `fetchStudentCustomContents` 구현
3. `classifyPlanContents` 구현 (복잡하므로 단계별 테스트 필요)

### Step 2: 기존 코드 교체 (1일)
1. `plan/new-group/page.tsx` 수정
2. `plan/group/[id]/edit/page.tsx` 수정
3. `plan/group/[id]/page.tsx` 수정

### Step 3: 페이지 컴포넌트 리팩토링 (1일)
1. `lib/data/planGroups.ts`에 통계 함수 추가
2. `plan/page.tsx` 리팩토링
3. `plan/new-group/page.tsx` Draft 로직 분리

### Step 4: 컴포넌트 최적화 (0.5일)
1. `FilterBar` 컴포넌트 개선
2. Spacing 정책 적용 확인

### Step 5: 테스트 및 검증 (1일)
1. 각 페이지 기능 테스트
2. 성능 테스트 (쿼리 수 확인)
3. 타입 검증

**총 예상 소요 시간**: **4.5일**

---

## ⚠️ 주의사항

### Breaking Changes
- 없음 (모두 내부 리팩토링)

### 테스트 필요 항목
1. 플랜 그룹 생성 플로우
2. Draft 불러오기
3. 플랜 그룹 편집
4. 플랜 그룹 상세 페이지
5. 플랜 목록 페이지 (필터링, 정렬)

### 롤백 계획
- 각 Phase별로 독립적으로 진행 가능
- Git 브랜치로 단계별 관리 권장

---

## 📝 추가 개선 제안

### 장기 개선사항 (현재 제안서 범위 외)

1. **React Query 도입**
   - 서버 상태 관리 개선
   - 캐싱 및 리프레시 최적화

2. **컴포넌트 분해**
   - `PlanGroupWizard` 컴포넌트가 너무 큼 (700+줄)
   - Step별로 별도 컴포넌트로 분리 검토

3. **타입 정의 강화**
   - `any` 타입 제거
   - 엄격한 타입 체크 적용

4. **에러 처리 개선**
   - 통일된 에러 처리 패턴
   - 사용자 친화적 에러 메시지

---

## ✅ 체크리스트

### 리팩토링 전
- [ ] 현재 코드 동작 확인
- [ ] 테스트 케이스 작성
- [ ] Git 브랜치 생성

### 리팩토링 중
- [ ] Phase 1: 유틸리티 함수 생성
- [ ] Phase 1: 기존 코드 교체
- [ ] Phase 2: 페이지 컴포넌트 리팩토링
- [ ] Phase 3: 컴포넌트 최적화

### 리팩토링 후
- [ ] 기능 테스트
- [ ] 성능 테스트
- [ ] 타입 검증
- [ ] 가이드라인 준수 확인
- [ ] 코드 리뷰

---

**작성일**: 2025-01-27
**작성자**: AI Assistant
**검토 상태**: 제안 단계 (실행 전)
