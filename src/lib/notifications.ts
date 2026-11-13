import { toast as sonner, type ExternalToast } from 'sonner'

type Message = Parameters<typeof sonner.error>[0]
type Kind = 'success' | 'error' | 'warning' | 'info' | 'loading'

function employeeMessage(message: Message): Message {
  if (typeof message !== 'string') return message
  if (
    /Prisma\w*|SQLSTATE|(?:Type|Reference|Syntax)Error:|\n\s*at\s+|stack trace|ECONNREFUSED/i.test(
      message,
    )
  ) {
    if (import.meta.env.DEV) console.error('[Notification diagnostic]', message)
    return 'The action could not be completed. Try again or contact your administrator.'
  }
  return message
}

function notificationId(kind: Kind, title: string, description: unknown) {
  const value = title + (typeof description === 'string' ? description : '')
  let hash = 0
  for (const character of value) hash = (Math.imul(31, hash) + character.charCodeAt(0)) | 0
  return `${kind}:${hash >>> 0}`
}

function notify(kind: Kind, message: Message, options?: ExternalToast) {
  const title = employeeMessage(message)
  const description = employeeMessage(options?.description)
  return sonner[kind](title, {
    // One repeated notification is updated in place; explicit operation IDs take precedence.
    ...(typeof title === 'string'
      ? { id: notificationId(kind, title, description) }
      : {}),
    ...options,
    duration:
      kind === 'error' || kind === 'warning' || kind === 'loading'
        ? Infinity
        : (options?.duration ?? Math.max(5000, (typeof title === 'string' ? title.length : 0) * 50)),
    closeButton: kind !== 'loading',
    ...(options?.description !== undefined ? { description } : {}),
  })
}

/** App feedback uses Sonner's existing store, accessibility and dismiss behavior. */
export const toast = Object.assign(
  (message: Message, options?: ExternalToast) => notify('info', message, options),
  sonner,
  {
    success: (message: Message, options?: ExternalToast) => notify('success', message, options),
    error: (message: Message, options?: ExternalToast) => notify('error', message, options),
    warning: (message: Message, options?: ExternalToast) => notify('warning', message, options),
    info: (message: Message, options?: ExternalToast) => notify('info', message, options),
    loading: (message: Message, options?: ExternalToast) => notify('loading', message, options),
  },
)
