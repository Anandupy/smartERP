import { AppLayout, type AppLayoutProps } from "./app-layout";

export interface WorkspaceLayoutProps extends AppLayoutProps {
  /** Workspace switcher slot — provided by the workspace feature later. */
  workspaceSwitcher?: React.ReactNode;
}

/**
 * Future workspace-scoped shell. Extends the app shell with a workspace
 * switcher region. Kept as a thin specialization so workspace theming and
 * scope selection can layer in without duplicating the app layout.
 */
export function WorkspaceLayout({
  workspaceSwitcher,
  sidebar,
  ...props
}: WorkspaceLayoutProps) {
  const composedSidebar =
    workspaceSwitcher || sidebar ? (
      <div className="flex h-full flex-col">
        {workspaceSwitcher ? (
          <div className="border-border border-b p-3">{workspaceSwitcher}</div>
        ) : null}
        {sidebar ? <div className="min-h-0 flex-1">{sidebar}</div> : null}
      </div>
    ) : undefined;

  return <AppLayout sidebar={composedSidebar} {...props} />;
}
