import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { fetchTransfer, writeTransfer } from './warehouse-transfers.api'
import type { TransferCommand } from './warehouse-transfers.types'
import type { WarehouseTransfer } from './warehouse-transfers.types'
import { transferReconciliationErrors } from './warehouse-transfers.validation'

export function useTransfer(id?: number) {
  return useQuery({
    queryKey: ['warehouse-transfers', 'detail', id],
    enabled: Boolean(id),
    retry: false,
    queryFn: ({ signal }) => fetchTransfer(id!, signal),
  })
}

export function useTransferWrite() {
  const client = useQueryClient()
  const { isAdmin, isManager, isStaff } = useAuth()
  return useMutation({
    retry: false,
    mutationFn: (command: TransferCommand) => {
      const allowed =
        command.action === 'dispatch' || command.action === 'reconcile'
          ? isAdmin || isManager || isStaff
          : isAdmin || isManager
      if (!allowed) throw Error('Your role cannot perform this transfer action.')
      if (command.action === 'reconcile') {
        const saved = client.getQueryData<WarehouseTransfer>([
          'warehouse-transfers',
          'detail',
          command.id,
        ])
        if (!saved) throw Error('Reload the saved transfer before reconciling.')
        const errors = transferReconciliationErrors(saved.items, command.payload.items)
        if (Object.keys(errors).length) throw Error(Object.values(errors).join(' '))
      }
      return writeTransfer(command)
    },
    onSuccess: (record) => {
      client.setQueryData(['warehouse-transfers', 'detail', record.id], record)
    },
    onSettled: () =>
      Promise.all(
        [
          'warehouse-transfers',
          'stock-items',
          'products',
          'warehouses',
          'quarantine-lots',
          'financial-reports',
        ].map((key) => client.invalidateQueries({ queryKey: [key] })),
      ),
  })
}
