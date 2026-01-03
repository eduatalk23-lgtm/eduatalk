'use client';

import { useReducer, useCallback } from 'react';
import type {
  AdminWizardState,
  AdminWizardAction,
  WizardStep,
  SelectedContent,
  PlanPurpose,
} from './types';

const initialState: AdminWizardState = {
  currentStep: 1,
  periodStart: '',
  periodEnd: '',
  name: '',
  planPurpose: '',
  selectedContents: [],
  skipContents: false,
  generateAIPlan: false,
  isSubmitting: false,
  error: null,
  createdGroupId: null,
};

function wizardReducer(
  state: AdminWizardState,
  action: AdminWizardAction
): AdminWizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step };

    case 'NEXT_STEP':
      if (state.currentStep < 3) {
        return { ...state, currentStep: (state.currentStep + 1) as WizardStep };
      }
      return state;

    case 'PREV_STEP':
      if (state.currentStep > 1) {
        return { ...state, currentStep: (state.currentStep - 1) as WizardStep };
      }
      return state;

    case 'UPDATE_PERIOD':
      return {
        ...state,
        periodStart: action.periodStart,
        periodEnd: action.periodEnd,
      };

    case 'UPDATE_NAME':
      return { ...state, name: action.name };

    case 'UPDATE_PURPOSE':
      return { ...state, planPurpose: action.purpose };

    case 'TOGGLE_CONTENT': {
      const exists = state.selectedContents.find(
        (c) => c.contentId === action.content.contentId
      );
      if (exists) {
        return {
          ...state,
          selectedContents: state.selectedContents.filter(
            (c) => c.contentId !== action.content.contentId
          ),
        };
      }
      if (state.selectedContents.length >= 9) {
        return state; // 최대 9개
      }
      return {
        ...state,
        selectedContents: [...state.selectedContents, action.content],
      };
    }

    case 'UPDATE_CONTENT_RANGE':
      return {
        ...state,
        selectedContents: state.selectedContents.map((c) =>
          c.contentId === action.contentId
            ? { ...c, startRange: action.startRange, endRange: action.endRange }
            : c
        ),
      };

    case 'SET_SKIP_CONTENTS':
      return { ...state, skipContents: action.skip };

    case 'SET_GENERATE_AI':
      return { ...state, generateAIPlan: action.generate };

    case 'SET_SUBMITTING':
      return { ...state, isSubmitting: action.isSubmitting };

    case 'SET_ERROR':
      return { ...state, error: action.error };

    case 'SET_CREATED_GROUP_ID':
      return { ...state, createdGroupId: action.groupId };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

export function useAdminWizardState() {
  const [state, dispatch] = useReducer(wizardReducer, initialState);

  // Step navigation
  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);
  const setStep = useCallback(
    (step: WizardStep) => dispatch({ type: 'SET_STEP', step }),
    []
  );

  // Step 1 updates
  const updatePeriod = useCallback(
    (periodStart: string, periodEnd: string) =>
      dispatch({ type: 'UPDATE_PERIOD', periodStart, periodEnd }),
    []
  );
  const updateName = useCallback(
    (name: string) => dispatch({ type: 'UPDATE_NAME', name }),
    []
  );
  const updatePurpose = useCallback(
    (purpose: PlanPurpose) => dispatch({ type: 'UPDATE_PURPOSE', purpose }),
    []
  );

  // Step 2 updates
  const toggleContent = useCallback(
    (content: SelectedContent) => dispatch({ type: 'TOGGLE_CONTENT', content }),
    []
  );
  const updateContentRange = useCallback(
    (contentId: string, startRange: number, endRange: number) =>
      dispatch({ type: 'UPDATE_CONTENT_RANGE', contentId, startRange, endRange }),
    []
  );
  const setSkipContents = useCallback(
    (skip: boolean) => dispatch({ type: 'SET_SKIP_CONTENTS', skip }),
    []
  );

  // Step 3 updates
  const setGenerateAI = useCallback(
    (generate: boolean) => dispatch({ type: 'SET_GENERATE_AI', generate }),
    []
  );

  // Status updates
  const setSubmitting = useCallback(
    (isSubmitting: boolean) => dispatch({ type: 'SET_SUBMITTING', isSubmitting }),
    []
  );
  const setError = useCallback(
    (error: string | null) => dispatch({ type: 'SET_ERROR', error }),
    []
  );
  const setCreatedGroupId = useCallback(
    (groupId: string) => dispatch({ type: 'SET_CREATED_GROUP_ID', groupId }),
    []
  );
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  // Validation
  const isStep1Valid = useCallback(() => {
    if (!state.periodStart || !state.periodEnd) return false;
    const start = new Date(state.periodStart);
    const end = new Date(state.periodEnd);
    return start < end;
  }, [state.periodStart, state.periodEnd]);

  const isStep2Valid = useCallback(() => {
    // Step 2 is always valid (contents are optional)
    return true;
  }, []);

  const canSubmit = useCallback(() => {
    return isStep1Valid() && !state.isSubmitting;
  }, [isStep1Valid, state.isSubmitting]);

  return {
    state,
    // Navigation
    nextStep,
    prevStep,
    setStep,
    // Step 1
    updatePeriod,
    updateName,
    updatePurpose,
    // Step 2
    toggleContent,
    updateContentRange,
    setSkipContents,
    // Step 3
    setGenerateAI,
    // Status
    setSubmitting,
    setError,
    setCreatedGroupId,
    reset,
    // Validation
    isStep1Valid,
    isStep2Valid,
    canSubmit,
  };
}
