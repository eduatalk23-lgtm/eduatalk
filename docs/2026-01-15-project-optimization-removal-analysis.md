# 프로젝트 최적화 제거 대상 분석 문서

**작성일**: 2026-01-15  
**분석 범위**: 전체 프로젝트  
**목적**: 프로젝트 최적화를 위해 제거 가능한 코드, 파일, 의존성 식별 및 문서화

---

## 📊 분석 요약

| 카테고리 | 항목 수 | 예상 절감량 | 우선순위 |
|---------|--------|------------|---------|
| Deprecated 코드 | 676개 매치 (246개 파일) | ~5,000+ 라인 | 높음 |
| 백업 파일 | 1개 | ~866 라인 | 높음 |
| 미사용 스크립트 | 5-10개 | ~500 라인 | 중간 |
| 중복 문서 | 50-100개 | - | 낮음 |
| 외부 프레임워크 | 2개 디렉토리 | ~50,000+ 라인 | 높음 |
| 미사용 유틸리티 | 3-5개 파일 | ~200 라인 | 중간 |

---

## 🔴 높은 우선순위: 즉시 제거 가능

### 1. Deprecated 코드 정리 (676개 매치, 246개 파일)

#### 1.1 완전히 사용되지 않는 Deprecated 함수/타입

**위치**: 프로젝트 전역

**주요 항목**:

1. **`lib/utils/phoneMasking.ts`** (전체 파일)
   - **상태**: Deprecated, 사용처 1곳만 남음
   - **대체**: `lib/utils/phone.ts` 사용
   - **사용처**: `app/(admin)/admin/attendance/sms-logs/_components/SMSLogsTable.tsx`
   - **작업**: import 경로 변경 후 파일 삭제
   - **예상 시간**: 0.5일

2. **`lib/utils/supabaseClientSelector.ts`** (전체 파일)
   - **상태**: Deprecated, 사용처 없음
   - **대체**: `lib/supabase/clientSelector.ts` 직접 사용
   - **작업**: 파일 삭제
   - **예상 시간**: 0.1일

3. **`lib/utils/planGroupTransform.ts`의 `transformPlanGroupToWizardData` 함수**
   - **상태**: Deprecated, 사용처 없음
   - **대체**: `transformPlanGroupToWizardDataPure` 사용
   - **작업**: 함수 제거
   - **예상 시간**: 0.5일

4. **`app/(student)/plan/new-group/_components/_features/scheduling/components/scheduleUtils.ts`의 `dayTypeColors`**
   - **상태**: Deprecated, `getDayTypeBadgeClasses()`로 대체
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 0.5일

5. **`lib/data/contentMasters/hybrid.ts`** (전체 파일)
   - **상태**: Deprecated, `searchMasterBooks` 또는 `searchMasterLectures` 사용 권장
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 1일

6. **`lib/data/contentMasters/copy.ts`의 deprecated 함수들**
   - **상태**: Deprecated, 개별 함수로 대체됨
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 1일

#### 1.2 하위 호환성을 위해 유지 중인 Deprecated 코드

**주의**: 다음 항목들은 하위 호환성을 위해 유지 중이지만, 점진적 마이그레이션 후 제거 가능

1. **`components/ui/index.ts`** (레거시 export)
   - **상태**: Atomic Design 패턴으로 마이그레이션됨
   - **대체**: `@/components/atoms`, `@/components/molecules`, `@/components/organisms` 직접 사용
   - **작업**: 모든 import 경로 마이그레이션 후 제거
   - **예상 시간**: 2-3일

2. **`app/(student)/analysis/_utils.ts`** (re-export 파일)
   - **상태**: `@/lib/domains/analysis`로 마이그레이션됨
   - **작업**: import 경로 변경 후 제거
   - **예상 시간**: 1일

3. **`app/(parent)/_utils.ts`** (re-export 파일)
   - **상태**: Deprecated
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 0.5일

4. **`lib/types/plan/domain.ts`의 deprecated 필드들**
   - **상태**: 여러 필드가 deprecated (10개 이상)
   - **작업**: 점진적 마이그레이션 후 제거
   - **예상 시간**: 3-5일

#### 1.3 Deprecated 컴포넌트

1. **`app/(admin)/admin/students/[id]/plans/_components/AdminQuickPlanModal.tsx`**
   - **상태**: `UnifiedPlanAddModal`로 대체됨
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 1일

