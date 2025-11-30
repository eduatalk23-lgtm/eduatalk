# 스케줄 미리보기 개선 작업 (2025-11-30)

## 개요

Step2_5SchedulePreview 컴포넌트의 사용성 및 성능을 개선하기 위해 하이브리드 갱신 전략을 구현하고, 사용자 친화적인 UI/UX 개선을 적용했습니다.

## 주요 변경사항

### 1. 하이브리드 갱신 전략 구현

#### 1.1 상태 관리 추가
- `isInitialLoad`: 최초 로드 여부 추적
- `lastCalculatedAt`: 마지막 계산 시간 (캐시 표시용)
- `isFromCache`: 캐시 사용 여부
- `loadingStage`: 로딩 단계 표시 (블록 조회 → 스케줄 계산 → 완료)

#### 1.2 갱신 로직
- **최초 진입**: "스케줄 확인하기" 버튼 표시 (수동 계산)
- **이후 변경**: 블록/제외일/학원일정 변경 시 자동 재계산
- **수동 갱신**: "다시 계산하기" 버튼 (Shift+클릭으로 캐시 무시)

### 2. 캐시 시스템 개선

#### 파일: `lib/utils/scheduleCache.ts`

**추가된 메서드:**
- `getWithTimestamp()`: 결과와 함께 타임스탬프 반환
- `invalidate()`: 특정 파라미터의 캐시 무효화

**새로운 타입:**
```typescript
export type CacheResultWithTimestamp = {
  result: ScheduleAvailabilityResult;
  timestamp: number;
  isFromCache: boolean;
};
```

### 3. UI/UX 개선

#### 3.1 최초 로드 UI
- 중앙 정렬된 "스케줄 확인하기" 버튼
- 캘린더 아이콘과 안내 문구
- 필수 정보 미입력 시 비활성화 및 안내

#### 3.2 로딩 상태 개선
- 진행 단계 표시 ("블록 조회 중..." → "스케줄 계산 중..." → "완료")
- 스켈레톤 UI (5개 통계 카드)
- 예상 소요 시간 안내

#### 3.3 캐시 인디케이터
- 캐시 사용 시: 회색 배지 "캐시 (2분 전)"
- 새로 계산 시: 초록색 배지 "새로 계산됨"
- 상대 시간 표시 (초/분/시간/일 단위)

#### 3.4 헤더 레이아웃
```
[스케줄 가능 날짜 확인] [캐시 배지]           [다시 계산하기 버튼]
설명 텍스트
```

### 4. 제외일 통계 표시

WeekSection 컴포넌트에 제외일 통계 추가:
```typescript
{weekExclusionDays > 0 && (
  <span className="text-gray-500">제외일 {weekExclusionDays}일</span>
)}
```

### 5. 에러 처리 개선

#### 5.1 사용자 친화적 에러 메시지
- 블록 조회 실패: 일반 모드/캠프 모드 구분 안내
- 네트워크 오류: 명확한 재시도 안내
- time_slots 생성 실패: 블록 설정 확인 안내

#### 5.2 개발 모드 디버그 로깅
```typescript
if (process.env.NODE_ENV === 'development') {
  console.log('[Step2_5SchedulePreview] 캐시 히트:', {...});
  console.log('[Step2_5SchedulePreview] 계산 완료:', {...});
  console.error('[Step2_5SchedulePreview] 계산 실패:', err);
}
```

### 6. time_slots 검증 강화

#### 파일: `lib/scheduler/calculateAvailableDates.ts`

개발 모드에서 다음 검증 수행:
- 계산된 시간과 타임라인 시간 불일치 경고 (0.5시간 이상)
- 학습일/복습일인데 time_slots가 비어있는 경우 경고
- 블록 개수 및 학원일정 개수 로깅

## 사용자 플로우

