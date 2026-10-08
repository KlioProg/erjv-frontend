import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
import { cn } from '@/lib/utils'

type SearchableDropdownProps<T> = {
  id?: string
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
}

export function SearchableDropdown<T>({
  id,
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
}: SearchableDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) searchInputRef.current?.focus()
  }, [open])

  const selectedOption = options.find((option) => getOptionValue(option) === value)
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase()
    if (!normalizedQuery) return options
    return options.filter((option) =>
      getOptionSearchText(option).toLocaleLowerCase().includes(normalizedQuery),
    )
  }, [getOptionSearchText, options, query])

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) setQuery('')
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className={cn('h-10 w-full justify-between text-xs font-normal sm:h-9', className)}
          aria-label={ariaLabel}
        >
          <span className="truncate">
            {selectedOption ? getOptionLabel(selectedOption) : placeholder}
          </span>
          <Search aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={side}
        avoidCollisions={avoidCollisions}
        align={align}
        className={cn(
          'flex max-h-[var(--radix-dropdown-menu-content-available-height)] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden p-2',
          contentClassName,
        )}
      >
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
            onKeyDown={(event) => event.stopPropagation()}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 pl-8 text-xs"
          />
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          aria-label={ariaLabel}
        >
          {filteredOptions.length === 0 ? (
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
                    <span className="min-w-0 flex-1">
                      {renderOption ? renderOption(option) : getOptionLabel(option)}
                    </span>
                    {isSelected && (
                      <Check aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                    )}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuGroup>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
