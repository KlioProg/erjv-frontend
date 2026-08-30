import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string
}

export function Spinner({ className, ...props }: SpinnerProps) {
  return (
    <Loader2
      className={cn("animate-spin", className)}
      aria-hidden="true"
      {...props}
    />
  )
}
