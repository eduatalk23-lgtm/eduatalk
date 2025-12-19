# Repomix 개선 다음 단계 제안 (업데이트)

**작성일**: 2025-02-04  
**업데이트 일시**: 2025-02-04

---

## ✅ 완료된 작업 확인

### Option 1: 레거시 student_scores 테이블 마이그레이션 ✅

**상태**: 완료  
**완료 일자**: 2025-02-04

**완료 내용**:
- ✅ 레거시 `student_scores` 테이블 확인 (이미 존재하지 않음)
- ✅ 모든 코드가 새 구조 사용 중 (`student_internal_scores`, `student_mock_scores`)
- ✅ 마이그레이션 파일 생성 완료
- ✅ 레거시 함수 deprecated 표시 완료

**문서**: 
- `docs/2025-02-04-legacy-table-cleanup-result.md`
- `docs/2025-02-04-phase4-migration-complete.md`

---

### Option 2: themeUtils.ts 완전 제거 ✅

**상태**: 완료  
**완료 일자**: 2025-02-04

**완료 내용**:
- ✅ `lib/utils/themeUtils.ts` 파일 제거 완료
- ✅ 모든 코드가 `darkMode.ts` 직접 사용 중
- ✅ 사용처 없음 확인

**문서**: `docs/2025-02-04-themeutils-removal-complete.md`

---

## 📋 남은 작업 및 다음 단계

### Option 1: lib/reports/monthly.ts 개선 (우선순위: 높음) ⚠️

**상태**: 미완료  
**우선순위**: 높음  
**예상 소요 시간**: 1-2시간

#### 개요
`getMonthlyWeakSubjectTrend` 함수에서 레거시 `student_scores` 참조를 제거하고, 새 구조를 사용하도록 개선합니다.

#### 현재 상태
- `lib/reports/monthly.ts`의 `getMonthlyWeakSubjectTrend` 함수 확인 필요
- `student_internal_scores`와 `student_mock_scores`를 조합하여 과목별 등급 계산 필요
- TODO 주석 또는 레거시 참조 확인 필요

#### 작업 계획
1. **함수 분석**
   - `getMonthlyWeakSubjectTrend` 함수 코드 확인
   - 레거시 `student_scores` 참조 위치 파악
   - 새 구조로 마이그레이션 계획 수립

2. **마이그레이션**
   - `student_internal_scores`와 `student_mock_scores` 조합
   - `subject_group_id`를 통해 과목 정보 조회
   - 등급 계산 로직 개선

3. **테스트 및 검증**
   - 월간 리포트 기능 테스트
   - 데이터 정확성 검증

#### 예상 작업량
- 파일 수정: 1개 (`lib/reports/monthly.ts`)
- 함수 개선: 1개 (`getMonthlyWeakSubjectTrend`)
- 테스트: 필수

---

### Option 2: 추가 타입 안전성 개선 (우선순위: 중간) ⚠️

**상태**: 미완료  
**우선순위**: 중간  
**예상 소요 시간**: 3-5시간

#### 개요
남은 `any` 타입을 찾아 명시적 타입으로 개선합니다.

#### 발견된 `any` 타입

**app/(admin) 폴더**: 9개
1. `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx` - `invitations: any[]`
2. `app/(admin)/actions/subjects/export.ts` - `allSubjects: any[]`
3. `app/(admin)/actions/schools/import.ts` - `schoolsToInsert: any[]`, `schoolData: any`
4. `app/(admin)/actions/masterLectures/import.ts` - `lecturesToInsert: any[]`, `lectureData: any`
5. `app/(admin)/actions/masterBooks/import.ts` - `booksToInsert: any[]`, `bookData: any`
6. `app/(admin)/admin/students/[id]/_components/AnalysisReportSection.tsx` - `risk: any`

**app/(student) 폴더**: 13개
1. `app/(student)/plan/group/[id]/reschedule/_components/RescheduleWizard.tsx` - `(p as any).plan_date` (2곳)
2. `app/(student)/scores/[id]/edit/page.tsx` - `score: any` (2곳)
3. `app/(student)/plan/new-group/_components/_features/content-selection/Step4RecommendedContents/hooks/useRecommendations.ts` - `(c as any).master_content_id` (2곳)
4. `app/(student)/actions/campActions.ts` - `(c as any).start_detail_id`, `(creationData.scheduler_options as any)` 등 (8곳)

**총 발견된 `any` 타입**: 22개

#### 작업 계획
1. **타입 정의**
   - 각 파일의 데이터 구조 분석
   - 명시적 타입 인터페이스 정의
   - 제네릭 타입 활용

2. **타입 적용**
   - `any` 타입을 명시적 타입으로 교체
   - 타입 단언(`as any`) 제거
   - 타입 가드 활용

3. **검증**
   - TypeScript 컴파일 에러 확인
   - 기능 테스트

#### 예상 작업량
- 파일 수정: 10개 (예상)
- 타입 개선: 22개
- 타입 정의 추가: 5-10개 (예상)

---

### Option 3: School Service Deprecated 함수 정리 (우선순위: 낮음) ⚠️

**상태**: 미완료  
**우선순위**: 낮음  
**예상 소요 시간**: 1-2시간

