'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getKeygenApi } from '@/lib/api'
import { Release } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ArrowLeft, Rocket, Ban, AlertTriangle } from 'lucide-react'
import { handleLoadError, handleCrudError } from '@/lib/utils/error-handling'
import { toast } from 'sonner'
import { ReleaseStatusBadge } from './release-status-badge'
import { ReleaseConstraints } from './release-constraints'
import { ArtifactList } from '@/components/artifacts/artifact-list'

interface ReleaseDetailProps {
  releaseId: string
}

export function ReleaseDetail({ releaseId }: ReleaseDetailProps) {
  const [release, setRelease] = useState<Release | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [publishDialogOpen, setPublishDialogOpen] = useState(false)
  const [yankDialogOpen, setYankDialogOpen] = useState(false)
  const api = getKeygenApi()

  const loadRelease = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.releases.get(releaseId)
      setRelease(response.data || null)
    } catch (error: unknown) {
      handleLoadError(error, 'release')
    } finally {
      setLoading(false)
    }
  }, [api.releases, releaseId])

  useEffect(() => {
    loadRelease()
  }, [loadRelease])

  const handlePublish = async () => {
    try {
      setActionLoading(true)
      await api.releases.publish(releaseId)
      toast.success('Release published')
      setPublishDialogOpen(false)
      loadRelease()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'Release')
    } finally {
      setActionLoading(false)
    }
  }

  const handleYank = async () => {
    try {
      setActionLoading(true)
      await api.releases.yank(releaseId)
      toast.success('Release yanked')
      setYankDialogOpen(false)
      loadRelease()
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'Release')
    } finally {
      setActionLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Loading release...</div>
      </div>
    )
  }

  if (!release) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-muted-foreground">Release not found</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <Link href="/releases" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" />
          Back to Releases
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {release.attributes.name || release.attributes.version}
            </h1>
            <p className="text-muted-foreground">Version {release.attributes.version}</p>
          </div>
          <div className="flex items-center gap-2">
            {release.attributes.status === 'DRAFT' && (
              <Button onClick={() => setPublishDialogOpen(true)}>
                <Rocket className="mr-2 h-4 w-4" />
                Publish
              </Button>
            )}
            {release.attributes.status === 'PUBLISHED' && (
              <Button variant="outline" onClick={() => setYankDialogOpen(true)}>
                <Ban className="mr-2 h-4 w-4" />
                Yank
              </Button>
            )}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <ReleaseStatusBadge status={release.attributes.status} />
            <Badge variant="secondary">{release.attributes.channel}</Badge>
            {release.attributes.tag && (
              <Badge variant="outline">tag: {release.attributes.tag}</Badge>
            )}
          </div>
          {release.attributes.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {release.attributes.description}
            </p>
          )}
          <div className="text-xs text-muted-foreground">
            Created {formatDate(release.attributes.created)} · Updated {formatDate(release.attributes.updated)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ReleaseConstraints releaseId={release.id} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <ArtifactList releaseId={release.id} />
        </CardContent>
      </Card>

      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Publish Release</DialogTitle>
            <DialogDescription>
              This will make version &ldquo;{release.attributes.version}&rdquo; available for distribution.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPublishDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={handlePublish} disabled={actionLoading}>
              {actionLoading ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={yankDialogOpen} onOpenChange={setYankDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Yank Release
            </DialogTitle>
            <DialogDescription>
              This will delist version &ldquo;{release.attributes.version}&rdquo; from distribution without deleting it. It can be republished later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setYankDialogOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleYank} disabled={actionLoading}>
              {actionLoading ? 'Yanking...' : 'Yank'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
