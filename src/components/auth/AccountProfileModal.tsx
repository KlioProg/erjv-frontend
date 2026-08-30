import React, { useState, useRef, type FormEvent } from 'react'
import {
  User,
  Camera,
  Upload,
  Trash2,
  CheckCircle2,
  FileText,
  Shield,
  Link,
  Sparkles,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import { useQueryClient } from '@tanstack/react-query'

type AccountProfileModalProps = {
  open: boolean
  onClose: () => void
}

// Built-in curated professional avatars that work anywhere across all PCs and networks
const AVATAR_PRESETS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
]

function AccountProfileForm({ onClose }: { onClose: () => void }) {
  const { user, updateProfile, isOwner } = useAuth()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [bio, setBio] = useState(user?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl || null)
  const [customUrlInput, setCustomUrlInput] = useState('')
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size should be less than 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result as string
      // Base64 Data URL travels anywhere and works on all PCs and browsers!
      setAvatarUrl(result)
      toast.success('Photo uploaded! Click "Save Changes" to apply.')
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    setAvatarUrl(null)
    setCustomUrlInput('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleApplyUrl = () => {
    const trimmed = customUrlInput.trim()
    if (trimmed) {
      setAvatarUrl(trimmed)
      toast.success('Image link set!')
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      await updateProfile({
        fullName: fullName.trim() || undefined,
        avatarUrl,
        bio: bio.trim() || null,
      })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['employees'] })
      toast.success('Profile details and photo saved successfully!')
      onClose()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile.')
    } finally {
      setIsSaving(false)
    }
  }

  const displayName = fullName.trim() || user?.fullName || (user?.email ? user.email.split('@')[0] : 'User')
  const userInitial = displayName.charAt(0).toUpperCase()

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
      {/* Profile Picture Upload & Presets Section */}
      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-muted/40 border border-border/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="relative group shrink-0">
            <Avatar className="size-20 border-2 border-primary/30 shadow-md bg-card">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} className="object-cover" />}
              <AvatarFallback className="bg-primary/15 text-primary text-2xl font-extrabold">
                {userInitial}
              </AvatarFallback>
            </Avatar>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-transform active:scale-95 cursor-pointer"
              title="Change Photo"
            >
              <Camera className="size-3.5" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-col gap-1 text-center sm:text-left flex-1 min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-bold text-foreground">Profile Picture</span>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                {user?.role || 'OWNER'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Saved in self-contained Base64 or cloud URLs so it persists across all PCs.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1 flex-wrap">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="h-7 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Upload className="size-3 text-primary" />
                Upload Photo
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowUrlInput(!showUrlInput)}
                className="h-7 text-xs font-semibold gap-1.5 cursor-pointer"
              >
                <Link className="size-3 text-primary" />
                Photo Link
              </Button>

              {avatarUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemovePhoto}
                  className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 cursor-pointer"
                >
                  <Trash2 className="size-3" />
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Optional Image URL Input */}
        {showUrlInput && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Input
              type="url"
              placeholder="Paste image URL (https://...)"
              value={customUrlInput}
              onChange={(e) => setCustomUrlInput(e.target.value)}
              className="text-xs h-8"
            />
            <Button
              type="button"
              size="sm"
              onClick={handleApplyUrl}
              className="h-8 text-xs font-bold shrink-0 cursor-pointer"
            >
              Apply
            </Button>
          </div>
        )}

        {/* Quick Avatar Presets */}
        <div className="flex items-center gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1 font-semibold text-foreground">
            <Sparkles className="size-3 text-primary" /> Presets:
          </span>
          <div className="flex items-center gap-2">
            {AVATAR_PRESETS.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setAvatarUrl(url)
                  toast.success('Preset avatar selected!')
                }}
                className={`size-7 rounded-full overflow-hidden border-2 transition-transform hover:scale-110 cursor-pointer ${
                  avatarUrl === url ? 'border-primary ring-2 ring-primary/30' : 'border-border/80'
                }`}
              >
                <img src={url} alt="Preset avatar" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Full Display Name (Only Owner can edit) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="prof-name" className="text-xs font-semibold text-foreground">
            Display Name
          </Label>
          {!isOwner && (
            <span className="text-[10px] text-muted-foreground font-medium">
              (Managed by Owner)
            </span>
          )}
        </div>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="prof-name"
            placeholder="Your full display name..."
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!isOwner}
            className="pl-10 text-xs h-9 disabled:opacity-75 disabled:bg-muted/50"
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          {isOwner
            ? 'As Enterprise Owner, you can change your display name across all modules.'
            : 'Staff and Admin display names are set upon registration and managed centrally.'}
        </p>
      </div>

      {/* Personal Description / Notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prof-bio" className="text-xs font-semibold text-foreground">
          Personal Description / Notes
        </Label>
        <div className="relative">
          <FileText className="absolute left-3.5 top-3 size-4 text-muted-foreground pointer-events-none" />
          <Textarea
            id="prof-bio"
            placeholder="Add personal notes, operational memos, or description..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="pl-10 text-xs resize-none"
            rows={3}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">
          Your personal notes are securely saved to your account and won't crowd the sidebar banner.
        </p>
      </div>

      <DialogFooter className="gap-2 pt-2 border-t sm:justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Shield className="size-3.5 text-emerald-600 shrink-0" />
          <span>Role: <strong className="text-foreground">{user?.role || 'OWNER'}</strong></span>
        </div>

        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving} className="font-bold shadow-xs cursor-pointer">
            {isSaving ? (
              <>
                <Spinner data-icon="inline-start" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="size-3.5" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogFooter>
    </form>
  )
}

export function AccountProfileModal({ open, onClose }: AccountProfileModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="pb-2">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-2xs">
            <User className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Customize Profile & Picture
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Customize your display name, account photo, and personal description or notes.
          </DialogDescription>
        </DialogHeader>

        {open && <AccountProfileForm onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
