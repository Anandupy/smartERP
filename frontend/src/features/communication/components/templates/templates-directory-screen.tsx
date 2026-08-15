"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { MessageSquare, Plus } from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROUTES } from "@/constants";
import { useDebouncedValue } from "@/hooks";
import {
  DataTablePagination,
  DataTableToolbar,
} from "@/shared/components/data";
import { EmptyState } from "@/shared/components/feedback";
import { PageHeader } from "@/shared/components/layout";

import {
  ANY,
  CHANNEL_OPTIONS,
  TEMPLATE_DIRECTORY_PAGE_SIZE,
  TEMPLATE_STATUS_OPTIONS,
} from "../../constants";
import { useTemplates } from "../../hooks/use-templates";
import type { CommunicationChannel, TemplateStatus } from "../../types/template.dto";
import { TemplatesTable } from "./templates-table";

/**
 * Templates Directory — `GET /communication/templates?channel=&status=&search=`.
 *
 * All three filters are documented query parameters and are sent to the
 * server as such (per the task's explicit contract, unlike Program's
 * client-only filtering). No `page` parameter is documented, so the returned
 * list is paged in the browser, the same accommodation Program's directory
 * makes for its own unpaginated list.
 */
export function TemplatesDirectoryScreen() {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<string>(ANY);
  const [status, setStatus] = useState<string>(ANY);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 200);

  const query = useMemo(
    () => ({
      search: debouncedSearch.trim() || undefined,
      channel: channel === ANY ? undefined : (channel as CommunicationChannel),
      status: status === ANY ? undefined : (status as TemplateStatus),
    }),
    [debouncedSearch, channel, status],
  );

  const { templates, isPending, isFetching, error, refetch } = useTemplates(query);

  const totalPages = Math.max(
    Math.ceil(templates.length / TEMPLATE_DIRECTORY_PAGE_SIZE),
    1,
  );
  const currentPage = Math.min(page, totalPages);
  const visible = templates.slice(
    (currentPage - 1) * TEMPLATE_DIRECTORY_PAGE_SIZE,
    currentPage * TEMPLATE_DIRECTORY_PAGE_SIZE,
  );

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) + (channel !== ANY ? 1 : 0) + (status !== ANY ? 1 : 0);

  const resetFilters = () => {
    setSearch("");
    setChannel(ANY);
    setStatus(ANY);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates Directory"
        description="Every message template — email, SMS, WhatsApp, push and in-app."
        actions={
          <Button asChild>
            <Link href={ROUTES.app.communication.templates.create}>
              <Plus />
              New template
            </Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <DataTableToolbar
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          searchPlaceholder="Search name, code, subject…"
          searchLabel="Search templates"
          activeFilterCount={activeFilterCount}
          onClearFilters={resetFilters}
          filters={
            <>
              <Select
                value={channel}
                onValueChange={(value) => {
                  setChannel(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40" aria-label="Filter by channel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-40" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
        />

        <TemplatesTable
          templates={visible}
          isLoading={isPending}
          error={error}
          onRetry={() => refetch()}
          emptyState={
            activeFilterCount > 0 ? (
              <EmptyState
                title="No templates match"
                description="Try a different search term, channel or status."
                action={
                  <Button type="button" variant="outline" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={MessageSquare}
                title="No templates yet"
                description="Create the first message template to get started."
                action={
                  <Button asChild>
                    <Link href={ROUTES.app.communication.templates.create}>
                      <Plus />
                      New template
                    </Link>
                  </Button>
                }
              />
            )
          }
        />

        {templates.length > 0 ? (
          <DataTablePagination
            page={currentPage}
            pageSize={TEMPLATE_DIRECTORY_PAGE_SIZE}
            total={templates.length}
            totalPages={totalPages}
            isLoading={isFetching}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}
