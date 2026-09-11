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
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { FileDown, HelpCircle, TriangleAlert } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { Machine } from '@/lib/types/keygen'
import type { MachineFileInclude } from '@/lib/api/resources/machines'
import { handleCrudError } from '@/lib/utils/error-handling'

/**
 * Relationships embeddable in the machine file. Unlike a license file — which
 * cannot contain machines at all — a machine file reaches the other way, so the
 * license and its config travel inside the file bound to this fingerprint.
 */
const INCLUDE_OPTIONS: { value: MachineFileInclude; label: string }[] = [
  { value: 'license', label: 'License' },
  { value: 'license.policy', label: 'License policy' },
  { value: 'license.entitlements', label: 'License entitlements' },
  { value: 'license.product', label: 'License product' },
  { value: 'license.owner', label: 'License owner' },
  { value: 'license.users', label: 'License users' },
  { value: 'components', label: 'Components' },
  { value: 'owner', label: 'Owner' },
  { value: 'group', label: 'Group' },
  { value: 'environment', label: 'Environment' },
]

interface CheckoutMachineDialogProps {
  machine: Machine
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckoutMachineDialog({ machine, open, onOpenChange }: CheckoutMachineDialogProps) {
  const [loading, setLoading] = useState(false)
  const [ttlDays, setTtlDays] = useState('30')
  const [noExpiry, setNoExpiry] = useState(false)
  const [encrypt, setEncrypt] = useState(true)
  // A machine file is most useful when the license travels with it — otherwise
  // the offline install still has to reach the API to learn what it may do.
  const [include, setInclude] = useState<MachineFileInclude[]>([
    'license',
    'license.policy',
    'license.entitlements',
  ])
  const api = getKeygenApi()

  const toggleInclude = (value: MachineFileInclude, checked: boolean) => {
    setInclude((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value)
    )
  }

  const handleCheckout = async () => {
    let ttl: number | null | undefined
    if (noExpiry) {
      ttl = null
    } else {
      const parsedDays = ttlDays.trim() ? parseInt(ttlDays) : undefined
      if (parsedDays !== undefined && (!Number.isFinite(parsedDays) || parsedDays <= 0)) {
        toast.error('Valid for (days) must be a positive number, or left blank')
        return
      }
      ttl = parsedDays ? parsedDays * 86400 : undefined
    }

    try {
      setLoading(true)

      const response = await api.machines.checkOut(machine.id, { ttl, encrypt, include })
      const certificate = response.data?.attributes?.certificate

      if (!certificate) {
        toast.error('Machine file check-out did not return a certificate')
        return
      }

      const basename = machine.attributes.name || machine.attributes.fingerprint || machine.id
      const filename = `${basename.replace(/[^a-z0-9_-]+/gi, '_')}.lic`
      const blob = new Blob([certificate], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success('Machine file downloaded')
      onOpenChange(false)
    } catch (error: unknown) {
      handleCrudError(error, 'create', 'Machine file', {
        customMessage:
          "Failed to check out machine file — the machine's license policy may not have a cryptographic scheme configured"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Download Machine File</DialogTitle>
          <DialogDescription>
            Check out a signed, offline-verifiable file bound to{' '}
            {machine.attributes.name || 'this machine'}&apos;s fingerprint.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="machine-checkout-ttl">Valid for (days)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>How long the offline file remains valid before it needs to be re-checked-out. Leave blank to use the server&apos;s default TTL.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="machine-checkout-ttl"
              type="number"
              min="1"
              value={ttlDays}
              onChange={(e) => setTtlDays(e.target.value)}
              disabled={noExpiry}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="machine-checkout-no-expiry"
                checked={noExpiry}
                onCheckedChange={(checked) => setNoExpiry(!!checked)}
              />
              <Label htmlFor="machine-checkout-no-expiry">No expiry (not recommended)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Issues a perpetual, irrevocable file. Later changes to the machine or its license —
                  expiry, suspension, metadata — are never guaranteed to reach this install.
                </TooltipContent>
              </Tooltip>
            </div>
            {noExpiry && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This file never needs to be re-checked-out, so it will keep working even if you
                  later deactivate this machine or revoke its license.
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="machine-checkout-encrypt"
              checked={encrypt}
              onCheckedChange={(checked) => setEncrypt(!!checked)}
            />
            <Label htmlFor="machine-checkout-encrypt">Encrypt file contents</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                Encrypts the snapshot using the license key combined with this machine&apos;s
                fingerprint as the secret, in addition to signing it
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Include in file</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Embeds these related records so an offline install can read them without
                  reaching the API.
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {INCLUDE_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`machine-checkout-include-${option.value}`}
                    checked={include.includes(option.value)}
                    onCheckedChange={(checked) => toggleInclude(option.value, !!checked)}
                  />
                  <Label
                    htmlFor={`machine-checkout-include-${option.value}`}
                    className="text-sm font-normal"
                  >
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCheckout} disabled={loading}>
            <FileDown className="mr-2 h-4 w-4" />
            {loading ? 'Downloading...' : 'Download'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
