import { useRef, useState } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useUpdateProductPrice } from '@/features/products/products.hooks'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { parseStockCents } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'

export function InventoryWholesalePrice({
  product,
  canEdit,
}: {
  product: InventoryItemResponse
  canEdit: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const updatePrice = useUpdateProductPrice()
  const pending = useRef(false)
  const editButton = useRef<HTMLButtonElement>(null)
  const editable = canEdit && product.isActive !== false
  const cents = parseStockCents(product.unitPrice)
  const displayPrice =
    cents === null
      ? '—'
      : `₱${(cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${(cents % 100n).toString().padStart(2, '0')}`

  function finishEditing() {
    setEditing(false)
    setError('')
    requestAnimationFrame(() => editButton.current?.focus())
  }

  async function savePrice() {
    if (pending.current || !editable) return
    const nextCents = parseStockCents(price)
    if (nextCents === null || nextCents > 999_999_999_999n) {
      setError(
        'Enter a non-negative price with up to 2 decimals and 10 digits before the decimal point.',
      )
      return
    }
    if (nextCents === cents) {
      finishEditing()
      return
    }
    pending.current = true
    setError('')
    try {
      await updatePrice.mutateAsync({ id: product.id, unitPrice: price.trim() })
      finishEditing()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      pending.current = false
    }
  }

  return (
    <div className="min-w-0 text-right" onClick={(event) => event.stopPropagation()}>
      {editing && editable ? (
        <form
          className="ml-auto max-w-44 space-y-1"
          onSubmit={(event) => {
            event.preventDefault()
            void savePrice()
          }}
        >
          <div className="flex flex-wrap items-center justify-end gap-1">
            <Input
              autoFocus
              type="text"
              inputMode="decimal"
              aria-label={`Wholesale price for ${product.name}`}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `price-error-${product.id}` : undefined}
              value={price}
              disabled={updatePrice.isPending}
              className="h-8 min-w-16 flex-1 basis-20 px-2 text-right text-xs tabular-nums"
              onChange={(event) => {
                setPrice(event.target.value)
                setError('')
              }}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  event.stopPropagation()
                  if (!pending.current) finishEditing()
                }
              }}
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              className="size-7 text-primary-text pointer-coarse:size-11"
              aria-label={`Save wholesale price for ${product.name}`}
              title="Save price"
              disabled={updatePrice.isPending}
              aria-busy={updatePrice.isPending}
            >
              {updatePrice.isPending ? (
                <Spinner aria-hidden="true" className="size-3.5" />
              ) : (
                <Check aria-hidden="true" className="size-3.5" />
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground pointer-coarse:size-11"
              aria-label={`Cancel price edit for ${product.name}`}
              title="Cancel price edit"
              disabled={updatePrice.isPending}
              onClick={finishEditing}
            >
              <X aria-hidden="true" className="size-3.5" />
            </Button>
          </div>
          {error && (
            <p
              id={`price-error-${product.id}`}
              role="alert"
              className="text-xs text-destructive [overflow-wrap:anywhere]"
            >
              {error}
            </p>
          )}
        </form>
      ) : editable ? (
        <button
          type="button"
          ref={editButton}
          className="group inline-flex max-w-full items-center justify-end gap-1 rounded px-1 py-1 text-xs font-extrabold tabular-nums text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:min-h-11"
          aria-label={`Edit wholesale price for ${product.name}`}
          title="Edit wholesale price"
          onClick={() => {
            setPrice(String(product.unitPrice))
            setError('')
            setEditing(true)
          }}
        >
          <span className="[overflow-wrap:anywhere]">{displayPrice}</span>
          <Pencil aria-hidden="true" className="size-3 shrink-0 text-muted-foreground" />
        </button>
      ) : (
        <OverflowValue
          value={displayPrice}
          fullValue={product.unitPrice}
          className="text-right text-xs font-extrabold text-foreground tabular-nums"
        />
      )}
    </div>
  )
}
