'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Copy, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface RevealTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string | null
}

export function RevealTokenDialog({ open, onOpenChange, token }: RevealTokenDialogProps) {
  const copyToken = () => {
    if (!token) return
    navigator.clipboard.writeText(token)
    toast.success('API key copied to clipboard')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>
            Copy this key now — for security, it won&apos;t be shown again.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border bg-muted p-3">
          <code className="flex-1 break-all font-mono text-sm">{token}</code>
          <Button variant="outline" size="icon" onClick={copyToken} aria-label="Copy API key">
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Store this key somewhere safe. If you lose it, you&apos;ll need to regenerate a new one.</span>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
