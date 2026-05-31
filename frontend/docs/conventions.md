# EduOS — Developer Conventions

## shadcn/ui Configuration

| Setting | Value |
|---|---|
| Style | **Radix** (clean, utility-first primitives) |
| Preset | **Nova** (modern, refined visual language) |
| CSS variables | `oklch` color space (native shadcn token system) |
| Icon library | Lucide React |
| Utility | `cn()` from `@/lib/utils` |

### Two CSS variable systems — how they coexist

EduOS uses two parallel CSS variable systems that work together:

**EduOS design tokens** (in `globals.css`, RGB space-separated):
```css
--color-primary: 10 10 10;   /* used as: rgb(var(--color-primary)) */
```
These power the custom ERP design system, Theme Studio overrides, and all application components.

**shadcn/ui tokens** (added by `shadcn init`, oklch):
```css
--primary: oklch(0.205 0 0); /* used by: bg-primary, text-primary, etc. */
```
These are consumed exclusively by shadcn/ui primitives (Button, Dialog, Select, etc.).

The two systems are intentionally separate. Do not mix them in custom components — use EduOS tokens for application code and let shadcn/ui components consume their own tokens internally.

### Adding new shadcn/ui components

```bash
# From the frontend/ directory
pnpm dlx shadcn@latest add <component-name>
```

Components are generated into `src/components/ui/`. Never edit generated files directly — wrap them in `src/components/shared/` if customization is needed.

---

## File Naming

```
ComponentName.tsx           → React component
ComponentName.test.tsx      → Component tests
use-hook-name.ts            → Custom hooks
module-name.types.ts        → Module-specific types
module-name.schema.ts       → Zod schemas
```

## Component Pattern

```typescript
import { cn } from '@/lib/utils'; // shadcn/ui canonical path

interface MyComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export function MyComponent({ className, children }: MyComponentProps) {
  return (
    <div className={cn('base-classes', className)}>
      {children}
    </div>
  );
}
```

## Hook Pattern — Queries

```typescript
export function useResource(id: string) {
  return useQuery({
    queryKey: queryKeys.resource.detail(id),
    queryFn: () => resourceApi.getById(id),
    enabled: !!id,
  });
}
```

## Hook Pattern — Mutations

```typescript
export function useCreateResource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resourceApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.resource.all });
      toast.success('Created successfully');
    },
  });
}
```

## Import Order

1. React / Next.js
2. External libraries
3. `@/types`
4. `@/lib`
5. `@/stores`
6. `@/hooks`
7. `@/components`
8. `@/modules`
9. Relative imports

## 'use client' Rules

Add `'use client'` ONLY when the component:
- Uses `useState`, `useEffect`, `useReducer`
- Uses browser APIs (window, document, localStorage)
- Uses Zustand stores
- Uses React event handlers that require client context

Do NOT add `'use client'` to:
- Pure layout components
- Server-side data fetching components
- Static content components

## Error Handling

```typescript
// In hooks — let TanStack Query handle errors
// In mutations — use onError callback
// In components — use ErrorBoundary
// Never swallow errors silently
```

## Accessibility

- Use semantic HTML elements
- All interactive elements have `aria-label` or visible text
- Keyboard navigation tested for all interactive components
- Color is never the sole indicator of status (always paired with text/icon)
- Reduced motion respected via `prefers-reduced-motion` media query

## Performance

- Heavy components use `React.lazy` + `Suspense`
- Tables with >100 rows use `@tanstack/react-virtual`
- Images use Next.js `<Image>` component
- Never import entire libraries — use named imports
