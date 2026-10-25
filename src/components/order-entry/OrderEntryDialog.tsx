import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEventHandler,
  type ReactNode,
} from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useOrderComposerLayout } from '@/hooks/use-order-composer-layout'
import type { useOrderSubmission } from '@/hooks/use-order-submission'
import './order-entry.css'

export function OrderEntryDialog({
  open,
  onClose,
  onSubmit,
  title,
  description,
  confirmLabel = 'Confirm Order',
  submission,
  busy,
  error,
  errorFocusId,
  children,
  catalog,
  itemCount,
}: {
  open: boolean
  onClose: () => void
  onSubmit: FormEventHandler<HTMLFormElement>
  title: string
  description: string
  confirmLabel?: string
  submission: ReturnType<typeof useOrderSubmission>
  busy: boolean
  error: string
  errorFocusId?: string
  children: (openCatalog: () => void) => ReactNode
  catalog: (returnToEditor: () => void) => ReactNode
  itemCount: number
}) {
  const [view, setView] = useState('editor')
  const split = useOrderComposerLayout()
  const errorRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLElement | null>(null)
  const catalogRef = useRef<HTMLDivElement>(null)
  const [catalogFocusRequest, requestCatalogFocus] = useState(0)
  const handledCatalogFocus = useRef(0)
  useLayoutEffect(() => {
    if (view === 'catalog' && catalogFocusRequest !== handledCatalogFocus.current) {
      catalogRef.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true })
      handledCatalogFocus.current = catalogFocusRequest
    }
  }, [view, catalogFocusRequest])
  useEffect(() => {
    if (error) {
      const target = errorFocusId ? document.getElementById(errorFocusId) : null
      ;(target ?? errorRef.current)?.focus()
    }
  }, [error, errorFocusId])
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent
        className="order-entry-dialog order-composer-dialog flex flex-col gap-0 overflow-hidden p-0"
        closeDisabled={busy}
        aria-busy={busy}
        onOpenAutoFocus={() => {
          launcherRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          if (launcherRef.current?.isConnected) launcherRef.current.focus({ preventScroll: true })
        }}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <DialogHeader className="shrink-0 gap-1 border-b px-5 pt-4 pb-4 pr-12 text-left">
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-ui leading-5">{description}</DialogDescription>
        </DialogHeader>
        <Tabs value={view} onValueChange={setView} className="flex min-h-0 flex-1 flex-col">
          <TabsList
            className="order-composer-tabs mx-4 my-3 shrink-0"
            aria-label="Order composer views"
          >
            <TabsTrigger value="editor" disabled={busy} className="flex-1">
              Order Editor ({itemCount})
            </TabsTrigger>
            <TabsTrigger value="catalog" disabled={busy} className="flex-1">
              Product Catalog
            </TabsTrigger>
          </TabsList>
          <div className="order-composer-panels min-h-0 flex-1">
            <TabsContent
              forceMount
              value="editor"
              role={split ? 'region' : 'tabpanel'}
              aria-label="Order Editor"
              aria-labelledby={undefined}
              aria-hidden={!split && view !== 'editor'}
              className="order-composer-panel order-composer-editor m-0 min-h-0 min-w-0"
            >
              <form onSubmit={onSubmit} noValidate className="flex h-full min-h-0 flex-col">
                <fieldset
                  disabled={submission.locked}
                  className="order-entry-body flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-4 [&>*]:shrink-0"
                >
                  {error && (
                    <Alert ref={errorRef} tabIndex={-1} variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  {submission.savedOrder && (
                    <p role="status" className="text-sm text-muted-foreground">
                      Draft {submission.savedOrder.orderNumber} is saved. Its details are read-only.
                      Confirm it here, or close and return to the saved draft from the order list.
                    </p>
                  )}
                  {children(() => {
                    requestCatalogFocus((request) => request + 1)
                    setView('catalog')
                  })}
                </fieldset>
                <DialogFooter className="shrink-0 flex-row flex-wrap justify-end gap-2 border-t bg-card px-5 py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={busy}
                    className="h-9 text-ui"
                  >
                    {submission.savedOrder ? 'Close' : 'Cancel'}
                  </Button>
                  {!submission.savedOrder && (
                    <Button
                      type="submit"
                      name="intent"
                      value="draft"
                      variant="outline"
                      disabled={busy}
                      className="h-9 text-ui"
                    >
                      {submission.phase === 'saving' && (
                        <Loader2
                          aria-hidden="true"
                          data-icon="inline-start"
                          className="size-4 animate-spin"
                        />
                      )}
                      {submission.phase === 'saving' ? 'Saving…' : 'Save Draft'}
                    </Button>
                  )}
                  {submission.canConfirm && (
                    <Button
                      type="submit"
                      name="intent"
                      value="confirm"
                      disabled={busy}
                      variant="primary-contrast"
                      className="h-9"
                    >
                      {submission.phase === 'confirming' && (
                        <Loader2
                          aria-hidden="true"
                          data-icon="inline-start"
                          className="size-4 animate-spin"
                        />
                      )}
                      {submission.phase === 'confirming'
                        ? 'Confirming…'
                        : submission.confirmationAttempted
                          ? 'Retry Confirmation'
                          : confirmLabel}
                    </Button>
                  )}
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent
              forceMount
              value="catalog"
              ref={catalogRef}
              role={split ? 'region' : 'tabpanel'}
              aria-label="Product Catalog"
              aria-labelledby={undefined}
              aria-hidden={!split && view !== 'catalog'}
              className="order-composer-panel order-composer-catalog m-0 min-h-0 min-w-0 bg-secondary"
            >
              {catalog(() => setView('editor'))}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
