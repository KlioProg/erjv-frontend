type ErjvPosLogoProps = {
  className?: string
}

export function ErjvPosLogo({ className = '' }: ErjvPosLogoProps) {
  return (
    <div className={`text-center leading-none ${className}`}>
      <p className="text-[26px] font-semibold tracking-[-.07em] text-[#c2474c]">ERJVPOS</p>
      <p className="mt-0.5 text-[8px] tracking-[-.01em] text-muted">Your POS Assistant</p>
    </div>
  )
}
