'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { License, Machine } from '@/lib/types/keygen'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Key, Monitor, Calendar, Info, CheckCircle, AlertCircle, Activity } from 'lucide-react'
import { handleLoadError } from '@/lib/utils/error-handling'

interface LicenseDetailsDialogProps {
  license: License
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Same normalization as machine-management.tsx — the API returns heartbeatStatus
// as e.g. "ALIVE" / "NOT_STARTED", uppercase with underscores.
const normalizeHeartbeatStatus = (heartbeatStatus: string) =>
  heartbeatStatus?.toLowerCase().replace(/_/g, '-') ?? ''

const heartbeatColor = (heartbeatStatus: string) => {
  switch (normalizeHeartbeatStatus(heartbeatStatus)) {
    case 'alive': return 'bg-green-100 text-green-800 border-green-200'
    case 'dead': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

const heartbeatIcon = (heartbeatStatus: string) => {
  switch (normalizeHeartbeatStatus(heartbeatStatus)) {
    case 'alive': return <CheckCircle className="h-3 w-3" />
    case 'dead': return <AlertCircle className="h-3 w-3" />
    default: return <Activity className="h-3 w-3" />
  }
}

// A null limit means the license has no override and inherits its policy's value
const formatLimit = (value?: number | null) =>
  value == null ? 'Policy default' : value.toLocaleString()

const formatByteLimit = (value?: number | null) => {
  if (value == null) return 'Policy default'

  const mib = value / (1024 * 1024)
  return mib >= 1024
    ? `${(mib / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} GiB`
    : `${Math.round(mib).toLocaleString()} MiB`
}

export function LicenseDetailsDialog({ license, open, onOpenChange }: LicenseDetailsDialogProps) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [machineCount, setMachineCount] = useState(0)
  const [loadingMachines, setLoadingMachines] = useState(false)
  // Process seats have to be counted with their own request — unlike machines,
  // no relationship on the license carries a process count.
  const [processCount, setProcessCount] = useState<number | null>(null)
  const [policyMaxProcesses, setPolicyMaxProcesses] = useState<number | null>(null)

  const api = getKeygenApi()

  const loadMachines = useCallback(async () => {
    if (!license.id) return

    setLoadingMachines(true)
    try {
      const response = await api.machines.list({ license: license.id, limit: 100 })
      setMachines(response.data || [])
      setMachineCount(response.meta?.count ?? (response.data?.length || 0))
    } catch (error: unknown) {
      handleLoadError(error, 'license machines')
    } finally {
      setLoadingMachines(false)
    }
  }, [api.machines, license.id])

  const loadProcessUsage = useCallback(async () => {
    try {
      // Ask for real rows rather than just meta.count — not all instances return
      // a count on this endpoint, in which case the rows are the only source.
      const response = await api.processes.list({ license: license.id, limit: 100 })
      setProcessCount(response.meta?.count ?? (response.data?.length || 0))
    } catch {
      // Non-fatal — the seat row is simply omitted
      setProcessCount(null)
    }

    // maxProcesses is inherited from the policy unless the license overrides it
    if (license.attributes.maxProcesses != null) {
      setPolicyMaxProcesses(license.attributes.maxProcesses)
      return
    }

    const policyRef = license.relationships?.policy?.data
    const policyId = policyRef && !Array.isArray(policyRef) ? policyRef.id : undefined
    if (!policyId) return

    try {
      const response = await api.policies.get(policyId)
      setPolicyMaxProcesses(response.data?.attributes.maxProcesses ?? null)
    } catch {
      setPolicyMaxProcesses(null)
    }
  }, [api.processes, api.policies, license])

  useEffect(() => {
    if (open && license.id) {
      loadMachines()
      loadProcessUsage()
    }
  }, [open, license.id, loadMachines, loadProcessUsage])

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            License Details: {license.attributes.name || 'Unnamed License'}
          </DialogTitle>
          <DialogDescription>
            View detailed information about this license and the machines it&apos;s activated on.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* License Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                License Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Key</label>
                  <p className="text-sm font-mono break-all">{license.attributes.key}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">ID</label>
                  <p className="text-sm font-mono">{license.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <p className="text-sm">
                    <Badge variant={license.attributes.status.toLowerCase() === 'active' ? 'default' : 'secondary'}>
                      {license.attributes.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Machines Used</label>
                  <p className="text-sm">
                    <Badge variant="secondary">{machineCount}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Expiry</label>
                  <p className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {license.attributes.expiry ? formatDate(license.attributes.expiry) : 'Never'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Uses</label>
                  <p className="text-sm">
                    {license.attributes.uses ?? 0}
                    {license.attributes.maxUses != null && ` / ${license.attributes.maxUses}`}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Process Seats</label>
                  <p className="text-sm">
                    {processCount === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <>
                        {processCount}
                        {policyMaxProcesses != null && (
                          <span className="text-muted-foreground"> / {policyMaxProcesses}</span>
                        )}
                      </>
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Validated</label>
                  <p className="text-sm">{formatDate(license.attributes.lastValidated)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Last Checked Out</label>
                  <p className="text-sm">{formatDate(license.attributes.lastCheckOut)}</p>
                </div>
              </div>

              {license.attributes.requireCheckIn && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Last Check-In</label>
                    <p className="text-sm">{formatDate(license.attributes.lastCheckIn)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Next Check-In</label>
                    <p className="text-sm">{formatDate(license.attributes.nextCheckIn)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-muted-foreground">Limits</label>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Machines: </span>
                    {formatLimit(license.attributes.maxMachines)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Processes: </span>
                    {formatLimit(license.attributes.maxProcesses)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Users: </span>
                    {formatLimit(license.attributes.maxUsers)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Cores: </span>
                    {formatLimit(license.attributes.maxCores)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Memory: </span>
                    {formatByteLimit(license.attributes.maxMemory)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Disk: </span>
                    {formatByteLimit(license.attributes.maxDisk)}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {license.attributes.protected && <Badge variant="outline">Protected</Badge>}
                {license.attributes.floating && <Badge variant="outline">Floating</Badge>}
                {license.attributes.strict && <Badge variant="outline">Strict</Badge>}
                {license.attributes.requireHeartbeat && <Badge variant="outline">Requires heartbeat</Badge>}
                {license.attributes.requireCheckIn && <Badge variant="outline">Requires check-in</Badge>}
                {license.attributes.version && (
                  <Badge variant="outline">Version {license.attributes.version}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Machines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Machines ({machineCount})
              </CardTitle>
              <CardDescription>
                Machines this license is currently activated on
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingMachines ? (
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : machines.length > 0 ? (
                <div className="space-y-2">
                  {machines.map((machine) => (
                    <div key={machine.id} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="text-sm font-medium">
                          {machine.attributes.name || machine.attributes.hostname || 'Unnamed Machine'}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {machine.attributes.fingerprint}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`${heartbeatColor(machine.attributes.heartbeatStatus)} flex items-center gap-1 w-fit`}
                      >
                        {heartbeatIcon(machine.attributes.heartbeatStatus)}
                        {machine.attributes.heartbeatStatus?.replace(/_/g, ' ').toLowerCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No machines activated on this license
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}
