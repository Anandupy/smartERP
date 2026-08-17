export const setupKeys = {
  all: ["workspace-admin-setup"] as const,
  status: () => ["workspace-admin-setup", "status"] as const,
} as const;
