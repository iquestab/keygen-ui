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
import { AlertTriangle, Trash2 } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { Release } from '@/lib/types/keygen'
import { handleCrudError } from '@/lib/utils/error-handling'

interface DeleteReleaseDialogProps {
  release: Release | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReleaseDeleted?: () => void
}

export function DeleteReleaseDialog({ release, open, onOpenChange, onReleaseDeleted }: DeleteReleaseDialogProps) {
  const [loading, setLoading] = useState(false)
  const api = getKeygenApi()

  const handleDelete = async () => {
    if (!release) return

    try {
      setLoading(true)
      await api.releases.delete(release.id)
      toast.success(`Release "${release.attributes.version}" deleted successfully`)
      onOpenChange(false)
      onReleaseDeleted?.()
    } catch (error: unknown) {
      handleCrudError(error, 'delete', 'Release', {
        onNotFound: () => {
          onOpenChange(false)
          onReleaseDeleted?.()
        }
      })
    } finally {
      setLoading(false)
    }
  }

  if (!release) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Release
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the release and its artifacts.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-medium text-destructive mb-1">
                  Are you sure you want to delete version &ldquo;{release.attributes.version}&rdquo;?
                </h4>
                <p className="text-sm text-muted-foreground">
                  Release ID: <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{release.id}</code>
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
            {loading ? (
              'Deleting...'
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Release
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
