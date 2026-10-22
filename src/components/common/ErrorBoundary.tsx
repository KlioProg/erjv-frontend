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
          <Card className="w-full max-w-lg border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex size-8 items-center justify-center text-destructive">
                  <AlertTriangle className="size-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Something went wrong</CardTitle>
                  <CardDescription className="text-xs">
                    An unexpected error occurred while rendering this interface.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex flex-col gap-3 text-ui">
              <div className="rounded-lg bg-muted/60 p-3 font-mono text-xs text-muted-foreground break-words border border-border/60">
                {this.state.error?.message || 'Unknown runtime error'}
              </div>

              {this.state.errorInfo?.componentStack && (
                <details className="text-xs text-muted-foreground cursor-pointer">
                  <summary className="hover:text-foreground transition-colors font-medium">
                    View Component Stack
                  </summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted/40 p-2 font-mono text-xs leading-5">
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
                className="text-xs shadow-xs"
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
