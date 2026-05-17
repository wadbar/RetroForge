import React, { Component, ErrorInfo, ReactNode } from 'react';
import { monitor } from '../services/monitorService';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * GlobalErrorBoundary - Captures unhandled React errors and reports to the monitor.
 */
export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    monitor.reportError(`UI_FATAL: ${error.message}`);
    console.error("Uncaught UI Error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-[#121217] border border-red-900/30 rounded-xl p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Interface Corrupted</h1>
            <p className="text-gray-400 mb-8 text-sm">
              A critical failure occurred in the UI projection layer. The event has been logged for auto-recovery analysis.
            </p>
            <div className="bg-black/40 rounded-lg p-4 mb-8 text-left overflow-auto max-h-32 text-xs font-mono text-red-400">
              {this.state.error?.toString()}
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Re-initialize Core
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
