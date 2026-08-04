"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { PageHeader } from "@/shared/components/layout";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import {
  useAcademicUnits,
  useCreateAcademicUnit,
} from "../hooks/use-academic-units";
import { toAcademicUnitRequest } from "../mappers/academic-unit.mapper";
import { academicUnitFormDefaults } from "../schemas/academic-unit.schema";
import { AcademicUnitForm } from "./academic-unit-form";
import { AcademicUnitScopeGate } from "./academic-unit-scope-gate";

export interface CreateAcademicUnitScreenProps {
  /**
   * The program selector, supplied by the route — see `AcademicUnitForm`.
   *
   * This is the Program ↔ Academic Unit seam: the picker is a component from
   * the Program module, composed at the route so neither feature imports the
   * other.
   */
  programPicker?: React.ReactNode;
}

/** The form, once the scope is resolved. */
function CreateForm({
  scope,
  programPicker,
}: {
  scope: AcademicUnitScope;
  programPicker?: React.ReactNode;
}) {
  const router = useRouter();
  const { branch, academicYear } = useWorkspace();
  const create = useCreateAcademicUnit(scope);
  const { units } = useAcademicUnits(scope);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Academic Unit"
        description="A department, class, division or batch within a program."
      />

      <AcademicUnitForm
        defaultValues={academicUnitFormDefaults({
          branchId: scope.branchId,
          academicYearId: scope.academicYearId,
        })}
        programPicker={programPicker}
        existingUnits={units}
        scopeLabel={[branch?.name, academicYear?.name]
          .filter(Boolean)
          .join(" · ")}
        submitLabel="Create unit"
        onCancel={() => router.push(ROUTES.app.academicUnits.tree)}
        onSubmit={async (values) => {
          const created = await create.mutateAsync(
            toAcademicUnitRequest(values),
          );
          // No response body is documented, so an id may not come back. The
          // hierarchy is the better fallback than the directory here: a unit is
          // created to sit somewhere, and that is what the user wants to see.
          router.push(
            created?.id
              ? ROUTES.app.academicUnits.detail(created.id)
              : ROUTES.app.academicUnits.tree,
          );
        }}
      />
    </div>
  );
}

/**
 * Create an academic unit.
 *
 * The branch and academic year come from the active workspace — both are
 * documented required fields, and both are fixed rather than chosen: a unit
 * created into a different year than the one on screen is the kind of mistake
 * that is invisible until enrolment.
 *
 * The program is chosen through the slotted picker, and the parent through a
 * list narrowed to that program — which is how the documented consistency rule
 * is satisfied without a validation step.
 */
export function CreateAcademicUnitScreen({
  programPicker,
}: CreateAcademicUnitScreenProps) {
  return (
    <AcademicUnitScopeGate>
      {(scope) => <CreateForm scope={scope} programPicker={programPicker} />}
    </AcademicUnitScopeGate>
  );
}
