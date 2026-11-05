import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { deliveryFormStyles } from './delivery-form.styles'

export function DeliveryFormDialog({
  open,
  onClose,
  busy,
  title,
  description,
  children,
  contentClassName,
}: {
  open: boolean
  onClose: () => void
  busy: boolean
  title: string
  description: string
  children: ReactNode
  contentClassName?: string
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent
        closeDisabled={busy}
        className={cn(deliveryFormStyles.dialog, contentClassName)}
      >
        <DialogHeader className={deliveryFormStyles.header}>
          <DialogTitle className={deliveryFormStyles.title}>{title}</DialogTitle>
          <DialogDescription className={deliveryFormStyles.description}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}

export function DeliveryFormFooter({ children }: { children: ReactNode }) {
  return <DialogFooter className={deliveryFormStyles.footer}>{children}</DialogFooter>
}
