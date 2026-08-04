"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Blocks, Plus, School, TriangleAlert } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants";
import { TreeView } from "@/shared/components/data";
import {
  BackendPendingNote,
  Banner,
  EmptyState,
} from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  useProgramBranch,
  useProgramTree,
  usePrograms,
} from "../hooks/use-programs";
import { formatProgramClassification } from "../mappers/program.mapper";
import type { ProgramDto } from "../types/program.dto";
import { buildProgramTree } from "../utils/program-hierarchy";
import { ProgramStatusBadge } from "./program-status-badge";

/** One program as it appears in the tree. */
function ProgramNode({ program }: { program: ProgramDto }) {
  const classification = formatProgramClassification(program);

  return (
    <Link
      href={ROUTES.app.programs.detail(program.id)}
      className="hover:bg-muted/60 focus-visible:ring-ring flex flex-wrap items-center gap-2 rounded-lg px-2 py-1.5 focus-visible:ring-3 focus-visible:outline-none"
    >
      <span className="text-foreground truncate text-sm font-medium">
        {program.name}
      </span>
      {classification ? (
        <span className="text-muted-foreground truncate text-xs">
          {classification}
        </span>
      ) : null}
      {program.level ? (
        <span className="text-muted-foreground bg-muted rounded px-1.5 py-0.5 text-xs">
          {program.level}
        </span>
      ) : null}
      <ProgramStatusBadge program={program} className="ml-auto" />
    </Link>
  );
}

/**
 * The program hierarchy for the active branch.
 *
 * The interesting decision here is **which source builds the tree**, and it is
 * not the tree endpoint.
 *
 * `GET /programs/tree` is documented by name alone — one row in a table reading
 * "Get hierarchical tree", with no response body, no nesting key and no stated
 * envelope. It is wired and read defensively, but the hierarchy shown is built
 * from the **flat list** with the shared `buildTree`, which needs only
 * `parentId` — a field both request bodies document. So the screen is correct
 * whatever shape the tree endpoint turns out to have, and the endpoint's
 * readability becomes a note rather than a failure.
 *
 * Orphans and cycles are reported rather than hidden. A program whose parent is
 * not in the list would otherwise vanish from a screen whose entire purpose is
 * to show every program, which is a worse bug than an extra panel.
 */
export function ProgramTreeScreen() {
  const branch = useProgramBranch();
  const { programs, isPending, error, refetch } = usePrograms(
    branch?.id ?? null,
  );
  const treeQuery = useProgramTree(branch?.id ?? null);

  const { roots, orphans, cyclic } = useMemo(
    () => buildProgramTree(programs),
    [programs],
  );

  if (!branch) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Program Hierarchy"
          description="How a branch's programs are grouped."
        />
        <EmptyState
          icon={School}
          title="No active branch"
          description="Programs belong to a branch, and the list endpoint requires a branch id. Choose a branch to continue."
          action={
            <Button asChild variant="outline">
              <Link href={ROUTES.workspace.root}>Change workspace</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Program Hierarchy"
        description={`How ${branch.name}'s programs are grouped. Parents may hold any number of children, to any depth.`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={ROUTES.app.programs.directory}>Directory</Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.app.programs.create}>
                <Plus />
                New program
              </Link>
            </Button>
          </>
        }
      />

      {cyclic.length > 0 ? (
        <Banner
          tone="danger"
          icon={TriangleAlert}
          title="Some programs form a circular parent chain"
          description={`${cyclic.length} could not be placed without looping. The backend documents that it prevents circular references, so this indicates malformed data rather than a normal state.`}
        />
      ) : null}

      <Card>
        <CardHeader className="border-b">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Blocks aria-hidden="true" className="size-4" />
              Hierarchy
            </span>
            <span className="text-muted-foreground text-xs font-normal">
              {roots.length} top-level · {programs.length} total
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <TreeView
            caption="Program hierarchy"
            roots={roots}
            isLoading={isPending}
            error={error}
            onRetry={() => refetch()}
            renderNode={(program) => <ProgramNode program={program} />}
            emptyState={
              <EmptyState
                icon={Blocks}
                title="No programs yet"
                description={`${branch.name} has no programs. Academic units name a program, so at least one is needed before the operational structure can be built.`}
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.programs.create}>
                      <Plus />
                      Create program
                    </Link>
                  </Button>
                }
              />
            }
          />
        </CardContent>
      </Card>

      {orphans.length > 0 ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Not placed in the hierarchy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            <p className="text-muted-foreground text-sm">
              These programs name a parent that the branch&apos;s list does not
              contain. They are shown here rather than promoted to the top level,
              which would misrepresent where they sit.
            </p>
            <ul className="divide-border divide-y">
              {orphans.map((program) => (
                <li key={program.id} className="py-2">
                  <Link
                    href={ROUTES.app.programs.detail(program.id)}
                    className="text-primary text-sm underline-offset-4 hover:underline"
                  >
                    {program.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    Parent <code>{program.parentId}</code> was not returned.
                  </p>
                </li>
              ))}
            </ul>
            <BackendPendingNote>
              the list endpoint documents a soft delete but no field marking one,
              so a parent may have been deleted without the frontend being able
              to tell.
            </BackendPendingNote>
          </CardContent>
        </Card>
      ) : null}

      <BackendPendingNote>
        this hierarchy is built in the browser from each program&apos;s{" "}
        <code>parentId</code>.{" "}
        {treeQuery.isUnrecognized
          ? "The documented GET /programs/tree endpoint returned a shape this app does not recognise — it has no documented response body — so nothing here depends on it."
          : "A GET /programs/tree endpoint is documented, but with no response body, so it is not relied on."}
      </BackendPendingNote>
    </div>
  );
}
