type ErjvPosLogoProps = {
  className?: string
}

export function ErjvPosLogo({ className = '' }: ErjvPosLogoProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <span className="text-3xl font-bold tracking-tight text-foreground">
        ERJV<span className="text-primary">POS</span>
      </span>
    </div>
  )
}
