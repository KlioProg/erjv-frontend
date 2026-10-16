import { useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'

export type ConfirmDeleteModalProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
  title: string
  description?: string
  itemName?: string
  itemDetails?: string
  confirmText?: string
  cancelText?: string
  variant?: 'destructive' | 'warning'
  icon?: ReactNode
  className?: string
}

export function ConfirmDeleteModal({
  open,
  onClose,
  onConfirm,
  title,
  description = 'Are you sure you want to proceed with this action? This will remove or deactivate the selected record.',
  itemName,
  itemDetails,
  confirmText = 'Deactivate',
  cancelText = 'Cancel',
  variant = 'destructive',
  icon,
  className,
}: ConfirmDeleteModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  const handleConfirm = async () => {
    if (pending.current) return
    pending.current = true
    setIsProcessing(true)
    setError('')
    try {
      await onConfirm()
      onClose()
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      pending.current = false
      setIsProcessing(false)
    }
  }

  const isDestructive = variant === 'destructive'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isProcessing && onClose()}>
      <DialogContent className={cn('sm:max-w-[440px] p-6', className)} closeDisabled={isProcessing}>
        <DialogHeader className="gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-md ${
              isDestructive
                ? 'bg-destructive/10 text-destructive'
                : 'bg-status-warning text-status-warning-foreground'
            } mb-1`}
          >
            {icon ??
              (isDestructive ? (
                <Trash2 className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              ))}
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="text-ui text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {/* Item Context Card */}
        {(itemName || itemDetails) && (
          <div className="my-2 p-4 rounded-md bg-muted/50 text-ui flex flex-col gap-1">
            {itemName && (
              <span className="font-medium text-foreground leading-snug">{itemName}</span>
            )}
            {itemDetails && (
              <span className="text-xs text-muted-foreground">
                {itemDetails}
              </span>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 pt-4 border-t sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="text-ui"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isProcessing}
            className="text-ui"
          >
            {isProcessing ? (
              <>
                <Spinner data-icon="inline-start" />
                Processing...
              </>
            ) : (
              <>
                {isDestructive && !icon && <Trash2 className="size-3.5" />}
                {confirmText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
