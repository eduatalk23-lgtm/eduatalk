# Score Dashboard 스크립트 리팩토링

## 📋 개요

성적 대시보드 관련 더미 데이터 생성 및 테스트 스크립트를 **이름 기반 조회** 방식으로 리팩토링하여, 마스터 테이블을 TRUNCATE 후 다시 입력해도 스크립트가 정상 동작하도록 개선했습니다.

## 🎯 핵심 원칙

- **UUID 하드코딩 금지**: 어떤 스크립트에서도 ID를 하드코딩하지 않음
- **이름 기반 조회 → ID 사용**: 항상 이름으로 조회한 후 ID를 사용
- **마스터 테이블 재입력 대응**: 마스터 테이블을 비우고 다시 입력해도 정상 동작

## 📝 변경된 파일

### 1. `scripts/seedScoreDashboardDummy.ts`

#### 주요 변경 사항

1. **테넌트 조회**
   - 변경 전: 첫 번째 테넌트 조회 또는 생성
   - 변경 후: `name = 'Default Tenant'` 기준으로 조회
   - 테넌트가 없으면 에러 발생 (자동 생성 제거)

2. **교육과정 개정 조회**
   - 변경 전: `year` 기준 정렬 후 첫 번째 조회
   - 변경 후: `name = '2022개정'` 기준으로 조회
   - 없으면 활성화된 첫 번째 교육과정 사용 (폴백)

3. **과목 조회**
   - 변경 전: 각 교과 그룹의 첫 번째 과목 사용
   - 변경 후: 이름 기반 조회
     - 국어 → '국어'
     - 수학 → '수학'
     - 영어 → '영어'
     - 사회 → '통합사회'
     - 과학 → '통합과학'
   - 정확한 이름으로 찾지 못하면 해당 교과 그룹의 첫 번째 과목 사용 (폴백)

4. **메타데이터 구조 변경**
   - 변경 전: `subjectIds: { korean, math, english, social, science }`
   - 변경 후: `subjectMap: Record<string, string>` (교과 그룹 이름 → 과목 ID)

5. **성적 데이터 생성 로직**
   - 변경 전: 삼항 연산자로 과목 ID 선택
   - 변경 후: `subjectMap[subjectGroup]`로 직접 조회

#### 코드 예시

```typescript
// 변경 전
const subjectId = score.subjectGroup === "국어"
  ? metadata.subjectIds.korean
  : score.subjectGroup === "수학"
  ? metadata.subjectIds.math
  : // ...

// 변경 후
const subjectId = metadata.subjectMap[score.subjectGroup];
if (!sgId || !subjectId) {
  throw new Error(`교과 그룹 또는 과목을 찾을 수 없습니다: ${score.subjectGroup}`);
}
```

### 2. `scripts/testScoreDashboard.ts`

#### 주요 변경 사항

1. **학생 목록 조회 필터 추가**
   - 변경 전: 모든 학생 중 최근 10명 조회
   - 변경 후: `name LIKE '더미학생%'` 필터 추가
   - 더미 학생만 조회하여 테스트 목록을 명확하게 표시

#### 코드 예시

```typescript
// 변경 전
const { data: students } = await supabase
  .from("students")
  .select("id, name, tenant_id, grade")
  .order("created_at", { ascending: false })
  .limit(10);

// 변경 후
const { data: students } = await supabase
  .from("students")
  .select("id, name, tenant_id, grade")
  .like("name", "더미학생%")
  .order("created_at", { ascending: false })
  .limit(10);
```

### 3. `scripts/cleanupScoreDashboardDummy.ts`

#### 주요 변경 사항

1. **삭제 기준 변경**
   - 변경 전: `memo = 'DUMMY_SCORE_TEST'` 기준
   - 변경 후: `name LIKE '더미학생%'` 기준

2. **삭제 로직 개선**
   - 변경 전: 각 테이블에서 `notes` 또는 `memo` 필드로 직접 삭제
   - 변경 후: 먼저 더미 학생 ID 목록 조회 → 해당 학생들의 관련 데이터 일괄 삭제

