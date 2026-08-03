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
import { Textarea } from '@/components/ui/textarea'
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
import { Product, Package as PackageType } from '@/lib/types/keygen'
import { handleFormError, handleLoadError } from '@/lib/utils/error-handling'

interface CreateReleaseDialogProps {
  products: Product[]
  onReleaseCreated?: () => void
}

const CHANNEL_OPTIONS = ['stable', 'rc', 'beta', 'alpha', 'dev'] as const

export function CreateReleaseDialog({ products, onReleaseCreated }: CreateReleaseDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [packages, setPackages] = useState<PackageType[]>([])
  const [packagesLoading, setPackagesLoading] = useState(false)
  const [formData, setFormData] = useState({
    productId: '',
    packageId: 'none',
    version: '',
    channel: 'stable' as typeof CHANNEL_OPTIONS[number],
    name: '',
    tag: '',
    description: '',
  })

  const api = getKeygenApi()

  const loadPackages = useCallback(async (productId: string) => {
    try {
      setPackagesLoading(true)
      const response = await api.packages.list({ product: productId, limit: 50 })
      setPackages(response.data || [])
    } catch (error: unknown) {
      handleLoadError(error, 'packages', { silent: true })
    } finally {
      setPackagesLoading(false)
    }
  }, [api.packages])

  useEffect(() => {
    if (formData.productId) {
      setFormData(prev => ({ ...prev, packageId: 'none' }))
      loadPackages(formData.productId)
    } else {
      setPackages([])
    }
  }, [formData.productId, loadPackages])

  const resetForm = () => {
    setFormData({
      productId: '',
      packageId: 'none',
      version: '',
      channel: 'stable',
      name: '',
      tag: '',
      description: '',
    })
    setPackages([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.productId) {
      toast.error('Please select a product')
      return
    }

    if (!formData.version.trim()) {
      toast.error('Please enter a version (semver, e.g. 1.0.0)')
      return
    }

    try {
      setLoading(true)

      await api.releases.create({
        version: formData.version.trim(),
        channel: formData.channel,
        name: formData.name.trim() || undefined,
        tag: formData.tag.trim() || undefined,
        description: formData.description.trim() || undefined,
        productId: formData.productId,
        packageId: formData.packageId === 'none' ? undefined : formData.packageId,
      })

      toast.success('Release created successfully')
      setOpen(false)
      resetForm()
      onReleaseCreated?.()
    } catch (error: unknown) {
      handleFormError(error, 'Release')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Release
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Release</DialogTitle>
          <DialogDescription>
            Releases start as drafts — publish them once artifacts are uploaded.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product">Product *</Label>
            <Select
              value={formData.productId}
              onValueChange={(value) => setFormData({ ...formData, productId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a product" />
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
              <Label htmlFor="package">Package</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Optionally group this release under one of the product&apos;s packages</TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={formData.packageId}
              onValueChange={(value) => setFormData({ ...formData, packageId: value })}
              disabled={!formData.productId}
            >
              <SelectTrigger>
                <SelectValue placeholder={packagesLoading ? 'Loading packages...' : 'None'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {packages.map((pkg) => (
                  <SelectItem key={pkg.id} value={pkg.id}>
                    {pkg.attributes.name || pkg.attributes.key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="version">Version *</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>Semantic version, no &quot;v&quot; prefix (e.g. 1.2.3 or 1.2.3-beta.1)</TooltipContent>
                </Tooltip>
              </div>
              <Input
                id="version"
                placeholder="1.0.0"
                value={formData.version}
                onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel">Channel *</Label>
              <Select
                value={formData.channel}
                onValueChange={(value: typeof CHANNEL_OPTIONS[number]) => setFormData({ ...formData, channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((channel) => (
                    <SelectItem key={channel} value={channel}>{channel}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Optional display name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="tag">Tag</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="size-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>A unique lookup identifier per product/package, e.g. &quot;latest&quot;</TooltipContent>
              </Tooltip>
            </div>
            <Input
              id="tag"
              placeholder="latest"
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Release notes..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
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
              {loading ? 'Creating...' : 'Create Release'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
