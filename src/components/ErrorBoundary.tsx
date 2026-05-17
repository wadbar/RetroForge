import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
    // In a real app we would send this to Sentry/DataDog
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-red-900/10 border border-red-500/20 p-8 rounded-2xl text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">System Failure Detected</h2>
          <p className="text-red-300 font-mono text-sm mb-4 max-w-md">{this.state.error?.message || 'Unknown render error'}</p>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 px-4 py-2 rounded-lg transition-colors font-mono uppercase text-xs"
          >
            <RefreshCw className="w-4 h-4" /> Reset Component State
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
