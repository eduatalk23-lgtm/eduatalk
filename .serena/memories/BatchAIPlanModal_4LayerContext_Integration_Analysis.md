# BatchAIPlanModal to 4-Layer Context Integration Analysis

## Current Implementation (BatchAIPlanModal.tsx)

### State Management Pattern
**Current: Fragmented useState Pattern (12+ independent states)**

```
- Modal Navigation State:
  * step: "settings" | "preview" | "progress" | "results"
  * isLoading: boolean

- Settings State:
  * settings: BatchPlanSettings
  * estimatedCost: CostData | null

- Progress State:
  * progress: number
  * currentStudent: string
  * results: StudentPlanResult[]
  * finalResult: BatchPlanGenerationResult | null

- Preview State (Phase 3):
  * previewResult: BatchPreviewResult | null
  * selectedStudentIds: string[]
  * previewStudents: Array<{studentId, contentIds}>

- Retry State (Phase 2):
  * retryMode: boolean
  * selectedRetryIds: string[]
  * originalContentsMap: Map<string, string[]>

- Refs:
  * abortControllerRef: AbortController | null
```

### Issues with Current Pattern
1. **No Separation of Concerns**: All state changes scattered across 12+ setState calls
2. **Tight Coupling**: Step navigation mixed with data/progress states
3. **No Type Safety for Actions**: Direct setState calls without action types
4. **Manual Cleanup**: useEffect for modal close handles 10+ state resets
5. **Callback Hell**: 4 main handlers (handlePreview, handleSaveFromPreview, handleStart, handleRetry) with complex SSE logic
6. **No Validation State**: Errors/warnings handled via showError/showSuccess instead of state
7. **No Dirty Tracking**: No tracking of unsaved changes
8. **Poor Performance**: Each setState triggers re-render of entire component + all children
9. **Hard to Test**: Complex intertwined state logic difficult to unit test
10. **No Reducer Pattern**: No centralized action handling

### Error Handling
- Ad-hoc error handling via Toast
- No centralized error state
- No field-level validation errors
- Errors logged to console but not tracked in state

### Data Flow
1. User changes settings → setState
2. Settings change triggers cost estimation
3. User clicks action (Preview/Start) → Complex async handler
4. Handler manages SSE stream + multiple setState calls
5. Child components receive props from parent state

---

## Desired 4-Layer Context Pattern

### Layer 1: Step Context (Navigation)
```typescript
AdminWizardStepContextValue {
  currentStep: WizardStep
  totalSteps: number
  nextStep: () => void
  prevStep: () => void
  setStep: (step) => void
  canGoNext: boolean
  canGoPrev: boolean
}
```

### Layer 2: Data Context
```typescript
AdminWizardDataContextValue {
  wizardData: AdminWizardData
  initialWizardData: AdminWizardData
  isDirty: boolean
  isSubmitting: boolean
  error: string | null
  updateData: (updates) => void
  updateDataFn: (fn) => void
  setDraftId: (id) => void
  setCreatedGroupId: (id) => void
  setSubmitting: (bool) => void
  setError: (error) => void
  resetDirtyState: () => void
  reset: () => void
}
```

### Layer 3: Validation Context
```typescript
AdminWizardValidationContextValue {
  validationErrors: string[]
  validationWarnings: string[]
  fieldErrors: Map<string, string>
  setErrors: (errors) => void
  setWarnings: (warnings) => void
  setFieldError: (field, error) => void
  setFieldErrors: (errors) => void
  clearFieldError: (field) => void
  clearValidation: () => void
  hasErrors: boolean
  hasWarnings: boolean
}
```

### Layer 4: Unified Reducer
```typescript
wizardReducer(state, action) handles:
- DataAction (UPDATE_DATA, SET_DRAFT_ID, etc.)
- StepAction (NEXT_STEP, PREV_STEP, SET_STEP)
- ValidationAction (SET_ERRORS, SET_FIELD_ERROR, etc.)
```

### Provider Structure
```
<AdminWizardProvider> (houses useReducer + all logic)
  ├─ <AdminWizardDataProvider> (data context only)
  ├─ <AdminWizardStepProvider> (navigation context only)
  └─ <AdminWizardValidationProvider> (validation context only)
```

---

## Gap Analysis: Current vs Desired

### 1. State Organization

| Aspect | Current | Desired | Impact |
|--------|---------|---------|--------|
| Number of useState | 12+ | 1 useReducer | Centralized state management |
| State Grouping | Scattered | 4 logical groups | Clear separation of concerns |
| Action Pattern | Direct setState | Unified reducer | Type-safe actions |
| Error Tracking | Toast notifications | State + validation | Persistent error state |
| Dirty Tracking | None | Debounced comparison | Auto-save support |

### 2. Context Layer Design

**Current:**
- No Context API usage
- All state in component
- Props drilling if extracted

**Desired:**
- Layer 1 (Step): For navigation-only components
- Layer 2 (Data): For form/data components
- Layer 3 (Validation): For validation display
- Layer 4 (Unified): For backward compatibility

**Benefit:** Components only subscribe to context they need → fewer re-renders

### 3. Data Types Mapping

