'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Entitlement } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Shield, Trash2, Edit, Eye, Code } from 'lucide-react'
import { toast } from 'sonner'
import { handleLoadError } from '@/lib/utils/error-handling'
import { CreateEntitlementDialog } from './create-entitlement-dialog'
import { EditEntitlementDialog } from './edit-entitlement-dialog'
import { DeleteEntitlementDialog } from './delete-entitlement-dialog'
import { EntitlementDetailsDialog } from './entitlement-details-dialog'
import { PaginationControls } from '@/components/shared/pagination-controls'

const DEFAULT_PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

export function EntitlementManagement() {
  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedEntitlement, setSelectedEntitlement] = useState<Entitlement | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS)

  const api = getKeygenApi()

  const buildSearchQuery = useCallback((term: string) => {
    const query: Record<string, string> = {}
    if (term.length < 3) return query

    query.name = term
    query.code = term

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
    if (uuidPattern.test(term)) {
      query.id = term
    }

    return query
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const searchQuery = debouncedSearch ? buildSearchQuery(debouncedSearch) : null
      const hasValidSearch = searchQuery && Object.keys(searchQuery).length > 0

      if (hasValidSearch) {
        setIsSearchMode(true)
        const response = await api.search.search<Entitlement>({
          type: 'entitlements',
          query: searchQuery,
          op: 'OR',
          page: { size: pageSize, number: currentPage },
        })
        setEntitlements(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      } else {
        setIsSearchMode(false)
        const response = await api.entitlements.list({
          page: { size: pageSize, number: currentPage },
        })
        setEntitlements(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      }
    } catch (error: unknown) {
      handleLoadError(error, 'entitlements')
    } finally {
      setLoading(false)
    }
  }, [api.entitlements, api.search, pageSize, currentPage, debouncedSearch, buildSearchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize, debouncedSearch])

  const handleEdit = (entitlement: Entitlement) => {
    setSelectedEntitlement(entitlement)
    setEditDialogOpen(true)
  }

  const handleDelete = (entitlement: Entitlement) => {
    setSelectedEntitlement(entitlement)
    setDeleteDialogOpen(true)
  }

  const handleViewDetails = (entitlement: Entitlement) => {
    setSelectedEntitlement(entitlement)
    setDetailsDialogOpen(true)
  }

  const handleEntitlementCreated = () => {
    setCreateDialogOpen(false)
    // Jump to page 1 — newly created records are returned first (reverse-
    // chronological order), so this is where the new entitlement will be. If
    // we're already on page 1, the page-number state won't change, so force a
    // reload explicitly instead of relying on the page-reset effect above.
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
    toast.success('Entitlement created successfully')
  }

  const handleEntitlementUpdated = () => {
    setEditDialogOpen(false)
    setSelectedEntitlement(null)
    loadData()
    toast.success('Entitlement updated successfully')
  }

  const handleEntitlementDeleted = () => {
    setDeleteDialogOpen(false)
    setSelectedEntitlement(null)
    loadData()
    toast.success('Entitlement deleted successfully')
  }

  // `entitlements` is already the current server page (and, in search mode, the
  // matching set) — no further client-side filtering needed on top of it.
  const filteredEntitlements = entitlements

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Entitlements</h1>
          <p className="text-muted-foreground">
            Manage feature entitlements and permissions for your products
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Entitlement
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Entitlements</CardTitle>
          <CardDescription>Find entitlements by name or code</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entitlements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Entitlements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Entitlements ({totalCount})
          </CardTitle>
          <CardDescription>
            {isSearchMode ? 'Matching search' : 'Manage feature toggles and permissions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntitlements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No entitlements match your search.' : 'No entitlements found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntitlements.map((entitlement) => (
                    <TableRow key={entitlement.id}>
                      <TableCell className="font-medium">{entitlement.attributes.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          <Code className="h-3 w-3 mr-1" />
                          {entitlement.attributes.code}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(entitlement.attributes.created)}</TableCell>
                      <TableCell>{formatDate(entitlement.attributes.updated)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(entitlement)} className="gap-2">
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(entitlement)} className="gap-2">
                              <Edit className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(entitlement)} 
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}

          {!loading && (
            <PaginationControls
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateEntitlementDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onEntitlementCreated={handleEntitlementCreated}
      />

      {selectedEntitlement && (
        <>
          <EditEntitlementDialog
            entitlement={selectedEntitlement}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onEntitlementUpdated={handleEntitlementUpdated}
          />
          <DeleteEntitlementDialog
            entitlement={selectedEntitlement}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onEntitlementDeleted={handleEntitlementDeleted}
          />
          <EntitlementDetailsDialog
            entitlement={selectedEntitlement}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
          />
        </>
      )}
    </div>
  )
}
