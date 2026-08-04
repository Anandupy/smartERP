"use client";

import { useMemo } from "react";

import {
  AcademicUnitDetailsScreen,
  AcademicUnitDirectoryScreen,
  AcademicUnitTreeScreen,
  CreateAcademicUnitScreen,
  EditAcademicUnitScreen,
} from "@/features/academic-unit";
import { ProgramPicker, useProgramBranch, usePrograms } from "@/features/program";

/**
 * Where Program and Academic Unit meet.
 *
 * AGENTS.md §28: *"Two features that meet do so at the route, through slots —
 * never by importing each other."* This file is that route composition. It is
 * the **only** module in the app that imports both feature barrels, and it
 * exists because the join genuinely cannot happen anywhere else:
 *
 * - an academic unit's request body names a `programId`, so its form needs a
 *   program selector;
 * - the tables and detail panels want a program **name**, not a uuid;
 * - neither feature may import the other, and a Server Component cannot call
 *   the hooks that fetch the program list.
 *
 * So this is a client component, co-located with the routes it serves rather
 * than living inside either feature. Two things cross the boundary and nothing
 * else: an opaque `ReactNode` (the picker, which binds itself through
 * `useFormContext()`) and a plain `ReadonlyMap` of names. Academic Unit never
 * learns that a Program module exists; Program never learns it is being used
 * inside one.
 *
 * Each export is a thin wrapper, so the page files stay as thin as every other
 * route in the app.
 */

/** Program names by id, for the active branch. */
function useProgramNames(): ReadonlyMap<string, string> {
  const branch = useProgramBranch();
  const { programs } = usePrograms(branch?.id ?? null);

  return useMemo(() => {
    const names = new Map<string, string>();
    for (const program of programs) names.set(program.id, program.name);
    return names;
  }, [programs]);
}

/** The hierarchy, with program names resolved. */
export function AcademicUnitTreeRoute() {
  const programNames = useProgramNames();
  return <AcademicUnitTreeScreen programNames={programNames} />;
}

/** The directory, with program names resolved for the column and filter. */
export function AcademicUnitDirectoryRoute() {
  const programNames = useProgramNames();
  return <AcademicUnitDirectoryScreen programNames={programNames} />;
}

/** Create, with the program selector slotted into the form. */
export function CreateAcademicUnitRoute() {
  return (
    <CreateAcademicUnitScreen
      programPicker={
        <ProgramPicker description="The vertical this unit belongs to. Only programs in the active branch are offered." />
      }
    />
  );
}

/** Edit, with the same selector. */
export function EditAcademicUnitRoute({ id }: { id: string }) {
  return (
    <EditAcademicUnitScreen
      id={id}
      programPicker={
        <ProgramPicker description="The vertical this unit belongs to. Changing it also changes which parents are available." />
      }
    />
  );
}

/**
 * Details, with program names resolved for the scope panel.
 *
 * The whole map is passed rather than a single name, because the lookup key is
 * the *unit's* `programId` — which only the screen knows, since it is the one
 * holding the loaded record.
 */
export function AcademicUnitDetailsRoute({
  id,
  activityTrail,
}: {
  id: string;
  activityTrail?: React.ReactNode;
}) {
  const programNames = useProgramNames();

  return (
    <AcademicUnitDetailsScreen
      id={id}
      programNames={programNames}
      activityTrail={activityTrail}
    />
  );
}
