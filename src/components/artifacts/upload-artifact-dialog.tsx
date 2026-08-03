'use client'

import { useState, useRef, DragEvent } from 'react'
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
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Upload, HelpCircle, FileArchive, X } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { uploadArtifactFile } from '@/lib/api/upload'
import { toast } from 'sonner'
import { handleFormError } from '@/lib/utils/error-handling'

interface UploadArtifactDialogProps {
  releaseId: string
  onArtifactUploaded?: () => void
}

// "app-1.2.3.tar.gz" -> "tar.gz"; "install.sh" -> "sh"
function guessFiletype(filename: string): string {
  const parts = filename.split('.')
  return parts.length > 1 ? parts.slice(1).join('.') : ''
}

export function UploadArtifactDialog({ releaseId, onArtifactUploaded }: UploadArtifactDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [formData, setFormData] = useState({
    filetype: '',
    platform: '',
    arch: '',
    checksum: '',
    signature: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const api = getKeygenApi()

  const resetForm = () => {
    setFile(null)
    setProgress(0)
    setFormData({ filetype: '', platform: '', arch: '', checksum: '', signature: '' })
  }

  const selectFile = (selected: File) => {
    setFile(selected)
    setFormData(prev => ({ ...prev, filetype: prev.filetype || guessFiletype(selected.name) }))
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
    const dropped = e.dataTransfer.files?.[0]
    if (dropped) selectFile(dropped)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragActive(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!file) {
      toast.error('Please choose a file to upload')
      return
    }

    if (!formData.filetype.trim()) {
      toast.error('Please enter a filetype (e.g. zip, tar.gz)')
      return
    }

    try {
      setLoading(true)
      setProgress(0)

      const { artifact, uploadUrl } = await api.artifacts.create({
        filename: file.name,
        filetype: formData.filetype.trim(),
        filesize: file.size,
        platform: formData.platform.trim() || undefined,
        arch: formData.arch.trim() || undefined,
        checksum: formData.checksum.trim() || undefined,
        signature: formData.signature.trim() || undefined,
        releaseId,
      })

      await uploadArtifactFile(file, uploadUrl, {
        onProgress: ({ loaded, total }) => setProgress(total ? Math.round((loaded / total) * 100) : 0),
      })

      toast.success(`Artifact "${artifact?.attributes.filename || file.name}" uploaded successfully`)
      setOpen(false)
      resetForm()
      onArtifactUploaded?.()
    } catch (error: unknown) {
      handleFormError(error, 'Artifact')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) resetForm() }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Upload Artifact
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Artifact</DialogTitle>
          <DialogDescription>
            Upload a file to attach to this release. Files are uploaded directly to storage.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) selectFile(selected)
              }}
            />
            {file ? (
              <div className="flex items-center gap-2">
                <FileArchive className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">{file.name}</span>
                <span className="text-xs text-muted-foreground">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); resetForm() }}
                  className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="h-6 w-6 text-muted-foreground" />
                <div className="text-sm text-muted-foreground">
                  Drag and drop a file here, or click to browse
                </div>
              </>
            )}
          </div>

          {loading && (
            <div className="space-y-1">
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground text-right">{progress}%</div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="filetype">Filetype *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Must match the file&apos;s extension (e.g. zip, tar.gz)</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="filetype"
                placeholder="zip"
                value={formData.filetype}
                onChange={(e) => setFormData({ ...formData, filetype: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Input
                id="platform"
                placeholder="darwin, linux, windows"
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="arch">Architecture</Label>
              <Input
                id="arch"
                placeholder="amd64, arm64"
                value={formData.arch}
                onChange={(e) => setFormData({ ...formData, arch: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="checksum">Checksum</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>SHA-512, base64 encoded without padding (optional)</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="checksum"
                placeholder="Optional"
                value={formData.checksum}
                onChange={(e) => setFormData({ ...formData, checksum: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="signature">Signature</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Ed25519ph, base64 encoded without padding (optional)</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="signature"
              placeholder="Optional"
              value={formData.signature}
              onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setOpen(false); resetForm() }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? `Uploading... ${progress}%` : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
