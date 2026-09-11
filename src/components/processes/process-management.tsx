'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { License, Process } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  Cpu,
  Filter,
  MoreVertical,
  Copy,
  Trash2,
  CheckCircle,
  AlertCircle,
  HeartPulse,
  Activity,
} from 'lucide-react'
import { toast } from 'sonner'
import { handleCrudError, handleLoadError } from '@/lib/utils/error-handling'
import { PaginationControls } from '@/components/shared/pagination-controls'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

const DEFAULT_PAGE_SIZE = 25

/** Pull a single related resource id off a JSON:API relationship */
function relatedId(process: Process, name: 'machine' | 'license'): string | undefined {
  const data = process.relationships?.[name]?.data
  return data && !Array.isArray(data) ? data.id : undefined
}

export function ProcessManagement() {
  const [processes, setProcesses] = useState<Process[]>([])
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [licenseFilter, setLicenseFilter] = useState<string>('all')

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  const [killDialogOpen, setKillDialogOpen] = useState(false)
  const [killLoading, setKillLoading] = useState(false)
  const [selectedProcess, setSelectedProcess] = useState<Process | null>(null)

  const api = getKeygenApi()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.processes.list({
        page: { size: pageSize, number: currentPage },
        ...(licenseFilter !== 'all' && { license: licenseFilter }),
      })
      setProcesses(response.data || [])
      setTotalCount(response.meta?.count ?? (response.data?.length || 0))
    } catch (error: unknown) {
      handleLoadError(error, 'processes')
    } finally {
      setLoading(false)
    }
  }, [api.processes, pageSize, currentPage, licenseFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setCurrentPage(1)
  }, [licenseFilter, statusFilter, pageSize])

  // Licenses are loaded once to resolve names for the filter and the table —
  // a process only carries relationship ids.
  useEffect(() => {
    let cancelled = false

    const loadLicenses = async () => {
      try {
        const response = await api.licenses.list({ limit: 100 })
        if (!cancelled) setLicenses(response.data || [])
      } catch {
        // Non-fatal — the table falls back to showing raw ids
      }
    }

    loadLicenses()
    return () => {
      cancelled = true
    }
  }, [api.licenses])

  const licenseLabel = (id?: string) => {
    if (!id) return null
    const license = licenses.find((l) => l.id === id)
    return license?.attributes.name || license?.attributes.key?.substring(0, 16) || id.substring(0, 8)
  }

  // The API has no status filter for processes, so this narrows the loaded page
  // only — same approach as the machines list.
  const displayProcesses = processes.filter(
    (process) => statusFilter === 'all' || process.attributes.status === statusFilter
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ALIVE': return 'bg-green-100 text-green-800 border-green-200'
      case 'RESURRECTED': return 'bg-teal-100 text-teal-800 border-teal-200'
      case 'DEAD': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ALIVE': return <CheckCircle className="h-3 w-3" />
      case 'RESURRECTED': return <HeartPulse className="h-3 w-3" />
      case 'DEAD': return <AlertCircle className="h-3 w-3" />
      default: return <Activity className="h-3 w-3" />
    }
  }

  const formatDate = (value?: string | null) => {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const copy = (value: string, label: string) => {
    navigator.clipboard.writeText(value)
    toast.success(`${label} copied to clipboard`)
  }

  const handleKill = (process: Process) => {
    setSelectedProcess(process)
    setKillDialogOpen(true)
  }

  const confirmKill = async () => {
    if (!selectedProcess) return

    try {
      setKillLoading(true)
      await api.processes.kill(selectedProcess.id)
      setKillDialogOpen(false)
      setSelectedProcess(null)
      await loadData()
      toast.success('Process killed')
    } catch (error: unknown) {
      handleCrudError(error, 'delete', 'Process', {
        customMessage: 'Failed to kill process',
        onNotFound: () => {
          setKillDialogOpen(false)
          loadData()
        },
      })
    } finally {
      setKillLoading(false)
    }
  }

  const liveCount = processes.filter(
    (p) => p.attributes.status === 'ALIVE' || p.attributes.status === 'RESURRECTED'
  ).length
  const deadCount = processes.filter((p) => p.attributes.status === 'DEAD').length

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Processes</h1>
        <p className="text-muted-foreground">
          Running instances of your software. Each process consumes a seat against its
          policy&apos;s process limit.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              {licenseFilter === 'all' ? 'Across all licenses' : 'For the selected license'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Live</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{liveCount}</div>
            <p className="text-xs text-muted-foreground">On current page</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dead</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deadCount}</div>
            <p className="text-xs text-muted-foreground">Missed their heartbeat</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Select value={licenseFilter} onValueChange={setLicenseFilter}>
          <SelectTrigger className="w-[240px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by license" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All licenses</SelectItem>
            {licenses.map((license) => (
              <SelectItem key={license.id} value={license.id}>
                {license.attributes.name || license.attributes.key.substring(0, 20)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="ALIVE">Alive</SelectItem>
            <SelectItem value="RESURRECTED">Resurrected</SelectItem>
            <SelectItem value="DEAD">Dead</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Process List</CardTitle>
          <CardDescription>
            {totalCount} process{totalCount !== 1 ? 'es' : ''} total
            {statusFilter !== 'all' && ' — status filter applies to this page only'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">PID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Machine</TableHead>
                <TableHead>Last Heartbeat</TableHead>
                <TableHead>Next Heartbeat</TableHead>
                <TableHead className="w-[70px] pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: pageSize > 10 ? 10 : pageSize }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-6 w-6 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : displayProcesses.length > 0 ? (
                displayProcesses.map((process) => {
                  const machineId = relatedId(process, 'machine')
                  const licenseId = relatedId(process, 'license')

                  return (
                    <TableRow key={process.id}>
                      <TableCell className="pl-6">
                        <code className="text-sm bg-muted px-1.5 py-0.5 rounded font-mono break-all">
                          {process.attributes.pid}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`${getStatusColor(process.attributes.status)} flex items-center gap-1 w-fit`}
                        >
                          {getStatusIcon(process.attributes.status)}
                          {process.attributes.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {licenseLabel(licenseId) || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-sm font-mono text-muted-foreground">
                        {machineId ? machineId.substring(0, 8) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(process.attributes.lastHeartbeat)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(process.attributes.nextHeartbeat)}
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
                            <DropdownMenuItem onClick={() => copy(process.attributes.pid, 'PID')}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy PID
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copy(process.id, 'Process ID')}>
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Process ID
                            </DropdownMenuItem>
                            {machineId && (
                              <DropdownMenuItem onClick={() => copy(machineId, 'Machine ID')}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Machine ID
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleKill(process)}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Kill Process
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7}>
                    <div className="flex items-center justify-center h-32">
                      <div className="text-center">
                        <Cpu className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <div className="text-sm font-medium">No processes found</div>
                        <div className="text-xs text-muted-foreground">
                          {licenseFilter !== 'all' || statusFilter !== 'all'
                            ? 'Try adjusting your filters'
                            : 'Processes appear here once your software spawns them'}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

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

      <ConfirmDialog
        open={killDialogOpen}
        onOpenChange={setKillDialogOpen}
        title="Kill this process?"
        description={
          selectedProcess
            ? `This removes process ${selectedProcess.attributes.pid} and frees its seat immediately. If the software is still running it may respawn on its next heartbeat.`
            : undefined
        }
        confirmLabel="Kill Process"
        destructive
        loading={killLoading}
        onConfirm={confirmKill}
      />
    </div>
  )
}
