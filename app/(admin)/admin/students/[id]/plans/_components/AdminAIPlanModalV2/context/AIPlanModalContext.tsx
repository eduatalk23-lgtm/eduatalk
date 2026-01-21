'use client';

import { createContext, useContext, useReducer, useMemo, type ReactNode, type Dispatch } from 'react';
import {
  type ModalState,
  type ModalAction,
  type ContentSlot,
  type SlotType,
  type WizardStep,
  createNewSlot,
} from '@/lib/domains/admin-plan/types/aiPlanSlot';

// ============================================================================
// 초기 상태
// ============================================================================

const initialState: ModalState = {
  currentStep: 1,
  selectedPlannerId: null,
  slots: [],
  periodStart: '',
  periodEnd: '',
  generationResult: null,
  isLoading: false,
  error: null,
};

// ============================================================================
// Reducer
// ============================================================================

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step, error: null };

    case 'SET_PLANNER':
      return { ...state, selectedPlannerId: action.plannerId, error: null };

    case 'SET_PERIOD':
      return {
        ...state,
        periodStart: action.periodStart,
        periodEnd: action.periodEnd,
      };

    case 'ADD_SLOT': {
      const newSlot = createNewSlot(action.slotType, state.slots.length);
      return { ...state, slots: [...state.slots, newSlot] };
    }

    case 'REMOVE_SLOT': {
      const filteredSlots = state.slots.filter(s => s.id !== action.slotId);
      // 순서 재정렬
      const reorderedSlots = filteredSlots.map((slot, index) => ({
        ...slot,
        displayOrder: index,
      }));
      return { ...state, slots: reorderedSlots };
    }

    case 'UPDATE_SLOT':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? { ...slot, ...action.updates }
            : slot
        ),
      };

    case 'REORDER_SLOT': {
      const slots = [...state.slots];
      const slotIndex = slots.findIndex(s => s.id === action.slotId);
      if (slotIndex === -1) return state;

      const [movedSlot] = slots.splice(slotIndex, 1);
      slots.splice(action.newOrder, 0, movedSlot);

      return {
        ...state,
        slots: slots.map((slot, index) => ({
          ...slot,
          displayOrder: index,
        })),
      };
    }

    case 'SET_AI_CONFIG':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? { ...slot, aiConfig: action.config, status: 'configuring' }
            : slot
        ),
      };

    case 'SET_AI_RESULT':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? {
                ...slot,
                aiResult: action.result,
                status: 'preview',
              }
            : slot
        ),
      };

    case 'SELECT_RECOMMENDATION':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId && slot.aiResult
            ? {
                ...slot,
                aiResult: {
                  ...slot.aiResult,
                  selectedContent: action.content,
                },
                // 범위 자동 설정 (전체 범위)
                rangeConfig: {
                  startRange: 1,
                  endRange: action.content.totalRange,
                },
              }
            : slot
        ),
      };

    case 'SET_EXISTING_CONTENT':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? {
                ...slot,
                existingContent: action.content,
                status: 'preview',
                // 범위 자동 설정 (전체 범위)
                rangeConfig: {
                  startRange: 1,
                  endRange: action.content.totalRange,
                },
              }
            : slot
        ),
      };

    case 'SET_RANGE_CONFIG':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? { ...slot, rangeConfig: action.rangeConfig }
            : slot
        ),
      };

    case 'SET_SUBJECT_CLASSIFICATION':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? {
                ...slot,
                subjectClassification: action.classification,
                // 취약 과목이면 전략 설정 제거
                strategicConfig: action.classification === 'weakness' ? undefined : slot.strategicConfig,
              }
            : slot
        ),
      };

    case 'SET_STRATEGIC_CONFIG':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? { ...slot, strategicConfig: action.config }
            : slot
        ),
      };

    case 'CONFIRM_SLOT':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? { ...slot, status: 'confirmed' }
            : slot
        ),
      };

    case 'SET_SLOT_ERROR':
      return {
        ...state,
        slots: state.slots.map(slot =>
          slot.id === action.slotId
            ? { ...slot, status: 'error', errorMessage: action.error }
            : slot
        ),
      };

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_GENERATION_RESULT':
      return { ...state, generationResult: action.result };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface AIPlanModalContextValue {
  state: ModalState;
  dispatch: Dispatch<ModalAction>;
}

const AIPlanModalContext = createContext<AIPlanModalContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

interface AIPlanModalProviderProps {
  children: ReactNode;
  initialPlannerId?: string | null;
  initialPeriodStart?: string;
  initialPeriodEnd?: string;
}

export function AIPlanModalProvider({
  children,
  initialPlannerId,
  initialPeriodStart,
  initialPeriodEnd,
}: AIPlanModalProviderProps) {
  const [state, dispatch] = useReducer(modalReducer, {
    ...initialState,
    selectedPlannerId: initialPlannerId ?? null,
    periodStart: initialPeriodStart ?? '',
    periodEnd: initialPeriodEnd ?? '',
  });

  return (
    <AIPlanModalContext.Provider value={{ state, dispatch }}>
      {children}
    </AIPlanModalContext.Provider>
  );
}

// ============================================================================
// Custom Hook
// ============================================================================

export function useAIPlanModal() {
  const context = useContext(AIPlanModalContext);
  if (!context) {
    throw new Error('useAIPlanModal must be used within AIPlanModalProvider');
  }
  return context;
}

