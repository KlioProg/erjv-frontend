import { useState, type Dispatch, type SetStateAction } from 'react'

export default function useFormValidation(initial = ''): {
  message: string
  setMessage: Dispatch<SetStateAction<string>>
} {
  const [message, setMessage] = useState<string>(initial)
  return { message, setMessage }
}
