'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Group } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Users, Trash2, Edit, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { handleLoadError } from '@/lib/utils/error-handling'
import { CreateGroupDialog } from './create-group-dialog'
import { EditGroupDialog } from './edit-group-dialog'
import { DeleteGroupDialog } from './delete-group-dialog'
import { GroupDetailsDialog } from './group-details-dialog'
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

export function GroupManagement() {
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)

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
        const response = await api.search.search<Group>({
          type: 'groups',
          query: searchQuery,
          op: 'OR',
          page: { size: pageSize, number: currentPage },
        })
        setGroups(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      } else {
        setIsSearchMode(false)
        const response = await api.groups.list({
          page: { size: pageSize, number: currentPage },
        })
        setGroups(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      }
    } catch (error: unknown) {
      handleLoadError(error, 'groups')
    } finally {
      setLoading(false)
    }
  }, [api.groups, api.search, pageSize, currentPage, debouncedSearch, buildSearchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize, debouncedSearch])

  const handleEdit = (group: Group) => {
    setSelectedGroup(group)
    setEditDialogOpen(true)
  }

  const handleDelete = (group: Group) => {
    setSelectedGroup(group)
    setDeleteDialogOpen(true)
  }

  const handleViewDetails = (group: Group) => {
    setSelectedGroup(group)
    setDetailsDialogOpen(true)
  }

  const handleGroupCreated = () => {
    setCreateDialogOpen(false)
    // Jump to page 1 — newly created records are returned first (reverse-
    // chronological order), so this is where the new group will be. If we're
    // already on page 1, the page-number state won't change, so force a
    // reload explicitly instead of relying on the page-reset effect above.
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
    toast.success('Group created successfully')
  }

  const handleGroupUpdated = () => {
    setEditDialogOpen(false)
    setSelectedGroup(null)
    loadData()
    toast.success('Group updated successfully')
  }

  const handleGroupDeleted = () => {
    setDeleteDialogOpen(false)
    setSelectedGroup(null)
    loadData()
    toast.success('Group deleted successfully')
  }

  // `groups` is already the current server page (and, in search mode, the matching
  // set) — no further client-side name filtering needed on top of it.
  const filteredGroups = groups

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
          <h1 className="text-3xl font-bold tracking-tight">Groups</h1>
          <p className="text-muted-foreground">
            Organize users and licenses into groups for easier management
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Search Groups</CardTitle>
          <CardDescription>Find groups by name</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search groups..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Groups Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Groups ({totalCount})
          </CardTitle>
          <CardDescription>
            {isSearchMode ? 'Matching search' : 'Manage your groups and their configurations'}
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
                  <TableHead>Max Licenses</TableHead>
                  <TableHead>Max Machines</TableHead>
                  <TableHead>Max Users</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      {searchTerm ? 'No groups match your search.' : 'No groups found.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredGroups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.attributes.name}</TableCell>
                      <TableCell>
                        {group.attributes.maxLicenses ? (
                          <Badge variant="secondary">{group.attributes.maxLicenses}</Badge>
                        ) : (
                          <Badge variant="outline">Unlimited</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {group.attributes.maxMachines ? (
                          <Badge variant="secondary">{group.attributes.maxMachines}</Badge>
                        ) : (
                          <Badge variant="outline">Unlimited</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {group.attributes.maxUsers ? (
                          <Badge variant="secondary">{group.attributes.maxUsers}</Badge>
                        ) : (
                          <Badge variant="outline">Unlimited</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(group.attributes.created)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleViewDetails(group)} className="gap-2">
                              <Eye className="h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(group)} className="gap-2">
                              <Edit className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDelete(group)} 
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
      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onGroupCreated={handleGroupCreated}
      />

      {selectedGroup && (
        <>
          <EditGroupDialog
            group={selectedGroup}
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onGroupUpdated={handleGroupUpdated}
          />
          <DeleteGroupDialog
            group={selectedGroup}
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onGroupDeleted={handleGroupDeleted}
          />
          <GroupDetailsDialog
            group={selectedGroup}
            open={detailsDialogOpen}
            onOpenChange={setDetailsDialogOpen}
          />
        </>
      )}
    </div>
  )
}
