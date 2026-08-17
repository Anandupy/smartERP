export const navigationKeys = {
  all: ["workspace-admin-navigation"] as const,
  tree: () => ["workspace-admin-navigation", "tree"] as const,
} as const;
