import { useState } from 'react'
import { PRODUCT_UNIT_OPTIONS } from '@/lib/product-unit'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ProductUnitField({
  id,
  value,
  onChange,
  disabled = false,
  readOnly = false,
  required = false,
}: {
  id: string
  value: string
  onChange: (unit: string) => void
  disabled?: boolean
  readOnly?: boolean
  required?: boolean
}) {
  const [customSelected, setCustomSelected] = useState(false)
  const custom =
    customSelected || (!!value && !PRODUCT_UNIT_OPTIONS.some((option) => option.value === value))
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>
        Unit{' '}
        {required && (
          <span aria-hidden="true" className="text-primary">
            *
          </span>
        )}
      </Label>
      <Select
        value={custom ? '__custom__' : value}
        disabled={disabled || readOnly}
        required={required}
        onValueChange={(selected) => {
          setCustomSelected(selected === '__custom__')
          onChange(selected === '__custom__' ? '' : selected)
        }}
      >
        <SelectTrigger id={id} className="h-10">
          <SelectValue placeholder="Select unit" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PRODUCT_UNIT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
            <SelectItem value="__custom__">Other / Custom Unit</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      {custom && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-custom`}>Custom Unit</Label>
          <Input
            id={`${id}-custom`}
            value={value}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </div>
  )
}
