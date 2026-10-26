import { useRef, useState, type FormEvent } from 'react'
import { isAxiosError } from 'axios'
import { getErrorMessage } from '@/lib/api-client'
import type { SavedLineAmounts } from '@/lib/order-line-pricing'

export type SavedOrder = { id: number; orderNumber: string; status: string; items?: SavedLineAmounts[] }
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
  const reviewLock = useRef(false)
  const [reviewRequired, setReviewRequired] = useState(false)

  async function submit(create: () => Promise<SavedOrder>, confirm: boolean) {
    if (pending.current || finished.current || reviewLock.current) return
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
      const status = isAxiosError(cause) ? cause.response?.status : undefined
      if (isAxiosError(cause) && (status === undefined || status >= 500)) {
        reviewLock.current = true
        setReviewRequired(true)
        setError(`The result is uncertain; the server may have saved or confirmed this order. Your input is preserved. Close this form and refresh the order list to review the saved record before trying again. ${message}`)
        return
      }
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
    locked: phase !== 'idle' || !!savedOrder || reviewRequired,
    reviewRequired,
    phase,
    error,
    clearError: () => setError(''),
    confirmationAttempted,
    canConfirm: !!onConfirm,
  }
}