**Settings State → Data Context:**
```
BatchPlanSettings {
  startDate: string
  endDate: string
  dailyStudyMinutes: number
  prioritizeWeakSubjects: boolean
  balanceSubjects: boolean
  includeReview: boolean
  modelTier: ModelTier
}

→ Maps to AdminWizardData (adapted)
```

**Progress State → Data Context:**
```
Progress tracking would be in wizardData:
- isSubmitting: boolean (from Data Context)
- error: string | null (from Data Context)
- createdGroupId: string | null (tracked in state)
```

**Preview/Retry State → Data Context:**
```
Would extend AdminWizardData with:
- previewResults?: BatchPreviewResult
- selectedStudentIds?: string[]
- retryMode?: boolean
```

### 4. Action Dispatching

**Current:**
```typescript
// Settings change
setSettings({...settings, modelTier: 'standard'})

// Cost estimation
setEstimatedCost(result)

// Progress update
setProgress(50)
setCurrentStudent(name)

// Results
setFinalResult(result)
setRetryMode(true)
```

**Desired:**
```typescript
// Settings change
dispatch({
  type: 'UPDATE_DATA',
  payload: { modelTier: 'standard' }
})

// Progress update (no action, read from state.isSubmitting)
dispatch({
  type: 'SET_SUBMITTING',
  payload: true
})

// Error handling
dispatch({
  type: 'SET_ERROR',
  payload: 'Generation failed'
})

// Step change
dispatch({
  type: 'SET_STEP',
  payload: 'progress'
})
```

### 5. Component Performance

**Current:**
```
Parent state change → Entire component re-renders
→ All child components re-render
→ All handlers recreated
→ All icons/SVGs re-rendered
```

**Desired:**
```
Parent state change → Only affected Context triggers re-render
→ Only components using that context re-render
→ Other layers unaffected
→ Better performance, especially for large forms
```

### 6. Error Handling Workflow

**Current:**
```
Error → showError(msg) → Toast → No state tracking
```

**Desired:**
```
Error → dispatch({type: 'SET_ERROR', payload: msg})
→ Stored in state.error
→ Display from validation context
→ Can retry on error with error state
→ Better UX with persistent error info
```

---

## Integration Steps Required

### Phase 1: Data Structure Adaptation
1. Map BatchPlanSettings → AdminWizardData subset
2. Add preview/retry specific fields to AdminWizardData
3. Define initial state generation

### Phase 2: Reducer Implementation
1. Create batchAIPlanReducer handling batch-specific actions
2. Map existing useState logic to reducer cases
3. Implement dirty state comparison
4. Add error state management

### Phase 3: Context Refactoring
1. Create BatchAIPlanProvider (or extend AdminWizardProvider)
2. Implement 4 context layers
3. Create custom hooks (useBatchAIPlanData, useBatchAIPlanStep, etc.)
4. Provider nesting/composition

### Phase 4: Component Refactoring
1. Replace useState with useContext hooks
2. Convert callbacks to dispatch actions
3. Extract step components (SettingsStep, ProgressStep, etc.)
4. Each step component uses only needed contexts

### Phase 5: Advanced Features
1. Auto-save using isDirty state
2. Debounced dirty checking (already implemented in AdminWizardContext)
3. Validation before navigation
4. Error recovery UI

---

## Key Differences: BatchAIPlanModal vs AdminWizardContext

### BatchAIPlanModal Specifics
- **4 Steps** (vs Admin Wizard 7 steps): settings → preview → progress → results
- **SSE Streaming**: Real-time progress updates via AbortController
- **Retry Logic**: Failed student re-processing
- **Cost Estimation**: Dynamic cost calculation
- **Preview Step**: Pre-save visualization

### What AdminWizardContext Provides
- Debounced dirty state tracking
- Field-level error validation
- Typed reducer pattern with action guards
- 4-layer context optimization
- Draft ID management (for auto-save)
- Initial state comparison for dirty tracking

### What BatchAIPlanModal Needs to Add
- Progress tracking (progress, currentStudent) → Could use isSubmitting + custom state
- Retry state management → New action type needed
- Preview results → Store in wizardData
- SSE streaming control → Keep ref pattern, add to dispatch logic

---

## Implementation Strategy

### Option 1: Use Existing AdminWizardContext
**Pros:**
- Reuse tested 4-layer pattern
- Consistent with student wizard
- Built-in dirty tracking

**Cons:**
- Over-engineered for 4-step modal
- 7 steps vs 4 steps mismatch
- Batch-specific logic (retry, preview) needs extension

### Option 2: Create Specialized BatchAIPlanContext
**Pros:**
- Tailored to 4-step flow
- Optimized for batch operations
- Simpler than full wizard

**Cons:**
- New context to maintain
- Duplicate pattern from AdminWizardContext
- Less consistency with codebase

### Option 3: Hybrid Approach
**Pros:**
- Reuse AdminWizardContext structure
- Customize for batch operations
- Keeps consistency

**Cons:**
- Requires conditional logic in provider
- May feel forced to fit batch into wizard pattern

### Recommended: Option 1 (Adapted AdminWizardContext)
Adapt AdminWizardContext for batch operations:
- Use existing 4-layer pattern (proven/tested)
- Extend AdminWizardData with batch-specific fields
- Add batch-specific actions to reducer
- Reuse validation context for error tracking
- Leverage built-in dirty state tracking for future auto-save
