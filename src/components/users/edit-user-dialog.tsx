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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { UserIcon, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { User } from '@/lib/types/keygen'
import { handleCrudError } from '@/lib/utils/error-handling'

interface EditUserDialogProps {
  user: User | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserUpdated?: () => void
}

const ROLE_OPTIONS: User['attributes']['role'][] = [
  'admin',
  'developer',
  'sales-agent',
  'support-agent',
  'read-only',
  'user',
]

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    role: 'user' as User['attributes']['role'],
    metadata: '',
  })

  const api = getKeygenApi()

  // Initialize form data when the dialog opens for a user — keyed on `open` as
  // well as `user` so reopening after a cancelled edit doesn't show stale input
  // (the parent passes the same object reference from the still-loaded list).
  useEffect(() => {
    if (open && user) {
      setFormData({
        firstName: user.attributes.firstName || '',
        lastName: user.attributes.lastName || '',
        email: user.attributes.email || '',
        role: user.attributes.role || 'user',
        metadata: user.attributes.metadata ? JSON.stringify(user.attributes.metadata, null, 2) : '',
      })
    }
  }, [open, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user) return

    if (!formData.email.trim()) {
      toast.error('Email is required')
      return
    }

    let metadata: Record<string, unknown> | undefined
    if (formData.metadata.trim()) {
      try {
        metadata = JSON.parse(formData.metadata)
      } catch {
        toast.error('Invalid JSON format in metadata')
        return
      }
    }

    try {
      setLoading(true)

      await api.users.update(user.id, {
        firstName: formData.firstName.trim() || undefined,
        lastName: formData.lastName.trim() || undefined,
        email: formData.email.trim(),
        role: formData.role,
        metadata,
      })

      toast.success('User updated successfully')
      onOpenChange(false)
      onUserUpdated?.()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'User')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update the user&apos;s information and role.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Basic Information
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-user-first-name">First Name</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Optional — shown alongside the user&apos;s email throughout the dashboard</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="edit-user-first-name"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label htmlFor="edit-user-last-name">Last Name</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>Optional — shown alongside the user&apos;s email throughout the dashboard</TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="edit-user-last-name"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="edit-user-email">Email *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Used to sign in and for account notifications — must be unique</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="edit-user-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="edit-user-role">Role</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Controls what this user can access and manage in your Keygen account</TooltipContent>
                </Tooltip>
              </div>
              <Select
                value={formData.role}
                onValueChange={(value: User['attributes']['role']) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="edit-user-metadata">Metadata (JSON)</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Freeform JSON object for your own custom tracking data</TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                id="edit-user-metadata"
                placeholder='{&quot;department&quot;: &quot;Engineering&quot;, &quot;location&quot;: &quot;Remote&quot;}'
                value={formData.metadata}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, metadata: e.target.value })}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Optional JSON metadata for the user
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update User'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
