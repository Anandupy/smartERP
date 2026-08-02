import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

import { initialsOf, roleLabelOf } from "../utils/identity-display";

export interface WorkspaceIdentityProps {
  name: string;
  email: string;
  role: string | null;
}

/**
 * Who is about to enter the workspace: avatar, name, email, and role.
 *
 * Shown because the choice on this screen is scoped to *this* account — on a
 * shared machine, the address is what tells the user whether they are picking a
 * campus as themselves or as whoever signed in last.
 *
 * The avatar is initials-only: `/auth/me` carries no photo, and a placeholder
 * silhouette would imply one is missing rather than never existing.
 */
export function WorkspaceIdentity({
  name,
  email,
  role,
}: WorkspaceIdentityProps) {
  const initials = initialsOf(name);
  const roleLabel = roleLabelOf(role);

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar size="lg" aria-hidden="true">
          <AvatarFallback className="bg-primary/10 text-primary font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">{name}</p>
          <p className="text-muted-foreground truncate text-xs">{email}</p>
        </div>
      </div>
      {roleLabel ? (
        <Badge variant="secondary" className="shrink-0">
          {roleLabel}
        </Badge>
      ) : null}
    </div>
  );
}
