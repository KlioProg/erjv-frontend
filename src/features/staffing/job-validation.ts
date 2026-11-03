export function jobNameError(name: string): string | null {
  const value = name.trim()
  if (!value || value.length > 100) return 'Use a job name from 1 to 100 characters.'
  if (['ADMIN', 'SUPERADMIN', 'ADMINISTRATOR', 'MANAGER', 'STAFF'].includes(value.toUpperCase()))
    return 'This name is reserved for account roles. Choose a job title.'
  return null
}
export function requireJobName(name: string): string {
  const error = jobNameError(name)
  if (error) throw Error(error)
  return name.trim()
}
