# Assets

Static assets and their typed accessors.

- `icons.ts` — curated re-exports of Lucide icons. Import icons from
  `@/assets/icons` instead of `lucide-react` directly so the set stays curated.
- Images/fonts/SVGs that must be served statically go in the top-level
  `public/` directory (referenced by absolute path, e.g. `/logo.svg`).