2. **`app/(admin)/admin/students/[id]/plans/_components/AddAdHocModal.tsx`**
   - **상태**: `UnifiedPlanAddModal`로 대체됨
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 1일

3. **`app/(admin)/admin/content-metadata/_components/SubjectsManager.tsx`**
   - **상태**: `/admin/subjects`로 통합됨
   - **작업**: 사용처 확인 후 제거
   - **예상 시간**: 0.5일

---

### 2. 백업 파일 제거

#### 2.1 `lib/types/plan.ts.backup`

- **크기**: ~866 라인
- **상태**: 백업 파일, 사용되지 않음
- **작업**: 즉시 삭제
- **예상 시간**: 0.1일

**삭제 명령**:
```bash
rm lib/types/plan.ts.backup
```

---

### 3. 외부 프레임워크 디렉토리 제거

#### 3.1 `SuperClaude_Framework/` 디렉토리

- **크기**: ~50,000+ 라인 (776개 파일)
- **상태**: 프로젝트와 무관한 외부 프레임워크
- **작업**: 전체 디렉토리 제거
- **예상 시간**: 0.1일

**삭제 명령**:
```bash
rm -rf SuperClaude_Framework/
```

**주의**: 이 디렉토리는 프로젝트 코드와 무관하며, 별도 저장소로 관리되어야 함

#### 3.2 `serena/` 디렉토리

- **크기**: ~20,000+ 라인 (458개 파일)
- **상태**: 프로젝트와 무관한 외부 도구
- **작업**: 전체 디렉토리 제거
- **예상 시간**: 0.1일

**삭제 명령**:
```bash
rm -rf serena/
```

**주의**: 이 디렉토리는 프로젝트 코드와 무관하며, 별도 저장소로 관리되어야 함

---

## 🟡 중간 우선순위: 점진적 제거

### 4. 미사용/일회성 스크립트 정리

#### 4.1 일회성 마이그레이션 스크립트

다음 스크립트들은 일회성 작업용으로 보이며, 작업 완료 후 제거 가능:

1. **`scripts/execute-camp-migration.ps1`**
   - **용도**: 캠프 마이그레이션 (일회성)
   - **작업**: 작업 완료 확인 후 제거

2. **`scripts/execute-migration-reset.ts`**
   - **용도**: 마이그레이션 리셋 (일회성)
   - **작업**: 작업 완료 확인 후 제거

3. **`scripts/execute-reset-sql.ps1`**
   - **용도**: SQL 리셋 (일회성)
   - **작업**: 작업 완료 확인 후 제거

4. **`scripts/reset-migrations.ps1`**
   - **용도**: 마이그레이션 리셋 (일회성)
   - **작업**: 작업 완료 확인 후 제거

5. **`scripts/reset-migrations-production.ps1`**
   - **용도**: 프로덕션 마이그레이션 리셋 (일회성)
   - **작업**: 작업 완료 확인 후 제거

6. **`scripts/start-fresh-migrations.ps1`**
   - **용도**: 새 마이그레이션 시작 (일회성)
   - **작업**: 작업 완료 확인 후 제거

7. **`scripts/fix-migration-history.ps1`**
   - **용도**: 마이그레이션 히스토리 수정 (일회성)
   - **작업**: 작업 완료 확인 후 제거

#### 4.2 테스트/검증 스크립트 (개발용)

다음 스크립트들은 개발/테스트용이며, 프로덕션에서는 불필요할 수 있음:

1. **`scripts/check-camp-plan-contents.ts`**
   - **용도**: 캠프 플랜 콘텐츠 검증
   - **작업**: 필요 시 유지, 불필요 시 제거

2. **`scripts/check-legacy-student-scores-table.ts`**
   - **용도**: 레거시 성적 테이블 검증
   - **작업**: 레거시 정리 완료 후 제거

3. **`scripts/check-student-divisions-table.ts`**
   - **용도**: 학생 구분 테이블 검증
   - **작업**: 필요 시 유지

4. **`scripts/check-student-scores.ts`**
   - **용도**: 학생 성적 검증
   - **작업**: 필요 시 유지

5. **`scripts/check-students-school-columns.ts`**
   - **용도**: 학생 학교 컬럼 검증
   - **작업**: 필요 시 유지