// ============================================================================
// 액션 헬퍼 Hook
// ============================================================================

export function useAIPlanModalActions() {
  const { dispatch } = useAIPlanModal();

  return useMemo(() => ({
    // 스텝 관련
    setStep: (step: WizardStep) => dispatch({ type: 'SET_STEP', step }),
    nextStep: () => dispatch({ type: 'SET_STEP', step: 2 }), // Placeholder
    prevStep: () => dispatch({ type: 'SET_STEP', step: 1 }), // Placeholder

    // 플래너 관련
    setPlanner: (plannerId: string) => dispatch({ type: 'SET_PLANNER', plannerId }),
    setPeriod: (periodStart: string, periodEnd: string) =>
      dispatch({ type: 'SET_PERIOD', periodStart, periodEnd }),

    // 슬롯 관련
    addSlot: (slotType: SlotType) => dispatch({ type: 'ADD_SLOT', slotType }),
    removeSlot: (slotId: string) => dispatch({ type: 'REMOVE_SLOT', slotId }),
    updateSlot: (slotId: string, updates: Partial<ContentSlot>) =>
      dispatch({ type: 'UPDATE_SLOT', slotId, updates }),

    // AI 관련
    setAIConfig: (slotId: string, config: ContentSlot['aiConfig']) =>
      config && dispatch({ type: 'SET_AI_CONFIG', slotId, config }),
    setAIResult: (slotId: string, result: ContentSlot['aiResult']) =>
      result && dispatch({ type: 'SET_AI_RESULT', slotId, result }),
    selectRecommendation: (slotId: string, content: NonNullable<ContentSlot['aiResult']>['selectedContent']) =>
      content && dispatch({ type: 'SELECT_RECOMMENDATION', slotId, content }),

    // 기존 콘텐츠 관련
    setExistingContent: (slotId: string, content: NonNullable<ContentSlot['existingContent']>) =>
      dispatch({ type: 'SET_EXISTING_CONTENT', slotId, content }),

    // 범위/분류 관련
    setRangeConfig: (slotId: string, rangeConfig: NonNullable<ContentSlot['rangeConfig']>) =>
      dispatch({ type: 'SET_RANGE_CONFIG', slotId, rangeConfig }),
    setSubjectClassification: (slotId: string, classification: NonNullable<ContentSlot['subjectClassification']>) =>
      dispatch({ type: 'SET_SUBJECT_CLASSIFICATION', slotId, classification }),
    setStrategicConfig: (slotId: string, config: NonNullable<ContentSlot['strategicConfig']>) =>
      dispatch({ type: 'SET_STRATEGIC_CONFIG', slotId, config }),

    // 슬롯 상태 관련
    confirmSlot: (slotId: string) => dispatch({ type: 'CONFIRM_SLOT', slotId }),
    setSlotError: (slotId: string, error: string) =>
      dispatch({ type: 'SET_SLOT_ERROR', slotId, error }),
    setSlotLoading: (slotId: string) =>
      dispatch({ type: 'UPDATE_SLOT', slotId, updates: { status: 'loading' } }),

    // 전역 상태 관련
    setLoading: (isLoading: boolean) => dispatch({ type: 'SET_LOADING', isLoading }),
    setError: (error: string | null) => dispatch({ type: 'SET_ERROR', error }),
    setGenerationResult: (result: NonNullable<ModalState['generationResult']>) =>
      dispatch({ type: 'SET_GENERATION_RESULT', result }),
    reset: () => dispatch({ type: 'RESET' }),
  }), [dispatch]);
}

// ============================================================================
// 선택자 Hooks
// ============================================================================

export function useAIPlanModalSelectors() {
  const { state } = useAIPlanModal();

  const confirmedSlots = state.slots.filter(s => s.status === 'confirmed');
  const aiSlots = state.slots.filter(s => s.type === 'ai_recommendation');
  const existingSlots = state.slots.filter(s => s.type === 'existing_content');
  const strategicSlots = confirmedSlots.filter(s => s.subjectClassification === 'strategic');
  const weaknessSlots = confirmedSlots.filter(s => s.subjectClassification === 'weakness');

  return {
    // 슬롯 관련
    slots: state.slots,
    confirmedSlots,
    aiSlots,
    existingSlots,
    strategicSlots,
    weaknessSlots,

    // 상태 관련
    currentStep: state.currentStep,
    selectedPlannerId: state.selectedPlannerId,
    periodStart: state.periodStart,
    periodEnd: state.periodEnd,
    isLoading: state.isLoading,
    error: state.error,
    generationResult: state.generationResult,

    // 파생 상태
    totalSlots: state.slots.length,
    confirmedCount: confirmedSlots.length,
    canProceedToStep3: state.slots.length > 0 && aiSlots.every(s => s.aiConfig?.subjectCategory),
    canGenerate: confirmedSlots.length > 0 && confirmedSlots.length === state.slots.length,
    hasAnyAISlot: aiSlots.length > 0,
    hasAnyExistingSlot: existingSlots.length > 0,

    // 전략 과목 주간 배정일 합계
    totalStrategicDays: strategicSlots.reduce(
      (sum, s) => sum + (s.strategicConfig?.weeklyDays ?? 0),
      0
    ),
  };
}
