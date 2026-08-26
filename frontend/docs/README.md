# CampusFlow ERP — Frontend Documentation

Engineering documentation for the CampusFlow ERP frontend platform. This is a
**scalable architecture foundation**: core platform, providers, design system,
and feature scaffolding designed to support 100+ pages across many ERP modules
without restructuring.

## Contents

1. [Architecture](./architecture.md)
2. [Source Layout](./source-layout.md)
3. [Folder Structure](./folder-structure.md)
4. [Core Platform](./core-platform.md)
5. [API Layer](./api-layer.md)
6. [Response Handling](./response-handling.md)
7. [Providers](./providers.md)
8. [Layouts](./layouts.md)
9. [State Management](./state-management.md)
10. [Forms](./forms.md)
11. [Error Handling](./error-handling.md)
12. [Authentication Screens & Startup Flow](./authentication.md)
13. [Workspace Scope Platform](./workspace.md)
14. [Initial Setup Wizard](./workspace-setup-module.md)
15. [Dashboard Shell](./dashboard-shell.md)
16. [Guide / Walkthrough System](./guides.md)
17. [Administration Modules](./administration-modules.md)
18. [Organization Module](./organization-module.md)
19. [Branch Module](./branch-module.md)
20. [Academic Year Module](./academic-year-module.md)
21. [Program Module](./program-module.md)
22. [Academic Unit Module](./academic-unit-module.md)
23. [Communication Module UI Spec](./communication-module-ui-spec.md)
24. [Account & Security Center Module](./security-center-module.md)
25. [Workspace Admin Module](./workspace-admin-module.md)
26. [Admission Masters Module](./admission-masters-module.md)
27. [Applicant Admission Lifecycle](./admission-lifecycle-module.md)
28. [Documents Management Module](./documents-management-module.md)
29. [Numbering Module](./numbering-module.md)
30. [Backend Contract Gaps](./backend-gaps.md)
31. [Testing Strategy](./testing.md)
32. [Coding Standards](./coding-standards.md)
33. [Contribution Guide](./contributing.md)
34. [Future Theme Integration](./theme-integration.md)

## Tech Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4 ·
shadcn/ui (Radix) · TanStack Query/Table/Virtual · React Hook Form · Zod ·
Axios · Zustand · next-themes · Sonner · Motion · Lucide · Vitest · Playwright ·
MSW · ESLint · Prettier · Husky · lint-staged.

## Verification

```bash
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest unit/integration (jsdom)
pnpm build       # Next.js production build
```
