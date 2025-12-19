# 캠프 참여자 대시보드 강화 Phase 4 구현 완료

## 📋 구현 완료 사항

### 1. 참여자 목록 페이지 개선 ✅

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/CampParticipantsList.tsx`

**추가된 기능**:
- 출석률 컬럼 추가
- 학습 시간 컬럼 추가
- 진행률 컬럼 추가
- 정렬 기능 추가 (출석률, 학습시간, 진행률, 이름)
- 학생명 클릭 시 상세 페이지로 이동

**데이터 로드 개선**:
- `loadCampParticipants()` 함수에 `includeStats` 옵션 추가
- 통계 정보 배치 조회로 성능 최적화

### 2. 참여자 통계 데이터 레이어 ✅

**파일**: `lib/data/campParticipantStats.ts` (신규)

구현된 함수:
- `getCampParticipantStatsBatch()`: 여러 참여자의 통계를 배치로 조회
- 출석 통계와 학습 통계를 병렬로 조회하여 성능 최적화

### 3. 참여자 상세 페이지 구현 ✅

**파일**: `app/(admin)/admin/camp-templates/[id]/participants/[studentId]/page.tsx`

**구현된 컴포넌트**:
- `CampParticipantDetailView`: 참여자 상세 뷰 메인 컴포넌트
- `CampParticipantStatsCards`: 통계 카드 (출석률, 학습 시간, 완료율, 완료된 플랜)
- `CampParticipantAttendanceHistory`: 출석 이력 섹션
- `CampParticipantLearningProgress`: 학습 진행 현황 섹션

**주요 기능**:
- 참여자 개별 통계 표시
- 출석 이력 (출석, 지각, 결석, 조퇴, 공결)
- 학습 진행 현황 (플랜 완료율, 과목별 학습 시간 분포)

### 4. 참여자 데이터 타입 확장 ✅

**파일**: `lib/data/campParticipants.ts`

**추가된 필드**:
- `attendance_rate`: 출석률 (선택적)
- `study_minutes`: 학습 시간 (선택적)
- `plan_completion_rate`: 플랜 완료율 (선택적)

## 🎨 UI 개선 사항

### 참여자 목록 테이블
- 출석률 색상 코딩 (90% 이상: 초록, 70% 이상: 노랑, 미만: 빨강)
- 학습 시간 표시 (시간/분)
- 진행률 색상 코딩 (80% 이상: 초록, 60% 이상: 노랑, 미만: 빨강)
- 정렬 가능한 컬럼 헤더 (클릭 시 정렬)
- 학생명 클릭 시 상세 페이지로 이동

### 참여자 상세 페이지
- 통계 카드로 주요 지표 표시
- 출석 이력 상세 정보
- 과목별 학습 시간 분포 (상위 5개)
- 학생 상세 페이지로 이동 링크

## 🔄 데이터 흐름

1. 참여자 목록 로드 → `loadCampParticipants(templateId, { includeStats: true })`
2. 통계 정보 배치 조회 → `getCampParticipantStatsBatch()`
3. 출석 통계 조회 → `getParticipantAttendanceStats()`
4. 학습 통계 조회 → `getParticipantLearningStats()`
5. 데이터 병합 및 표시

## 📊 정렬 기능

- **이름**: 가나다순 정렬
- **출석률**: 높은 순/낮은 순 정렬
- **학습 시간**: 많은 순/적은 순 정렬
- **진행률**: 높은 순/낮은 순 정렬
- 정렬 방향 토글 (오름차순/내림차순)

## 🎯 최적화 사항

1. **배치 조회**: 여러 참여자의 통계를 한 번에 조회
2. **병렬 처리**: 출석 통계와 학습 통계를 병렬로 조회
3. **메모이제이션**: 필터링 및 정렬 결과를 메모이제이션
4. **조건부 로드**: 통계 정보는 `includeStats` 옵션으로 선택적 로드

## 🔗 네비게이션

- 참여자 목록 → 참여자 상세 페이지
- 참여자 상세 → 학생 상세 페이지 (전체 출석 이력)
- 참여자 상세 → 참여자 목록 (뒤로 가기)

## 📝 참고 사항

- 통계 정보는 `accepted` 상태인 참여자만 조회
- 통계가 없는 경우 "—" 표시
- 정렬 시 null 값은 마지막에 배치
- 학생명 클릭 시 상세 페이지로 이동

