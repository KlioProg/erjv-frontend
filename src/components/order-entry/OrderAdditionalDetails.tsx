import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { OrderField } from './OrderEntryFields'

export function OrderAdditionalDetails({
  prefix,
  reference,
  onReferenceChange,
  notes,
  onNotesChange,
  referenceLabel = 'External Reference',
  referencePlaceholder,
  notesPlaceholder,
  errorFocusId,
}: {
  prefix: string
  reference: string
  onReferenceChange: (value: string) => void
  notes: string
  onNotesChange: (value: string) => void
  referenceLabel?: string
  referencePlaceholder: string
  notesPlaceholder: string
  errorFocusId?: string
}) {
  const [expanded, setExpanded] = useState(!!(reference || notes))
  const referenceId = `${prefix}-reference`
  const notesId = `${prefix}-notes`
  const invalid = errorFocusId === referenceId || errorFocusId === notesId
  return (
    <details open={expanded || invalid} onToggle={(event) => setExpanded(event.currentTarget.open)}>
      <summary className="w-fit cursor-pointer rounded-sm text-[13px] font-medium focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring">
        Additional details
      </summary>
      <div hidden={!expanded && !invalid} className="mt-3 flex flex-col gap-3">
        <OrderField id={referenceId} label={referenceLabel}>
          <Input
            id={referenceId}
            value={reference}
            onChange={(event) => onReferenceChange(event.target.value)}
            placeholder={referencePlaceholder}
            className="h-9 text-sm"
          />
        </OrderField>
        <OrderField id={notesId} label="Notes">
          <Input
            id={notesId}
            value={notes}
            onChange={(event) => onNotesChange(event.target.value)}
            placeholder={notesPlaceholder}
            className="h-9 text-sm"
          />
        </OrderField>
      </div>
    </details>
  )
}
