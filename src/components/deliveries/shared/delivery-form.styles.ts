/** Shared density for incoming and outgoing scheduling; workflow stays domain-owned. */
export const deliveryFormStyles = {
  dialog:
    'flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] flex-col gap-4 overflow-hidden p-6 sm:max-w-3xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11',
  header: 'shrink-0 gap-1.5 pr-8 text-left',
  title: 'text-xl font-semibold leading-6 [overflow-wrap:anywhere]',
  description: 'text-xs leading-5',
  form: 'flex min-h-0 flex-1 flex-col gap-4',
  body: 'min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain',
  fields: 'flex min-w-0 flex-col gap-4',
  grid: 'grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2',
  field: 'flex min-w-0 flex-col gap-1.5',
  label: 'text-[13px] font-medium leading-5',
  control: 'h-10 min-w-0 text-[13px] sm:h-10 pointer-coarse:h-11 sm:pointer-coarse:h-11',
  option: 'min-h-9 text-[13px] pointer-coarse:min-h-11',
  popover: 'max-w-[calc(100vw-2rem)]',
  sectionTitle: 'text-base font-semibold leading-5',
  summary:
    'cursor-pointer rounded-sm py-2 text-[13px] font-medium pointer-coarse:min-h-11 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring',
  empty: 'rounded-md bg-secondary px-4 py-3 text-center text-xs leading-5 text-muted-foreground',
  message: 'mb-4 text-xs leading-5',
  retry: 'ml-2 h-auto px-0 text-xs font-medium pointer-coarse:min-h-11',
  footer:
    'flex shrink-0 flex-row flex-wrap items-center justify-end gap-2 border-t border-border pt-4 sm:gap-2',
  button: 'h-10 px-4 text-[13px] font-medium pointer-coarse:min-h-11',
} as const
