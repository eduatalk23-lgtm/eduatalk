# 리포트 JOIN 쿼리 에러 수정

## 📋 개요

리포트 기능에서 발생한 JOIN 쿼리 에러를 해결하기 위해 JOIN을 제거하고 배치 조회 방식으로 변경했습니다.

## 🔍 발견된 문제

### 에러 현상
```
[reports] 내신 성적 쿼리 에러 상세: {}
```

에러 객체가 비어있어 실제 에러 원인을 파악하기 어려웠습니다.

### 원인 분석
1. **JOIN 쿼리 실패**: Supabase JOIN 쿼리에서 FK가 null이거나 RLS 정책으로 인해 JOIN된 테이블에 접근할 수 없는 경우
2. **에러 객체 비어있음**: 에러가 발생했지만 에러 객체의 속성들이 제대로 채워지지 않음
3. **JOIN 문법 문제**: Supabase의 JOIN 문법이 예상과 다르게 동작할 수 있음

## 🔧 수정 내용

### `app/(student)/reports/_utils.ts`

#### 1. JOIN 쿼리 제거 및 배치 조회로 변경

**변경 전 (JOIN 사용):**
```typescript
const { data: internalData, error: internalError } = await supabase
  .from("student_internal_scores")
  .select(`
    subject_group_id,
    subject_id,
    grade_score,
    raw_score,
    test_date,
    subject_groups:subject_group_id(name),
    subjects:subject_id(name)
  `)
  .gte("test_date", startDateStr)
  .lte("test_date", endDateStr)
  .eq("student_id", studentId)
  .order("test_date", { ascending: true });
```

**변경 후 (배치 조회):**
```typescript
// 1. 기본 컬럼만 먼저 조회
const { data: internalData, error: internalError } = await supabase
  .from("student_internal_scores")
  .select("subject_group_id,subject_id,grade_score,raw_score,test_date")
  .gte("test_date", startDateStr)
  .lte("test_date", endDateStr)
  .eq("student_id", studentId)
  .order("test_date", { ascending: true });

// 2. subject_group_id와 subject_id 수집
const subjectGroupIds = new Set<string>();
const subjectIds = new Set<string>();

(internalData || []).forEach((score: any) => {
  if (score.subject_group_id) subjectGroupIds.add(score.subject_group_id);
  if (score.subject_id) subjectIds.add(score.subject_id);
});

// 3. 배치로 과목명 조회
const [subjectGroupsData, subjectsData] = await Promise.all([
  subjectGroupIds.size > 0
    ? supabase
        .from("subject_groups")
        .select("id,name")
        .in("id", Array.from(subjectGroupIds))
    : Promise.resolve({ data: [], error: null }),
  subjectIds.size > 0
    ? supabase
        .from("subjects")
        .select("id,name")
        .in("id", Array.from(subjectIds))
    : Promise.resolve({ data: [], error: null }),
]);

// 4. Map으로 변환하여 빠른 조회
const subjectGroupMap = new Map<string, string>();
(subjectGroupsData.data || []).forEach((sg: any) => {
  subjectGroupMap.set(sg.id, sg.name);
});

const subjectMap = new Map<string, string>();
(subjectsData.data || []).forEach((s: any) => {
  subjectMap.set(s.id, s.name);
});

// 5. 데이터 변환
internalScoresResult = (internalData || []).map((score: any) => ({
  subject_group: score.subject_group_id ? subjectGroupMap.get(score.subject_group_id) || null : null,
  subject_name: score.subject_id ? subjectMap.get(score.subject_id) || null : null,
  grade_score: score.grade_score,
  raw_score: score.raw_score,
  test_date: score.test_date,
}));
```

#### 2. 에러 로깅 개선

**변경 전:**
```typescript
if (internalError) {
  console.error("[reports] 내신 성적 쿼리 에러 상세:", {
    code: internalError.code,
    message: internalError.message,
    details: internalError.details,
    hint: internalError.hint,
    query: "student_internal_scores",
    filters: { startDateStr, endDateStr, studentId },
  });
}
```

**변경 후:**
```typescript
if (internalError) {
  // 에러 객체의 모든 속성을 확인
  const errorInfo = {
    code: internalError.code || "UNKNOWN",
    message: internalError.message || "Unknown error",
    details: internalError.details || null,
    hint: internalError.hint || null,
    error: internalError ? JSON.stringify(internalError, Object.getOwnPropertyNames(internalError)) : "Empty error object",
    query: "student_internal_scores",
    filters: { startDateStr, endDateStr, studentId },
  };
  console.error("[reports] 내신 성적 쿼리 에러 상세:", errorInfo);
}
```

#### 3. null 데이터 체크 추가

```typescript
} else if (!internalData) {
  console.warn("[reports] 내신 성적 데이터가 null입니다.", { startDateStr, endDateStr, studentId });
  internalScoresResult = [];
} else {
  // 데이터 처리...
}
```

## ✅ 결과

1. **JOIN 에러 해결**: JOIN 쿼리를 제거하고 배치 조회로 변경하여 에러 발생 가능성 감소
2. **에러 로깅 개선**: 에러 객체의 모든 속성을 확인하여 디버깅 용이성 향상
3. **안정성 향상**: null 데이터 체크 추가로 예외 상황 처리 개선
4. **성능 유지**: 배치 조회를 사용하여 쿼리 횟수 최소화

## 📝 참고사항

- JOIN 쿼리는 편리하지만 RLS 정책이나 FK null 값으로 인해 실패할 수 있습니다.
- 배치 조회 방식은 더 안전하고 예측 가능한 동작을 보장합니다.
- 향후 JOIN 쿼리를 사용할 경우 RLS 정책과 FK null 처리를 고려해야 합니다.

