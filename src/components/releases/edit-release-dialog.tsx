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
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { Release } from '@/lib/types/keygen'
import { handleCrudError } from '@/lib/utils/error-handling'

interface EditReleaseDialogProps {
  release: Release | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReleaseUpdated?: () => void
}

export function EditReleaseDialog({ release, open, onOpenChange, onReleaseUpdated }: EditReleaseDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    tag: '',
    description: '',
  })

  const api = getKeygenApi()

  useEffect(() => {
    if (open && release) {
      setFormData({
        name: release.attributes.name || '',
        tag: release.attributes.tag || '',
        description: release.attributes.description || '',
      })
    }
  }, [open, release])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!release) return

    try {
      setLoading(true)

      await api.releases.update(release.id, {
        name: formData.name.trim() || undefined,
        tag: formData.tag.trim() || undefined,
        description: formData.description.trim() || undefined,
      })

      toast.success('Release updated successfully')
      onOpenChange(false)
      onReleaseUpdated?.()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'Release')
    } finally {
      setLoading(false)
    }
  }

  if (!release) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Release</DialogTitle>
          <DialogDescription>
            Update release metadata. Version and channel are immutable after creation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Version</Label>
            <Input value={release.attributes.version} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tag">Tag</Label>
            <Input
              id="edit-tag"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Release'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
