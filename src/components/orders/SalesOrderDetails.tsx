import { OrderAdditionalDetails } from '@/components/order-entry/OrderAdditionalDetails'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { OrderField } from '@/components/order-entry/OrderEntryFields'
import type { Client } from '@/features/crm/clients.types'
import type { useSalesOrderEntry } from '@/features/crm/sales-order-entry.hooks'

type SalesEntry = ReturnType<typeof useSalesOrderEntry>

export function SalesOrderCustomerInformation({
  clients,
  cashier,
  form,
  customerSelector,
}: {
  customerSelector?: ReactNode
  clients: Client[]
  cashier: string
  form: Pick<
    SalesEntry,
    | 'fieldErrors'
    | 'clientId'
    | 'changeClient'
    | 'expectedAt'
    | 'setExpectedAt'
    | 'deliveryAddress'
    | 'setDeliveryAddress'
  >
}) {
  return (
    <section
      aria-label="Customer information"
      className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
    >
      <OrderField id="order-customer" label="Customer" required>
        {customerSelector ?? (
          <SearchableDropdown
            id="order-customer"
            error={form.fieldErrors.clientId}
            options={clients.filter((client) => client.isActive)}
            value={form.clientId}
            onValueChange={form.changeClient}
            getOptionValue={(client) => String(client.id)}
            getOptionLabel={(client) => client.name}
            getOptionSearchText={(client) =>
              [client.name, client.contactPerson, client.email, client.phone]
                .filter(Boolean)
                .join(' ')
            }
            placeholder="Search customers"
            searchPlaceholder="Search customer name or contact..."
            emptyMessage="No active customers found."
            ariaLabel="Search and choose a customer"
            className="h-9 text-sm"
          />
        )}
      </OrderField>
      <OrderField id="order-expected" label="Expected Delivery Date">
        <Input
          id="order-expected"
          aria-invalid={!!form.fieldErrors.expectedAt || undefined}
          aria-describedby={form.fieldErrors.expectedAt ? 'order-expected-server-error' : undefined}
          type="date"
          value={form.expectedAt}
          onChange={(event) => form.setExpectedAt(event.target.value)}
          className="h-9 min-w-0 text-sm"
        />
        {form.fieldErrors.expectedAt && (
          <p id="order-expected-server-error" role="alert" className="text-xs text-destructive">
            {form.fieldErrors.expectedAt}
          </p>
        )}
      </OrderField>
      <OrderField
        id="order-address"
        label="Delivery Address (optional for drafts)"
        className="sm:col-span-2"
      >
        <Input
          id="order-address"
          aria-invalid={!!form.fieldErrors.deliveryAddress || undefined}
          aria-describedby={
            form.fieldErrors.deliveryAddress ? 'order-address-server-error' : undefined
          }
          value={form.deliveryAddress}
          onChange={(event) => form.setDeliveryAddress(event.target.value)}
          placeholder="Enter the delivery or pickup address"
          className="h-9 text-sm"
        />
        {form.fieldErrors.deliveryAddress && (
          <p id="order-address-server-error" role="alert" className="text-xs text-destructive">
            {form.fieldErrors.deliveryAddress}
          </p>
        )}
      </OrderField>
      <p className="text-xs text-muted-foreground sm:col-span-2">Processed by: {cashier}</p>
    </section>
  )
}

export function SalesOrderAdditionalDetails({
  form,
}: {
  form: Pick<SalesEntry, 'reference' | 'setReference' | 'notes' | 'setNotes' | 'errorFocusId'>
}) {
  return (
    <OrderAdditionalDetails
      prefix="order"
      reference={form.reference}
      onReferenceChange={form.setReference}
      notes={form.notes}
      onNotesChange={form.setNotes}
      errorFocusId={form.errorFocusId}
      referencePlaceholder="Customer reference or document number"
      notesPlaceholder="Delivery instructions or remarks"
    />
  )
}
