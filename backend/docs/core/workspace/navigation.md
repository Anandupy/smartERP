# Navigation Subsystem & Administration Specification

## 1. Overview

The **Navigation Subsystem** manages the database-driven menu hierarchy, visibility filtering, display ordering, and administrative lifecycle for CampusFlow ERP.

---

## 2. Menu Visibility Pipeline

```mermaid
flowchart TD
    Query[Fetch DB Menus] --> ModCheck{Module Active?}
    ModCheck -- No --> Exclude[Exclude Menu]
    ModCheck -- Yes --> StatusCheck{Menu Status IN [ACTIVE, BETA]?}
    StatusCheck -- No --> Exclude
    StatusCheck -- Yes --> PermCheck{Permissions Array Empty?}
    PermCheck -- Yes --> Include[Include in Tree]
    PermCheck -- No --> AuthService["Call AuthorizationService.canUserAccess()"]
    AuthService -- Allowed: false --> Exclude
    AuthService -- Allowed: true --> Include
```

---

## 3. Hierarchy & Invariant Validation Rules

All menu mutations pass through `MenuHierarchyValidator`:

1. **Cycle Prevention Rule (Graph DAG)**: Menu cannot become a child of its own descendant. Verified using Depth-First Search (DFS) ancestor traversal.
2. **Self-Parenting Rule**: `parentId !== menuId`.
3. **Hard Depth Limit**: Maximum of **3 levels** (`Root (Level 1) -> Group (Level 2) -> Detail Page (Level 3)`).
4. **Route Uniqueness**: Route paths must be unique across the navigation subsystem.
5. **System Protection**: `isSystem = true` records prohibit code modification or hard deletion.

---

## 4. Cache Strategy & Strategy Pattern

```typescript
export const INAVIGATION_CACHE = Symbol('INavigationCache');

export interface INavigationCache {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  clear(): Promise<void>;
}
```

- **Phase 1 Implementation**: `MemoryNavigationCacheService` (in-memory Map with TTL).
- **Key Pattern**: `workspace:nav:user:<userId>:<role>`
- **Invalidation**: Module/menu mutation events publish domain events that invalidate all navigation entries (`workspace:nav:*`).

---

## 5. Administrative REST APIs

### Super Admin Menu Operations

- `GET /v1/admin/navigation/menus`: List flat menu records.
- `POST /v1/admin/navigation/menus`: Create new menu item.
- `PATCH /v1/admin/navigation/menus/:id`: Update menu attributes.
- `PATCH /v1/admin/navigation/menus/:id/move`: Change parent/module with DFS validation.
- `PUT /v1/admin/navigation/menus/reorder`: Bulk update display ranks.
- `PATCH /v1/admin/navigation/menus/:id/status`: Update status (`ACTIVE`, `BETA`, `DISABLED`, etc.).
- `POST /v1/admin/navigation/menus/:id/duplicate`: Clone menu record.
- `DELETE /v1/admin/navigation/menus/:id`: Delete menu (blocked if child submenus exist).
