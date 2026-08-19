import type { AuthRequest, AuthMode } from './auth.types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api'

export async function submitAuthRequest(
  mode: AuthMode,
  payload: AuthRequest,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error('Unable to complete the authentication request.')
  }
}
