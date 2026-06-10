// ============================================================
// Setup Steps — First-time EduOS initialization checklist
//
// Plain data module (no 'use client') so it can be imported
// by both Server Components (setup/page.tsx) and Client
// Components (setup-guard.tsx hooks).
// ============================================================

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isComplete: boolean;
}

export const SETUP_STEPS: SetupStep[] = [
  {
    id: 'system-init',
    title: 'Initialize System',
    description: 'Configure the core EduOS system settings.',
    isRequired: true,
    isComplete: false,
  },
  {
    id: 'create-organization',
    title: 'Create Organization',
    description: 'Set up your first educational organization.',
    isRequired: true,
    isComplete: false,
  },
  {
    id: 'create-branch',
    title: 'Create Branch',
    description: 'Add your first institution branch or campus.',
    isRequired: true,
    isComplete: false,
  },
  {
    id: 'create-academic-year',
    title: 'Set Academic Year',
    description: 'Define the current academic year for your branch.',
    isRequired: true,
    isComplete: false,
  },
  {
    id: 'create-program',
    title: 'Create Program',
    description: 'Add at least one program (e.g., Class 1 to 12, B.Tech).',
    isRequired: false,
    isComplete: false,
  },
];
