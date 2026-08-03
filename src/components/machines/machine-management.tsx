'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Machine } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Filter,
  MoreVertical,
  Monitor,
  Activity,
  AlertCircle,
  CheckCircle,
  Trash2,
  Key,
  Copy,
  Cpu,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleLoadError, handleCrudError } from '@/lib/utils/error-handling'
import { ActivateMachineDialog } from './activate-machine-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
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

export function MachineManagement() {
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const api = getKeygenApi()
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [pendingMachine, setPendingMachine] = useState<Machine | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS)

  // Build search query from the search term.
  // Uses OR logic so any matching field returns results.
  const buildSearchQuery = useCallback((term: string) => {
    const query: Record<string, string> = {}
    if (term.length < 3) return query

    // Always search by name (ILIKE substring match)
    query.name = term

    // If it looks like a UUID, search by id
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
    if (uuidPattern.test(term)) {
      query.id = term
    }

    // Speculative fields — not documented as searchable, but harmless to
    // include with OR since a non-matching field simply contributes nothing
    query.fingerprint = term
    query.ip = term

    return query
  }, [])

  // Unified data loader: handles both search and browse modes
  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const searchQuery = debouncedSearch ? buildSearchQuery(debouncedSearch) : null
      const hasValidSearch = searchQuery && Object.keys(searchQuery).length > 0

      if (hasValidSearch) {
        // Server-side search via POST /search with pagination
        setIsSearchMode(true)
        const response = await api.search.search<Machine>({
          type: 'machines',
          query: searchQuery,
          op: 'OR',
          page: { size: pageSize, number: currentPage },
        })
        setMachines(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      } else {
        // Normal paginated browsing
        setIsSearchMode(false)
        const response = await api.machines.list({
          page: { size: pageSize, number: currentPage },
        })
        setMachines(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      }
    } catch (error: unknown) {
      handleLoadError(error, 'machines')
    } finally {
      setLoading(false)
    }
  }, [api.machines, api.search, pageSize, currentPage, debouncedSearch, buildSearchQuery])

  // Load data whenever dependencies change
  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, pageSize, debouncedSearch])

  // After activating a machine, jump to page 1 — newly created records are
  // returned first (reverse-chronological order), so this is where the new
  // machine will be. If we're already on page 1, force a reload explicitly
  // instead of relying on the page-reset effect above.
  const handleMachineActivated = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
  }, [currentPage, loadData])

  // The API returns heartbeatStatus as e.g. "ALIVE" / "NOT_STARTED" — uppercase
  // with underscores — while the rest of this file assumes the lowercase,
  // hyphenated form the TS type declares. Normalize once at the source.
  const normalizeHeartbeatStatus = (heartbeatStatus: string) =>
    heartbeatStatus?.toLowerCase().replace(/_/g, '-') ?? ''

  // Client-side heartbeat status filter — applied only to the currently
  // loaded page, since heartbeatStatus is not a confirmed server-searchable
  // field. This is on top of the properly paginated `machines` state.
  const filteredMachines = machines.filter(machine => {
    const status = normalizeHeartbeatStatus(machine.attributes.heartbeatStatus)
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && status === 'alive') ||
      (statusFilter === 'inactive' && status === 'dead') ||
      (statusFilter === 'not-started' && status === 'not-started')

    return matchesStatus
  })

  const getStatusColor = (heartbeatStatus: string) => {
    switch (normalizeHeartbeatStatus(heartbeatStatus)) {
      case 'alive': return 'bg-green-100 text-green-800 border-green-200'
      case 'dead': return 'bg-red-100 text-red-800 border-red-200'
      case 'not-started': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (heartbeatStatus: string) => {
    switch (normalizeHeartbeatStatus(heartbeatStatus)) {
      case 'alive': return <CheckCircle className="h-3 w-3" />
      case 'dead': return <AlertCircle className="h-3 w-3" />
      case 'not-started': return <Activity className="h-3 w-3" />
      default: return <Activity className="h-3 w-3" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleDeleteMachine = (machine: Machine) => {
    setPendingMachine(machine)
    setConfirmDeleteOpen(true)
  }

  const confirmDeleteMachine = async () => {
    if (!pendingMachine) return
    setConfirmLoading(true)
    try {
      await api.machines.deactivate(pendingMachine.id)
      await loadData()
      toast.success('Machine deleted successfully')
      setConfirmDeleteOpen(false)
      setPendingMachine(null)
    } catch (error: unknown) {
      handleCrudError(error, 'delete', 'Machine', {
        customMessage: 'Failed to delete machine'
      })
    } finally {
      setConfirmLoading(false)
    }
  }

  const copyFingerprint = (fingerprint: string) => {
    navigator.clipboard.writeText(fingerprint)
    toast.success('Machine fingerprint copied to clipboard')
  }

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id)
    toast.success('Machine ID copied to clipboard')
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Machines</h1>
          <p className="text-muted-foreground">
            Monitor and manage licensed machines
          </p>
        </div>
        <ActivateMachineDialog onMachineActivated={handleMachineActivated} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Machines</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              {isSearchMode ? 'Matching search' : 'Registered machines'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {machines.filter(m => normalizeHeartbeatStatus(m.attributes.heartbeatStatus) === 'alive').length}
            </div>
            <p className="text-xs text-muted-foreground">
              On current page
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inactive</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {machines.filter(m => normalizeHeartbeatStatus(m.attributes.heartbeatStatus) === 'dead').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Offline machines
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Not Started</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {machines.filter(m => normalizeHeartbeatStatus(m.attributes.heartbeatStatus) === 'not-started').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Never activated
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search machines..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="not-started">Not Started</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Machines Table */}
      <Card>
        <CardHeader>
          <CardTitle>Machine List</CardTitle>
          <CardDescription>
            A list of all registered machines
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading machines...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fingerprint</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Hostname</TableHead>
                  <TableHead>Last Heartbeat</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMachines.map((machine) => (
                  <TableRow key={machine.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-muted px-1 rounded">
                          {machine.attributes.fingerprint?.substring(0, 12)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyFingerprint(machine.attributes.fingerprint || '')}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {machine.attributes.name || 'Unnamed Machine'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStatusColor(machine.attributes.heartbeatStatus)} flex items-center gap-1 w-fit`}
                      >
                        {getStatusIcon(machine.attributes.heartbeatStatus)}
                        {machine.attributes.heartbeatStatus?.replace('_', ' ').toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {machine.attributes.ip || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {machine.attributes.hostname || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {machine.attributes.lastHeartbeat 
                        ? formatDate(machine.attributes.lastHeartbeat)
                        : 'Never'
                      }
                    </TableCell>
                    <TableCell>
                      {formatDate(machine.attributes.created)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => copyId(machine.id)}>
                            <Key className="mr-2 h-4 w-4" />
                            Copy Machine ID
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => copyFingerprint(machine.attributes.fingerprint || '')}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Fingerprint
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteMachine(machine)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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

          {!loading && filteredMachines.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <Monitor className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm font-medium">No machines found</div>
                <div className="text-xs text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Machines will appear here when licenses are activated'
                  }
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete machine?"
        description="Are you sure you want to delete this machine? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={confirmLoading}
        onConfirm={confirmDeleteMachine}
      />
    </div>
  )
}
