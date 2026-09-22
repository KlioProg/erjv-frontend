import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary caught error]:', error, errorInfo)
    this.setState({ error, errorInfo })
  }

  private handleReload = (): void => {
    window.location.reload()
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-svh items-center justify-center p-4 bg-background selection:bg-primary/20">
          <Card className="w-full max-w-lg border-destructive/30 shadow-lg animate-in fade-in-50 zoom-in-95 duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-bold">Something went wrong</CardTitle>
                  <CardDescription className="text-xs">
                    An unexpected error occurred while rendering this interface.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3 text-xs">
              <div className="rounded-lg bg-muted/60 p-3 font-mono text-[11px] text-muted-foreground break-words border border-border/60">
                {this.state.error?.message || 'Unknown runtime error'}
              </div>

              {this.state.errorInfo?.componentStack && (
                <details className="text-[11px] text-muted-foreground/80 cursor-pointer">
                  <summary className="hover:text-foreground transition-colors font-medium">
                    View Component Stack
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-[10px] leading-tight">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <Button variant="outline" size="sm" onClick={this.handleReset} className="text-xs">
                <Home className="size-3.5 mr-1.5" />
                Try Again
              </Button>
              <Button
                size="sm"
                onClick={this.handleReload}
                className="text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <RefreshCw className="size-3.5 mr-1.5" />
                Reload Application
              </Button>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
