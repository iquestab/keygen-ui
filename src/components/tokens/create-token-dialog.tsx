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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, Plus, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { handleFormError } from '@/lib/utils/error-handling'
import { toast } from 'sonner'

interface CreateTokenDialogProps {
  onTokenCreated?: (rawToken: string) => void
}

export function CreateTokenDialog({ onTokenCreated }: CreateTokenDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    permissions: '',
    expiry: undefined as Date | undefined,
  })

  const api = getKeygenApi()

  const resetForm = () => {
    setFormData({ name: '', permissions: '', expiry: undefined })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      setLoading(true)

      const response = await api.tokens.create({
        name: formData.name.trim() || undefined,
        expiry: formData.expiry ? formData.expiry.toISOString() : undefined,
        permissions: formData.permissions
          ? formData.permissions.split(',').map((p) => p.trim()).filter(Boolean)
          : undefined,
      })

      const rawToken = response.data?.attributes?.token
      if (!rawToken) {
        toast.error('Key created, but no secret was returned by the API')
      }

      setOpen(false)
      resetForm()
      onTokenCreated?.(rawToken || '')
    } catch (error: unknown) {
      handleFormError(error, 'API key')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create API Key
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Generate a new API key for programmatic access to the Keygen API.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Label htmlFor="token-name">Name</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>A label to help you recognize this key later (e.g. which service uses it)</TooltipContent>
                </Tooltip>
              </div>
              <span className="text-xs text-muted-foreground">Optional</span>
            </div>
            <Input
              id="token-name"
              placeholder="e.g., CI Pipeline"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="token-permissions">Permissions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Comma-separated (e.g., *, licenses:read). Leave blank for full access.</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="token-permissions"
              placeholder="Full access (*)"
              value={formData.permissions}
              onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label>Expiry</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Leave blank for no expiry</TooltipContent>
              </Tooltip>
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !formData.expiry && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.expiry ? format(formData.expiry, 'PPP') : 'Never expires'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.expiry}
                  onSelect={(date) => setFormData({ ...formData, expiry: date })}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm() }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating…' : 'Create API Key'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
