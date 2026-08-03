'use client'

import { useState, useEffect, useCallback } from 'react'
import { getKeygenApi } from '@/lib/api'
import { Token } from '@/lib/types/keygen'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KeyRound, MoreVertical, RefreshCcw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { handleLoadError, handleCrudError } from '@/lib/utils/error-handling'
import { CreateTokenDialog } from './create-token-dialog'
import { RevealTokenDialog } from './reveal-token-dialog'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PaginationControls, DEFAULT_PAGE_SIZES } from '@/components/shared/pagination-controls'

const DEFAULT_PAGE_SIZE = 10

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function TokenManagement() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const api = getKeygenApi()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE)
  const [totalCount, setTotalCount] = useState(0)

  // Reveal-secret dialog (shared by create + regenerate)
  const [revealDialogOpen, setRevealDialogOpen] = useState(false)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)

  // Revoke confirmation
  const [revokeConfirmOpen, setRevokeConfirmOpen] = useState(false)
  const [tokenToRevoke, setTokenToRevoke] = useState<Token | null>(null)
  const [revokeLoading, setRevokeLoading] = useState(false)

  // Regenerate confirmation
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false)
  const [tokenToRegenerate, setTokenToRegenerate] = useState<Token | null>(null)
  const [regenerateLoading, setRegenerateLoading] = useState(false)

  const loadTokens = useCallback(async () => {
    try {
      setLoading(true)
      const response = await api.tokens.list({ page: { size: pageSize, number: currentPage } })
      setTokens(response.data || [])
      setTotalCount(response.meta?.count ?? (response.data?.length || 0))
    } catch (error: unknown) {
      handleLoadError(error, 'API keys')
    } finally {
      setLoading(false)
    }
  }, [api.tokens, pageSize, currentPage])

  useEffect(() => {
    loadTokens()
  }, [loadTokens])

  // Reset to page 1 when page size changes
  useEffect(() => {
    setCurrentPage(1)
  }, [pageSize])

  const handleTokenCreated = async (rawToken: string) => {
    // Jump to page 1 — newly created records are returned first (reverse-
    // chronological order), so this is where the new key will be. If we're
    // already on page 1, the page-number state won't change, so force a
    // reload explicitly instead of relying on the page-size-reset effect.
    if (currentPage !== 1) {
      setCurrentPage(1)
    } else {
      await loadTokens()
    }
    if (rawToken) {
      setRevealedToken(rawToken)
      setRevealDialogOpen(true)
    }
  }

  const handleRevoke = (token: Token) => {
    setTokenToRevoke(token)
    setRevokeConfirmOpen(true)
  }

  const confirmRevoke = async () => {
    if (!tokenToRevoke) return
    setRevokeLoading(true)
    try {
      await api.tokens.revoke(tokenToRevoke.id)
      toast.success('API key revoked')
      setRevokeConfirmOpen(false)
      setTokenToRevoke(null)
      await loadTokens()
    } catch (error: unknown) {
      handleCrudError(error, 'delete', 'API key', { customMessage: 'Failed to revoke API key' })
    } finally {
      setRevokeLoading(false)
    }
  }

  const handleRegenerate = (token: Token) => {
    setTokenToRegenerate(token)
    setRegenerateConfirmOpen(true)
  }

  const confirmRegenerate = async () => {
    if (!tokenToRegenerate) return
    setRegenerateLoading(true)
    try {
      const response = await api.tokens.regenerate(tokenToRegenerate.id)
      toast.success('API key regenerated')
      setRegenerateConfirmOpen(false)
      setTokenToRegenerate(null)
      await loadTokens()
      const rawToken = response.data?.attributes?.token
      if (rawToken) {
        setRevealedToken(rawToken)
        setRevealDialogOpen(true)
      }
    } catch (error: unknown) {
      handleCrudError(error, 'update', 'API key', { customMessage: 'Failed to regenerate API key' })
    } finally {
      setRegenerateLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Your API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Generate keys for programmatic access to the Keygen API
          </p>
        </div>
        <CreateTokenDialog onTokenCreated={handleTokenCreated} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="h-4 w-4" />
            API Keys ({totalCount})
          </CardTitle>
          <CardDescription>
            These keys are scoped to your account and won&apos;t be visible to other users
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Name</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="pr-6">Created</TableHead>
                <TableHead className="w-[70px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell className="pl-6"><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell className="pr-6"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-6 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : tokens.length > 0 ? (
                tokens.map((token) => (
                  <TableRow key={token.id}>
                    <TableCell className="pl-6 font-medium">
                      {token.attributes.name || (
                        <span className="text-muted-foreground italic">Unnamed key</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{token.attributes.kind}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {token.attributes.permissions && token.attributes.permissions.length > 0
                        ? token.attributes.permissions.includes('*')
                          ? 'Full access'
                          : `${token.attributes.permissions.length} permission${token.attributes.permissions.length !== 1 ? 's' : ''}`
                        : 'Full access'}
                    </TableCell>
                    <TableCell>
                      {token.attributes.expiry ? formatDate(token.attributes.expiry) : (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="pr-6 text-muted-foreground">
                      {formatDate(token.attributes.created)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleRegenerate(token)}>
                            <RefreshCcw className="mr-2 h-4 w-4" />
                            Regenerate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleRevoke(token)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revoke
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <KeyRound className="h-8 w-8 text-muted-foreground mb-2" />
                      <div className="text-sm font-medium">No API keys yet</div>
                      <div className="text-xs text-muted-foreground">
                        Create one to access the Keygen API programmatically
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {!loading && (
            <PaginationControls
              currentPage={currentPage}
              pageSize={pageSize}
              totalCount={totalCount}
              pageSizes={DEFAULT_PAGE_SIZES}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </CardContent>
      </Card>

      <RevealTokenDialog
        open={revealDialogOpen}
        onOpenChange={setRevealDialogOpen}
        token={revealedToken}
      />

      <ConfirmDialog
        open={revokeConfirmOpen}
        onOpenChange={setRevokeConfirmOpen}
        title="Revoke API key?"
        description={
          tokenToRevoke
            ? `Any application using "${tokenToRevoke.attributes.name || 'this key'}" will immediately lose access. This action cannot be undone.`
            : ''
        }
        confirmLabel="Revoke"
        destructive
        loading={revokeLoading}
        onConfirm={confirmRevoke}
      />

      <ConfirmDialog
        open={regenerateConfirmOpen}
        onOpenChange={setRegenerateConfirmOpen}
        title="Regenerate API key?"
        description={
          tokenToRegenerate
            ? `The current secret for "${tokenToRegenerate.attributes.name || 'this key'}" will stop working immediately, and a new one will be generated.`
            : ''
        }
        confirmLabel="Regenerate"
        destructive
        loading={regenerateLoading}
        onConfirm={confirmRegenerate}
      />
    </div>
  )
}
