import { Link, useNavigate, useParams } from 'react-router'
import { WarehouseInventory } from '@/components/operations/WarehouseInventory'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { ManagementPage } from '@/components/ui/ManagementPage'
import { Spinner } from '@/components/ui/spinner'
import { useWarehouse } from '@/features/logistics/warehouses.hooks'
import { getErrorMessage } from '@/lib/api-client'
import { ROUTES } from '@/routes'

export function WarehouseDetailsRoute() {
  const { warehouseId } = useParams()
  const navigate = useNavigate()
  const id = Number(warehouseId)
  const validId = /^\d+$/.test(warehouseId ?? '') && Number.isSafeInteger(id) && id > 0
  const query = useWarehouse(validId ? id : undefined)

  return (
    <ManagementPage summary={[]}>
      {validId && query.data && !query.isError ? (
        <WarehouseInventory
          key={id}
          warehouse={query.data}
          onBack={() => navigate(ROUTES.warehouses)}
        />
      ) : (
        <div className="flex flex-col items-start gap-4">
          <Button asChild variant="secondary">
            <Link to={ROUTES.warehouses}>Back to Warehouses</Link>
          </Button>
          {!validId ? (
            <Alert variant="destructive">
              <AlertDescription>Invalid warehouse identifier.</AlertDescription>
            </Alert>
          ) : query.isPending ? (
            <Spinner aria-label="Loading warehouse" />
          ) : (
            <Alert variant="destructive">
              <AlertDescription>
                Warehouse could not be loaded: {getErrorMessage(query.error)}
                <Button variant="link" onClick={() => void query.refetch()}>
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
    </ManagementPage>
  )
}