#### 개요
`lib/domains/school/service.ts`의 deprecated CRUD 함수들을 정리합니다.

#### 발견된 Deprecated 함수
1. `createSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
2. `updateSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
3. `deleteSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
4. `autoRegisterSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
5. `checkDuplicateSchool()` - 더 이상 필요 없음

#### 현재 상태
- 모든 함수가 `@deprecated` 주석으로 표시됨
- 함수들이 에러를 반환하도록 구현됨
- 실제 사용처 확인 필요

#### 작업 계획
1. **사용처 확인**
   - `createSchool`, `updateSchool`, `deleteSchool`, `autoRegisterSchool`, `checkDuplicateSchool` 호출 확인
   - 실제 사용 중인지 확인
   - 사용 중이면 에러 처리 개선 또는 대안 제시
   - 사용하지 않으면 제거

2. **정리 작업**
   - 사용하지 않는 함수 제거
   - 사용 중인 함수는 에러 메시지 개선
   - 문서 업데이트

#### 예상 작업량
- 파일 수정: 1개 (`lib/domains/school/service.ts`)
- 함수 정리: 5개
- 사용처 확인: 13개 파일 (app 폴더), 10개 파일 (lib 폴더)

**참고**: 많은 파일에서 `createSchool`, `updateSchool` 등의 이름이 발견되었지만, 이것들이 실제로 deprecated 함수를 호출하는지 확인이 필요합니다. 대부분은 다른 함수일 가능성이 높습니다.

---

### Option 4: 코드 품질 개선 (우선순위: 낮음)

**상태**: 미완료  
**우선순위**: 낮음  
**예상 소요 시간**: 가변적

#### 개요
코드 품질을 개선할 수 있는 부분을 찾아 개선합니다.

#### 작업 계획
1. **중복 코드 제거**
   - 유사한 패턴의 코드 통합
   - 공통 함수 추출

2. **성능 최적화**
   - N+1 쿼리 문제 해결
   - 불필요한 리렌더링 방지

3. **에러 처리 개선**
   - 일관된 에러 처리 패턴
   - 에러 메시지 개선

#### 예상 작업량
- 파일 수정: 10-30개 (예상)
- 개선 항목: 다양

---

## 🎯 권장 작업 순서

### 1단계: lib/reports/monthly.ts 개선 (Option 1)
**이유**: 
- Phase 4 마이그레이션의 마지막 단계
- 데이터 일관성에 중요한 부분
- 사용자 기능에 직접 영향

**예상 소요 시간**: 1-2시간

---

### 2단계: 추가 타입 안전성 개선 (Option 2)
**이유**: 
- 코드 품질 향상
- 버그 예방
- 개발자 경험 개선
- 22개 `any` 타입 발견

**예상 소요 시간**: 3-5시간

---

### 3단계: School Service 정리 (Option 3)
**이유**: 
- 우선순위 낮음
- 기능에 직접 영향 없음
- 사용처 확인 후 안전하게 정리 가능

**예상 소요 시간**: 1-2시간

---

### 4단계: 코드 품질 개선 (Option 4)
**이유**: 
- 지속적인 개선 작업
- 우선순위 낮음

**예상 소요 시간**: 가변적

---

## 📊 작업 우선순위 매트릭스

| 작업 | 우선순위 | 예상 시간 | 영향도 | 난이도 | 상태 |
|------|---------|----------|--------|--------|------|
| Option 1: monthly.ts 개선 | 높음 | 1-2시간 | 높음 | 중간 | ⚠️ 미완료 |
| Option 2: 타입 안전성 개선 | 중간 | 3-5시간 | 중간 | 중간 | ⚠️ 미완료 |
| Option 3: School Service 정리 | 낮음 | 1-2시간 | 낮음 | 낮음 | ⚠️ 미완료 |
| Option 4: 코드 품질 개선 | 낮음 | 가변적 | 중간 | 중간 | ⚠️ 미완료 |

---

## 📈 진행 현황 요약

### 완료된 작업
- ✅ Option 1 (이전): 레거시 student_scores 테이블 마이그레이션
- ✅ Option 2 (이전): themeUtils.ts 완전 제거

### 미완료 작업
- ⚠️ Option 1 (새): lib/reports/monthly.ts 개선
- ⚠️ Option 2 (새): 추가 타입 안전성 개선 (22개 any 타입)
- ⚠️ Option 3: School Service Deprecated 함수 정리
- ⚠️ Option 4: 코드 품질 개선

---

## 📝 다음 작업 시작 전 체크리스트

- [x] 완료된 작업 확인
- [x] 남은 작업 파악
- [ ] Git 커밋 상태 확인
- [ ] 테스트 환경 준비
- [ ] 작업 범위 명확화
- [ ] 예상 소요 시간 확인
- [ ] 리스크 평가

---

## 🔗 관련 문서

- [Repomix 개선 진행 상태 점검](./2025-02-04-repomix-improvement-status-check.md)
- [다음 작업 요약](./2025-02-04-next-work-summary.md)
- [레거시 테이블 정리 결과](./2025-02-04-legacy-table-cleanup-result.md)
- [themeUtils.ts 제거 완료](./2025-02-04-themeutils-removal-complete.md)

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04

