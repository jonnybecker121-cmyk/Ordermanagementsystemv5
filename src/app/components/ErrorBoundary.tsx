import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "../ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background p-4 text-center">
          <div className="flex max-w-md flex-col items-center gap-4 rounded-lg border border-destructive/20 bg-destructive/10 p-8">
            <div className="rounded-full bg-destructive/20 p-4">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Etwas ist schiefgelaufen</h1>
            <p className="text-sm text-muted-foreground">
              Ein unerwarteter Fehler ist aufgetreten. Bitte laden Sie die Seite neu.
            </p>
            {this.state.error && (
                <div className="max-w-xs overflow-auto rounded bg-background/50 p-2 text-xs text-muted-foreground">
                    {this.state.error.toString()}
                </div>
            )}
            <Button 
              onClick={() => window.location.reload()}
              variant="default"
              className="mt-2"
            >
              Seite neu laden
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
