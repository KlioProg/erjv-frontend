import { Toaster as Sonner } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      closeButton
      visibleToasts={3}
      gap={8}
      offset={16}
      mobileOffset={16}
      containerAriaLabel="Application notifications"
      className="toaster group"
      toastOptions={{
        closeButtonAriaLabel: 'Dismiss notification',
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:shadow-sm group-[.toaster]:rounded-lg font-sans [overflow-wrap:anywhere] [&[data-type=error]_[data-icon]]:text-destructive [&[data-type=success]_[data-icon]]:text-status-success-foreground [&[data-type=warning]_[data-icon]]:text-status-warning-foreground',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton:
            'group-[.toast]:bg-primary-contrast group-[.toast]:text-primary-contrast-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-card',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
