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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Shield, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { Policy } from '@/lib/types/keygen'
import { handleCrudError } from '@/lib/utils/error-handling'

interface EditPolicyDialogProps {
  policy: Policy | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPolicyUpdated?: () => void
}

export function EditPolicyDialog({
  policy,
  open,
  onOpenChange,
  onPolicyUpdated
}: EditPolicyDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    duration: '',
    strict: false,
    floating: false,
    protected: false,
    requireHeartbeat: false,
    heartbeatDuration: '3600',
    heartbeatCullStrategy: 'DEACTIVATE_DEAD' as 'DEACTIVATE_DEAD' | 'KEEP_DEAD',
    heartbeatResurrectionStrategy: 'NO_REVIVE' as 'NO_REVIVE' | 'ALWAYS_REVIVE',
    heartbeatBasis: 'FROM_CREATION' as 'FROM_CREATION' | 'FROM_FIRST_PING',
    machineUniquenessStrategy: 'UNIQUE_PER_LICENSE' as 'UNIQUE_PER_LICENSE' | 'UNIQUE_PER_ACCOUNT',
    machineMatchingStrategy: 'MATCH_ANY' as 'MATCH_ANY' | 'MATCH_TWO' | 'MATCH_MOST' | 'MATCH_ALL',
    expirationStrategy: 'RESTRICT_ACCESS' as 'RESTRICT_ACCESS' | 'REVOKE_ACCESS' | 'MAINTAIN_ACCESS',
    expirationBasis: 'FROM_CREATION' as 'FROM_CREATION' | 'FROM_FIRST_VALIDATION' | 'FROM_FIRST_ACTIVATION' | 'FROM_FIRST_DOWNLOAD' | 'FROM_FIRST_USE',
    renewalBasis: 'FROM_EXPIRY' as 'FROM_EXPIRY' | 'FROM_NOW',
    transferStrategy: 'RESET_EXPIRY' as 'RESET_EXPIRY' | 'KEEP_EXPIRY',
    authenticationStrategy: 'TOKEN' as 'TOKEN' | 'LICENSE' | 'MIXED' | 'NONE',
    machineLeasingStrategy: 'PER_LICENSE' as 'PER_LICENSE' | 'PER_USER' | 'ALWAYS_ALLOW',
    processLeasingStrategy: 'PER_MACHINE' as 'PER_MACHINE' | 'PER_LICENSE' | 'PER_USER' | 'ALWAYS_ALLOW',
    overageStrategy: 'NO_OVERAGE' as 'NO_OVERAGE' | 'ALWAYS_ALLOW_OVERAGE' | 'ALLOW_1_25X_OVERAGE' | 'ALLOW_1_5X_OVERAGE' | 'ALLOW_2X_OVERAGE',
    metadata: ''
  })

  // As with create-policy-dialog.tsx: Keygen's API has previously rejected policy
  // writes with "unpermitted parameter" errors when these strategy fields are sent
  // unconditionally. Even though these Selects are initialized from the policy's
  // real current values here (not a fixed default), the risk is with the parameter
  // *name* being sent at all, not its value — so only send a strategy if the user
  // actually changed it during this edit.
  const [touchedStrategies, setTouchedStrategies] = useState({
    authenticationStrategy: false,
    expirationStrategy: false,
    overageStrategy: false,
    machineUniquenessStrategy: false,
    machineMatchingStrategy: false,
    expirationBasis: false,
    renewalBasis: false,
    transferStrategy: false,
    machineLeasingStrategy: false,
    processLeasingStrategy: false,
    heartbeatResurrectionStrategy: false,
  })

  const api = getKeygenApi()

  // Initialize form data when the dialog opens for a policy — keyed on `open` as
  // well as `policy` so reopening after a cancelled edit doesn't show stale input
  // (the parent passes the same object reference from the still-loaded list).
  useEffect(() => {
    if (open && policy) {
      setFormData({
        name: policy.attributes.name || '',
        duration: policy.attributes.duration ? String(policy.attributes.duration) : '',
        strict: policy.attributes.strict,
        floating: policy.attributes.floating,
        protected: policy.attributes.protected,
        requireHeartbeat: policy.attributes.requireHeartbeat,
        heartbeatDuration: policy.attributes.heartbeatDuration ? String(policy.attributes.heartbeatDuration) : '3600',
        heartbeatCullStrategy: policy.attributes.heartbeatCullStrategy || 'DEACTIVATE_DEAD',
        heartbeatResurrectionStrategy: (policy.attributes.heartbeatResurrectionStrategy === 'REVIVE_DEAD' ? 'ALWAYS_REVIVE' : policy.attributes.heartbeatResurrectionStrategy) || 'NO_REVIVE',
        heartbeatBasis: policy.attributes.heartbeatBasis || 'FROM_CREATION',
        machineUniquenessStrategy: 'UNIQUE_PER_LICENSE',
        machineMatchingStrategy: 'MATCH_ANY',
        expirationStrategy: (policy.attributes.expirationStrategy as 'RESTRICT_ACCESS' | 'REVOKE_ACCESS' | 'MAINTAIN_ACCESS') || 'RESTRICT_ACCESS',
        expirationBasis: policy.attributes.expirationBasis || 'FROM_CREATION',
        renewalBasis: policy.attributes.renewalBasis || 'FROM_EXPIRY',
        transferStrategy: 'RESET_EXPIRY',
        authenticationStrategy: policy.attributes.authenticationStrategy || 'TOKEN',
        machineLeasingStrategy: 'PER_LICENSE',
        processLeasingStrategy: 'PER_MACHINE',
        overageStrategy: policy.attributes.overageStrategy || 'NO_OVERAGE',
        metadata: policy.attributes.metadata ? JSON.stringify(policy.attributes.metadata, null, 2) : ''
      })
      setTouchedStrategies({
        authenticationStrategy: false,
        expirationStrategy: false,
        overageStrategy: false,
        machineUniquenessStrategy: false,
        machineMatchingStrategy: false,
        expirationBasis: false,
        renewalBasis: false,
        transferStrategy: false,
        machineLeasingStrategy: false,
        processLeasingStrategy: false,
        heartbeatResurrectionStrategy: false,
      })
    }
  }, [open, policy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!policy) return

    if (!formData.name.trim()) {
      toast.error('Policy name is required')
      return
    }

    try {
      setLoading(true)

      const policyData: Record<string, unknown> = {
        name: formData.name.trim(),
      }

      if (formData.duration.trim()) {
        policyData.duration = parseInt(formData.duration)
      }

      policyData.strict = formData.strict
      policyData.floating = formData.floating
      policyData.protected = formData.protected

      policyData.requireHeartbeat = formData.requireHeartbeat
      if (formData.requireHeartbeat) {
        if (formData.heartbeatDuration) {
          policyData.heartbeatDuration = parseInt(formData.heartbeatDuration)
        }
        policyData.heartbeatCullStrategy = formData.heartbeatCullStrategy
        policyData.heartbeatBasis = formData.heartbeatBasis
        if (touchedStrategies.heartbeatResurrectionStrategy) {
          policyData.heartbeatResurrectionStrategy = formData.heartbeatResurrectionStrategy
        }
      }

      if (touchedStrategies.authenticationStrategy) {
        policyData.authenticationStrategy = formData.authenticationStrategy
      }
      if (touchedStrategies.expirationStrategy) {
        policyData.expirationStrategy = formData.expirationStrategy
      }
      if (touchedStrategies.overageStrategy) {
        policyData.overageStrategy = formData.overageStrategy
      }
      if (touchedStrategies.machineUniquenessStrategy) {
        policyData.machineUniquenessStrategy = formData.machineUniquenessStrategy
      }
      if (touchedStrategies.machineMatchingStrategy) {
        policyData.machineMatchingStrategy = formData.machineMatchingStrategy
      }
      if (touchedStrategies.expirationBasis) {
        policyData.expirationBasis = formData.expirationBasis
      }
      if (touchedStrategies.renewalBasis) {
        policyData.renewalBasis = formData.renewalBasis
      }
      if (touchedStrategies.transferStrategy) {
        policyData.transferStrategy = formData.transferStrategy
      }
      if (touchedStrategies.machineLeasingStrategy) {
        policyData.machineLeasingStrategy = formData.machineLeasingStrategy
      }
      if (touchedStrategies.processLeasingStrategy) {
        policyData.processLeasingStrategy = formData.processLeasingStrategy
      }

      if (formData.metadata.trim()) {
        try {
          policyData.metadata = JSON.parse(formData.metadata)
        } catch {
          policyData.metadata = { notes: formData.metadata }
        }
      }

      await api.policies.update(policy.id, policyData)

      toast.success('Policy updated successfully')
      onOpenChange(false)
      onPolicyUpdated?.()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'Policy')
    } finally {
      setLoading(false)
    }
  }

  if (!policy) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Policy</DialogTitle>
          <DialogDescription>
            Update the policy&apos;s rules and constraints.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Basic Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-policy-name">Policy Name *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>A human-readable label to help you identify this policy</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="edit-policy-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-policy-duration">Duration (seconds)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How long a license created under this policy remains valid before expiring</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="edit-policy-duration"
                  type="number"
                  placeholder="e.g., 86400 (1 day)"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">Leave empty for no expiration</p>
              </div>
            </div>
          </div>

          {/* Policy Type */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Policy Type</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-strict"
                  checked={formData.strict}
                  onCheckedChange={(checked) => setFormData({ ...formData, strict: !!checked })}
                />
                <Label htmlFor="edit-strict">Strict validation</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Require every validation scope (product, machine, etc.) to be explicitly provided rather than inferred</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-floating"
                  checked={formData.floating}
                  onCheckedChange={(checked) => setFormData({ ...formData, floating: !!checked })}
                />
                <Label htmlFor="edit-floating">Floating license</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Allow a license&apos;s activations to be shared/pooled across machines rather than permanently tied to one device</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-protected"
                  checked={formData.protected}
                  onCheckedChange={(checked) => setFormData({ ...formData, protected: !!checked })}
                />
                <Label htmlFor="edit-protected">Write-protected</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Prevent licenses under this policy from being modified via the API once created</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Heartbeat Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Heartbeat Settings</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-requireHeartbeat"
                  checked={formData.requireHeartbeat}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireHeartbeat: !!checked })}
                />
                <Label htmlFor="edit-requireHeartbeat">Require heartbeat</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Require machines to periodically &quot;check in&quot; (ping) to stay considered alive</TooltipContent>
                </Tooltip>
              </div>

              {formData.requireHeartbeat && (
                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="edit-heartbeatDuration">Heartbeat Duration (seconds)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>How long a machine can go without pinging before it&apos;s considered dead</TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="edit-heartbeatDuration"
                      type="number"
                      value={formData.heartbeatDuration}
                      onChange={(e) => setFormData({ ...formData, heartbeatDuration: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="edit-heartbeatCullStrategy">Cull Strategy</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>What happens to a machine once it&apos;s considered dead — deactivate it, or keep it around</TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={formData.heartbeatCullStrategy}
                      onValueChange={(value: 'DEACTIVATE_DEAD' | 'KEEP_DEAD') => setFormData({ ...formData, heartbeatCullStrategy: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DEACTIVATE_DEAD">Deactivate Dead</SelectItem>
                        <SelectItem value="KEEP_DEAD">Keep Dead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="edit-heartbeatBasis">Heartbeat Basis</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>When the heartbeat &quot;clock&quot; starts counting — from the machine&apos;s creation, or from its first ping</TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={formData.heartbeatBasis}
                      onValueChange={(value: 'FROM_CREATION' | 'FROM_FIRST_PING') => setFormData({ ...formData, heartbeatBasis: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FROM_CREATION">From Creation</SelectItem>
                        <SelectItem value="FROM_FIRST_PING">From First Ping</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="edit-heartbeatResurrectionStrategy">Resurrection Strategy</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Whether a dead machine can come back to life if it pings again, or stays dead permanently</TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={formData.heartbeatResurrectionStrategy}
                      onValueChange={(value: 'NO_REVIVE' | 'ALWAYS_REVIVE') => {
                        setFormData({ ...formData, heartbeatResurrectionStrategy: value })
                        setTouchedStrategies(prev => ({ ...prev, heartbeatResurrectionStrategy: true }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_REVIVE">No Revive</SelectItem>
                        <SelectItem value="ALWAYS_REVIVE">Always Revive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Strategies */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Advanced Settings</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-expirationStrategy">Expiration Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>What happens to a license once it expires — restrict some access, revoke it entirely, or keep it working</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.expirationStrategy}
                  onValueChange={(value: 'RESTRICT_ACCESS' | 'REVOKE_ACCESS' | 'MAINTAIN_ACCESS') => {
                    setFormData({ ...formData, expirationStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, expirationStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESTRICT_ACCESS">Restrict Access</SelectItem>
                    <SelectItem value="REVOKE_ACCESS">Revoke Access</SelectItem>
                    <SelectItem value="MAINTAIN_ACCESS">Maintain Access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-authenticationStrategy">Authentication Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How machines/users authenticate under this policy&apos;s licenses — by token, license key, either, or none</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.authenticationStrategy}
                  onValueChange={(value: 'TOKEN' | 'LICENSE' | 'MIXED' | 'NONE') => {
                    setFormData({ ...formData, authenticationStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, authenticationStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOKEN">Token</SelectItem>
                    <SelectItem value="LICENSE">License</SelectItem>
                    <SelectItem value="MIXED">Mixed</SelectItem>
                    <SelectItem value="NONE">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-overageStrategy">Overage Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Whether licenses can exceed their machine/process limits, and by how much</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.overageStrategy}
                  onValueChange={(value: 'NO_OVERAGE' | 'ALWAYS_ALLOW_OVERAGE' | 'ALLOW_1_25X_OVERAGE' | 'ALLOW_1_5X_OVERAGE' | 'ALLOW_2X_OVERAGE') => {
                    setFormData({ ...formData, overageStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, overageStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_OVERAGE">No Overage</SelectItem>
                    <SelectItem value="ALLOW_1_25X_OVERAGE">Allow 1.25x Overage</SelectItem>
                    <SelectItem value="ALLOW_1_5X_OVERAGE">Allow 1.5x Overage</SelectItem>
                    <SelectItem value="ALLOW_2X_OVERAGE">Allow 2x Overage</SelectItem>
                    <SelectItem value="ALWAYS_ALLOW_OVERAGE">Always Allow Overage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-machineUniquenessStrategy">Machine Uniqueness Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Whether a machine fingerprint must be unique per license, or unique across the whole account</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.machineUniquenessStrategy}
                  onValueChange={(value: 'UNIQUE_PER_LICENSE' | 'UNIQUE_PER_ACCOUNT') => {
                    setFormData({ ...formData, machineUniquenessStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, machineUniquenessStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNIQUE_PER_LICENSE">Unique Per License</SelectItem>
                    <SelectItem value="UNIQUE_PER_ACCOUNT">Unique Per Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-machineMatchingStrategy">Machine Matching Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How many of a license&apos;s associated machines must match at validation time</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.machineMatchingStrategy}
                  onValueChange={(value: 'MATCH_ANY' | 'MATCH_TWO' | 'MATCH_MOST' | 'MATCH_ALL') => {
                    setFormData({ ...formData, machineMatchingStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, machineMatchingStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATCH_ANY">Match Any</SelectItem>
                    <SelectItem value="MATCH_TWO">Match Two</SelectItem>
                    <SelectItem value="MATCH_MOST">Match Most</SelectItem>
                    <SelectItem value="MATCH_ALL">Match All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-expirationBasis">Expiration Basis</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>What event starts the license&apos;s expiration countdown — creation, first validation, first activation, first download, or first use</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.expirationBasis}
                  onValueChange={(value: 'FROM_CREATION' | 'FROM_FIRST_VALIDATION' | 'FROM_FIRST_ACTIVATION' | 'FROM_FIRST_DOWNLOAD' | 'FROM_FIRST_USE') => {
                    setFormData({ ...formData, expirationBasis: value })
                    setTouchedStrategies(prev => ({ ...prev, expirationBasis: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FROM_CREATION">From Creation</SelectItem>
                    <SelectItem value="FROM_FIRST_VALIDATION">From First Validation</SelectItem>
                    <SelectItem value="FROM_FIRST_ACTIVATION">From First Activation</SelectItem>
                    <SelectItem value="FROM_FIRST_DOWNLOAD">From First Download</SelectItem>
                    <SelectItem value="FROM_FIRST_USE">From First Use</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-renewalBasis">Renewal Basis</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>When a renewed license&apos;s new expiry is calculated from — its original expiry date, or the moment it&apos;s renewed</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.renewalBasis}
                  onValueChange={(value: 'FROM_EXPIRY' | 'FROM_NOW') => {
                    setFormData({ ...formData, renewalBasis: value })
                    setTouchedStrategies(prev => ({ ...prev, renewalBasis: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FROM_EXPIRY">From Expiry</SelectItem>
                    <SelectItem value="FROM_NOW">From Now</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-transferStrategy">Transfer Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>What happens to a license&apos;s expiry when it&apos;s transferred to a different policy — reset it, or keep the current expiry</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.transferStrategy}
                  onValueChange={(value: 'RESET_EXPIRY' | 'KEEP_EXPIRY') => {
                    setFormData({ ...formData, transferStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, transferStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESET_EXPIRY">Reset Expiry</SelectItem>
                    <SelectItem value="KEEP_EXPIRY">Keep Expiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-machineLeasingStrategy">Machine Leasing Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How floating machine slots are leased out — per license, per user, or always allowed regardless of limits</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.machineLeasingStrategy}
                  onValueChange={(value: 'PER_LICENSE' | 'PER_USER' | 'ALWAYS_ALLOW') => {
                    setFormData({ ...formData, machineLeasingStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, machineLeasingStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_LICENSE">Per License</SelectItem>
                    <SelectItem value="PER_USER">Per User</SelectItem>
                    <SelectItem value="ALWAYS_ALLOW">Always Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-processLeasingStrategy">Process Leasing Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How floating process slots are leased out — per machine, per license, per user, or always allowed regardless of limits</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.processLeasingStrategy}
                  onValueChange={(value: 'PER_MACHINE' | 'PER_LICENSE' | 'PER_USER' | 'ALWAYS_ALLOW') => {
                    setFormData({ ...formData, processLeasingStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, processLeasingStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_MACHINE">Per Machine</SelectItem>
                    <SelectItem value="PER_LICENSE">Per License</SelectItem>
                    <SelectItem value="PER_USER">Per User</SelectItem>
                    <SelectItem value="ALWAYS_ALLOW">Always Allow</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="edit-metadata">Metadata (Optional)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Freeform JSON object for your own custom tracking data</TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="edit-metadata"
              placeholder='{&quot;description&quot;: &quot;Policy description&quot;, &quot;tags&quot;: [&quot;enterprise&quot;]}'
              value={formData.metadata}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, metadata: e.target.value })}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Optional JSON metadata for the policy
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
