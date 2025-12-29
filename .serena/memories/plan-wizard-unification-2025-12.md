# Plan Wizard Unification (2025-12)

## Summary
Unified the plan creation system to improve usability and autonomy.

## Completed Work

### Phase 1: Wizard Component Cleanup
- Deleted legacy `QuickPlanWizard.tsx`, renamed `QuickPlanWizardUnified.tsx` → `QuickPlanWizard.tsx`
- Deleted legacy `ContentAddWizard.tsx`, renamed `ContentAddWizardUnified.tsx` → `ContentAddWizard.tsx`
- Removed `useUnifiedWizard` feature flag toggles from wrappers
- Added missing exports: `quickCreateFromContent`, `getSmartScheduleRecommendation`, `QuickCreateInput`

### Phase 2: Data Model Integration
- Added migration `add_plan_mode_to_plan_groups`:
  - `plan_mode` column: 'structured', 'content_based', 'quick', 'adhoc_migrated'
  - `is_single_day` boolean for quick plans
  - `migrated_from_adhoc_id` for ad_hoc_plans migration tracking
- Added `PlanMode` type to `lib/types/plan/domain.ts`
- Created `createQuickPlan()` function that uses `plan_groups` instead of `ad_hoc_plans`

### Phase 3: Unified Route
- Created `/plan/create` route with mode selector UI
- Supports mode query param: `?mode=full`, `?mode=quick`, `?mode=content`
- Redirects to appropriate wizard based on selection

## Key Files
- `app/(student)/plan/create/page.tsx` - Unified entry point
- `app/(student)/plan/create/_components/ModeSelector.tsx` - Mode selection UI
- `lib/domains/plan/actions/contentPlanGroup.ts` - Contains `createQuickPlan()`
- `lib/types/plan/domain.ts` - Contains `PlanMode` type

## Completed Phase 4: View Integration

### Calendar View
- Added `plan_mode` and `is_single_day` to SELECT queries in `lib/data/planGroups.ts`
- Updated both `getPlanGroupsForStudent()` and `getPlanGroupById()` functions
- Quick plans are now properly fetched and displayed in calendar

### Today View
- Updated `QuickPlanWizard` to use `createQuickPlan()` instead of `createStudentAdHocPlan()`
- Quick plans created via the wizard now go into `plan_groups` + `student_plan`
- Backward compatible: old `ad_hoc_plans` still displayed via existing query

### Data Flow
```
QuickPlanWizard
  → createQuickPlan() [lib/domains/plan/actions/contentPlanGroup.ts]
    → INSERT plan_groups (plan_mode='quick', is_single_day=true)
    → INSERT student_plan (linked to plan_group)
  
Calendar View
  → getPlanGroupsForStudent() [lib/data/planGroups.ts]
    → SELECT with plan_mode, is_single_day
  → getPlansForStudent() 
    → Fetches student_plan by plan_group_ids

Today View
  → getTodayContainerPlans() [lib/domains/today/actions/containerPlans.ts]
    → Fetches both student_plan AND ad_hoc_plans (backward compat)
```

## All Work Completed