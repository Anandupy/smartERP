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

## Data Structure

Every field of the response, as `AcademicUnitDto` documents it in Swagger.

| Field | Type | Notes |
| :--- | :--- | :--- |
| `id` | `String (UUID v7)` | |
| `branchId` | `String` | Required. |
| `programId` | `String` | Required. |
| `academicYearId` | `String` | Required. |
| `parentId` | `String?` | Null at the root. |
| `name` | `String` | Required. Unique among siblings. |
| `code` | `String?` | Optional. |
| `unitType` | `AcademicUnitType` | `SECTION`, `CLASS`, `DIVISION`, `STREAM`, `DEPARTMENT`, `YEAR`, `SEMESTER`, `BATCH`, `CUSTOM`. |
| `level` | `Int` | **Server-computed, always returned.** `0` at the root. |
| `displayOrder` | `Int?` | Optional. Null sorts last. |
| `isActive` | `Boolean` | Default `true`. Always returned. |
| `isDeleted` | `Boolean` | Default `false`. Always returned. Soft-delete flag. |
| `metadata` | `Json?` | Unconstrained. See [Future Extensibility](#future-extensibility). |
| `createdBy` / `updatedBy` | `String?` | User id. |
| `createdAt` / `updatedAt` | `DateTime` | ISO 8601. |

### `unitType` is a database enum

Despite the guidance in [Best Practices](#best-practices) not to branch on it,
`unitType` **is** a Prisma enum with exactly nine values, and a write outside
that set is rejected. The advice is about not hardcoding *logic* against a
level — it is not a statement that the column is free text. A client may safely
offer the nine as a select.

### `level` and `displayOrder`

`level` is required and always returned, so a client never has to derive depth
from the tree. It is computed on create and recalculated across the whole
subtree on move; it is never accepted from a client.

Siblings are ordered `level`, then `displayOrder`, then `name`. `displayOrder`
is nullable and has no default — Postgres sorts nulls last on an ascending
sort, so a unit without one appears **after** every sibling that has one.

### Hydrated relations

| Endpoint | Shape | Hydrates |
| :--- | :--- | :--- |
| `GET /academic-units` | `AcademicUnitDto[]` | nothing — a flat list |
| `GET /academic-units/:id` | `AcademicUnitDetailDto` | `parent` and `children` (deleted children excluded) |
| `GET /academic-units/tree` | `AcademicUnitTreeNodeDto[]` | `children`, recursively |

`branchId`, `programId` and `academicYearId` are ids on every shape; none of the
three is expanded.

### The tree endpoint

`GET /academic-units/tree` returns the **same units** as the flat list, nested
under their parents. Each node is a full `AcademicUnitDto` plus a `children`
array, present at every depth and empty at the leaves. It is an array at the top
level, not an object with a nesting key. Building the hierarchy client-side from
the flat list via `parentId` gives an identical result.

## API Endpoints

| Method | Path | Description |
| :--- | :--- | :--- |
| `POST` | `/v1/academic-units` | Create a unit. |
| `GET` | `/v1/academic-units` | Flat list for the branch and year. |
| `GET` | `/v1/academic-units/tree` | The same units, nested. |
| `GET` | `/v1/academic-units/:id` | One unit, with parent and children. |
| `PATCH` | `/v1/academic-units/:id` | Update. **Accepts a partial body.** |
| `PATCH` | `/v1/academic-units/:id/move` | Re-parent, recalculating `level`. |
| `PATCH` | `/v1/academic-units/:id/status` | Toggle active status. |
| `DELETE` | `/v1/academic-units/:id` | Soft delete. |

Both reads require `x-branch-id` and `x-academic-year-id`, and accept
`branchId` / `academicYearId` as query parameters, which take precedence.

### Two write paths, and which one owns what

Two relationships each have two endpoints that can change them. Both work; they
differ in what else they do:

| Change | Endpoints | Use |
| :--- | :--- | :--- |
| Re-parent | `PATCH /:id` (via `parentId`) and `PATCH /:id/move` | **`move`** — it is the only one that recalculates `level` across the subtree. Setting `parentId` through `PATCH /:id` moves the node without fixing the depth of anything below it. |
| Activate / deactivate | `PATCH /:id` (via `isActive`) and `PATCH /:id/status` | **Either.** `PATCH /:id` sets a target state and is idempotent; `/status` flips the current value and is not. Prefer `PATCH /:id` when the desired state is known. |

### Endpoint notes

- **Every list excludes soft-deleted units**, so a count is the live structure.
- **No query parameters** beyond the two scope ids, neither of which narrows the
  result. There is no `programId` filter, so narrowing by program is a
  client-side operation even though every unit carries one.
- **Soft delete only.** There is no permanent deletion and no restore.

## Validation Rules
* **Existence Constraints:** Parent `Branch`, `Program`, and `AcademicYear` must strictly exist.
* **Consistency Constraints:** An academic unit must share the same `branchId`, `programId`, and `academicYearId` as its parent. 
* **Tree Constraints:** Self-parenting and circular references are actively prevented during move and creation operations.
* **Uniqueness:** Siblings (nodes sharing the same parent and academic year) must have strictly unique names.

## Error Contracts

| Rule broken | Status | `error.code` | Message |
| :--- | :--- | :--- | :--- |
| Branch missing | `404` | `NotFoundException` | `Branch not found` |
| Program missing | `404` | `NotFoundException` | `Program not found` |
| Academic year missing | `404` | `NotFoundException` | `Academic year not found` |
| Parent missing or deleted | `404` | `NotFoundException` | `Parent academic unit not found or is deleted` |
| Unit missing | `404` | `NotFoundException` | `Academic unit not found` |
| Parent in another branch | `400` | `BadRequestException` | `Parent belongs to a different branch` |
| Parent in another program | `400` | `BadRequestException` | `Parent belongs to a different program` |
| Parent in another year | `400` | `BadRequestException` | `Parent belongs to a different academic year` |
| Self-parenting | `400` | `BadRequestException` | `Cannot set academic unit as its own parent` |
| Circular move | `400` | `BadRequestException` | `Cannot create circular hierarchy` |
| Delete with active children | `400` | `BadRequestException` | `Cannot delete academic unit with active children` |
| Sibling name collision | `409` | `ConflictException` | Uniqueness violation |

## Audit

Units publish `academic_unit.created`, `.updated` and `.deleted`, recorded under
the `ACADEMIC` module. **`move` and the status toggle both publish
`academic_unit.updated`** — the same event as a field edit — so the
[audit trail](../core/audit.md) shows that a unit changed but not that it was
re-parented or deactivated.

## Fee Applicability Explanation
In the future, fees can be attached either to the `Program` (for stable baseline fees) or to a specific `AcademicUnit` (for year-wise, batch-specific variations or lab fees). The node-level inheritance ensures fees can be aggregated efficiently.

## Best Practices
* **Use Soft Delete:** Never permanently remove nodes if they have financial or academic trails. The engine prevents deleting parent nodes if active children exist.
* **Avoid Hardcoding Enums:** `AcademicUnitType` serves mainly as UI tags. Always depend on tree structure and node references rather than hardcoding logic targeting a specific level like "CLASS".
* **Level Metadata:** The `level` variable is auto-calculated starting at `0` for roots. It is maintained across moves dynamically by traversing the subtree — but only by `PATCH /:id/move`. Do not update manually, and do not re-parent through `PATCH /:id` if the subtree depth matters.

## Future Extensibility
The `metadata: Json` field is available to store attributes that don't need strict relational schemas (like room capacities, minimum students, lab requirements, custom shift timings).
