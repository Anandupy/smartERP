/**
 * Re-exports `cn` from the canonical shadcn/ui location at @/lib/utils.
 * Both import paths work:
 *   import { cn } from '@/lib/utils'      ← shadcn/ui components
 *   import { cn } from '@/lib/utils/cn'   ← application components
 *
 * Single source of truth: src/lib/utils.ts
 */
export { cn } from '../utils';
