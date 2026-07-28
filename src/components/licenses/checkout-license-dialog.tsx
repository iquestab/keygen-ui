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
import { License } from '@/lib/types/keygen'
import { handleCrudError } from '@/lib/utils/error-handling'

interface CheckoutLicenseDialogProps {
  license: License
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CheckoutLicenseDialog({ license, open, onOpenChange }: CheckoutLicenseDialogProps) {
  const [loading, setLoading] = useState(false)
  const [ttlDays, setTtlDays] = useState('30')
  const [noExpiry, setNoExpiry] = useState(false)
  const [encrypt, setEncrypt] = useState(true)
  const api = getKeygenApi()

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

      const response = await api.licenses.checkOut(license.id, { ttl, encrypt })
      const certificate = response.data?.attributes?.certificate

      if (!certificate) {
        toast.error('License file check-out did not return a certificate')
        return
      }

      const filename = `${(license.attributes.name || license.id).replace(/[^a-z0-9_-]+/gi, '_')}.lic`
      const blob = new Blob([certificate], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      toast.success('License file downloaded')
      onOpenChange(false)
    } catch (error: unknown) {
      handleCrudError(error, 'create', 'License file', {
        customMessage: "Failed to check out license file — the license's policy may not have a cryptographic scheme configured"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Download License File</DialogTitle>
          <DialogDescription>
            Check out a signed, offline-verifiable license file for {license.attributes.name || 'this license'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="checkout-ttl">Valid for (days)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>How long the offline file remains valid before it needs to be re-checked-out. Leave blank to use the server&apos;s default TTL.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="checkout-ttl"
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
                id="checkout-no-expiry"
                checked={noExpiry}
                onCheckedChange={(checked) => setNoExpiry(!!checked)}
              />
              <Label htmlFor="checkout-no-expiry">No expiry (not recommended)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  Issues a perpetual, irrevocable file. Later changes to the license — expiry, suspension,
                  metadata — are never guaranteed to reach this install, since no re-checkout is ever required.
                </TooltipContent>
              </Tooltip>
            </div>
            {noExpiry && (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This file never needs to be re-checked-out, so it will keep working even if you later suspend,
                  revoke, or change this license.
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="checkout-encrypt"
              checked={encrypt}
              onCheckedChange={(checked) => setEncrypt(!!checked)}
            />
            <Label htmlFor="checkout-encrypt">Encrypt file contents</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="size-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>Encrypts the license snapshot using the license key as the secret, in addition to signing it</TooltipContent>
            </Tooltip>
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
