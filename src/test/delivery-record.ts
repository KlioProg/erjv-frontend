import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

export async function openDeliveryRecord(reference: string) {
  await userEvent.click(await screen.findByRole('button', { name: `View delivery ${reference}` }))
  return within(await screen.findByRole('dialog', { name: reference }))
}

export async function startDeliveryAction(reference: string, label: string) {
  const record = await screen.findByRole('button', { name: `View delivery ${reference}` })
  const row = within(record.closest('tr')!)
  const action = await row.findByRole('button', { name: `${label} ${reference}` })
  await waitFor(() => {
    if (action.hasAttribute('disabled')) throw Error('Waiting for current delivery details')
  })
  await userEvent.click(action)
}
