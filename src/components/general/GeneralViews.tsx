import { Settings as SettingsIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SettingsView() {
  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <Card className="border-border/80">
        <CardHeader>
          <div className="flex items-center gap-2">
            <SettingsIcon className="size-5 text-rose-600" />
            <CardTitle className="text-base font-bold">System & POS Configuration</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Manage your store branch details, receipt print templates, and regional tax settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Store / Enterprise Name</Label>
              <Input defaultValue="ERJVPOS Superstore Davao" className="h-9 text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Default Currency</Label>
              <Input defaultValue="Philippine Peso (₱ PHP)" disabled className="h-9 text-xs font-semibold" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">VAT / Tax Rate (%)</Label>
              <Input defaultValue="12.00" className="h-9 text-xs" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold">Branch POS Terminal ID</Label>
              <Input defaultValue="TERM-DVO-01" className="h-9 text-xs font-mono" />
            </div>
          </div>

          <div className="pt-2">
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white text-xs">
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function FeedbackView() {
  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <Card className="border-border/80 text-center p-8">
        <CardContent className="flex flex-col items-center justify-center space-y-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
            ⭐
          </div>
          <h3 className="text-lg font-bold text-foreground">Rate your ERJVPOS Experience</h3>
          <p className="text-xs text-muted-foreground max-w-sm">
            We continuously refine our point of sale, inventory, and logistics platform based on your feedback.
          </p>
          <div className="flex items-center gap-2 text-2xl cursor-pointer">
            <span>⭐</span>
            <span>⭐</span>
            <span>⭐</span>
            <span>⭐</span>
            <span>⭐</span>
          </div>
          <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white mt-2">
            Submit Rating
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
