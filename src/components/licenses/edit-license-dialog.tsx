'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Edit, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { License } from '@/lib/types/keygen'
import type { LicenseUpdateInput } from '@/lib/api/resources/licenses'
import { handleCrudError } from '@/lib/utils/error-handling'
import { bytesToMib, mibToBytes } from '@/lib/utils/bytes'
import { EntitlementManager } from '@/components/shared/entitlement-manager'

/** Render a nullable numeric attribute as a form field value */
function numToField(
  value: number | null | undefined,
  transform: (n: number) => number = (n) => n
): string {
  return value == null ? '' : String(transform(value))
}

/**
 * Diff one numeric limit field against its current value.
 * Returns `undefined` when unchanged (omit from the payload) and `null` when
 * cleared, which resets the override so the policy's limit applies again.
 */
function diffLimit(
  fieldValue: string,
  current: number | null | undefined,
  units: { toField: (n: number) => number; toPayload: (n: number) => number } = {
    toField: (n) => n,
    toPayload: (n) => n,
  }
): number | null | undefined {
  const trimmed = fieldValue.trim()
  if (trimmed === numToField(current, units.toField)) return undefined

  if (!trimmed) return null

  const parsed = parseInt(trimmed, 10)
  if (Number.isNaN(parsed)) return undefined

  return units.toPayload(parsed)
}

const MIB_UNITS = { toField: bytesToMib, toPayload: mibToBytes }

interface EditLicenseDialogProps {
  license: License
  open: boolean
  onOpenChange: (open: boolean) => void
  onLicenseUpdated: () => void
}

