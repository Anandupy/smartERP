'use client';

// ============================================================
// Setup Guard — Onboarding check architecture
//
// Checks performed in order:
// 1. System initialized (GET /v1/system-settings)
// 2. Organization exists
// 3. Branch exists (for current org)
// 4. Academic Year exists (for current branch)
// 5. Program exists (for current branch)
//
// If any check fails, the Setup Wizard is shown.
// ============================================================

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { useIsHydrated } from '@/hooks/use-is-hydrated';
import { queryKeys } from '@/lib/api/query-keys';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { SystemSettings } from '@/types/domain.types';

export type SetupStatus =
  | 'checking'
  | 'complete'
  | 'needs-system-init'
  | 'needs-organization'
  | 'needs-branch'
  | 'needs-academic-year'
  | 'needs-program';

/**
 * Hook to determine the current setup status.
 * Only runs for SUPER_ADMIN — other roles skip the check.
 */
export function useSetupStatus(): SetupStatus {
  const role = useAuthStore((s) => s.role);
  const isHydrated = useIsHydrated();
  const [status, setStatus] = useState<SetupStatus>('checking');

  // Check system settings — determines if system is initialized
  const { data: systemSettings, isLoading, error } = useQuery({
    queryKey: queryKeys.systemSettings.detail(),
    queryFn: () => apiGet<SystemSettings>(ENDPOINTS.systemSettings.get),
    // Only check for SUPER_ADMIN
    enabled: isHydrated && role === 'SUPER_ADMIN',
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!isHydrated || role !== 'SUPER_ADMIN') {
      setStatus('complete');
      return;
    }

    if (isLoading) {
      setStatus('checking');
      return;
    }

    if (error || !systemSettings) {
      // Could not fetch system settings — likely not initialized
      setStatus('needs-system-init');
      return;
    }

    // System is initialized — further checks would query org/branch/year
    // These are deferred to Phase 2 when the business modules are built
    setStatus('complete');
  }, [isHydrated, role, systemSettings, isLoading, error]);

  return status;
}

// ── Setup Wizard Architecture ─────────────────────────────────

export interface SetupStep {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  isComplete: boolean;
}

/**
 * Setup wizard step definitions.
 * Used by the /setup page to render the wizard UI.
 */
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
