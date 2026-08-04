"use client";

import { useMemo, useState } from "react";

import { ChevronDown, ChevronRight } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ApiErrorState,
  EmptyState,
  SkeletonRegion,
} from "@/shared/components/feedback";
import { flattenTree, type TreeNode } from "@/utils";

export interface TreeViewProps<T> {
  /** Roots, already built by `buildTree`. */
  roots: readonly TreeNode<T>[];
  /** Renders one node's content. The row, indent and toggle are handled here. */
  renderNode: (item: T, meta: { depth: number; hasChildren: boolean }) => React.ReactNode;
  /** Describes the tree for assistive tech. Visually hidden. */
  caption: string;
  isLoading?: boolean;
  /** A failed fetch. Rendered through `ApiErrorState` in place of the rows. */
  error?: unknown;
  onRetry?: () => void;
  /** Replaces the default "nothing here" panel. */
  emptyState?: React.ReactNode;
  /** Ids whose children start hidden. Everything is expanded by default. */
  initialCollapsed?: readonly string[];
  /** Rows rendered by the loading skeleton. */
  skeletonRows?: number;
  className?: string;
}

/**
 * The one hierarchy view every ERP tree uses.
 *
 * Like `DataTable`, it owns the four states a remote list actually has —
 * loading, error, empty, loaded — so no module re-decides what a failed fetch
 * looks like mid-tree. Node content stays with the feature that understands the
 * domain; this component only knows how to indent, expand and announce.
 *
 * Three things it does that hand-rolled trees usually get wrong:
 *
 * - **`role="tree"` with real `aria-level`, `aria-posinset` and `aria-setsize`.**
 *   A screen reader announces "level 3, 2 of 4" instead of leaving a blind user
 *   to infer structure from visual indentation they cannot see.
 * - **The rows are flat.** Nesting `<ul>`s inside `<li>`s to arbitrary depth
 *   produces markup whose depth matches the data; a flat list with an
 *   `aria-level` does not, and stays cheap at a hundred sections.
 * - **The expand control is a separate button.** Making the whole row toggle
 *   would steal the click from whatever the feature renders inside it — usually
 *   a link to the record.
 *
 * Indentation is applied with a style rather than a Tailwind class because the
 * depth is data: a `pl-${depth * 6}` class cannot be generated at build time,
 * and would silently render flat.
 */
export function TreeView<T>({
  roots,
  renderNode,
  caption,
  isLoading = false,
  error,
  onRetry,
  emptyState,
  initialCollapsed,
  skeletonRows = 6,
  className,
}: TreeViewProps<T>) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
    () => new Set(initialCollapsed ?? []),
  );

  const rows = useMemo(() => {
    // `flattenTree` takes the ids that ARE expanded; this component tracks the
    // inverse, because "expanded by default" is the useful default for a
    // structural tree and tracking exceptions is smaller than tracking the rest.
    const expanded = new Set<string>();
    const collect = (nodes: readonly TreeNode<T>[]) => {
      for (const node of nodes) {
        if (!collapsed.has(node.id)) expanded.add(node.id);
        collect(node.children);
      }
    };
    collect(roots);
    return flattenTree(roots, expanded);
  }, [roots, collapsed]);

  const toggle = (id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (error) {
    return <ApiErrorState error={error} onRetry={onRetry} />;
  }

  if (isLoading) {
    return (
      <SkeletonRegion label="Loading hierarchy" className="space-y-2">
        {Array.from({ length: skeletonRows }, (_, index) => (
          <Skeleton
            key={index}
            className="h-9"
            // Staggered indents so the placeholder reads as a hierarchy rather
            // than as a list, which is what the user is about to see.
            style={{ marginLeft: `${(index % 3) * 1.25}rem` }}
          />
        ))}
      </SkeletonRegion>
    );
  }

  if (roots.length === 0) {
    return (
      emptyState ?? (
        <EmptyState
          title="Nothing to show"
          description="No records match the current view."
        />
      )
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <p className="sr-only" id={`${caption}-caption`}>
        {caption}
      </p>
      <ul role="tree" aria-label={caption} className="space-y-1">
        {rows.map((row) => {
          const isCollapsed = collapsed.has(row.id);

          return (
            <li
              key={row.id}
              role="treeitem"
              aria-level={row.level}
              aria-posinset={row.position}
              aria-setsize={row.setSize}
              aria-expanded={row.hasChildren ? !isCollapsed : undefined}
              // Required on `treeitem`, and deliberately always false: these
              // trees are navigational, not selectable — a node's content is a
              // link to its record. Omitting it makes a screen reader announce
              // an unselected item as if selection were merely unknown.
              aria-selected={false}
              className="list-none"
            >
              <div
                className="flex items-start gap-1"
                // Depth is data, so the indent cannot be a compiled class.
                style={{ paddingLeft: `${row.depth * 1.25}rem` }}
              >
                {row.hasChildren ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="mt-0.5 shrink-0"
                    aria-expanded={!isCollapsed}
                    aria-label={
                      isCollapsed ? "Expand children" : "Collapse children"
                    }
                    onClick={() => toggle(row.id)}
                  >
                    {isCollapsed ? <ChevronRight /> : <ChevronDown />}
                  </Button>
                ) : (
                  // Reserves the toggle's width so leaf rows align with their
                  // siblings instead of shifting left by a button.
                  <span aria-hidden="true" className="size-8 shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  {renderNode(row.item, {
                    depth: row.depth,
                    hasChildren: row.hasChildren,
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
