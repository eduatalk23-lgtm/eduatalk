# 다음 작업 요약

**작성일**: 2025-02-04  
**현재 상태**: Phase 4 완료

---

## ✅ 완료된 작업

### Phase 1: any 타입 제거
- ✅ 29개 `any` 타입 제거 완료

### Phase 2: Deprecated 함수 정리
- ✅ `selectClientForStudentQuery` 등 4개 함수 마이그레이션
- ✅ `parseForm*` 함수들 제거
- ✅ `isViewNotFoundError` 등 에러 체커 함수들 제거

### Phase 3: difficulty_level → difficulty_level_id 마이그레이션
- ✅ 전체 6개 Phase 완료

### Phase 4: 레거시 student_scores 테이블 마이그레이션
- ✅ 성적 타입 확인 헬퍼 함수 구현
- ✅ 내신/모의고사 성적 CRUD 함수 추가
- ✅ 성적 수정/삭제 페이지 마이그레이션
- ✅ 대시보드 및 분석 유틸리티 마이그레이션
- ✅ 레거시 코드 정리 (deprecated 표시)
- ✅ 레거시 테이블 확인 (이미 존재하지 않음)

---

## 📋 남은 작업

### Option 1: lib/reports/monthly.ts 개선 (우선순위: 높음)

#### 개요
`getMonthlyWeakSubjectTrend` 함수에서 레거시 `student_scores` 참조를 제거하고, 새 구조를 사용하도록 개선합니다.

#### 현재 상태
- `lib/reports/monthly.ts`에 TODO 주석 존재
- `student_internal_scores`와 `student_mock_scores`를 조합하여 과목별 등급 계산 필요

#### 작업 계획
1. `getMonthlyWeakSubjectTrend` 함수 수정
2. `student_internal_scores`와 `student_mock_scores` 조합
3. `subject_group_id`를 통해 과목 정보 조회
4. 테스트 및 검증

#### 예상 작업량
- 파일 수정: 1개
- 함수 개선: 1개
- 테스트: 필수

---

### Option 2: themeUtils.ts 완전 제거 (우선순위: 중간)

#### 개요
`lib/utils/themeUtils.ts`는 이미 deprecated로 표시되어 있으며, `darkMode.ts`로 마이그레이션되었습니다.

#### 현재 상태
- `themeUtils.ts`는 `darkMode.ts`의 re-export만 제공
- 사용처 확인 필요

#### 작업 계획
1. **사용처 확인**
   - `themeUtils.ts`를 import하는 모든 파일 찾기
   - `darkMode.ts`로 변경

2. **파일 제거**
   - 모든 사용처 마이그레이션 후 파일 제거

#### 예상 작업량
- 파일 수정: 5-10개 (예상)
- 파일 제거: 1개

---

### Option 3: School Service Deprecated 함수 정리 (우선순위: 낮음)

#### 개요
`lib/domains/school/service.ts`에 deprecated CRUD 함수들이 있습니다.

#### 발견된 Deprecated 함수
- `createSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
- `updateSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
- `deleteSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함
- `autoRegisterSchool()` - 읽기 전용 테이블이므로 더 이상 지원 안 함

#### 작업 계획
1. **사용처 확인**
   - 이 함수들이 실제로 호출되는지 확인
   - 사용 중이면 에러 처리 개선
   - 사용하지 않으면 제거

2. **에러 처리 개선**
   - 더 명확한 에러 메시지
   - 적절한 HTTP 상태 코드 반환

#### 예상 작업량
- 파일 수정: 1-2개
- 함수 정리: 4개

---

### Option 4: 추가 타입 안전성 개선 (우선순위: 중간)

#### 개요
남은 `any` 타입이나 타입 안전성을 개선할 수 있는 부분을 찾아 개선합니다.

#### 작업 계획
1. **any 타입 검색**
   - `app/(student)` 폴더 외의 `any` 타입 찾기
   - `app/(admin)` 폴더의 `any` 타입 찾기

2. **타입 정의 개선**
   - 명시적 타입 정의
   - 제네릭 활용

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

## 🎯 권장 작업 순서

### 1단계: lib/reports/monthly.ts 개선 (Option 1)
**이유**: 
- Phase 4 마이그레이션의 마지막 단계
- 데이터 일관성에 중요한 부분
- 사용자 기능에 직접 영향

**예상 소요 시간**: 1-2시간

### 2단계: themeUtils.ts 제거 (Option 2)
**이유**: 
- 이미 deprecated로 표시됨
- 상대적으로 안전한 작업
- 코드베이스 정리

**예상 소요 시간**: 1-2시간

### 3단계: 추가 타입 안전성 개선 (Option 4)
**이유**: 
- 코드 품질 향상
- 버그 예방
- 개발자 경험 개선

**예상 소요 시간**: 3-5시간

### 4단계: School Service 정리 (Option 3)
**이유**: 
- 우선순위 낮음
- 기능에 직접 영향 없음

**예상 소요 시간**: 1시간

### 5단계: 코드 품질 개선 (Option 5)
**이유**: 
- 지속적인 개선 작업
- 우선순위 낮음

**예상 소요 시간**: 가변적

---

## 📊 작업 우선순위 매트릭스

| 작업 | 우선순위 | 예상 시간 | 영향도 | 난이도 |
|------|---------|----------|--------|--------|
| Option 1: monthly.ts 개선 | 높음 | 1-2시간 | 높음 | 중간 |
| Option 2: themeUtils.ts 제거 | 중간 | 1-2시간 | 낮음 | 낮음 |
| Option 4: 타입 안전성 개선 | 중간 | 3-5시간 | 중간 | 중간 |
| Option 3: School Service 정리 | 낮음 | 1시간 | 낮음 | 낮음 |
| Option 5: 코드 품질 개선 | 낮음 | 가변적 | 중간 | 중간 |

---

## 📝 다음 작업 시작 전 체크리스트

- [x] Phase 4 마이그레이션 완료
- [x] 레거시 테이블 확인 완료
- [ ] Git 커밋 상태 확인
- [ ] 테스트 환경 준비
- [ ] 작업 범위 명확화
- [ ] 예상 소요 시간 확인
- [ ] 리스크 평가

---

## 🔗 관련 문서

- [Phase 4 마이그레이션 완료](./2025-02-04-phase4-migration-complete.md)
- [레거시 테이블 정리 결과](./2025-02-04-legacy-table-cleanup-result.md)
- [다음 단계 작업 정리](./2025-02-04-next-steps-summary.md)

---

**작성자**: AI Assistant  
**마지막 업데이트**: 2025-02-04