6. **`scripts/generate-dummy-scores.ts`**
   - **용도**: 더미 성적 생성 (개발용)
   - **작업**: 개발 환경에서만 유지

7. **`scripts/seedScoreDashboardDummy.ts`**
   - **용도**: 더미 데이터 시드 (개발용)
   - **작업**: 개발 환경에서만 유지

8. **`scripts/cleanupScoreDashboardDummy.ts`**
   - **용도**: 더미 데이터 정리 (개발용)
   - **작업**: 개발 환경에서만 유지

9. **`scripts/testScoreDashboard.ts`**
   - **용도**: 대시보드 테스트 (개발용)
   - **작업**: 개발 환경에서만 유지

10. **`scripts/test-llm-mock.ts`**
    - **용도**: LLM 모의 테스트 (개발용)
    - **작업**: 개발 환경에서만 유지

11. **`scripts/test-llm-plan.ts`**
    - **용도**: LLM 플랜 테스트 (개발용)
    - **작업**: 개발 환경에서만 유지

12. **`scripts/test-llm-validation.ts`**
    - **용도**: LLM 검증 테스트 (개발용)
    - **작업**: 개발 환경에서만 유지

13. **`scripts/test-ppurio-sms.ts`**
    - **용도**: SMS 서비스 테스트 (개발용)
    - **작업**: 개발 환경에서만 유지

14. **`scripts/test-student-search-api.ts`**
    - **용도**: 학생 검색 API 테스트 (개발용)
    - **작업**: 개발 환경에서만 유지

15. **`scripts/test-supabase-connection.ts`**
    - **용도**: Supabase 연결 테스트 (개발용)
    - **작업**: 개발 환경에서만 유지

16. **`scripts/validate-legacy-plan-data.ts`**
    - **용도**: 레거시 플랜 데이터 검증
    - **작업**: 레거시 정리 완료 후 제거

---

### 5. 미사용 유틸리티 함수 정리

#### 5.1 `lib/utils/studentFormUtils.ts`의 재export 제거

- **위치**: 라인 53-71
- **내용**: 전화번호 함수들의 재export
- **대체**: `lib/utils/phone.ts`에서 직접 import
- **작업**: 재export 제거
- **예상 시간**: 0.5일

#### 5.2 `lib/utils/masterContentFormHelpers.ts`의 deprecated 필드

- **위치**: 6곳에서 사용
- **내용**: `difficulty_level` 필드 (deprecated)
- **대체**: `difficulty_level_id` 사용
- **작업**: 점진적 마이그레이션
- **예상 시간**: 1일

---

### 6. 중복된 타입 정의 정리

#### 6.1 `app/(student)/plan/new-group/_components/PlanGroupWizard.tsx`의 타입 re-export

- **위치**: 라인 32-36
- **내용**: `WizardData`, `TemplateLockedFields` 타입 re-export
- **대체**: `@/lib/schemas/planWizardSchema`에서 직접 import
- **작업**: 모든 import 경로 마이그레이션 후 제거
- **예상 시간**: 1일

---

## 🟢 낮은 우선순위: 장기적 정리

### 7. 문서 정리

#### 7.1 중복/구식 문서 정리

**현재 상태**: `docs/` 디렉토리에 1,334개 문서 파일 존재

**정리 대상**:

1. **완료된 작업 문서**: 작업 완료 후 참고용으로만 필요
   - 예: `docs/2025-01-30-*.md` (30개 이상)
   - 예: `docs/2025-02-02-*.md` (50개 이상)

2. **중복 문서**: 동일한 내용의 문서가 여러 버전으로 존재
   - 예: 리팩토링 관련 문서들

3. **구식 문서**: 현재 아키텍처와 맞지 않는 문서
   - 예: 레거시 시스템 설명 문서

**권장 사항**:
- 완료된 작업 문서는 `docs/archive/` 디렉토리로 이동
- 중복 문서는 통합
- 구식 문서는 업데이트 또는 제거

**작업**: 수동 검토 필요, 자동화 어려움

---

### 8. 미사용 의존성 확인

#### 8.1 package.json 의존성 검토

**확인 필요 항목**:

1. **`react-virtualized-auto-sizer`** + **`@types/react-virtualized-auto-sizer`**
   - **용도**: 가상화된 리스트 자동 크기 조정
   - **상태**: 사용 여부 확인 필요