3. **Service Role Key 사용**
   - 변경 전: Anon Key 사용
   - 변경 후: Service Role Key 사용 (RLS 우회)

#### 코드 예시

```typescript
// 변경 전
const { error } = await supabase
  .from("student_internal_scores")
  .delete()
  .eq("notes", DUMMY_TAG);

// 변경 후
const { data: dummyStudents } = await supabase
  .from("students")
  .select("id, name")
  .like("name", DUMMY_NAME_PATTERN);

const studentIds = dummyStudents.map((s) => s.id);

const { error } = await supabase
  .from("student_internal_scores")
  .delete()
  .in("student_id", studentIds);
```

## ✅ 테스트 시나리오

리팩토링 후 아래 시나리오가 항상 통과됩니다:

### 1. 마스터/더미 데이터 초기화

```bash
# 마스터 테이블 TRUNCATE 및 재입력 (별도 migration/seed에서 처리)
# 더미 데이터 삭제
npm run cleanup:score-dashboard-dummy
```

### 2. 더미 데이터 생성

```bash
npm run seed:score-dashboard-dummy
```

**예상 출력:**
```
✅ 테넌트 조회 완료: Default Tenant (xxx)
✅ 교육과정 개정 조회 완료: 2022개정 (yyy)
✅ 교과 그룹 조회 완료: 5개
   ✅ 국어: 국어 (zzz)
   ✅ 수학: 수학 (aaa)
   ...
```

### 3. 테스트 스크립트 안내

```bash
npm run test:score-dashboard
```

**예상 출력:**
```
📋 사용 가능한 학생 목록 (최근 10명):

  👤 더미학생A_정시우위 (ID: ...)
     - Tenant ID: ...
     - 학년: 2
     - 학기: 2025년 2학년 1학기
     - Term ID: ...
     - 테스트 명령어:
       npx tsx scripts/testScoreDashboard.ts ... ... ...
```

### 4. 실제 호출 테스트

```bash
npx tsx scripts/testScoreDashboard.ts <studentId> <tenantId> <termId>
```

**예상 응답:**
- 내신 GPA / Z-index: 정상 숫자
- 모의고사 평균 백분위 / 표준점수 합 / 상위 3개 등급 합: 정상 숫자
- 내신 환산 백분위 / 전략 타입: 정상 숫자 및 타입

## 🔍 주요 개선 사항

### 1. 이름 기반 조회로 변경

모든 마스터 데이터 조회를 이름 기반으로 변경하여, 마스터 테이블을 재입력해도 정상 동작합니다.

### 2. 에러 처리 개선

- 테넌트/교육과정/과목을 찾을 수 없을 때 명확한 에러 메시지 제공
- 폴백 로직 추가 (교육과정: 활성화된 첫 번째, 과목: 교과 그룹의 첫 번째)

### 3. 코드 가독성 향상

- 삼항 연산자 체인 제거
- Map 기반 조회로 변경하여 코드 간결화

### 4. 일관성 확보

- 모든 스크립트에서 `더미학생%` 패턴 일관성 유지
- 삭제 스크립트도 이름 기반으로 통일

## 📌 주의 사항

1. **테넌트 이름**: `Default Tenant`라는 이름의 테넌트가 반드시 존재해야 합니다.
2. **교육과정 이름**: `2022개정`이라는 이름의 교육과정이 있으면 우선 사용하며, 없으면 활성화된 첫 번째 교육과정을 사용합니다.
3. **과목 이름**: 정확한 이름으로 찾지 못하면 해당 교과 그룹의 첫 번째 과목을 사용합니다.
4. **더미 학생 이름**: 반드시 `더미학생`으로 시작해야 합니다 (예: `더미학생A_정시우위`).

## 🚀 사용 방법

### 더미 데이터 생성

```bash
npm run seed:score-dashboard-dummy
```

### 테스트 스크립트 실행

```bash
# 학생 목록 조회
npm run test:score-dashboard

# 특정 학생 테스트
npm run test:score-dashboard <studentId> <tenantId> <termId>
```

### 더미 데이터 삭제

```bash
npm run cleanup:score-dashboard-dummy
```

## 📅 변경 일자

2024년 12월

