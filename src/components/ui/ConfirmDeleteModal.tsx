import { useState } from 'react'
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
}: ConfirmDeleteModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)

  const handleConfirm = async () => {
    setIsProcessing(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setIsProcessing(false)
    }
  }

  const isDestructive = variant === 'destructive'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && !isProcessing && onClose()}>
      <DialogContent className="sm:max-w-[440px] p-6">
        <DialogHeader className="gap-2">
          <div
            className={`flex size-12 items-center justify-center rounded-2xl ${
              isDestructive
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-500/10 text-amber-600'
            } shadow-2xs mb-1`}
          >
            {isDestructive ? <Trash2 className="size-6" /> : <AlertTriangle className="size-6" />}
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
            {title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Item Context Card */}
        {(itemName || itemDetails) && (
          <div className="my-2 p-3.5 rounded-xl bg-muted/50 border border-border/80 text-xs flex flex-col gap-1">
            {itemName && (
              <span className="font-extrabold text-foreground text-sm leading-snug">
                {itemName}
              </span>
            )}
            {itemDetails && (
              <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                {itemDetails}
              </span>
            )}
          </div>
        )}

        <DialogFooter className="gap-2.5 pt-3 border-t sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isProcessing}
            className="text-xs font-semibold"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={isDestructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={isProcessing}
            className="text-xs font-bold shadow-xs gap-1.5"
          >
            {isProcessing ? (
              <>
                <Spinner data-icon="inline-start" />
                Processing...
              </>
            ) : (
              <>
                {isDestructive && <Trash2 className="size-3.5" />}
                {confirmText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
