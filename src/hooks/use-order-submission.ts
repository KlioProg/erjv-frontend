import { useRef, useState, type FormEvent } from 'react'
import { getErrorMessage } from '@/lib/api-client'

export type SavedOrder = { id: number; orderNumber: string; status: string }
export type OrderSubmissionProps<Values> = {
  onSubmit: (values: Values, intent?: 'draft' | 'confirm') => Promise<SavedOrder>
  onConfirm?: (id: number) => Promise<SavedOrder>
  onConfirmed?: (order: SavedOrder) => void
  savedDraft?: SavedOrder
}

// Enter saves a draft; confirmation always requires the explicit submit button.
export function wantsOrderConfirmation(event: FormEvent<HTMLFormElement>) {
  return (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'confirm'
}

export function useOrderSubmission({
  onConfirm,
  onConfirmed,
  savedDraft,
  onClose,
}: Omit<OrderSubmissionProps<never>, 'onSubmit'> & { onClose: () => void }) {
  const savedRef = useRef(savedDraft)
  const [savedOrder, setSavedOrder] = useState(savedDraft)
  const [phase, setPhase] = useState<'idle' | 'saving' | 'confirming'>('idle')
  const [error, setError] = useState('')
  const [confirmationAttempted, setConfirmationAttempted] = useState(false)
  const pending = useRef(false)
  const finished = useRef(false)

  async function submit(create: () => Promise<SavedOrder>, confirm: boolean) {
    if (pending.current || finished.current) return
    pending.current = true
    setError('')
    try {
      let order = savedRef.current
      if (!order) {
        setPhase('saving')
        order = await create()
        // Store the ID before confirmation, including when that request fails.
        savedRef.current = order
        setSavedOrder(order)
      }
      if (confirm) {
        if (!onConfirm) throw new Error('Confirmation is unavailable.')
        if (order.status !== 'DRAFT') throw new Error('Only a saved Draft can be confirmed.')
        setConfirmationAttempted(true)
        setPhase('confirming')
        const confirmed = await onConfirm(order.id)
        if (confirmed.id !== order.id || confirmed.status !== 'CONFIRMED')
          throw new Error(
            'The server did not confirm this order. Review its status before retrying.',
          )
        finished.current = true
        onConfirmed?.(confirmed)
      } else {
        finished.current = true
      }
      onClose()
    } catch (cause) {
      const message = getErrorMessage(cause)
      setError(
        savedRef.current
          ? `Draft ${savedRef.current.orderNumber} is saved. Confirmation did not complete. ${message}`
          : message,
      )
    } finally {
      pending.current = false
      setPhase('idle')
    }
  }

  return {
    submit,
    savedOrder,
    busy: phase !== 'idle',
    locked: phase !== 'idle' || !!savedOrder,
    phase,
    error,
    confirmationAttempted,
    canConfirm: !!onConfirm,
  }
}
