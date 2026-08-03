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

export function LicenseDetailsDialog({ license, open, onOpenChange }: LicenseDetailsDialogProps) {
  const [machines, setMachines] = useState<Machine[]>([])
  const [machineCount, setMachineCount] = useState(0)
  const [loadingMachines, setLoadingMachines] = useState(false)

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

  useEffect(() => {
    if (open && license.id) {
      loadMachines()
    }
  }, [open, license.id, loadMachines])

  const formatDate = (dateString?: string) => {
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
