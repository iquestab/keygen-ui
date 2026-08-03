'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Product } from '@/lib/types/keygen'
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
  Package,
  Shield,
  Unlock,
  Lock,
  Edit,
  Trash2,
  ExternalLink,
} from 'lucide-react'
// No direct toasts here; using centralized error handlers where needed
import { handleLoadError } from '@/lib/utils/error-handling'
import { CreateProductDialog } from './create-product-dialog'
import { EditProductDialog } from './edit-product-dialog'
import { DeleteProductDialog } from './delete-product-dialog'
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

export function ProductManagement() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [strategyFilter, setStrategyFilter] = useState<string>('all')
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const api = getKeygenApi()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  // Search state
  const [isSearchMode, setIsSearchMode] = useState(false)
  const debouncedSearch = useDebounce(searchTerm, SEARCH_DEBOUNCE_MS)

  const buildSearchQuery = useCallback((term: string) => {
    const query: Record<string, string> = {}
    if (term.length < 3) return query

    query.name = term

    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
    if (uuidPattern.test(term)) {
      query.id = term
    }

    // Speculative — harmless with OR if not actually searchable
    query.code = term

    return query
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const searchQuery = debouncedSearch ? buildSearchQuery(debouncedSearch) : null
      const hasValidSearch = searchQuery && Object.keys(searchQuery).length > 0

      if (hasValidSearch) {
        setIsSearchMode(true)
        const response = await api.search.search<Product>({
          type: 'products',
          query: searchQuery,
          op: 'OR',
          page: { size: pageSize, number: currentPage },
        })
        setProducts(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      } else {
        setIsSearchMode(false)
        const response = await api.products.list({
          page: { size: pageSize, number: currentPage },
        })
        setProducts(response.data || [])
        setTotalCount(response.meta?.count ?? (response.data?.length || 0))
      }
    } catch (error: unknown) {
      handleLoadError(error, 'products')
    } finally {
      setLoading(false)
    }
  }, [api.products, api.search, pageSize, currentPage, debouncedSearch, buildSearchQuery])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [strategyFilter, pageSize, debouncedSearch])

  // After creating a product, jump to page 1 — newly created records are
  // returned first (reverse-chronological order), so this is where the new
  // product will be. If we're already on page 1, force a reload explicitly
  // instead of relying on the page-reset effect above.
  const handleProductCreated = useCallback(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      loadData()
    }
  }, [currentPage, loadData])

  // Strategy filter applied client-side on top of the properly paginated page,
  // since distributionStrategy isn't a confirmed server-searchable field.
  const filteredProducts = products.filter(product => {
    return strategyFilter === 'all' || product.attributes.distributionStrategy === strategyFilter
  })

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'LICENSED': return 'bg-green-100 text-green-800 border-green-200'
      case 'OPEN': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'CLOSED': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'LICENSED': return <Shield className="h-3 w-3" />
      case 'OPEN': return <Unlock className="h-3 w-3" />
      case 'CLOSED': return <Lock className="h-3 w-3" />
      default: return <Package className="h-3 w-3" />
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const handleDeleteProduct = (product: Product) => {
    setDeleteProduct(product)
    setDeleteDialogOpen(true)
  }

  const openUrl = (url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // Invalid URL, do nothing
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditProduct(product)
    setEditDialogOpen(true)
  }

  return (
    <div className="space-y-6 px-4 lg:px-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="text-muted-foreground">
            Manage your software products and distribution strategies
          </p>
        </div>
        <CreateProductDialog onProductCreated={handleProductCreated} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              {isSearchMode ? 'Matching search' : 'Registered products'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licensed</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.attributes.distributionStrategy === 'LICENSED').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Licensed products
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open</CardTitle>
            <Unlock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.attributes.distributionStrategy === 'OPEN').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Open products
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Closed</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter(p => p.attributes.distributionStrategy === 'CLOSED').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Private products
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex items-center space-x-4">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>
        <Select value={strategyFilter} onValueChange={setStrategyFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by strategy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Strategies</SelectItem>
            <SelectItem value="LICENSED">Licensed</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product List</CardTitle>
          <CardDescription>
            A list of all products in your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-sm text-muted-foreground">Loading products...</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Platforms</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-[70px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="font-medium">{product.attributes.name}</div>
                    </TableCell>
                    <TableCell>
                      {product.attributes.code ? (
                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                          {product.attributes.code}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">No code</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getStrategyColor(product.attributes.distributionStrategy)} flex items-center gap-1 w-fit`}
                      >
                        {getStrategyIcon(product.attributes.distributionStrategy)}
                        {product.attributes.distributionStrategy?.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {product.attributes.url ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openUrl(product.attributes.url!)}
                          className="p-0 h-auto font-normal text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-3 w-3 mr-1" />
                          {product.attributes.url}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">No URL</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.attributes.platforms && product.attributes.platforms.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.attributes.platforms.slice(0, 2).map((platform, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {platform}
                            </Badge>
                          ))}
                          {product.attributes.platforms.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{product.attributes.platforms.length - 2}
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No platforms</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDate(product.attributes.created)}
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
                          <DropdownMenuItem onClick={() => handleEditProduct(product)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Product
                          </DropdownMenuItem>
                          {product.attributes.url && (
                            <DropdownMenuItem onClick={() => openUrl(product.attributes.url!)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Visit URL
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => handleDeleteProduct(product)}
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

          {!loading && filteredProducts.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <Package className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <div className="text-sm font-medium">No products found</div>
                <div className="text-xs text-muted-foreground">
                  {searchTerm || strategyFilter !== 'all' 
                    ? 'Try adjusting your search or filters'
                    : 'Get started by creating your first product'
                  }
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <EditProductDialog
        product={editProduct}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onProductUpdated={loadData}
      />

      {/* Delete Product Dialog */}
      <DeleteProductDialog
        product={deleteProduct}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onProductDeleted={loadData}
      />
    </div>
  )
}
