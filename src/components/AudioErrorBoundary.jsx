import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * Error Boundary specifically for audio-related components.
 * Catches JavaScript errors in the audio component tree and displays
 * a fallback UI instead of crashing the entire application.
 */
export class AudioErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render shows the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log error details for debugging
        console.error('[AudioErrorBoundary] Caught error:', error);
        console.error('[AudioErrorBoundary] Error info:', errorInfo);

        this.setState({ errorInfo });

        // Call optional onError callback
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });

        // Call optional onRetry callback
        if (this.props.onRetry) {
            this.props.onRetry();
        }
    };

    render() {
        if (this.state.hasError) {
            // Fallback UI
            return (
                <div className="flex flex-col items-center justify-center p-8 bg-zinc-900/50 border border-red-500/30 rounded-xl">
                    <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                        <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-lg font-bold text-zinc-200 mb-2">Audio Error</h3>
                    <p className="text-sm text-zinc-400 text-center mb-4 max-w-md">
                        {this.state.error?.message || 'Something went wrong with audio playback.'}
                    </p>
                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        <span>Retry</span>
                    </button>
                    {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                        <details className="mt-4 text-xs text-zinc-500 max-w-md">
                            <summary className="cursor-pointer hover:text-zinc-400">Technical Details</summary>
                            <pre className="mt-2 p-2 bg-zinc-950 rounded overflow-auto max-h-32">
                                {this.state.errorInfo.componentStack}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default AudioErrorBoundary;
