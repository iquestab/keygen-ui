'use client'

import { useState, useEffect, useCallback } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Plus, HelpCircle } from 'lucide-react'
import { getKeygenApi } from '@/lib/api'
import { toast } from 'sonner'
import { Product } from '@/lib/types/keygen'
import { handleFormError, handleLoadError } from '@/lib/utils/error-handling'

interface CreatePackageDialogProps {
  onPackageCreated?: () => void
}

const ENGINE_OPTIONS = ['npm', 'pypi', 'rubygems', 'tauri', 'oci', 'raw'] as const

export function CreatePackageDialog({ onPackageCreated }: CreatePackageDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [productsLoading, setProductsLoading] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    productId: '',
    engine: 'none' as typeof ENGINE_OPTIONS[number] | 'none',
  })

  const api = getKeygenApi()

  const loadProducts = useCallback(async () => {
    try {
      setProductsLoading(true)
      const response = await api.products.list({ limit: 50 })
      setProducts(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'products')
    } finally {
      setProductsLoading(false)
    }
  }, [api.products])

  useEffect(() => {
    if (open && products.length === 0) {
      loadProducts()
    }
  }, [open, products.length, loadProducts])

  const resetForm = () => {
    setFormData({ key: '', name: '', productId: '', engine: 'none' })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.key.trim()) {
      toast.error('Please enter a package key')
      return
    }

    if (!formData.productId) {
      toast.error('Please select a product')
      return
    }

    try {
      setLoading(true)

      await api.packages.create({
        key: formData.key.trim(),
        name: formData.name.trim() || undefined,
        engine: formData.engine === 'none' ? undefined : formData.engine,
        productId: formData.productId,
      })

      toast.success('Package created successfully')
      setOpen(false)
      resetForm()
      onPackageCreated?.()
    } catch (error: unknown) {
      handleFormError(error, 'Package')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Package
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Create New Package</DialogTitle>
          <DialogDescription>
            Packages group releases within a product and define how they&apos;re distributed.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="product">Product *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>The product this package belongs to</TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.productId}
              onValueChange={(value) => setFormData({ ...formData, productId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={productsLoading ? "Loading products..." : "Select a product"} />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.attributes.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="key">Key *</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Machine-readable identifier for this package</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="key"
              placeholder="my-package"
              value={formData.key}
              onChange={(e) => setFormData({ ...formData, key: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="name">Name</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Display name for this package (optional)</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="name"
              placeholder="My Package"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="engine">Engine</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>The distribution platform this package&apos;s releases are published through</TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.engine}
              onValueChange={(value: typeof ENGINE_OPTIONS[number] | 'none') => setFormData({ ...formData, engine: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ENGINE_OPTIONS.map((engine) => (
                  <SelectItem key={engine} value={engine}>{engine}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Package'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
