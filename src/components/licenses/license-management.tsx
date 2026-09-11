'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getKeygenApi } from '@/lib/api'
import { License, LicenseStatus, Policy } from '@/lib/types/keygen'

/** A policy's seat limits, used as the fallback when a license has no override */
interface PolicyLimitRow {
  maxMachines?: number
  maxProcesses?: number
}
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  Key,
  Calendar,
  CalendarCheck,
  Users,
  Activity,
  Pause,
  Play,
  Trash2,
  Edit,
  Copy,
  FileDown,
  Monitor,
  X,
  Loader2,
  ShieldCheck,
  Ban,
  Plus,
  Minus,
  RotateCcw,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleLoadError, handleCrudError } from '@/lib/utils/error-handling'
import { getErrorMessage, getErrorStatus } from '@/lib/utils/error-guards'
import { CreateLicenseDialog } from './create-license-dialog'
import { DeleteLicenseDialog } from './delete-license-dialog'
import { EditLicenseDialog } from './edit-license-dialog'
import { CheckoutLicenseDialog } from './checkout-license-dialog'
import { LicenseDetailsDialog } from './license-details-dialog'
import { PaginationControls } from '@/components/shared/pagination-controls'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

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

export function LicenseManagement() {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false)
  const [policyLimits, setPolicyLimits] = useState<Record<string, PolicyLimitRow>>({})
  // Process counts have to be fetched per license — unlike machines, no
  // relationship on the license carries a process count.
  const [processCounts, setProcessCounts] = useState<Record<string, number | null>>({})
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [revokeLoading, setRevokeLoading] = useState(false)
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS)

  const api = getKeygenApi()

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      // Escape to clear search
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setSearchTerm('')
        searchInputRef.current?.blur()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

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

    // If it contains hyphens and uppercase (license key pattern), search by key
    if (term.includes('-') && /[A-F0-9]{4,}/.test(term)) {
      query.key = term
    }

    // If it looks like an email, search by user
    if (term.includes('@')) {
      query.user = term
    }

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
        const response = await api.search.search<License>({
          type: 'licenses',
          query: searchQuery,
          op: 'OR',
          page: { size: pageSize, number: currentPage },
        })
        setLicenses(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      } else {
        // Normal paginated browsing
        setIsSearchMode(false)
        const response = await api.licenses.list({
          page: { size: pageSize, number: currentPage },
          ...(statusFilter !== 'all' && { status: statusFilter as LicenseStatus })
        })
        setLicenses(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      }
    } catch (error: unknown) {
      handleLoadError(error, 'licenses')
    } finally {
      setLoading(false)
    }
  }, [api.licenses, api.search, pageSize, currentPage, statusFilter, debouncedSearch, buildSearchQuery])

  // Load data whenever dependencies change
  useEffect(() => {
    loadData()
  }, [loadData])

  // A license only carries max* when it overrides its policy, so pull the
  // policies' own limits once to show an effective cap for everything else.
  useEffect(() => {
    let cancelled = false

    const loadPolicyLimits = async () => {
      try {
        const response = await api.policies.list({ limit: 100 })
        if (cancelled) return

        const limits: Record<string, PolicyLimitRow> = {}
        for (const policy of (response.data || []) as Policy[]) {
          limits[policy.id] = {
            maxMachines: policy.attributes.maxMachines ?? undefined,
            maxProcesses: policy.attributes.maxProcesses ?? undefined,
          }
        }
        setPolicyLimits(limits)
      } catch {
        // Non-fatal — the columns just fall back to showing the count alone
      }
    }

    loadPolicyLimits()
    return () => {
      cancelled = true
    }
  }, [api.policies])

  // One small request per visible license (page[size]=1, we only read
  // meta.count). Batched so a large page size doesn't fire 100 at once, and
  // deliberately not awaited by the table — counts fill in as they land.
  useEffect(() => {
    if (licenses.length === 0) return
    let cancelled = false

    const loadProcessCounts = async () => {
      const results: Record<string, number | null> = {}
      const BATCH = 6

      for (let i = 0; i < licenses.length; i += BATCH) {
        if (cancelled) return

        const batch = licenses.slice(i, i + BATCH)
        await Promise.all(
          batch.map(async (license) => {
            try {
              // Not all instances return meta.count on this endpoint, so ask for
              // real rows and fall back to counting them. Caps at 100 when the
              // count is absent, which is well past any sane seat limit.
              const response = await api.processes.list({
                license: license.id,
                limit: 100,
              })
              results[license.id] = response.meta?.count ?? (response.data?.length || 0)
            } catch (error: unknown) {
              // Rendered as an em dash. Surface the reason in development —
              // a 404 here usually means the instance has no processes endpoint.
              if (process.env.NODE_ENV !== 'production') {
                console.error(
                  `Process count failed for license ${license.id}:`,
                  getErrorStatus(error),
                  getErrorMessage(error)
                )
              }
              results[license.id] = null
            }
          })
        )

        if (!cancelled) setProcessCounts({ ...results })
      }
    }

    setProcessCounts({})
    loadProcessCounts()
    return () => {
      cancelled = true
    }
  }, [api.processes, licenses])

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, pageSize, debouncedSearch])

  // Display data
  const displayLicenses = licenses
  const displayTotalCount = totalCount

  const isLoading = loading

  // Refresh handler — used after CRUD operations that should keep the current page
  const handleRefresh = useCallback(async () => {
    await loadData()
  }, [loadData])

  // After creating a license, jump to page 1 — newly created records are returned
  // first (reverse-chronological order), so this is where the new license will be.
  // If we're already on page 1, the page-number state won't change, so force a
  // reload explicitly instead of relying on the page-reset effect.
  const handleLicenseCreated = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
  }, [currentPage, loadData])

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'bg-green-100 text-green-800 border-green-200'
      case 'expiring': return 'bg-amber-100 text-amber-800 border-amber-200'
      case 'suspended': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'expired': return 'bg-red-100 text-red-800 border-red-200'
      case 'banned': return 'bg-red-100 text-red-800 border-red-200'
      case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Keys can run to hundreds of characters, which is unreadable inline and
  // overflows the confirm dialog — fall back to a truncated key, as the delete
  // dialog already does.
  const describeLicense = (license: License) =>
    license.attributes.name || `${license.attributes.key.substring(0, 20)}...`

  // The machine count rides along on the license's own relationship metadata,
  // so the list needs no extra request per row.
  const getMachineUsage = (license: License) => {
    const count = license.relationships?.machines?.meta?.count

    const policyRef = license.relationships?.policy?.data
    const policyId = policyRef && !Array.isArray(policyRef) ? policyRef.id : undefined

    // A per-license override wins; otherwise fall back to the policy's limit
    const max = license.attributes.maxMachines ?? (policyId ? policyLimits[policyId]?.maxMachines : undefined)

    return { count, max }
  }

  // Same shape as machine usage, but the count is fetched rather than free.
  // `undefined` means still loading; `null` means the request failed.
  const getProcessUsage = (license: License) => {
    const count = processCounts[license.id]

    const policyRef = license.relationships?.policy?.data
    const policyId = policyRef && !Array.isArray(policyRef) ? policyRef.id : undefined
    const max = license.attributes.maxProcesses ?? (policyId ? policyLimits[policyId]?.maxProcesses : undefined)

    return { count, max }
  }

  // `suspended` is an explicit attribute, but fall back to the status in case an
  // older instance omits it — a SUSPENDED license must never offer "Suspend".
  const isSuspended = (license: License) =>
    license.attributes.suspended ?? license.attributes.status.toUpperCase() === 'SUSPENDED'

  // Renewable while expiring as well as after it has fully expired
  const isRenewable = (license: License) =>
    ['EXPIRED', 'EXPIRING'].includes(license.attributes.status.toUpperCase())

  // The API returns status in uppercase (e.g. "EXPIRED"), but comparisons and
  // display throughout this app assume lowercase — normalize once at the source.
  const formatStatus = (status: string) => {
    const lower = status.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleSuspendLicense = async (license: License) => {
    try {
      await api.licenses.suspend(license.id)
      await handleRefresh()
      toast.success('License suspended successfully')
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License', { customMessage: 'Failed to suspend license' })
    }
  }

  const handleReinstateLicense = async (license: License) => {
    try {
      await api.licenses.reinstate(license.id)
      await handleRefresh()
      toast.success('License reinstated successfully')
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License', { customMessage: 'Failed to reinstate license' })
    }
  }

  const handleRenewLicense = async (license: License) => {
    try {
      await api.licenses.renew(license.id)
      await handleRefresh()
      toast.success('License renewed successfully')
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License', { customMessage: 'Failed to renew license' })
    }
  }

  const handleValidateLicense = async (license: License) => {
    try {
      const result = await api.licenses.validate(license.id)
      // A failed validation is still HTTP 200 — the verdict lives in meta.
      if (result.meta?.valid) {
        toast.success('License is valid')
      } else {
        toast.warning(
          `License is not valid: ${result.meta?.detail || result.meta?.code || 'unknown reason'}`
        )
      }
      await handleRefresh()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License', { customMessage: 'Failed to validate license' })
    }
  }

  const handleCheckInLicense = async (license: License) => {
    try {
      await api.licenses.checkIn(license.id)
      await handleRefresh()
      toast.success('License checked in successfully')
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License', { customMessage: 'Failed to check in license' })
    }
  }

  const handleUsageChange = async (
    license: License,
    action: 'increment' | 'decrement' | 'reset'
  ) => {
    try {
      if (action === 'increment') {
        await api.licenses.incrementUsage(license.id)
      } else if (action === 'decrement') {
        await api.licenses.decrementUsage(license.id)
      } else {
        await api.licenses.resetUsage(license.id)
      }
      await handleRefresh()
      toast.success(
        action === 'reset' ? 'License usage reset' : `License usage ${action}ed`
      )
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License', {
        customMessage: `Failed to ${action} license usage`,
      })
    }
  }

  const handleRevokeLicense = (license: License) => {
    setSelectedLicense(license)
    setRevokeDialogOpen(true)
  }

  const confirmRevokeLicense = async () => {
    if (!selectedLicense) return

    try {
      setRevokeLoading(true)
      await api.licenses.revoke(selectedLicense.id)
      setRevokeDialogOpen(false)
      setSelectedLicense(null)
      await handleRefresh()
      toast.success('License revoked')
    } catch (error: unknown) {
      handleCrudError(error, 'delete', 'License', {
        customMessage: 'Failed to revoke license',
        onNotFound: () => {
          setRevokeDialogOpen(false)
          handleRefresh()
        },
      })
    } finally {
      setRevokeLoading(false)
    }
  }

  const copyLicenseKey = (key: string) => {
    navigator.clipboard.writeText(key)
    toast.success('License key copied to clipboard')
  }

  const handleDeleteLicense = (license: License) => {
    setSelectedLicense(license)
    setDeleteDialogOpen(true)
  }

  const handleEditLicense = (license: License) => {
    setSelectedLicense(license)
    setEditDialogOpen(true)
  }

  const handleCheckoutLicense = (license: License) => {
    setSelectedLicense(license)
    setCheckoutDialogOpen(true)
  }

  const handleViewMachines = (license: License) => {
    setSelectedLicense(license)
    setDetailsDialogOpen(true)
  }

  const handleGenerateToken = async (license: License) => {
    try {
      const response = await api.licenses.generateActivationToken(license.id)
      const tokenData = response.data as { attributes?: { token?: string } }
      if (tokenData?.attributes?.token) {
        await navigator.clipboard.writeText(tokenData.attributes.token)
        toast.success('Activation token copied to clipboard')
      } else {
        toast.error('Failed to generate activation token')
      }
    } catch (error: unknown) {
      handleCrudError(error, 'create', 'Activation token', { customMessage: 'Failed to generate activation token' })
    }
  }

  const clearSearch = () => {
    setSearchTerm('')
    setCurrentPage(1)
    searchInputRef.current?.focus()
  }

  // Stats from currently loaded page
  const activeCount = licenses.filter(l => l.attributes.status === 'ACTIVE').length
  const expiredCount = licenses.filter(l => l.attributes.status === 'EXPIRED').length
  const totalUsage = licenses.reduce((acc, l) => acc + (l.attributes.uses || 0), 0)

  return (
    <div className="space-y-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Licenses</h1>
          <p className="text-muted-foreground">
            Manage and monitor your software licenses
          </p>
        </div>
        <CreateLicenseDialog onLicenseCreated={handleLicenseCreated} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              {isSearchMode ? `${totalCount} matching search` : 'All licenses'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">Currently active licenses</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expired</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{expiredCount}</div>
            <p className="text-xs text-muted-foreground">Need renewal</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Metered Usage</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsage}</div>
            <p className="text-xs text-muted-foreground">Consumed via increment-usage</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search by key, name, or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-9 pr-20"
          />
          {searchTerm ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSearch}
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          )}
          {isSearchMode && loading && (
            <Loader2 className="absolute right-10 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="EXPIRING">Expiring</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="EXPIRED">Expired</SelectItem>
            <SelectItem value="INACTIVE">Inactive</SelectItem>
            <SelectItem value="BANNED">Banned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Licenses Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>License List</CardTitle>
              <CardDescription>
                {isSearchMode
                  ? `${totalCount} result${totalCount !== 1 ? 's' : ''} for "${debouncedSearch}"`
                  : `${totalCount} license${totalCount !== 1 ? 's' : ''} total`
                }
              </CardDescription>
            </div>
            {isSearchMode && (
              <Badge variant="secondary" className="text-xs">
                Search results
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">License Key</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Machines</TableHead>
                <TableHead>Processes</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[70px] pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Skeleton loading rows
                Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-6 w-6 rounded" />
                      </div>
                    </TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-6 w-6 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : displayLicenses.length > 0 ? (
                displayLicenses.map((license) => (
                  <TableRow key={license.id} className="group">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-2">
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono">
                          {license.attributes.key.substring(0, 20)}...
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyLicenseKey(license.attributes.key)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {license.attributes.name || (
                        <span className="text-muted-foreground italic">Unnamed</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getStatusColor(license.attributes.status)}
                      >
                        {formatStatus(license.attributes.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {license.attributes.uses || 0}
                        {license.attributes.maxUses ? (
                          <span className="text-muted-foreground"> / {license.attributes.maxUses}</span>
                        ) : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const { count, max } = getMachineUsage(license)
                        if (count === undefined) {
                          return <span className="text-muted-foreground">—</span>
                        }
                        return (
                          <span className="tabular-nums">
                            {count}
                            {max ? <span className="text-muted-foreground"> / {max}</span> : ''}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const { count, max } = getProcessUsage(license)
                        // undefined = still loading, null = request failed
                        if (count === undefined) {
                          return <Skeleton className="h-4 w-10" />
                        }
                        if (count === null) {
                          return <span className="text-muted-foreground">—</span>
                        }
                        return (
                          <span className="tabular-nums">
                            {count}
                            {max ? <span className="text-muted-foreground"> / {max}</span> : ''}
                          </span>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {license.attributes.expiry
                        ? formatDate(license.attributes.expiry)
                        : <span className="text-muted-foreground">Never</span>
                      }
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(license.attributes.created)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleEditLicense(license)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit License
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleViewMachines(license)}>
                            <Monitor className="mr-2 h-4 w-4" />
                            View Machines
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGenerateToken(license)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Generate Token
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCheckoutLicense(license)}>
                            <FileDown className="mr-2 h-4 w-4" />
                            Download License File
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleValidateLicense(license)}>
                            <ShieldCheck className="mr-2 h-4 w-4" />
                            Validate
                          </DropdownMenuItem>
                          {license.attributes.requireCheckIn && (
                            <DropdownMenuItem onClick={() => handleCheckInLicense(license)}>
                              <CalendarCheck className="mr-2 h-4 w-4" />
                              Check In
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <Activity className="mr-2 h-4 w-4" />
                              Usage
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              <DropdownMenuItem onClick={() => handleUsageChange(license, 'increment')}>
                                <Plus className="mr-2 h-4 w-4" />
                                Increment
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUsageChange(license, 'decrement')}
                                disabled={(license.attributes.uses || 0) === 0}
                              >
                                <Minus className="mr-2 h-4 w-4" />
                                Decrement
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleUsageChange(license, 'reset')}
                                disabled={(license.attributes.uses || 0) === 0}
                              >
                                <RotateCcw className="mr-2 h-4 w-4" />
                                Reset
                              </DropdownMenuItem>
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          {isSuspended(license) ? (
                            <DropdownMenuItem
                              onClick={() => handleReinstateLicense(license)}
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Reinstate
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleSuspendLicense(license)}
                            >
                              <Pause className="mr-2 h-4 w-4" />
                              Suspend
                            </DropdownMenuItem>
                          )}
                          {isRenewable(license) && (
                            <DropdownMenuItem
                              onClick={() => handleRenewLicense(license)}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              Renew
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRevokeLicense(license)}
                            className="text-destructive"
                          >
                            <Ban className="mr-2 h-4 w-4" />
                            Revoke
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteLicense(license)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9}>
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <Key className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <div className="text-sm font-medium">No licenses found</div>
                        <div className="text-xs text-muted-foreground">
                          {searchTerm || statusFilter !== 'all'
                            ? 'Try adjusting your search or filters'
                            : 'Get started by creating your first license'
                          }
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!isLoading && (
            <PaginationControls
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={displayTotalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      {selectedLicense && (
        <DeleteLicenseDialog
          license={selectedLicense}
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onLicenseDeleted={handleRefresh}
        />
      )}

      {/* Edit Dialog */}
      {selectedLicense && (
        <EditLicenseDialog
          license={selectedLicense}
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          onLicenseUpdated={handleRefresh}
        />
      )}

      {/* Checkout (License File) Dialog */}
      {selectedLicense && (
        <CheckoutLicenseDialog
          license={selectedLicense}
          open={checkoutDialogOpen}
          onOpenChange={setCheckoutDialogOpen}
        />
      )}

      {/* Details (Machines) Dialog */}
      {selectedLicense && (
        <LicenseDetailsDialog
          license={selectedLicense}
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
        />
      )}

      {/* Revoke Confirmation */}
      <ConfirmDialog
        open={revokeDialogOpen}
        onOpenChange={setRevokeDialogOpen}
        title="Revoke this license?"
        description={
          selectedLicense
            ? `This permanently deletes ${describeLicense(selectedLicense)} and immediately deletes every machine activated against it. This cannot be undone.`
            : undefined
        }
        confirmLabel="Revoke License"
        destructive
        loading={revokeLoading}
        onConfirm={confirmRevokeLicense}
      />
    </div>
  )
}
