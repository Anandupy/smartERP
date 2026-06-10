'use client';

import { useCallback } from 'react';
import { useUIStore } from '@/stores/ui.store';
import { getTour, getAllTours, getToursForRole } from './registry';
import { env } from '@/config/env';
import type { TourDefinition } from '@/types/ui.types';

/**
 * Hook to control Driver.js tours.
 *
 * Usage:
 * const { startTour, stopTour, isTourCompleted } = useTour();
 * startTour('app-shell-intro');
 */
export function useTour() {
  const {
    activeTourId,
    setActiveTour,
    markTourCompleted,
    isTourCompleted,
  } = useUIStore();

  /**
   * Start a tour by ID.
   * Tours are loaded lazily from the registry.
   */
  const startTour = useCallback(
    async (tourId: string) => {
      if (!env.enableTours) return;

      const tour = getTour(tourId);
      if (!tour) {
        console.warn(`[Tours] Tour "${tourId}" not found in registry.`);
        return;
      }

      // Load Driver.js lazily (CSS is imported globally in globals.css)
      const { driver } = await import('driver.js');

      const driverObj = driver({
        showProgress: true,
        animate: true,
        overlayOpacity: 0.35,
        allowClose: true,
        onDestroyStarted: () => {
          driverObj.destroy();
          markTourCompleted(tourId);
          setActiveTour(null);
        },
        steps: tour.steps.map((step) => ({
          element: step.element,
          popover: {
            title: step.popover.title,
            description: step.popover.description,
            side: step.popover.side,
            align: step.popover.align,
          },
        })),
      });

      setActiveTour(tourId);
      driverObj.drive();
    },
    [setActiveTour, markTourCompleted],
  );

  /**
   * Stop the currently active tour.
   */
  const stopTour = useCallback(() => {
    if (activeTourId) {
      markTourCompleted(activeTourId);
      setActiveTour(null);
    }
  }, [activeTourId, markTourCompleted, setActiveTour]);

  /**
   * Start a tour only if it hasn't been completed yet.
   */
  const startTourIfNew = useCallback(
    async (tourId: string) => {
      if (!isTourCompleted(tourId)) {
        await startTour(tourId);
      }
    },
    [startTour, isTourCompleted],
  );

  return {
    activeTourId,
    startTour,
    stopTour,
    startTourIfNew,
    isTourCompleted,
    allTours: getAllTours(),
    toursForRole: (role: string) => getToursForRole(role),
  };
}
