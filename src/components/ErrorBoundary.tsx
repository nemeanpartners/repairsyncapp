import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
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
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center p-8 bg-zinc-50 border border-zinc-200 rounded-2xl text-zinc-800 my-4 text-sm font-medium text-center">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6 text-red-600" />
          </div>
          <h2 className="text-lg font-bold mb-2">Something went wrong</h2>
          <p className="text-zinc-500 mb-6 max-w-md">
            The component could not be rendered due to an unexpected error.
          </p>
          <Button onClick={() => this.setState({ hasError: false })} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
          <details className="whitespace-pre-wrap mt-6 text-xs text-left bg-white p-4 rounded-xl border border-zinc-200 w-full max-w-2xl overflow-auto hidden">
            {this.state.error && this.state.error.toString()}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
