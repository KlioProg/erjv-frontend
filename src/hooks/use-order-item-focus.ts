import { useLayoutEffect, useRef, useState } from 'react'

export function useOrderItemFocus(lines: unknown) {
  const inputs = useRef(new Map<number, HTMLInputElement>())
  const pending = useRef<number | null>(null)
  const [request, setRequest] = useState(0)
  const focusQuantity = () => {
    if (pending.current === null) return
    const input = inputs.current.get(pending.current)
    input?.closest('tr')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    input?.focus({ preventScroll: true })
    input?.select()
  }
  useLayoutEffect(() => {
    focusQuantity()
    pending.current = null
  }, [lines, request])
  return {
    quantityRef: (id: number, input: HTMLInputElement | null) => {
      if (input) inputs.current.set(id, input)
      else inputs.current.delete(id)
    },
    requestQuantityFocus: (id: number) => {
      pending.current = id
      setRequest((value) => value + 1)
    },
  }
}
