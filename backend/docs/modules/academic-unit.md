# Academic Unit Module

## Architecture Explanation

The Academic Unit module forms the operational core of the hierarchical academic engine for the ERP. 
Unlike `Program` (which represents standard structural groupings like "Primary English" or "Engineering" that rarely change), an `AcademicUnit` is highly dynamic and tightly scoped to an `AcademicYear`. This is because operational structures (such as sections, divisions, and batches) can increase, decrease, or split entirely based on enrollment for that specific academic year.

## Hierarchy Examples

The hierarchy is fully dynamic. It relies on the `parentId` relationship natively and supports unlimited depth.

### School Example
* Primary English (Program)
  * Std 1 (AcademicUnit: CLASS)
    * Div A (AcademicUnit: DIVISION)
    * Div B (AcademicUnit: DIVISION)

### College Example
* Engineering (Program)
  * IT Department (AcademicUnit: DEPARTMENT)
    * FYIT (AcademicUnit: YEAR)
      * Batch A (AcademicUnit: BATCH)

## Validation Rules
* **Existence Constraints:** Parent `Branch`, `Program`, and `AcademicYear` must strictly exist.
* **Consistency Constraints:** An academic unit must share the same `branchId`, `programId`, and `academicYearId` as its parent. 
* **Tree Constraints:** Self-parenting and circular references are actively prevented during move and creation operations.
* **Uniqueness:** Siblings (nodes sharing the same parent and academic year) must have strictly unique names.

## Fee Applicability Explanation
In the future, fees can be attached either to the `Program` (for stable baseline fees) or to a specific `AcademicUnit` (for year-wise, batch-specific variations or lab fees). The node-level inheritance ensures fees can be aggregated efficiently.

## Best Practices
* **Use Soft Delete:** Never permanently remove nodes if they have financial or academic trails. The engine prevents deleting parent nodes if active children exist.
* **Avoid Hardcoding Enums:** `AcademicUnitType` serves mainly as UI tags. Always depend on tree structure and node references rather than hardcoding logic targeting a specific level like "CLASS".
* **Level Metadata:** The `level` variable is auto-calculated starting at `0` for roots. It is maintained across moves dynamically by traversing the subtree. Do not update manually.

## Future Extensibility
The `metadata: Json` field is available to store attributes that don't need strict relational schemas (like room capacities, minimum students, lab requirements, custom shift timings).