export function EditLicenseDialog({ 
  license, 
  open, 
  onOpenChange, 
  onLicenseUpdated 
}: EditLicenseDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    expiry: '',
    protected: false,
    permissions: '',
    maxUses: '',
    maxMachines: '',
    maxProcesses: '',
    maxUsers: '',
    maxCores: '',
    maxMemoryMib: '',
    maxDiskMib: '',
    metadata: ''
  })
  const api = getKeygenApi()

  // Initialize form data when dialog opens
  useEffect(() => {
    if (open && license) {
      const { attributes } = license
      setFormData({
        name: attributes.name || '',
        expiry: attributes.expiry ? attributes.expiry.split('T')[0] : '', // Convert to date string
        protected: attributes.protected ?? false,
        permissions: (attributes.permissions || []).join(', '),
        maxUses: numToField(attributes.maxUses),
        maxMachines: numToField(attributes.maxMachines),
        maxProcesses: numToField(attributes.maxProcesses),
        maxUsers: numToField(attributes.maxUsers),
        maxCores: numToField(attributes.maxCores),
        maxMemoryMib: numToField(attributes.maxMemory, bytesToMib),
        maxDiskMib: numToField(attributes.maxDisk, bytesToMib),
        metadata: attributes.metadata ? JSON.stringify(attributes.metadata, null, 2) : ''
      })
    }
  }, [open, license])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      setLoading(true)
      
      const { attributes } = license
      const updates: LicenseUpdateInput = {}

      // Only include fields that have changed. `null` clears a value — sending
      // `undefined` would just be dropped by JSON.stringify and silently no-op.
      if (formData.name.trim() !== (attributes.name || '')) {
        updates.name = formData.name.trim() || null
      }

      if (formData.expiry !== (attributes.expiry?.split('T')[0] || '')) {
        updates.expiry = formData.expiry ? new Date(formData.expiry).toISOString() : null
      }

      if (formData.protected !== (attributes.protected ?? false)) {
        updates.protected = formData.protected
      }

      // Only sent when non-empty: clearing the field keeps the current
      // permissions rather than stripping the license of all of them.
      const permissionsField = formData.permissions.trim()
      if (permissionsField && permissionsField !== (attributes.permissions || []).join(', ')) {
        updates.permissions = permissionsField
          .split(',')
          .map((permission) => permission.trim())
          .filter(Boolean)
      }

      const limits: Record<string, number | null | undefined> = {
        maxUses: diffLimit(formData.maxUses, attributes.maxUses),
        maxMachines: diffLimit(formData.maxMachines, attributes.maxMachines),
        maxProcesses: diffLimit(formData.maxProcesses, attributes.maxProcesses),
        maxUsers: diffLimit(formData.maxUsers, attributes.maxUsers),
        maxCores: diffLimit(formData.maxCores, attributes.maxCores),
        maxMemory: diffLimit(formData.maxMemoryMib, attributes.maxMemory, MIB_UNITS),
        maxDisk: diffLimit(formData.maxDiskMib, attributes.maxDisk, MIB_UNITS),
      }
      for (const [key, value] of Object.entries(limits)) {
        if (value !== undefined) {
          ;(updates as Record<string, unknown>)[key] = value
        }
      }

      if (formData.metadata !== (attributes.metadata ? JSON.stringify(attributes.metadata, null, 2) : '')) {
        if (formData.metadata.trim()) {
          try {
            updates.metadata = JSON.parse(formData.metadata)
          } catch {
            updates.metadata = { notes: formData.metadata }
          }
        } else {
          updates.metadata = {}
        }
      }
      
      // Only make API call if there are actual updates
      if (Object.keys(updates).length > 0) {
        await api.licenses.update(license.id, updates)
        toast.success('License updated successfully')
      } else {
        toast.info('No changes to save')
      }
      
      onLicenseUpdated()
      onOpenChange(false)
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'License')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit License
          </DialogTitle>
          <DialogDescription>
            Update license details and settings
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* License Key (Read-only) */}
          <div className="space-y-2">
            <Label>License Key</Label>
            {/* Signed/encrypted keys run to hundreds of characters with no
                spaces — without break-all the key's min-content width drags
                the whole dialog past its max-width. */}
            <div className="p-2 bg-muted rounded-md font-mono text-sm break-all select-all max-h-24 overflow-y-auto">
              {license.attributes.key}
            </div>
            <p className="text-xs text-muted-foreground">
              License keys cannot be changed after creation
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="name">Name</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>A human-readable label to help you identify this license</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="name"
              placeholder="Enter license name (optional)"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          {/* Expiry Date */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="expiry">Expiry Date</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>The date this license stops working. Leave empty for no expiration.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="expiry"
              type="date"
              value={formData.expiry}
              onChange={(e) => setFormData({ ...formData, expiry: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave empty for no expiration
            </p>
          </div>

          {/* Protected */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="protected"
              checked={formData.protected}
              onCheckedChange={(v) => setFormData({ ...formData, protected: Boolean(v) })}
            />
            <div className="flex items-center gap-1">
              <Label htmlFor="protected">Protected</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Stops end users from activating and managing machines themselves</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="permissions">Permissions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Comma-separated (e.g., *, machines:read)</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="permissions"
              placeholder="Inherited from the token bearer"
              value={formData.permissions}
              onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to keep the current permissions
            </p>
          </div>

          {/* Limits */}
          <div className="space-y-3">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Limits
            </div>
            <p className="text-xs text-muted-foreground">
              Blank means this license inherits its policy&apos;s limit. Clearing a value you had
              set removes the override.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxUses">Max Uses</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Caps how many times this license can be activated or validated</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxUses"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxUses}
                onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxMachines">Max Machines</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>How many machines can be activated against this license</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxMachines"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxMachines}
                onChange={(e) => setFormData({ ...formData, maxMachines: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxProcesses">Max Processes</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>How many concurrent machine processes this license allows</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxProcesses"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxProcesses}
                onChange={(e) => setFormData({ ...formData, maxProcesses: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxUsers">Max Users</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>How many users can be attached to this license</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxUsers"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxUsers}
                onChange={(e) => setFormData({ ...formData, maxUsers: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxCores">Max CPU Cores</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Total CPU cores summed across all of this license&apos;s machines</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxCores"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxCores}
                onChange={(e) => setFormData({ ...formData, maxCores: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxMemoryMib">Max Memory (MiB)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Total memory summed across all of this license&apos;s machines</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxMemoryMib"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxMemoryMib}
                onChange={(e) => setFormData({ ...formData, maxMemoryMib: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="maxDiskMib">Max Disk (MiB)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Total disk summed across all of this license&apos;s machines</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="maxDiskMib"
                type="number"
                min="0"
                placeholder="Inherit from policy"
                value={formData.maxDiskMib}
                onChange={(e) => setFormData({ ...formData, maxDiskMib: e.target.value })}
              />
            </div>
            </div>
          </div>

          {/* Entitlements */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Entitlements</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Additional entitlements this license has, beyond what it inherits from its policy</TooltipContent>
              </Tooltip>
            </div>
            <EntitlementManager
              resourceId={license.id}
              resourceType="license"
              emptyHint="No entitlements directly attached to this license"
            />
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="metadata">Metadata (JSON)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Freeform JSON object for your own custom tracking data (e.g. customer ID, order number)</TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="metadata"
              placeholder='{&quot;key&quot;: &quot;value&quot;}'
              value={formData.metadata}
              onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Optional JSON metadata for custom tracking
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="mr-2 h-4 w-4" />
                  Update License
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}