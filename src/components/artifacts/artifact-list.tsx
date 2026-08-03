'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Artifact } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { FileArchive, Trash2 } from 'lucide-react'
import { handleLoadError } from '@/lib/utils/error-handling'
import { UploadArtifactDialog } from './upload-artifact-dialog'
import { DeleteArtifactDialog } from './delete-artifact-dialog'

interface ArtifactListProps {
  releaseId: string
}

const STATUS_STYLES: Record<Artifact['attributes']['status'], string> = {
  WAITING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  UPLOADED: 'bg-green-100 text-green-800 border-green-200',
  FAILED: 'bg-red-100 text-red-800 border-red-200',
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`
}

export function ArtifactList({ releaseId }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteArtifact, setDeleteArtifact] = useState<Artifact | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const api = getKeygenApi()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.artifacts.list({ release: releaseId, limit: 100 })
      setArtifacts(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'artifacts')
    } finally {
      setLoading(false)
    }
  }, [api.artifacts, releaseId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleDeleteArtifact = (artifact: Artifact) => {
    setDeleteArtifact(artifact)
    setDeleteDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Artifacts</h3>
        <UploadArtifactDialog releaseId={releaseId} onArtifactUploaded={loadData} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-24">
          <div className="text-sm text-muted-foreground">Loading artifacts...</div>
        </div>
      ) : artifacts.length === 0 ? (
        <div className="flex items-center justify-center h-24 border rounded-lg border-dashed">
          <div className="text-center">
            <FileArchive className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">No artifacts uploaded yet</div>
          </div>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Filename</TableHead>
              <TableHead>Platform</TableHead>
              <TableHead>Arch</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {artifacts.map((artifact) => (
              <TableRow key={artifact.id}>
                <TableCell>
                  <div className="font-medium">{artifact.attributes.filename}</div>
                  <div className="text-xs text-muted-foreground">{artifact.attributes.filetype}</div>
                </TableCell>
                <TableCell>{artifact.attributes.platform || '—'}</TableCell>
                <TableCell>{artifact.attributes.arch || '—'}</TableCell>
                <TableCell>{formatBytes(artifact.attributes.filesize)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={STATUS_STYLES[artifact.attributes.status]}>
                    {artifact.attributes.status.toLowerCase()}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteArtifact(artifact)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <DeleteArtifactDialog
        artifact={deleteArtifact}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onArtifactDeleted={loadData}
      />
    </div>
  )
}
