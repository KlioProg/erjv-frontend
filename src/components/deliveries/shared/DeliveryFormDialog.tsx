import type { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { deliveryFormStyles } from './delivery-form.styles'

export function DeliveryFormDialog({
  open,
  onClose,
  busy,
  title,
  description,
  children,
}: {
  open: boolean
  onClose: () => void
  busy: boolean
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent closeDisabled={busy} className={deliveryFormStyles.dialog}>
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
