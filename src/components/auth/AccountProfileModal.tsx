import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_DETAILS, USER_ROLES } from '@/features/auth/roles'

type AccountProfileModalProps = {
  open: boolean
  onClose: () => void
}

export function AccountProfileModal({ open, onClose }: AccountProfileModalProps) {
  const { user } = useAuth()
  const role = ROLE_DETAILS[user?.role || USER_ROLES.UNKNOWN] || ROLE_DETAILS[USER_ROLES.UNKNOWN]
  const email = user?.email || 'Unknown account'

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <User className="size-5" />
          </div>
          <DialogTitle>Account profile</DialogTitle>
          <DialogDescription>
            Account details are managed by an administrator. This view does not edit your account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-4 rounded-xl border border-border/80 bg-muted/30 p-4">
          <Avatar className="size-12">
            <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{email}</p>
            <p className="text-xs text-muted-foreground">{role.label}</p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
