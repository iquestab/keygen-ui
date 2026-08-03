'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Channel } from '@/lib/types/keygen'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { GitBranch } from 'lucide-react'
import { handleLoadError } from '@/lib/utils/error-handling'

export function ChannelManagement() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const api = getKeygenApi()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.channels.list({ limit: 100 })
      setChannels(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'channels')
    } finally {
      setLoading(false)
    }
  }, [api.channels])

  useEffect(() => {
    loadData()
  }, [loadData])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Channels</h1>
        <p className="text-muted-foreground">
          Distribution channels, automatically populated by your releases and their artifacts
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Channels</CardTitle>
          <GitBranch className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{channels.length}</div>
          <p className="text-xs text-muted-foreground">In use across your releases</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel List</CardTitle>
          <CardDescription>
            Channels are read-only — they&apos;re derived from your releases&apos; channel attribute
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading channels...</div>
            </div>
          ) : channels.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <GitBranch className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm font-medium">No channels yet</div>
                <div className="text-xs text-muted-foreground">
                  Channels appear here once you create releases
                </div>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {channels.map((channel) => (
                  <TableRow key={channel.id}>
                    <TableCell>
                      <div className="font-medium">{channel.attributes.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{channel.attributes.key}</Badge>
                    </TableCell>
                    <TableCell>
                      {formatDate(channel.attributes.created)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
