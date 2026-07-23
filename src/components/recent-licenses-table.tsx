'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getKeygenApi } from '@/lib/api'
import { License } from '@/lib/types/keygen'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Key, ArrowRight } from 'lucide-react'

const RECENT_COUNT = 8

function getStatusColor(status: string) {
  switch (status.toLowerCase()) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200'
    case 'suspended': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'expired': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function RecentLicensesTable() {
  const [licenses, setLicenses] = useState<License[]>([])
  const [loading, setLoading] = useState(true)
  const api = getKeygenApi()

  useEffect(() => {
    let cancelled = false

    async function loadRecentLicenses() {
      try {
        // Fetch a page and sort client-side by creation date, since the API
        // doesn't guarantee newest-first ordering by default.
        const response = await api.licenses.list({ page: { size: 100, number: 1 } })
        if (cancelled) return
        const sorted = (response.data || [])
          .slice()
          .sort((a, b) => new Date(b.attributes.created).getTime() - new Date(a.attributes.created).getTime())
          .slice(0, RECENT_COUNT)
        setLicenses(sorted)
      } catch (error) {
        if (cancelled) return
        console.error('Failed to load recent licenses:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRecentLicenses()
    return () => { cancelled = true }
  }, [api.licenses])

  return (
    <Card className="mx-4 lg:mx-6">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Recent Licenses</CardTitle>
          <CardDescription>The most recently created licenses in your account</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/licenses">
            View all
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Expiry</TableHead>
              <TableHead className="pr-6">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell className="pr-6"><Skeleton className="h-4 w-24" /></TableCell>
                </TableRow>
              ))
            ) : licenses.length > 0 ? (
              licenses.map((license) => (
                <TableRow key={license.id}>
                  <TableCell className="pl-6 font-medium">
                    {license.attributes.name || (
                      <span className="text-muted-foreground italic">Unnamed</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(license.attributes.status)}>
                      {license.attributes.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {license.attributes.expiry ? formatDate(license.attributes.expiry) : (
                      <span className="text-muted-foreground">Never</span>
                    )}
                  </TableCell>
                  <TableCell className="pr-6 text-muted-foreground">
                    {formatDate(license.attributes.created)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4}>
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Key className="h-8 w-8 text-muted-foreground mb-2" />
                    <div className="text-sm font-medium">No licenses yet</div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
