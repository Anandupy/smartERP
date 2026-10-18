"use client";

import { useRouter } from "next/navigation";

import { ROUTES } from "@/constants";
import { useWorkspace } from "@/core/workspace";
import { PageHeader } from "@/shared/components/layout";

import type { AcademicUnitScope } from "../api/academic-unit.service";
import {
  useAcademicUnits,
  useUpdateAcademicUnit,
} from "../hooks/use-academic-units";
import {
  toAcademicUnitFormValues,
  toAcademicUnitRequest,
} from "../mappers/academic-unit.mapper";
import type { AcademicUnitDto } from "../types/academic-unit.dto";
import { AcademicUnitBoundary } from "./academic-unit-boundary";
import { AcademicUnitForm } from "./academic-unit-form";

export interface EditAcademicUnitScreenProps {
  id: string;
  /** The program selector, supplied by the route. */
  programPicker?: React.ReactNode;
}

/** The form, mounted only once its record exists. */
function EditForm({
  unit,
  scope,
  programPicker,
}: {
  unit: AcademicUnitDto;
  scope: AcademicUnitScope;
  programPicker?: React.ReactNode;
}) {
  const router = useRouter();
  const { branch, academicYear } = useWorkspace();
  const update = useUpdateAcademicUnit(unit.id, scope);
  const { units } = useAcademicUnits(scope);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${unit.name}`}
        description="Changes take effect as soon as they are saved."
      />

      <AcademicUnitForm
        defaultValues={toAcademicUnitFormValues(unit)}
        programPicker={programPicker}
        existingUnits={units}
        editingId={unit.id}
        scopeLabel={[branch?.name, academicYear?.name]
          .filter(Boolean)
          .join(" · ")}
        submitLabel="Save changes"
        onCancel={() => router.push(ROUTES.app.academicUnits.detail(unit.id))}
        onSubmit={async (values) => {
          await update.mutateAsync(toAcademicUnitRequest(values));
          router.push(ROUTES.app.academicUnits.detail(unit.id));
        }}
      />

      <p className="text-muted-foreground text-sm">
        To change the parent, use the Move action: it is the only path that
        recalculates the level of every unit beneath this one. This form saves
        the parent as loaded.
      </p>
    </div>
  );
}

/**
 * Edit an existing academic unit.
 *
 * The form is only mounted once the record has loaded, so `defaultValues` is
 * the real unit rather than blanks that get reset a moment later.
 *
 * `editingId` is what keeps the parent picker honest: the documented tree rules
 * prevent self-parenting and circular references, so the record and every one
 * of its descendants are removed from the options.
 */
export function EditAcademicUnitScreen({
  id,
  programPicker,
}: EditAcademicUnitScreenProps) {
  return (
    <AcademicUnitBoundary id={id}>
      {(unit, scope) => (
        <EditForm unit={unit} scope={scope} programPicker={programPicker} />
      )}
    </AcademicUnitBoundary>
  );
}
