import { Injectable } from '@nestjs/common';
import { MenuStatus } from '@/generated/client';

export interface NavigationTreeNode {
  id: string;
  code: string;
  moduleId: string;
  parentId: string | null;
  route: string;
  componentIdentifier: string | null;
  displayName: string;
  icon: string | null;
  tooltip: string | null;
  description: string | null;
  displayOrder: number;
  badge: string | null;
  searchKeywords: string[];
  helpUrl: string | null;
  documentationUrl: string | null;
  status: MenuStatus;
  children: NavigationTreeNode[];
}

export interface TreeBuildResult {
  tree: NavigationTreeNode[];
  totalVisibleMenus: number;
  menuTreeDepth: number;
}

@Injectable()
export class NavigationTreeBuilder {
  buildTree(menus: any[]): TreeBuildResult {
    const nodeMap = new Map<string, NavigationTreeNode>();
    const rootNodes: NavigationTreeNode[] = [];
    let totalVisibleMenus = 0;

    // 1. Initialize all nodes
    for (const menu of menus) {
      const node: NavigationTreeNode = {
        id: menu.id,
        code: menu.code,
        moduleId: menu.moduleId,
        parentId: menu.parentId,
        route: menu.route,
        componentIdentifier: menu.componentIdentifier,
        displayName: menu.displayName,
        icon: menu.icon,
        tooltip: menu.tooltip,
        description: menu.description,
        displayOrder: menu.displayOrder,
        badge: menu.badge,
        searchKeywords: Array.isArray(menu.searchKeywords)
          ? menu.searchKeywords
          : [],
        helpUrl: menu.helpUrl,
        documentationUrl: menu.documentationUrl,
        status: menu.status,
        children: [],
      };
      nodeMap.set(menu.id, node);
      totalVisibleMenus++;
    }

    // 2. Link parent and children
    for (const menu of menus) {
      const node = nodeMap.get(menu.id)!;
      if (menu.parentId && nodeMap.has(menu.parentId)) {
        const parentNode = nodeMap.get(menu.parentId)!;
        parentNode.children.push(node);
      } else {
        rootNodes.push(node);
      }
    }

    // 3. Sort siblings recursively by displayOrder
    const sortNodes = (nodes: NavigationTreeNode[]): number => {
      nodes.sort((a, b) => a.displayOrder - b.displayOrder);
      let maxDepth = nodes.length > 0 ? 1 : 0;
      for (const node of nodes) {
        if (node.children.length > 0) {
          const childDepth = sortNodes(node.children);
          maxDepth = Math.max(maxDepth, 1 + childDepth);
        }
      }
      return maxDepth;
    };

    const maxTreeDepth = sortNodes(rootNodes);

    return {
      tree: rootNodes,
      totalVisibleMenus,
      menuTreeDepth: maxTreeDepth,
    };
  }
}
