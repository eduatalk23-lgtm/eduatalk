# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TimeLevelUp** - A learning plan and grade management system built with Next.js 16 (App Router), TypeScript 5, Tailwind CSS 4, and Supabase.

## Common Commands

```bash
pnpm dev          # Start development server (port 3000)
pnpm build        # Production build
pnpm lint         # Run ESLint
pnpm test         # Run Vitest tests
pnpm test:watch   # Run tests in watch mode
pnpm analyze      # Bundle analysis (ANALYZE=true next build)
```

## Architecture

### Directory Structure

- `app/` - Next.js App Router pages with role-based route groups
  - `(admin)/` - Admin pages (`/admin/*`)
  - `(parent)/` - Parent pages (`/parent/*`)
  - `(student)/` - Student pages (`/dashboard`, `/today`, `/plan`, `/scores`, etc.)
  - `actions/` - Server Actions
  - `api/` - API routes
- `components/` - Reusable UI components (atoms, molecules, organisms pattern)
- `lib/` - Core utilities and business logic
  - `supabase/` - Supabase clients (client.ts, server.ts, admin.ts)
  - `auth/` - Authentication utilities
  - `domains/` - Domain-specific logic (plan, school, score, student, etc.)
  - `data/` - Data fetching functions
  - `hooks/` - Custom React hooks
- `supabase/migrations/` - Database migrations

### Key Patterns

**Supabase Clients:**
- `createSupabaseServerClient()` - For Server Components/Actions (rate-limit aware)
- `createSupabaseBrowserClient()` - For Client Components
- `createSupabaseAdminClient()` - For bypassing RLS (server-only)

**State Management:**
- React Query for server state (`lib/providers/QueryProvider.tsx`)
- Context API for client state (ToastProvider)

**Authentication Flow:**
- Role-based routing: student → `/dashboard`, admin → `/admin/dashboard`, parent → `/parent/dashboard`
- Use `getCurrentUser()` and `getCurrentUserRole()` from `lib/auth/`

### Next.js 15+ Specifics

Dynamic route params are Promises:
```typescript
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // ...
}
```

## Code Style Guidelines

### TypeScript
- **Never use `any`** - Use `unknown`, generics, or explicit types
- Handle `null` properly with optional chaining (`?.`) and nullish coalescing (`??`)
- Use type assertions (`as`) only after null checks

### Components
- PascalCase naming: `[Domain][Role][Variant]` (e.g., `CourseCard`, `StudentList`)
- Avoid: `Common`, `Base`, `Util` prefixes
- Single component → `export default`; utilities/hooks → named exports
- No unnecessary wrapper components (avoid div+className-only containers)

### Styling (Tailwind)
- **Spacing-First Policy**: Use `gap` for siblings, `padding` for containers; avoid `margin` for layout
- No inline `style={}` or styled-jsx
- Use `cn()` from `lib/cn.ts` for conditional classes
- Follow design system tokens for colors/typography

### File Structure
- Path alias: `@/*` → project root
- Prefer editing existing files over creating new ones
- No barrel exports (`index.ts`) for small component folders

## Database

Supabase with PostgreSQL. Migrations in `supabase/migrations/`. Uses Row Level Security (RLS).

Key tables: `students`, `student_plans`, `scores`, `plan_groups`, `blocks`, `tenants`
