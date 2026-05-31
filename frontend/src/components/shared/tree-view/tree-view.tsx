'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

// ── Types ─────────────────────────────────────────────────────

export interface TreeNode {
  id: string;
  name: string;
  type: string;
  level: number;
  parentId: string | null;
  children?: TreeNode[];
  meta?: Record<string, unknown>;
  isActive?: boolean;
  badge?: string | number;
}

export interface TreeViewProps {
  nodes: TreeNode[];
  onSelect?: (node: TreeNode) => void;
  onMove?: (nodeId: string, targetParentId: string) => void;
  selectedId?: string | null;
  typeIcons?: Record<string, LucideIcon>;
  className?: string;
  /** Maximum depth to expand by default */
  defaultExpandDepth?: number;
}

// ── TreeNodeComponent ─────────────────────────────────────────

interface TreeNodeProps {
  node: TreeNode;
  depth: number;
  onSelect?: (node: TreeNode) => void;
  selectedId?: string | null;
  typeIcons?: Record<string, LucideIcon>;
  defaultExpandDepth: number;
}

function TreeNodeComponent({
  node,
  depth,
  onSelect,
  selectedId,
  typeIcons,
  defaultExpandDepth,
}: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < defaultExpandDepth);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;

  const Icon = typeIcons?.[node.type];

  return (
    <li>
      <div
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={hasChildren ? expanded : undefined}
        aria-level={depth + 1}
        tabIndex={0}
        onClick={() => {
          if (hasChildren) setExpanded((v) => !v);
          onSelect?.(node);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (hasChildren) setExpanded((v) => !v);
            onSelect?.(node);
          }
          if (e.key === 'ArrowRight' && hasChildren && !expanded) {
            setExpanded(true);
          }
          if (e.key === 'ArrowLeft' && expanded) {
            setExpanded(false);
          }
        }}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isSelected
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-foreground hover:bg-surface-2',
          !node.isActive && !isSelected && 'opacity-60',
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/Collapse Icon */}
        <span className="flex h-4 w-4 items-center justify-center">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-erp" aria-hidden />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-erp" aria-hidden />
            )
          ) : (
            <span className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>

        {/* Type Icon */}
        {Icon && (
          <Icon className="h-4 w-4 shrink-0 text-muted-erp" aria-hidden />
        )}

        {/* Node Name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Badge */}
        {node.badge !== undefined && (
          <span className="ml-1 rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted-erp">
            {node.badge}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <ul role="group" aria-label={`${node.name} children`}>
          {node.children!.map((child) => (
            <TreeNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              selectedId={selectedId}
              typeIcons={typeIcons}
              defaultExpandDepth={defaultExpandDepth}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── TreeView ──────────────────────────────────────────────────

/**
 * TreeView Engine — hierarchical data display.
 *
 * Features:
 * - Keyboard navigation (Arrow keys, Enter, Space)
 * - Expand/collapse per node
 * - ARIA tree semantics
 * - Type-based icons
 * - Selection tracking
 * - Activity state styling
 *
 * Drag-and-drop will be added via @dnd-kit in Phase 4 (Academic Unit module).
 */
export function TreeView({
  nodes,
  onSelect,
  selectedId,
  typeIcons,
  className,
  defaultExpandDepth = 1,
}: TreeViewProps) {
  if (nodes.length === 0) return null;

  return (
    <ul
      role="tree"
      aria-label="Hierarchy tree"
      className={cn('space-y-0.5', className)}
    >
      {nodes.map((node) => (
        <TreeNodeComponent
          key={node.id}
          node={node}
          depth={0}
          onSelect={onSelect}
          selectedId={selectedId}
          typeIcons={typeIcons}
          defaultExpandDepth={defaultExpandDepth}
        />
      ))}
    </ul>
  );
}
