# 다음 작업 요약 업데이트

**작성일**: 2025-02-04  
**업데이트 내용**: Option 1, Option 2 완료 상태 확인

---

## ✅ 완료 확인된 작업

### Option 1: lib/reports/monthly.ts 개선 ✅
- **상태**: 이미 완료됨
- **확인 사항**: `getMonthlyWeakSubjectTrend` 함수가 이미 새로운 구조(`getInternalScores`, `getMockScores`)를 사용 중
- **추가 개선**: `any` 타입 4개를 `Record<string, unknown>`으로 개선 완료
- **문서**: [2025-02-04-monthly-reports-type-improvement.md](./2025-02-04-monthly-reports-type-improvement.md)

### Option 2: themeUtils.ts 완전 제거 ✅
- **상태**: 이미 완료됨 (2025-02-04)
- **확인 사항**: `lib/utils/themeUtils.ts` 파일이 이미 제거됨
- **문서**: [2025-02-04-themeutils-removal-complete.md](./2025-02-04-themeutils-removal-complete.md)

---

## 📋 남은 작업

### Option 3: School Service Deprecated 함수 정리 (우선순위: 낮음)

#### 현재 상태
- Deprecated 함수들이 일부 컴포넌트에서 호출되고 있음
- 하지만 모든 함수가 에러를 반환하도록 구현되어 있음
- UI에서 실제로 기능이 동작하지 않음

#### 발견된 사용처
- `app/(admin)/admin/schools/_components/SchoolTable.tsx`: `deleteSchool` 호출
- `app/(admin)/admin/schools/[id]/edit/SchoolEditForm.tsx`: `updateSchool`, `deleteSchool` 호출
- `app/(admin)/admin/schools/_components/SchoolFormModal.tsx`: `createSchool`, `updateSchool` 호출
- `app/(admin)/admin/schools/new/SchoolForm.tsx`: `createSchool` 호출

#### 권장 작업
1. UI에서 학교 CRUD 기능이 실제로 필요한지 확인
2. 필요하지 않다면 관련 UI 컴포넌트 제거
3. 필요하다면 더 명확한 에러 메시지 및 안내 추가

#### 예상 작업량
- 파일 수정: 5-10개
- UI 변경: 필요 시

---

### Option 4: 추가 타입 안전성 개선 (우선순위: 중간)

#### 개요
남은 `any` 타입이나 타입 안전성을 개선할 수 있는 부분을 찾아 개선합니다.

#### 작업 계획
1. **any 타입 검색**
   - `app/(student)` 폴더 외의 `any` 타입 찾기
   - `app/(admin)` 폴더의 `any` 타입 찾기
   - `lib` 폴더의 `any` 타입 찾기

2. **타입 정의 개선**
   - 명시적 타입 정의
   - 제네릭 활용
   - 타입 가드 함수 추가

#### 예상 작업량
- 파일 수정: 10-20개 (예상)
- 타입 개선: 20-30개 (예상)

---

### Option 5: 코드 품질 개선 (우선순위: 낮음)

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

## 🎯 권장 작업 순서 (업데이트)

### 1단계: 추가 타입 안전성 개선 (Option 4) ⬅️ 현재 권장
**이유**: 
- 코드 품질 향상
- 버그 예방
- 개발자 경험 개선

**예상 소요 시간**: 3-5시간

### 2단계: School Service 정리 (Option 3)
**이유**: 
- 우선순위 낮음
- 기능에 직접 영향 없음 (이미 에러 반환 중)
- UI 변경이 필요할 수 있음

**예상 소요 시간**: 1-2시간

### 3단계: 코드 품질 개선 (Option 5)
**이유**: 
- 지속적인 개선 작업
- 우선순위 낮음

**예상 소요 시간**: 가변적

---

## 📊 작업 우선순위 매트릭스 (업데이트)

| 작업 | 우선순위 | 예상 시간 | 영향도 | 난이도 | 상태 |
|------|---------|----------|--------|--------|------|
| Option 1: monthly.ts 개선 | 높음 | 1-2시간 | 높음 | 중간 | ✅ 완료 |
| Option 2: themeUtils.ts 제거 | 중간 | 1-2시간 | 낮음 | 낮음 | ✅ 완료 |
| Option 4: 타입 안전성 개선 | 중간 | 3-5시간 | 중간 | 중간 | ⏳ 진행 가능 |
| Option 3: School Service 정리 | 낮음 | 1-2시간 | 낮음 | 낮음 | ⏸️ 대기 |
| Option 5: 코드 품질 개선 | 낮음 | 가변적 | 중간 | 중간 | ⏸️ 대기 |

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04

