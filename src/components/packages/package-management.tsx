'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Package as PackageType } from '@/lib/types/keygen'
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
  Search,
  MoreVertical,
  Box,
  Edit,
  Trash2,
} from 'lucide-react'
import { handleLoadError } from '@/lib/utils/error-handling'
import { CreatePackageDialog } from './create-package-dialog'
import { EditPackageDialog } from './edit-package-dialog'
import { DeletePackageDialog } from './delete-package-dialog'
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

export function PackageManagement() {
  const [packages, setPackages] = useState<PackageType[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [editPackage, setEditPackage] = useState<PackageType | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deletePackage, setDeletePackage] = useState<PackageType | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const api = getKeygenApi()

  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.packages.list({
        page: { size: pageSize, number: currentPage },
      })
      setPackages(response.data || [])
      setTotalCount(response.meta?.count ?? (response.data?.length || 0))
    } catch (error: unknown) {
      handleLoadError(error, 'packages')
    } finally {
      setLoading(false)
    }
  }, [api.packages, pageSize, currentPage])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize, debouncedSearch])

  const handlePackageCreated = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
  }, [currentPage, loadData])

  // Search filters client-side on top of the current page — packages aren't a
  // server-searchable resource type, and lists are small enough per product.
  const filteredPackages = packages.filter(pkg => {
    if (!debouncedSearch) return true
    const term = debouncedSearch.toLowerCase()
    return (
      pkg.attributes.key.toLowerCase().includes(term) ||
      (pkg.attributes.name || '').toLowerCase().includes(term)
    )
  })

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDeletePackage = (pkg: PackageType) => {
    setDeletePackage(pkg)
    setDeleteDialogOpen(true)
  }

  const handleEditPackage = (pkg: PackageType) => {
    setEditPackage(pkg)
    setEditDialogOpen(true)
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Packages</h1>
          <p className="text-muted-foreground">
            Group releases within a product and define their distribution engine
          </p>
        </div>
        <CreatePackageDialog onPackageCreated={handlePackageCreated} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Packages</CardTitle>
          <Box className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{totalCount}</div>
          <p className="text-xs text-muted-foreground">Registered packages</p>
        </CardContent>
      </Card>

      <div className="flex items-center space-x-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search packages..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Package List</CardTitle>
          <CardDescription>
            A list of all packages in your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading packages...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Engine</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPackages.map((pkg) => (
                  <TableRow key={pkg.id}>
                    <TableCell>
                      <div className="font-medium">{pkg.attributes.name || pkg.attributes.key}</div>
                    </TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                        {pkg.attributes.key}
                      </code>
                    </TableCell>
                    <TableCell>
                      {pkg.attributes.engine ? (
                        <Badge variant="outline">{pkg.attributes.engine}</Badge>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(pkg.attributes.created)}
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
                          <DropdownMenuItem onClick={() => handleEditPackage(pkg)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Package
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDeletePackage(pkg)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
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

          {!loading && filteredPackages.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <Box className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm font-medium">No packages found</div>
                <div className="text-xs text-muted-foreground">
                  {searchTerm
                    ? 'Try adjusting your search'
                    : 'Get started by creating your first package'
                  }
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <EditPackageDialog
        pkg={editPackage}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onPackageUpdated={loadData}
      />

      <DeletePackageDialog
        pkg={deletePackage}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onPackageDeleted={loadData}
      />
    </div>
  )
}
