'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getKeygenApi } from '@/lib/api'
import { Release, Product } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Search,
  Filter,
  MoreVertical,
  Rocket,
  Edit,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import { handleLoadError } from '@/lib/utils/error-handling'
import { CreateReleaseDialog } from './create-release-dialog'
import { EditReleaseDialog } from './edit-release-dialog'
import { DeleteReleaseDialog } from './delete-release-dialog'
import { PaginationControls } from '@/components/shared/pagination-controls'

const DEFAULT_PAGE_SIZE = 25
const SEARCH_DEBOUNCE_MS = 300

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

export function ReleaseManagement() {
  const [releases, setReleases] = useState<Release[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [channelFilter, setChannelFilter] = useState<string>('all')
  const [editRelease, setEditRelease] = useState<Release | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteRelease, setDeleteRelease] = useState<Release | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const api = getKeygenApi()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS)

  const productsById = new Map(products.map(p => [p.id, p]))

  const loadProducts = useCallback(async () => {
    try {
      const response = await api.products.list({ limit: 100 })
      setProducts(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'products', { silent: true })
    }
  }, [api.products])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.releases.list({
        page: { size: pageSize, number: currentPage },
        status: statusFilter === 'all' ? undefined : (statusFilter as Release['attributes']['status']),
        channel: channelFilter === 'all' ? undefined : (channelFilter as Release['attributes']['channel']),
      })
      setReleases(response.data || [])
      setTotalCount(response.meta?.count ?? (response.data?.length || 0))
    } catch (error: unknown) {
      handleLoadError(error, 'releases')
    } finally {
      setLoading(false)
    }
  }, [api.releases, pageSize, currentPage, statusFilter, channelFilter])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, channelFilter, pageSize, debouncedSearch])

  const handleReleaseCreated = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
  }, [currentPage, loadData])

  const filteredReleases = releases.filter(release => {
    if (!debouncedSearch) return true
    const term = debouncedSearch.toLowerCase()
    return (
      release.attributes.version.toLowerCase().includes(term) ||
      (release.attributes.name || '').toLowerCase().includes(term) ||
      (release.attributes.tag || '').toLowerCase().includes(term)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDeleteRelease = (release: Release) => {
    setDeleteRelease(release)
    setDeleteDialogOpen(true)
  }

  const handleEditRelease = (release: Release) => {
    setEditRelease(release)
    setEditDialogOpen(true)
  }

  const productIdOf = (release: Release) => {
    const rel = release.relationships?.product?.data
    return rel && !Array.isArray(rel) ? rel.id : undefined
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Releases</h1>
          <p className="text-muted-foreground">
            Manage versioned releases and their artifacts
          </p>
        </div>
        <CreateReleaseDialog products={products} onReleaseCreated={handleReleaseCreated} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Releases</CardTitle>
          <Rocket className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCount}</div>
          <p className="text-xs text-muted-foreground">Across all products</p>
        </CardContent>
      </Card>

      <div className="flex items-center space-x-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by version, name, or tag..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="YANKED">Yanked</SelectItem>
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="stable">stable</SelectItem>
            <SelectItem value="rc">rc</SelectItem>
            <SelectItem value="beta">beta</SelectItem>
            <SelectItem value="alpha">alpha</SelectItem>
            <SelectItem value="dev">dev</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Release List</CardTitle>
          <CardDescription>
            A list of all releases in your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading releases...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReleases.map((release) => {
                  const productId = productIdOf(release)
                  const product = productId ? productsById.get(productId) : undefined
                  return (
                    <TableRow key={release.id}>
                      <TableCell>
                        <Link
                          href={`/releases/${release.id}`}
                          className="font-medium text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        >
                          {release.attributes.name || release.attributes.version}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                        <div className="text-xs text-muted-foreground">{release.attributes.version}</div>
                      </TableCell>
                      <TableCell>
                        {product ? product.attributes.name : <span className="text-muted-foreground">Unknown</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{release.attributes.channel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            release.attributes.status === 'PUBLISHED'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : release.attributes.status === 'YANKED'
                              ? 'bg-red-100 text-red-800 border-red-200'
                              : 'bg-gray-100 text-gray-800 border-gray-200'
                          }
                        >
                          {release.attributes.status.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {release.attributes.tag ? (
                          <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                            {release.attributes.tag}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(release.attributes.created)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild>
                              <Link href={`/releases/${release.id}`}>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEditRelease(release)}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Release
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteRelease(release)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}

          {!loading && (
            <PaginationControls
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}

          {!loading && filteredReleases.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <Rocket className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm font-medium">No releases found</div>
                <div className="text-xs text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' || channelFilter !== 'all'
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating your first release'
                  }
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditReleaseDialog
        release={editRelease}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onReleaseUpdated={loadData}
      />

      <DeleteReleaseDialog
        release={deleteRelease}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onReleaseDeleted={loadData}
      />
    </div>
  )
}
