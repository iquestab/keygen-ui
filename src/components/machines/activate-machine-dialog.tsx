'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { mibToBytes, parseOptionalInt } from '@/lib/utils/bytes'
import { License } from '@/lib/types/keygen'
import { handleFormError, handleLoadError } from '@/lib/utils/error-handling'
import { toast } from 'sonner'

interface ActivateMachineDialogProps {
  onMachineActivated?: () => void
}

export function ActivateMachineDialog({ onMachineActivated }: ActivateMachineDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [licenses, setLicenses] = useState<License[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [formData, setFormData] = useState({
    fingerprint: '',
    licenseId: '',
    name: '',
    platform: '',
    hostname: '',
    cores: '',
    memoryMib: '',
    diskMib: '',
    ip: ''
  })

  const api = getKeygenApi()

  const loadInitialData = useCallback(async () => {
    try {
      setLoadingData(true)
      // Load active licenses for machine activation
      const licensesResponse = await api.licenses.list({ 
        limit: 100,
        // Only get active licenses
      })
      setLicenses(licensesResponse.data?.filter(license =>
        license.attributes.status.toLowerCase() === 'active'
      ) || [])
    } catch (error: unknown) {
      handleLoadError(error, 'licenses')
    } finally {
      setLoadingData(false)
    }
  }, [api.licenses])

  useEffect(() => {
    if (open) {
      loadInitialData()
    }
  }, [open, loadInitialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.fingerprint.trim()) {
      toast.error('Machine fingerprint is required')
      return
    }
    
    if (!formData.licenseId) {
      toast.error('Please select a license')
      return
    }

    try {
      setLoading(true)
      
      const memoryMib = parseOptionalInt(formData.memoryMib)
      const diskMib = parseOptionalInt(formData.diskMib)

      await api.machines.activate({
        fingerprint: formData.fingerprint.trim(),
        licenseId: formData.licenseId,
        name: formData.name.trim() || undefined,
        platform: formData.platform.trim() || undefined,
        hostname: formData.hostname.trim() || undefined,
        cores: parseOptionalInt(formData.cores),
        memory: memoryMib === undefined ? undefined : mibToBytes(memoryMib),
        disk: diskMib === undefined ? undefined : mibToBytes(diskMib),
        ip: formData.ip.trim() || undefined
      })

      toast.success('Machine activated successfully')
      setOpen(false)
      setFormData({
        fingerprint: '',
        licenseId: '',
        name: '',
        platform: '',
        hostname: '',
        cores: '',
        memoryMib: '',
        diskMib: '',
        ip: ''
      })
      onMachineActivated?.()
    } catch (error: unknown) {
      handleFormError(error, 'Machine')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Activate Machine
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activate New Machine</DialogTitle>
          <DialogDescription>
            Activate a new machine by assigning it to a license. The machine fingerprint uniquely identifies the device.
          </DialogDescription>
        </DialogHeader>
        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-muted-foreground">Loading licenses...</div>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="fingerprint">Machine Fingerprint *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>A unique, stable identifier for this device (e.g. a hardware ID or generated UUID) — used to tell machines apart under the same license</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="fingerprint"
                placeholder="e.g., 1A2B3C4D5E6F7G8H9I0J"
                value={formData.fingerprint}
                onChange={(e) => setFormData({ ...formData, fingerprint: e.target.value })}
                required
              />
              <p className="text-xs text-muted-foreground">
                Unique identifier for this machine (hardware-based fingerprint)
              </p>
            </div>
            <div className="space-y-2 col-span-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="license">License *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>The license this machine will be activated against and count toward</TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={formData.licenseId}
                onValueChange={(value) => setFormData({ ...formData, licenseId: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a license" />
                </SelectTrigger>
                <SelectContent>
                  {licenses.map((license) => (
                    <SelectItem key={license.id} value={license.id}>
                      {license.attributes.name || license.attributes.key} 
                      {license.attributes.maxUses && (
                        <span className="text-muted-foreground ml-2">
                          ({license.attributes.uses}/{license.attributes.maxUses} uses)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="name">Machine Name</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>A friendly label to help you recognize this machine in lists (optional)</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="name"
                placeholder="e.g., John's Workstation"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="platform">Platform</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>The operating system this machine is running (optional, informational only)</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="platform"
                placeholder="e.g., Windows, macOS, Linux"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="hostname">Hostname</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>The machine&apos;s network hostname (optional, informational only)</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="hostname"
                placeholder="e.g., DESKTOP-ABC123"
                value={formData.hostname}
                onChange={(e) => setFormData({ ...formData, hostname: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="cores">CPU Cores</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Number of CPU cores on this machine — useful if the policy enforces core-based limits</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="cores"
                type="number"
                placeholder="e.g., 8"
                value={formData.cores}
                onChange={(e) => setFormData({ ...formData, cores: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="memoryMib">Memory (MiB)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Memory on this machine — useful if the policy enforces memory-based limits</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="memoryMib"
                type="number"
                min="0"
                placeholder="e.g., 16384"
                value={formData.memoryMib}
                onChange={(e) => setFormData({ ...formData, memoryMib: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="diskMib">Disk (MiB)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Disk on this machine — useful if the policy enforces disk-based limits</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="diskMib"
                type="number"
                min="0"
                placeholder="e.g., 512000"
                value={formData.diskMib}
                onChange={(e) => setFormData({ ...formData, diskMib: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="ip">IP Address</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>The machine&apos;s IP address at activation time (optional, informational only)</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="ip"
              placeholder="e.g., 192.168.1.100"
              value={formData.ip}
              onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Activating...' : 'Activate Machine'}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
