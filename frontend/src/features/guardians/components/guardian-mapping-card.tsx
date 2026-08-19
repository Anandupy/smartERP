"use client";

import { Contact, EllipsisVertical, Mail, Pencil, Phone, Trash2 } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/shared/components/data-display";

import { formatGuardianName } from "../mappers/guardian.mapper";
import type { ApplicantGuardianMappingDto } from "../types/guardian.dto";

export interface GuardianMappingCardProps {
  mapping: ApplicantGuardianMappingDto;
  relationTypeName: string | null;
  onEditGuardian: () => void;
  onEditMapping: () => void;
  onRemove: () => void;
}

/**
 * One guardian, mapped to this application. Shows exactly the flags the
 * mapping documents — never a fabricated "verified" status, since the
 * mapping has none.
 *
 * "Person linked" reflects the *guardian's own* `personId`
 * (`GuardianDto.personId`), not the applicant's — a guardian resolves
 * identity independently, and can be linked before or after the applicant
 * itself resolves one (module doc §5.1).
 */
export function GuardianMappingCard({
  mapping,
  relationTypeName,
  onEditGuardian,
  onEditMapping,
  onRemove,
}: GuardianMappingCardProps) {
  const guardian = mapping.guardian;

  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-4">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="font-medium">
              {guardian ? formatGuardianName(guardian) : "Guardian"}
            </p>
            <p className="text-muted-foreground text-xs">
              {relationTypeName ?? "Relation not set"}
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {mapping.isPrimary ? (
              <StatusBadge tone="brand">Primary</StatusBadge>
            ) : null}
            {mapping.isFinancialGuardian ? (
              <StatusBadge tone="info">Financial</StatusBadge>
            ) : null}
            {mapping.isEmergencyContact ? (
              <StatusBadge tone="warning">Emergency contact</StatusBadge>
            ) : null}
            {mapping.pickupAllowed ? (
              <StatusBadge tone="success">Pickup allowed</StatusBadge>
            ) : null}
          </div>

          {guardian ? (
            <div className="text-muted-foreground space-y-0.5 text-sm">
              <p className="flex items-center gap-1.5">
                <Phone aria-hidden="true" className="size-3.5" />
                {guardian.mobilePrimary}
              </p>
              {guardian.email ? (
                <p className="flex items-center gap-1.5">
                  <Mail aria-hidden="true" className="size-3.5" />
                  {guardian.email}
                </p>
              ) : null}
              <p className="flex items-center gap-1.5">
                <Contact aria-hidden="true" className="size-3.5" />
                {guardian.personId ? "Person linked" : "Identity not yet resolved"}
              </p>
            </div>
          ) : null}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Guardian actions"
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEditMapping}>
              <Pencil aria-hidden="true" />
              Edit relationship
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEditGuardian}>
              <Pencil aria-hidden="true" />
              Edit guardian details
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onRemove}>
              <Trash2 aria-hidden="true" />
              Remove mapping
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}
