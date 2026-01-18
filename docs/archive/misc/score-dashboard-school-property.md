# 성적 대시보드 API - 학교 유형 추가

## 📋 작업 개요

성적 대시보드 API 응답에 "학교 유형" (`school_property`) 필드를 추가했습니다.

## 🔄 주요 변경사항

### 1. API 라우트 수정 (`app/api/students/[id]/score-dashboard/route.ts`)

**변경 내용:**
- `students` 테이블 조회 시 `school_id`, `school_type` 필드 추가
- `school_type`이 `MIDDLE` 또는 `HIGH`이고 `school_id`가 있는 경우, `school_info` 테이블을 조인하여 `school_property` 조회
- `school_id` 파싱 로직 추가 (통합 ID 형식 `SCHOOL_123` 또는 직접 ID 형식 `123` 지원)
- 응답의 `studentProfile.schoolType`에 `school_property` 값 매핑

**구현 로직:**
```typescript
// students.school_id와 school_type 조회
const { data: student } = await supabase
  .from("students")
  .select("id, name, grade, class, school_id, school_type")
  .eq("id", studentId)
  .eq("tenant_id", tenantId)
  .maybeSingle();

// school_type이 MIDDLE 또는 HIGH인 경우 school_info 조회
if (student.school_id && (student.school_type === "MIDDLE" || student.school_type === "HIGH")) {
  // school_id 파싱 (SCHOOL_ 접두사 처리)
  let schoolInfoId: number | null = null;
  if (student.school_id.startsWith("SCHOOL_")) {
    schoolInfoId = parseInt(student.school_id.replace("SCHOOL_", ""), 10);
  } else {
    schoolInfoId = parseInt(student.school_id, 10);
  }
  
  // school_info에서 school_property 조회
  const { data: schoolInfo } = await supabase
    .from("school_info")
    .select("school_property")
    .eq("id", schoolInfoId)
    .maybeSingle();
  
  schoolProperty = schoolInfo?.school_property || null;
}
```

### 2. TypeScript 타입

**기존 타입 유지:**
- `ScoreDashboardResponse["studentProfile"]["schoolType"]`는 이미 `string | null`로 정의되어 있어 추가 수정 불필요

### 3. 테스트 스크립트 (`scripts/testScoreDashboard.ts`)

**변경 없음:**
- 이미 `data.studentProfile?.schoolType || "N/A"` 형식으로 출력하고 있어 추가 수정 불필요

## 📊 데이터 흐름

```
API 요청 (studentId, tenantId)
  ↓
students 조회 (school_id, school_type 포함)
  ↓
school_type이 MIDDLE 또는 HIGH인 경우
  ↓
school_id 파싱 (SCHOOL_ 접두사 처리)
  ↓
school_info 조회 (school_property)
  ↓
응답에 schoolType 필드로 매핑
```

## ✅ 검증 방법

### 테스트 명령어
```bash
npx tsx scripts/testScoreDashboard.ts fe7d04b5-3663-421c-8014-bc6a1018a652 84b71a5d-5681-4da3-88d2-91e75ef89015 2 1
```

### 기대 결과
- **학교 유형이 있는 경우**: "학교 유형: 일반고등학교" (또는 "자율고등학교", "특수목적고등학교" 등)
- **학교 유형이 없는 경우**: "학교 유형: N/A"

## 🔍 주의사항

1. **school_id 형식 지원**
   - 통합 ID 형식: `SCHOOL_123` (all_schools_view 형식)
   - 직접 ID 형식: `123` (school_info.id 직접 참조)
   - 두 형식 모두 파싱하여 처리

2. **school_type 조건**
   - `MIDDLE` 또는 `HIGH`인 경우에만 `school_info` 조회
   - `UNIVERSITY`인 경우 `school_property`는 `null` (대학교는 다른 테이블 구조)

3. **방어적 코딩**
   - `school_id`가 없거나 파싱 실패 시 `null` 반환
   - `school_info` 조회 실패 시 에러 로그만 출력하고 `null` 반환
   - 학교 유형이 없어도 내신/모의고사 분석은 정상 동작

## 📝 참고사항

- `school_property` 값 예시: "일반고등학교", "자율고등학교", "특수목적고등학교", "특성화고등학교" 등
- `school_info` 테이블은 나이스(NEIS) API 데이터 기반
- `students.school_id`는 text 타입, `school_info.id`는 integer 타입이므로 변환 필요

