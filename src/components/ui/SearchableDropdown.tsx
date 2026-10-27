import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { cn } from '@/lib/utils'

type SearchableDropdownProps<T> = {
  id?: string
  onCreateValue?: (value: string) => void
  maxCustomLength?: number
  options: T[]
  value: string
  onValueChange: (value: string, option: T) => void
  getOptionValue: (option: T) => string
  getOptionLabel: (option: T) => string
  getOptionSearchText?: (option: T) => string
  renderOption?: (option: T) => ReactNode
  placeholder: string
  searchPlaceholder: string
  emptyMessage: string
  ariaLabel: string
  className?: string
  contentClassName?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  avoidCollisions?: boolean
  disabled?: boolean
  isLoading?: boolean
}

export function SearchableDropdown<T>({
  id,
  onCreateValue,
  maxCustomLength = 100,
  options,
  value,
  onValueChange,
  getOptionValue,
  getOptionLabel,
  getOptionSearchText = getOptionLabel,
  renderOption,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  ariaLabel,
  className,
  contentClassName,
  align = 'start',
  side = 'bottom',
  avoidCollisions,
  disabled = false,
  isLoading = false,
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const validationId = useId()
  const customValue = query.trim().replace(/\s+/g, ' ')
  const exactMatch = options.find(
    (option) =>
      String(getOptionLabel(option) ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() ===
      customValue.toLocaleLowerCase(),
  )
  const tooLong = !!onCreateValue && customValue.length > maxCustomLength
  const canCreate = !!onCreateValue && !!customValue && !exactMatch && !tooLong
  const selectCustom = () => {
    if (!canCreate) return
    onCreateValue?.(customValue)
    setOpen(false)
  }

  const selectedOption = options.find((option) => getOptionValue(option) === value)
  const selectedLabel = selectedOption
    ? getOptionLabel(selectedOption)
    : onCreateValue && value
      ? value
      : placeholder
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      String(getOptionSearchText(option) ?? '')
        .replace(/\s+/g, ' ')
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    )
  }, [getOptionSearchText, options, query])

  return (
    <DropdownMenu
      open={open && !disabled && !isLoading}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen && !disabled && !isLoading)
        if (nextOpen) setQuery('')
      }}
    >
      <OverflowValue asChild value={selectedLabel}>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            disabled={disabled || isLoading}
            variant="outline"
            className={cn(
              'h-10 min-w-0 w-full justify-between text-sm font-normal pointer-coarse:min-h-11',
              className,
            )}
            aria-label={ariaLabel}
          >
            <span data-overflow-text className="min-w-0 flex-1 truncate text-left">
              {selectedLabel}
            </span>
            <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
      </OverflowValue>
      <DropdownMenuContent
        onFocus={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault()
            searchInputRef.current?.focus()
          }
        }}
        onKeyDown={(event) => {
          if (
            event.key === 'ArrowUp' &&
            event.target === event.currentTarget.querySelector('[role="menuitem"]')
          ) {
            event.preventDefault()
            searchInputRef.current?.focus()
          }
        }}
        side={side}
        avoidCollisions={avoidCollisions}
        align={align}
        className={cn(
          'flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-2',
          contentClassName,
        )}
      >
        {onCreateValue && value && !selectedOption && (
          <p className="px-2.5 pb-2 text-sm [overflow-wrap:anywhere]">Selected: {value}</p>
        )}
        <div className="relative shrink-0 pb-2">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-invalid={tooLong || undefined}
            aria-describedby={tooLong ? validationId : undefined}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && onCreateValue && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (exactMatch) {
                  onValueChange(getOptionValue(exactMatch), exactMatch)
                  setOpen(false)
                } else {
                  selectCustom()
                }
              }
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                const items = event.currentTarget
                  .closest('[role="menu"]')
                  ?.querySelectorAll<HTMLElement>('[role="menuitem"]')
                const item = event.key === 'ArrowDown' ? items?.[0] : items?.[items.length - 1]
                item?.focus()
              }
              // Keep text editing out of menu typeahead; allow Escape to dismiss.
              if (event.key !== 'Escape') event.stopPropagation()
            }}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 pl-8 text-sm"
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label={ariaLabel}>
          {tooLong && (
            <p id={validationId} role="status" className="px-2.5 py-2 text-xs text-destructive">
              Use {maxCustomLength} characters or fewer.
            </p>
          )}
          {filteredOptions.length === 0 && !canCreate ? (
            <p className="px-2.5 py-4 text-center text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            <DropdownMenuGroup>
              {filteredOptions.map((option) => {
                const optionValue = getOptionValue(option)
                const isSelected = optionValue === value
                return (
                  <DropdownMenuItem
                    key={optionValue}
                    onSelect={() => onValueChange(optionValue, option)}
                    className="flex min-h-11 items-center justify-between gap-3"
                  >
                    <span className="min-w-0 flex-1 whitespace-normal [overflow-wrap:anywhere]">
                      {renderOption ? renderOption(option) : getOptionLabel(option)}
                    </span>
                    {isSelected && (
                      <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                )
              })}
              {canCreate && (
                <DropdownMenuItem
                  onSelect={selectCustom}
                  className="min-h-11 whitespace-normal [overflow-wrap:anywhere]"
                >
                  Use &quot;{customValue}&quot;
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
