'use client'

import { useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import type {
  PolicyHeartbeatCullStrategy,
  PolicyHeartbeatResurrectionStrategy,
  PolicyHeartbeatBasis,
  PolicyMachineUniquenessStrategy,
  PolicyMachineMatchingStrategy,
  PolicyComponentUniquenessStrategy,
  PolicyComponentMatchingStrategy,
  PolicyExpirationStrategy,
  PolicyExpirationBasis,
  PolicyRenewalBasis,
  PolicyTransferStrategy,
  PolicyAuthenticationStrategy,
  PolicyMachineLeasingStrategy,
  PolicyProcessLeasingStrategy,
  PolicyOverageStrategy,
  PolicyCheckInInterval,
  PolicyScheme,
} from '@/lib/types/keygen'
import { mibToBytes, parseOptionalInt } from '@/lib/utils/bytes'
import { toast } from 'sonner'
import { Product, Entitlement } from '@/lib/types/keygen'
import { handleFormError, handleLoadError } from '@/lib/utils/error-handling'
import { useEffect, useCallback } from 'react'

interface CreatePolicyDialogProps {
  onPolicyCreated?: () => void
}

export function CreatePolicyDialog({ onPolicyCreated }: CreatePolicyDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    productId: '',
    duration: '',
    strict: false,
    floating: false,
    protected: false,
    requireHeartbeat: false,
    heartbeatDuration: '3600',
    heartbeatCullStrategy: 'DEACTIVATE_DEAD' as PolicyHeartbeatCullStrategy,
    heartbeatResurrectionStrategy: 'NO_REVIVE' as PolicyHeartbeatResurrectionStrategy,
    heartbeatBasis: 'FROM_CREATION' as PolicyHeartbeatBasis,
    machineUniquenessStrategy: 'UNIQUE_PER_LICENSE' as PolicyMachineUniquenessStrategy,
    machineMatchingStrategy: 'MATCH_ANY' as PolicyMachineMatchingStrategy,
    componentUniquenessStrategy: 'UNIQUE_PER_MACHINE' as PolicyComponentUniquenessStrategy,
    componentMatchingStrategy: 'MATCH_ANY' as PolicyComponentMatchingStrategy,
    expirationStrategy: 'RESTRICT_ACCESS' as PolicyExpirationStrategy,
    expirationBasis: 'FROM_CREATION' as PolicyExpirationBasis,
    renewalBasis: 'FROM_EXPIRY' as PolicyRenewalBasis,
    transferStrategy: 'RESET_EXPIRY' as PolicyTransferStrategy,
    authenticationStrategy: 'TOKEN' as PolicyAuthenticationStrategy,
    machineLeasingStrategy: 'PER_LICENSE' as PolicyMachineLeasingStrategy,
    processLeasingStrategy: 'PER_MACHINE' as PolicyProcessLeasingStrategy,
    overageStrategy: 'NO_OVERAGE' as PolicyOverageStrategy,
    scheme: 'NONE' as 'NONE' | PolicyScheme,
    // Limits — blank means "no limit"
    maxMachines: '',
    maxProcesses: '',
    maxUsers: '',
    maxCores: '',
    maxUses: '',
    maxMemoryMib: '',
    maxDiskMib: '',
    // Pool — cannot be changed after creation
    usePool: false,
    // Check-in
    requireCheckIn: false,
    checkInInterval: 'month' as PolicyCheckInInterval,
    checkInIntervalCount: '1',
    // Validation scope requirements
    requireProductScope: false,
    requirePolicyScope: false,
    requireMachineScope: false,
    requireFingerprintScope: false,
    requireComponentsScope: false,
    requireUserScope: false,
    requireChecksumScope: false,
    requireVersionScope: false,
    metadata: ''
  })

  // Keygen's API has previously rejected policy creation with "unpermitted parameter"
  // errors when these strategy fields are sent unconditionally (see CLAUDE.md). Since
  // they're Selects with real default values (not blank placeholders), we can't tell
  // "user picked the default" from "user never touched this" any other way — so track
  // it explicitly and only send a strategy if the user actually changed it.
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
    componentUniquenessStrategy: false,
    componentMatchingStrategy: false,
  })

  const [entitlements, setEntitlements] = useState<Entitlement[]>([])
  const [entitlementSearch, setEntitlementSearch] = useState('')
  const [selectedEntitlements, setSelectedEntitlements] = useState<string[]>([])

  const api = getKeygenApi()

  // Load products when dialog opens
  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true)
      const response = await api.products.list({ limit: 50 })
      setProducts(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'products')
    } finally {
      setProductsLoading(false)
    }
  }, [api.products])

  const loadEntitlements = useCallback(async () => {
    try {
      const response = await api.entitlements.list({ limit: 100 })
      setEntitlements(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'entitlements', { silent: true })
    }
  }, [api.entitlements])

  useEffect(() => {
    if (open && products.length === 0) {
      loadProducts()
    }
    if (open && entitlements.length === 0) {
      loadEntitlements()
    }
  }, [open, products.length, loadProducts, entitlements.length, loadEntitlements])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      toast.error('Policy name is required')
      return
    }

    if (!formData.productId) {
      toast.error('Please select a product')
      return
    }

    try {
      setLoading(true)

      // Build policy data with all user-selected options
      const policyData: Record<string, unknown> = {
        name: formData.name.trim(),
        productId: formData.productId
      }

      // Add duration if specified
      if (formData.duration && formData.duration.trim()) {
        policyData.duration = parseInt(formData.duration)
      }

      // Add boolean flags if enabled
      if (formData.strict) policyData.strict = true
      if (formData.floating) policyData.floating = true
      if (formData.protected) policyData.protected = true

      // Add heartbeat settings if heartbeat is required
      if (formData.requireHeartbeat) {
        policyData.requireHeartbeat = true
        if (formData.heartbeatDuration) {
          policyData.heartbeatDuration = parseInt(formData.heartbeatDuration)
        }
        policyData.heartbeatCullStrategy = formData.heartbeatCullStrategy
        policyData.heartbeatBasis = formData.heartbeatBasis
        if (touchedStrategies.heartbeatResurrectionStrategy) {
          policyData.heartbeatResurrectionStrategy = formData.heartbeatResurrectionStrategy
        }
      }

      // Only send strategy fields the user actually changed from their default —
      // sending them unconditionally previously caused "unpermitted parameter" errors.
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

      // Signing scheme is immutable after creation, so only send it if the user
      // actually picked one — 'NONE' means "don't send", not "explicitly no scheme".
      if (formData.scheme !== 'NONE') {
        policyData.scheme = formData.scheme
      }

      // Add metadata if provided
      if (touchedStrategies.componentUniquenessStrategy) {
        policyData.componentUniquenessStrategy = formData.componentUniquenessStrategy
      }
      if (touchedStrategies.componentMatchingStrategy) {
        policyData.componentMatchingStrategy = formData.componentMatchingStrategy
      }

      // Limits — omit when blank so the policy simply has no limit
      const maxMemoryMib = parseOptionalInt(formData.maxMemoryMib)
      const maxDiskMib = parseOptionalInt(formData.maxDiskMib)
      const limits: Record<string, number | undefined> = {
        maxMachines: parseOptionalInt(formData.maxMachines),
        maxProcesses: parseOptionalInt(formData.maxProcesses),
        maxUsers: parseOptionalInt(formData.maxUsers),
        maxCores: parseOptionalInt(formData.maxCores),
        maxUses: parseOptionalInt(formData.maxUses),
        maxMemory: maxMemoryMib === undefined ? undefined : mibToBytes(maxMemoryMib),
        maxDisk: maxDiskMib === undefined ? undefined : mibToBytes(maxDiskMib),
      }
      for (const [key, value] of Object.entries(limits)) {
        if (value !== undefined) policyData[key] = value
      }

      // usePool cannot be changed later, so it is only settable here
      if (formData.usePool) policyData.usePool = true

      if (formData.requireCheckIn) {
        policyData.requireCheckIn = true
        policyData.checkInInterval = formData.checkInInterval
        const intervalCount = parseOptionalInt(formData.checkInIntervalCount)
        if (intervalCount !== undefined) {
          policyData.checkInIntervalCount = intervalCount
        }
      }

      // Validation scope requirements — only sent when enabled, matching how the
      // other boolean flags above are handled
      if (formData.requireProductScope) policyData.requireProductScope = true
      if (formData.requirePolicyScope) policyData.requirePolicyScope = true
      if (formData.requireMachineScope) policyData.requireMachineScope = true
      if (formData.requireFingerprintScope) policyData.requireFingerprintScope = true
      if (formData.requireComponentsScope) policyData.requireComponentsScope = true
      if (formData.requireUserScope) policyData.requireUserScope = true
      if (formData.requireChecksumScope) policyData.requireChecksumScope = true
      if (formData.requireVersionScope) policyData.requireVersionScope = true

      if (formData.metadata && formData.metadata.trim()) {
        try {
          policyData.metadata = JSON.parse(formData.metadata)
        } catch {
          policyData.metadata = { notes: formData.metadata }
        }
      }

      const response = await api.policies.create(policyData as { name: string; productId: string; duration?: number })

      const createdId = response.data?.id
      if (createdId && selectedEntitlements.length > 0) {
        await api.policies.attachEntitlements(createdId, selectedEntitlements)
      }

      toast.success('Policy created successfully')
      setOpen(false)
      resetForm()
      onPolicyCreated?.()
    } catch (error: unknown) {
      handleFormError(error, 'Policy')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      productId: '',
      duration: '',
      strict: false,
      floating: false,
      protected: false,
      requireHeartbeat: false,
      heartbeatDuration: '3600',
      heartbeatCullStrategy: 'DEACTIVATE_DEAD',
      heartbeatResurrectionStrategy: 'NO_REVIVE',
      heartbeatBasis: 'FROM_CREATION',
      machineUniquenessStrategy: 'UNIQUE_PER_LICENSE',
      machineMatchingStrategy: 'MATCH_ANY',
      expirationStrategy: 'RESTRICT_ACCESS',
      expirationBasis: 'FROM_CREATION',
      renewalBasis: 'FROM_EXPIRY',
      transferStrategy: 'RESET_EXPIRY',
      authenticationStrategy: 'TOKEN',
      machineLeasingStrategy: 'PER_LICENSE',
      processLeasingStrategy: 'PER_MACHINE',
      componentUniquenessStrategy: 'UNIQUE_PER_MACHINE',
      componentMatchingStrategy: 'MATCH_ANY',
      maxMachines: '',
      maxProcesses: '',
      maxUsers: '',
      maxCores: '',
      maxUses: '',
      maxMemoryMib: '',
      maxDiskMib: '',
      usePool: false,
      requireCheckIn: false,
      checkInInterval: 'month',
      checkInIntervalCount: '1',
      requireProductScope: false,
      requirePolicyScope: false,
      requireMachineScope: false,
      requireFingerprintScope: false,
      requireComponentsScope: false,
      requireUserScope: false,
      requireChecksumScope: false,
      requireVersionScope: false,
      overageStrategy: 'NO_OVERAGE',
      scheme: 'NONE',
      metadata: ''
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
      componentUniquenessStrategy: false,
      componentMatchingStrategy: false,
    })
    setSelectedEntitlements([])
    setEntitlementSearch('')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Policy
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Policy</DialogTitle>
          <DialogDescription>
            Create a new licensing policy with specific rules and constraints for your products.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="name">Policy Name *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>A human-readable label to help you identify this policy</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="name"
                  placeholder="e.g., Standard License Policy"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="product">Product *</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>The product this policy&apos;s licenses will belong to</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.productId}
                  onValueChange={(value) => setFormData({ ...formData, productId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={productsLoading ? "Loading products..." : "Select a product"} />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.attributes.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Choose which product this policy applies to</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="duration">Duration (seconds)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How long a license created under this policy remains valid before expiring</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="duration"
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
                  id="strict"
                  checked={formData.strict}
                  onCheckedChange={(checked) => setFormData({ ...formData, strict: !!checked })}
                />
                <Label htmlFor="strict">Strict validation</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Require every validation scope (product, machine, etc.) to be explicitly provided rather than inferred</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="floating"
                  checked={formData.floating}
                  onCheckedChange={(checked) => setFormData({ ...formData, floating: !!checked })}
                />
                <Label htmlFor="floating">Floating license</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Allow a license&apos;s activations to be shared/pooled across machines rather than permanently tied to one device</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="protected"
                  checked={formData.protected}
                  onCheckedChange={(checked) => setFormData({ ...formData, protected: !!checked })}
                />
                <Label htmlFor="protected">Write-protected</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Prevent licenses under this policy from being modified via the API once created</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Offline Licensing */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Offline Licensing</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="scheme">Cryptographic Scheme</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Required to check out signed license files for air-gapped/offline verification. Cannot be changed after the policy is created.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={formData.scheme}
                onValueChange={(value: 'NONE' | 'ED25519_SIGN' | 'RSA_2048_PKCS1_SIGN' | 'RSA_2048_PKCS1_PSS_SIGN' | 'RSA_2048_PKCS1_ENCRYPT' | 'RSA_2048_JWT_RS256') =>
                  setFormData({ ...formData, scheme: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">None (online validation only)</SelectItem>
                  <SelectItem value="ED25519_SIGN">Ed25519 Signature</SelectItem>
                  <SelectItem value="ECDSA_P256_SIGN">ECDSA P-256 Signature</SelectItem>
                  <SelectItem value="RSA_2048_PKCS1_SIGN_V2">RSA-2048 PKCS1 Signature (V2)</SelectItem>
                  <SelectItem value="RSA_2048_PKCS1_PSS_SIGN_V2">RSA-2048 PKCS1 PSS Signature (V2)</SelectItem>
                  <SelectItem value="RSA_2048_PKCS1_SIGN">RSA-2048 PKCS1 Signature</SelectItem>
                  <SelectItem value="RSA_2048_PKCS1_PSS_SIGN">RSA-2048 PKCS1 PSS Signature</SelectItem>
                  <SelectItem value="RSA_2048_PKCS1_ENCRYPT">RSA-2048 PKCS1 Encrypt</SelectItem>
                  <SelectItem value="RSA_2048_JWT_RS256">RSA-2048 JWT (RS256)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Licenses under this policy will be signed with this key, allowing you to check out a
                &quot;.lic&quot; file that can be verified offline, without calling the API.
              </p>
            </div>
          </div>

          {/* Heartbeat Settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Heartbeat Settings</h4>
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireHeartbeat"
                  checked={formData.requireHeartbeat}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireHeartbeat: !!checked })}
                />
                <Label htmlFor="requireHeartbeat">Require heartbeat</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Require machines to periodically &quot;check in&quot; (ping) to stay considered alive</TooltipContent>
                </Tooltip>
              </div>

              {formData.requireHeartbeat && (
                <div className="grid grid-cols-3 gap-4 ml-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="heartbeatDuration">Heartbeat Duration (seconds)</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>How long a machine can go without pinging before it&apos;s considered dead</TooltipContent>
                      </Tooltip>
                    </div>
                    <Input
                      id="heartbeatDuration"
                      type="number"
                      value={formData.heartbeatDuration}
                      onChange={(e) => setFormData({ ...formData, heartbeatDuration: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-1">
                      <Label htmlFor="heartbeatCullStrategy">Cull Strategy</Label>
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
                      <Label htmlFor="heartbeatBasis">Heartbeat Basis</Label>
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
                      <Label htmlFor="heartbeatResurrectionStrategy">Resurrection Strategy</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <HelpCircle className="size-3.5 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>Whether a dead machine can come back to life if it pings again, or stays dead permanently</TooltipContent>
                      </Tooltip>
                    </div>
                    <Select
                      value={formData.heartbeatResurrectionStrategy}
                      onValueChange={(value: PolicyHeartbeatResurrectionStrategy) => {
                        setFormData({ ...formData, heartbeatResurrectionStrategy: value })
                        setTouchedStrategies(prev => ({ ...prev, heartbeatResurrectionStrategy: true }))
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NO_REVIVE">No revive</SelectItem>
                        <SelectItem value="1_MINUTE_REVIVE">Revive within 1 minute</SelectItem>
                        <SelectItem value="2_MINUTE_REVIVE">Revive within 2 minutes</SelectItem>
                        <SelectItem value="5_MINUTE_REVIVE">Revive within 5 minutes</SelectItem>
                        <SelectItem value="10_MINUTE_REVIVE">Revive within 10 minutes</SelectItem>
                        <SelectItem value="15_MINUTE_REVIVE">Revive within 15 minutes</SelectItem>
                        <SelectItem value="ALWAYS_REVIVE">Always revive (requires Keep Dead)</SelectItem>
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
                  <Label htmlFor="expirationStrategy">Expiration Strategy</Label>
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
                  <Label htmlFor="authenticationStrategy">Authentication Strategy</Label>
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
                  <Label htmlFor="overageStrategy">Overage Strategy</Label>
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
                  <Label htmlFor="machineUniquenessStrategy">Machine Uniqueness Strategy</Label>
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
                  <Label htmlFor="machineMatchingStrategy">Machine Matching Strategy</Label>
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
                  <Label htmlFor="expirationBasis">Expiration Basis</Label>
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
                  <Label htmlFor="renewalBasis">Renewal Basis</Label>
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
                  <Label htmlFor="transferStrategy">Transfer Strategy</Label>
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
                  <Label htmlFor="machineLeasingStrategy">Machine Leasing Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How floating machine slots are leased out — per license, per user, or always allowed regardless of limits</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.machineLeasingStrategy}
                  onValueChange={(value: PolicyMachineLeasingStrategy) => {
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
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="processLeasingStrategy">Process Leasing Strategy</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How floating process slots are leased out — per machine, per license, per user, or always allowed regardless of limits</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.processLeasingStrategy}
                  onValueChange={(value: PolicyProcessLeasingStrategy) => {
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
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Limits</h4>
            <p className="text-xs text-muted-foreground">
              Applied to every license implementing this policy. Leave blank for no limit; an
              individual license can override any of these.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="maxMachines">Max Machines</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How many machines a license implementing this policy may activate</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxMachines"
                  type="number"
                  min="0"
                  placeholder="No limit"
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
                    <TooltipContent>How many concurrent machine processes a license allows</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxProcesses"
                  type="number"
                  min="0"
                  placeholder="No limit"
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
                    <TooltipContent>How many users may be attached to a license</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxUsers"
                  type="number"
                  min="0"
                  placeholder="No limit"
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
                    <TooltipContent>Total CPU cores summed across a license&apos;s machines</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxCores"
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={formData.maxCores}
                  onChange={(e) => setFormData({ ...formData, maxCores: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="maxUses">Max Uses</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How many times a license may be used before it stops validating</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxUses"
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={formData.maxUses}
                  onChange={(e) => setFormData({ ...formData, maxUses: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="maxMemoryMib">Max Memory (MiB)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Total memory summed across a license&apos;s machines</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxMemoryMib"
                  type="number"
                  min="0"
                  placeholder="No limit"
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
                    <TooltipContent>Total disk summed across a license&apos;s machines</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxDiskMib"
                  type="number"
                  min="0"
                  placeholder="No limit"
                  value={formData.maxDiskMib}
                  onChange={(e) => setFormData({ ...formData, maxDiskMib: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Check-in */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Check-in</h4>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="requireCheckIn"
                checked={formData.requireCheckIn}
                onCheckedChange={(checked) => setFormData({ ...formData, requireCheckIn: !!checked })}
              />
              <Label htmlFor="requireCheckIn" className="font-normal">Require periodic check-in</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  A license that misses its check-in window stops passing validation until it checks in again.
                </TooltipContent>
              </Tooltip>
            </div>
            {formData.requireCheckIn && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Interval</Label>
                  <Select
                    value={formData.checkInInterval}
                    onValueChange={(value: PolicyCheckInInterval) =>
                      setFormData({ ...formData, checkInInterval: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Daily</SelectItem>
                      <SelectItem value="week">Weekly</SelectItem>
                      <SelectItem value="month">Monthly</SelectItem>
                      <SelectItem value="year">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="checkInIntervalCount">Every</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <HelpCircle className="size-3.5 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>Number of intervals between check-ins — e.g. 2 with a weekly interval means every two weeks</TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="checkInIntervalCount"
                    type="number"
                    min="1"
                    value={formData.checkInIntervalCount}
                    onChange={(e) => setFormData({ ...formData, checkInIntervalCount: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Required validation scopes */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Required Validation Scopes</h4>
            <p className="text-xs text-muted-foreground">
              Validation fails unless the caller supplies each of these.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireProductScope"
                  checked={formData.requireProductScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireProductScope: !!checked })}
                />
                <Label htmlFor="requireProductScope" className="font-normal">Product scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must name the product the license belongs to</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requirePolicyScope"
                  checked={formData.requirePolicyScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requirePolicyScope: !!checked })}
                />
                <Label htmlFor="requirePolicyScope" className="font-normal">Policy scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must name the policy the license implements</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireMachineScope"
                  checked={formData.requireMachineScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireMachineScope: !!checked })}
                />
                <Label htmlFor="requireMachineScope" className="font-normal">Machine scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must name a specific machine</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireFingerprintScope"
                  checked={formData.requireFingerprintScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireFingerprintScope: !!checked })}
                />
                <Label htmlFor="requireFingerprintScope" className="font-normal">Fingerprint scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must supply a machine fingerprint — the basis of node-locked licensing</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireComponentsScope"
                  checked={formData.requireComponentsScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireComponentsScope: !!checked })}
                />
                <Label htmlFor="requireComponentsScope" className="font-normal">Components scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must supply component fingerprints</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireUserScope"
                  checked={formData.requireUserScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireUserScope: !!checked })}
                />
                <Label htmlFor="requireUserScope" className="font-normal">User scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must name the user the license belongs to</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireChecksumScope"
                  checked={formData.requireChecksumScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireChecksumScope: !!checked })}
                />
                <Label htmlFor="requireChecksumScope" className="font-normal">Checksum scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must supply an artifact checksum</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="requireVersionScope"
                  checked={formData.requireVersionScope}
                  onCheckedChange={(checked) => setFormData({ ...formData, requireVersionScope: !!checked })}
                />
                <Label htmlFor="requireVersionScope" className="font-normal">Version scope</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Validation must supply a release version</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Component strategies */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">Component Strategies</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label>Component Uniqueness</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How widely a component fingerprint must be unique</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.componentUniquenessStrategy}
                  onValueChange={(value: PolicyComponentUniquenessStrategy) => {
                    setFormData({ ...formData, componentUniquenessStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, componentUniquenessStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNIQUE_PER_ACCOUNT">Unique per account</SelectItem>
                    <SelectItem value="UNIQUE_PER_PRODUCT">Unique per product</SelectItem>
                    <SelectItem value="UNIQUE_PER_POLICY">Unique per policy</SelectItem>
                    <SelectItem value="UNIQUE_PER_LICENSE">Unique per license</SelectItem>
                    <SelectItem value="UNIQUE_PER_MACHINE">Unique per machine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label>Component Matching</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>How many supplied component fingerprints must match during validation</TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={formData.componentMatchingStrategy}
                  onValueChange={(value: PolicyComponentMatchingStrategy) => {
                    setFormData({ ...formData, componentMatchingStrategy: value })
                    setTouchedStrategies(prev => ({ ...prev, componentMatchingStrategy: true }))
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MATCH_ANY">Match any</SelectItem>
                    <SelectItem value="MATCH_TWO">Match two</SelectItem>
                    <SelectItem value="MATCH_MOST">Match most</SelectItem>
                    <SelectItem value="MATCH_ALL">Match all</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="usePool"
                checked={formData.usePool}
                onCheckedChange={(checked) => setFormData({ ...formData, usePool: !!checked })}
              />
              <Label htmlFor="usePool" className="font-normal">Use a pre-determined key pool</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Licenses draw their keys from a finite pool you populate yourself. This cannot be changed after the policy is created.
                </TooltipContent>
              </Tooltip>
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
                <TooltipContent>
                  Licenses under this policy will automatically inherit all selected entitlements
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="rounded-md border">
              <div className="p-2 border-b">
                <Input
                  placeholder="Search entitlements…"
                  value={entitlementSearch}
                  onChange={(e) => setEntitlementSearch(e.target.value)}
                />
              </div>
              <ScrollArea className="h-32">
                <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {entitlements
                    .filter((ent) => {
                      const q = entitlementSearch.toLowerCase()
                      const name = String(ent.attributes.name || '').toLowerCase()
                      const code = String(ent.attributes.code || '').toLowerCase()
                      return !q || name.includes(q) || code.includes(q) || ent.id.includes(q)
                    })
                    .map((ent) => (
                      <label key={ent.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selectedEntitlements.includes(ent.id)}
                          onCheckedChange={(v) =>
                            setSelectedEntitlements((prev) =>
                              v ? [...prev, ent.id] : prev.filter((id) => id !== ent.id)
                            )
                          }
                        />
                        <span>
                          {ent.attributes.name}
                          <span className="text-muted-foreground"> · {ent.attributes.code}</span>
                        </span>
                      </label>
                    ))}
                  {entitlements.length === 0 && (
                    <div className="text-xs text-muted-foreground">No entitlements found</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="metadata">Metadata (Optional)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Freeform JSON object for your own custom tracking data</TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              id="metadata"
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
            <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Policy'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
