# 캠프 학습 통계 및 리포트 Phase 2 구현 완료

## 📋 구현 완료 사항

### 1. 타입 정의 추가 ✅

**파일**: `lib/domains/camp/types.ts`

- `CampLearningStats`: 캠프 학습 통계 타입
- `ParticipantLearningStats`: 참여자별 학습 통계 타입

### 2. 학습 통계 도메인 레이어 구현 ✅

**파일**: `lib/domains/camp/learningStats.ts`

구현된 함수:
- `calculateCampLearningStats()`: 캠프별 학습 통계 계산
- `getParticipantLearningStatsForCamp()`: 참여자별 학습 통계 조회

### 3. 학습 통계 데이터 레이어 구현 ✅

**파일**: `lib/data/campLearningStats.ts`

구현된 함수:
- `getCampLearningStats()`: 캠프별 학습 통계 계산
- `getParticipantLearningStats()`: 참여자별 학습 통계 조회

**데이터 흐름**:
1. 캠프 템플릿 및 초대 목록 조회
2. 플랜 그룹 조회 (camp_template_id, plan_type='camp')
3. 플랜 조회 (plan_group_id로 필터링)
4. 학습 세션 조회 (plan_id로 필터링)
5. 학습 시간 및 완료율 계산

### 4. 리포트 생성 기능 구현 ✅

**파일**: `lib/reports/camp.ts`

구현된 함수:
- `getCampReportData()`: 캠프 리포트 데이터 수집
- `generateCampAttendanceReport()`: 출석 리포트 생성
- `generateCampLearningReport()`: 학습 리포트 생성
- `generateCampFullReport()`: 통합 리포트 생성

**타입 정의**:
- `CampReportData`: 캠프 리포트 데이터 타입

### 5. 관리자 리포트 페이지 구현 ✅

**파일**: `app/(admin)/admin/camp-templates/[id]/reports/page.tsx`

- 캠프 리포트 대시보드 페이지
- 권한 검증 (admin, consultant)
- 템플릿 존재 여부 확인

### 6. 리포트 컴포넌트 구현 ✅

#### `CampReportDashboard`
- 리포트 대시보드 메인 컴포넌트
- 출석 및 학습 리포트 통합 표시

#### `CampReportSummaryCards`
- 총 참여자 수
- 출석률
- 총 학습 시간
- 평균 학습 시간 (참여자당)

#### `CampAttendanceReportSection`
- 출석률, 지각률, 결석률 통계
- 참여자별 출석 현황 테이블

#### `CampLearningReportSection`
- 총 학습 시간 및 평균 학습 시간
- 참여자별 학습 현황 테이블
- 플랜 완료율 표시
- 주요 과목 표시 (학습 시간 상위 3개)

### 7. 네비게이션 추가 ✅

**파일**: `app/(admin)/admin/camp-templates/[id]/CampTemplateDetail.tsx`

- 템플릿 상세 페이지에 "리포트" 링크 추가

## 🔗 데이터 연결 관계

```
camp_templates
  ↓
camp_invitations (status='accepted')
  ↓
plan_groups (camp_template_id, plan_type='camp')
  ↓
student_plan (plan_group_id)
  ↓
student_study_sessions (plan_id)
```

## 📊 주요 기능

### 학습 통계 계산
- 총 학습 시간 집계 (분 단위)
- 참여자별 평균 학습 시간 계산
- 플랜 완료율 계산
- 과목별 학습 시간 분포

### 리포트 생성
- 출석 리포트: 출석률, 지각률, 결석률
- 학습 리포트: 학습 시간, 완료율, 과목 분포
- 통합 리포트: 출석 + 학습 통계 통합

### 참여자별 현황
- 학습 시간 표시 (시간/분)
- 플랜 완료율 색상 코딩 (80% 이상: 초록, 60% 이상: 노랑, 미만: 빨강)
- 주요 과목 표시 (학습 시간 상위 3개)

## 🎯 최적화 사항

1. **배치 조회**: 플랜 그룹, 플랜, 학습 세션을 배치로 조회하여 N+1 문제 방지
2. **병렬 처리**: 출석 통계와 학습 통계를 병렬로 조회
3. **데이터 집계**: 클라이언트 사이드에서 통계 계산하여 서버 부하 감소

## 🔄 다음 단계 (Phase 3)

- [ ] 통계 계산 유틸리티 통합 (lib/utils/statistics.ts)
- [ ] React Query 캐싱 전략 개선
- [ ] 데이터베이스 쿼리 최적화 (인덱스 추가)
- [ ] 참여자 대시보드 강화 (출석률, 학습시간 컬럼 추가)

## 📝 참고 사항

- 기존 `student_study_sessions` 테이블의 `duration_seconds` 사용
- `student_plan` 테이블의 `completed_amount`로 완료율 계산
- 과목 정보는 `student_plan.subject`에서 추출
- 캠프 기간은 `camp_templates.camp_start_date`, `camp_end_date` 사용