### 시나리오 1: 최초 진입
1. 사용자가 Step 2.5로 이동
2. "스케줄 확인하기" 버튼 표시
3. 버튼 클릭 → 계산 시작
4. 로딩 단계 표시 (블록 조회 → 계산 중 → 완료)
5. 결과 표시 + "새로 계산됨" 배지

### 시나리오 2: 블록 변경
1. 사용자가 Step 1에서 블록 수정
2. Step 2.5로 돌아옴
3. 자동으로 재계산 시작
4. 결과 업데이트

### 시나리오 3: 캐시 히트
1. 사용자가 다른 Step으로 이동 후 Step 2.5로 복귀
2. 캐시된 결과 즉시 표시
3. "캐시 (2분 전)" 배지 표시
4. 필요 시 "다시 계산하기" 버튼 클릭

### 시나리오 4: 강제 갱신
1. "다시 계산하기" 버튼 Shift+클릭
2. 캐시 무시하고 강제 재계산
3. "새로 계산됨" 배지 표시

## 성능 영향

### 긍정적 영향
- 최초 로드 시 자동 계산 방지 → 불필요한 API 호출 감소
- 캐시 활용 강화 → 동일 조건 재계산 방지
- 상대 시간 표시 → 캐시 유효성 직관적 확인

### 주의사항
- 5분 TTL 유지 (기존과 동일)
- 최대 10개 캐시 항목 (기존과 동일)

## 테스트 체크리스트

### 일반 모드
- [ ] 최초 진입 시 "확인하기" 버튼 표시
- [ ] 블록 변경 시 자동 재계산
- [ ] 제외일 추가 시 자동 재계산
- [ ] 캐시 히트 시 "캐시 (N분 전)" 배지 표시
- [ ] "다시 계산하기" 클릭 시 재계산
- [ ] Shift+클릭 시 캐시 무시

### 캠프 모드
- [ ] 템플릿 블록 조회 성공
- [ ] 제외일 통계 표시
- [ ] 에러 발생 시 "템플릿 블록을 불러올 수 없습니다" 메시지

### 공통
- [ ] 로딩 단계 표시 ("블록 조회 중" → "스케줄 계산 중")
- [ ] 스켈레톤 UI 표시
- [ ] 제외일 통계 표시 (WeekSection)
- [ ] 개발 모드에서 콘솔 로그 출력

## 파일 변경 목록

1. `lib/utils/scheduleCache.ts` - 캐시 시스템 개선
2. `app/(student)/plan/new-group/_components/Step2_5SchedulePreview.tsx` - 메인 UI 및 로직
3. `lib/scheduler/calculateAvailableDates.ts` - time_slots 검증 추가
4. `docs/schedule-preview-improvement-2025-11-30.md` - 이 문서

## 마이그레이션 가이드

### 기존 사용자 영향
- 기존 캐시는 자동으로 호환됨
- UI 변경으로 인한 재학습 필요 없음 (더 직관적)
- 최초 진입 시 한 번의 클릭 필요 (자동 계산 → 수동 확인)

### 개발자 가이드
```typescript
// 캐시 무효화가 필요한 경우
scheduleCache.invalidate(params);

// 타임스탬프와 함께 캐시 조회
const cached = scheduleCache.getWithTimestamp(params);
if (cached) {
  console.log('캐시된 지', Date.now() - cached.timestamp, 'ms');
}
```

## 향후 개선 사항

1. **캐시 영속화**: localStorage 활용하여 페이지 새로고침 시에도 캐시 유지
2. **실시간 갱신**: WebSocket 활용하여 관리자가 템플릿 수정 시 실시간 반영
3. **배치 계산**: 여러 플랜 그룹의 스케줄을 한 번에 계산
4. **오프라인 지원**: Service Worker를 통한 오프라인 계산 지원

## 관련 문서

- [스케줄 계산 로직](../lib/scheduler/calculateAvailableDates.ts)
- [캐시 시스템](../lib/utils/scheduleCache.ts)
- [프로젝트 구조](./project_rule.mdc)

