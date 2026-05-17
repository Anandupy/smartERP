export function buildAcademicTree(
  units: any[],
  parentId: string | null = null,
): any[] {
  return units
    .filter((unit) => unit.parentId === parentId)
    .map((unit) => ({
      ...unit,
      children: buildAcademicTree(units, unit.id),
    }));
}