2. **`react-window`** + **`@types/react-window`**
   - **용도**: 가상화된 리스트 렌더링
   - **상태**: 사용 여부 확인 필요

3. **`html5-qrcode`** + **`qrcode`**
   - **용도**: QR 코드 생성/스캔
   - **상태**: 사용 중 (출석 관리)

4. **`xlsx`** + **`@types/xlsx`**
   - **용도**: Excel 파일 처리
   - **상태**: 사용 여부 확인 필요

5. **`react-markdown`** + **`remark-gfm`**
   - **용도**: Markdown 렌더링
   - **상태**: 사용 여부 확인 필요

**작업**: 
- `npm-check-unused` 또는 유사 도구로 미사용 의존성 확인
- 사용되지 않는 의존성 제거

---

## 📋 실행 계획

### Phase 1: 즉시 제거 (1-2일)

1. ✅ 백업 파일 제거 (`lib/types/plan.ts.backup`)
2. ✅ 외부 프레임워크 디렉토리 제거 (`SuperClaude_Framework/`, `serena/`)
3. ✅ 사용처 없는 deprecated 파일 제거
   - `lib/utils/supabaseClientSelector.ts`
   - `lib/utils/planGroupTransform.ts`의 `transformPlanGroupToWizardData` 함수

### Phase 2: Deprecated 코드 마이그레이션 (3-5일)

1. 전화번호 유틸리티 통합
   - `lib/utils/phoneMasking.ts` → `lib/utils/phone.ts`
   - `lib/utils/studentFormUtils.ts`의 재export 제거

2. Deprecated 컴포넌트 제거
   - `AdminQuickPlanModal.tsx` → `UnifiedPlanAddModal`
   - `AddAdHocModal.tsx` → `UnifiedPlanAddModal`
   - `SubjectsManager.tsx` → `/admin/subjects`

3. Re-export 파일 제거
   - `app/(student)/analysis/_utils.ts`
   - `app/(parent)/_utils.ts`

### Phase 3: 스크립트 정리 (1-2일)

1. 일회성 마이그레이션 스크립트 제거
2. 개발용 테스트 스크립트 정리 (필요 시 유지)

### Phase 4: 장기적 정리 (지속적)

1. 문서 정리 (수동 검토)
2. 미사용 의존성 확인 및 제거
3. 중복 타입 정의 정리

---

## ⚠️ 주의사항

### 삭제 전 필수 확인 사항

1. **사용처 검색**: 프로젝트 전체에서 해당 파일/함수 import 검색
2. **테스트 실행**: 삭제 전후로 테스트 실행
3. **빌드 확인**: 삭제 후 빌드 에러 확인
4. **Git 히스토리**: 삭제한 파일은 Git 히스토리에서 복구 가능하므로 안전하게 삭제 가능

### 하위 호환성 고려

- Deprecated 코드 중 일부는 하위 호환성을 위해 유지 중
- 점진적 마이그레이션 후 제거 권장
- 급하게 제거하지 말고 사용처를 먼저 마이그레이션

---

## 📊 예상 효과

### 코드 라인 감소

- **Deprecated 코드 제거**: ~5,000+ 라인
- **백업 파일 제거**: ~866 라인
- **외부 프레임워크 제거**: ~70,000+ 라인
- **스크립트 정리**: ~500 라인
- **총 예상 감소**: ~76,000+ 라인

### 번들 크기 감소

- **미사용 의존성 제거**: ~500KB-1MB (예상)
- **코드 제거**: ~100-200KB (예상)

### 유지보수성 향상

- **코드 복잡도 감소**: Deprecated 코드 제거로 혼란 감소
- **명확한 구조**: 중복 코드 제거로 구조 명확화
- **빌드 시간 단축**: 불필요한 파일 제거로 빌드 시간 단축

---

## 🔗 참고 문서

- [Deprecated 함수 사용처 목록](./deprecated-usage-inventory.md)
- [Plan Wizard 레거시 파일 전수 조사](./app/(student)/plan/new-group/LEGACY_FILES_AUDIT.md)
- [리팩토링 분석 리포트](./refactoring-analysis-report.md)

---

**작성일**: 2026-01-15  
**최종 업데이트**: 2026-01-15  
**상태**: 분석 완료, 실행 대기

