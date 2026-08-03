"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "@/assets/icons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Page sizes offered everywhere, capped at the backend's documented maximum. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  /** Total matching records, not the length of the current page. */
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  /** Dims the controls while a page is being fetched. */
  isLoading?: boolean;
  className?: string;
}

/**
 * Page controls beneath a `DataTable`.
 *
 * Fully controlled: it reports intent and renders what it is told, so the same
 * component serves server-paginated lists (the usual case) and client-paginated
 * ones without knowing which it is driving.
 *
 * The range summary is the accessible anchor — "1–25 of 2,492" tells a screen
 * reader user where they are far better than a highlighted page number does.
 */
export function DataTablePagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  isLoading = false,
  className,
}: DataTablePaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const lastPage = Math.max(totalPages, 1);
  const canGoBack = page > 1 && !isLoading;
  const canGoForward = page < lastPage && !isLoading;

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {total === 0
          ? "No records"
          : `${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {onPageSizeChange ? (
          <div className="flex items-center gap-2">
            <span
              id="page-size-label"
              className="text-muted-foreground text-sm whitespace-nowrap"
            >
              Rows per page
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger
                size="sm"
                className="w-[4.5rem]"
                aria-labelledby="page-size-label"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="First page"
            disabled={!canGoBack}
            onClick={() => onPageChange(1)}
          >
            <ChevronsLeft />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Previous page"
            disabled={!canGoBack}
            onClick={() => onPageChange(page - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-muted-foreground px-2 text-sm whitespace-nowrap">
            Page {page} of {lastPage}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Next page"
            disabled={!canGoForward}
            onClick={() => onPageChange(page + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Last page"
            disabled={!canGoForward}
            onClick={() => onPageChange(lastPage)}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </nav>
  );
}
