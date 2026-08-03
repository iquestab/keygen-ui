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
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { Package as PackageType } from '@/lib/types/keygen'
import { handleCrudError } from '@/lib/utils/error-handling'

interface EditPackageDialogProps {
  pkg: PackageType | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onPackageUpdated?: () => void
}

const ENGINE_OPTIONS = ['npm', 'pypi', 'rubygems', 'tauri', 'oci', 'raw'] as const

export function EditPackageDialog({ pkg, open, onOpenChange, onPackageUpdated }: EditPackageDialogProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    engine: 'none' as typeof ENGINE_OPTIONS[number] | 'none',
  })

  const api = getKeygenApi()

  useEffect(() => {
    if (open && pkg) {
      setFormData({
        key: pkg.attributes.key,
        name: pkg.attributes.name || '',
        engine: pkg.attributes.engine || 'none',
      })
    }
  }, [open, pkg])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!pkg) return

    if (!formData.key.trim()) {
      toast.error('Package key is required')
      return
    }

    try {
      setLoading(true)

      await api.packages.update(pkg.id, {
        key: formData.key.trim(),
        name: formData.name.trim() || undefined,
        engine: formData.engine === 'none' ? null : formData.engine,
      })

      toast.success('Package updated successfully')
      onOpenChange(false)
      onPackageUpdated?.()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'Package')
    } finally {
      setLoading(false)
    }
  }

  if (!pkg) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Edit Package</DialogTitle>
          <DialogDescription>
            Update the package information.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-key">Key *</Label>
            <Input
              id="edit-key"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
            />
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
            <Label htmlFor="edit-engine">Engine</Label>
            <Select
              value={formData.engine}
              onValueChange={(value: typeof ENGINE_OPTIONS[number] | 'none') => setFormData({ ...formData, engine: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ENGINE_OPTIONS.map((engine) => (
                  <SelectItem key={engine} value={engine}>{engine}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Update Package'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
