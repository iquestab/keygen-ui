'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const

interface PaginationControlsProps {
  currentPage: number
  pageSize: number
  totalCount: number
  pageSizes?: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

function getPageNumbers(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  const pages: (number | 'ellipsis')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('ellipsis')
    const start = Math.max(2, currentPage - 1)
    const end = Math.min(totalPages - 1, currentPage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (currentPage < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
  }
  return pages
}

export function PaginationControls({
  currentPage,
  pageSize,
  totalCount,
  pageSizes = DEFAULT_PAGE_SIZES,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  if (totalCount === 0) return null

  const totalPages = Math.ceil(totalCount / pageSize)
  const goToPage = (page: number) => onPageChange(Math.max(1, Math.min(page, totalPages)))

  return (
    <div className="flex items-center justify-between border-t px-6 pt-4 mt-2">
      {/* Left: showing range + page size */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Showing{' '}
          <span className="font-medium text-foreground">
            {Math.min((currentPage - 1) * pageSize + 1, totalCount)}
          </span>
          {' '}&ndash;{' '}
          <span className="font-medium text-foreground">
            {Math.min(currentPage * pageSize, totalCount)}
          </span>
          {' '}of{' '}
          <span className="font-medium text-foreground">{totalCount}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-xs">Rows</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-7 w-[62px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizes.map(size => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: page navigation */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={currentPage === 1}
            onClick={() => goToPage(1)}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={currentPage === 1}
            onClick={() => goToPage(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {getPageNumbers(currentPage, totalPages).map((page, idx) =>
            page === 'ellipsis' ? (
              <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground text-sm">
                ...
              </span>
            ) : (
              <Button
                key={page}
                variant={currentPage === page ? 'default' : 'outline'}
                size="sm"
                className="h-8 w-8 p-0 text-xs"
                onClick={() => goToPage(page)}
              >
                {page}
              </Button>
            )
          )}

          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={currentPage === totalPages}
            onClick={() => goToPage(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 p-0"
            disabled={currentPage === totalPages}
            onClick={() => goToPage(totalPages)}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
