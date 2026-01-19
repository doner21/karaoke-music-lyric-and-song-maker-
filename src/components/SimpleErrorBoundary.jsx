import React from 'react';

class SimpleErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("SimpleErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 9999,
                    backgroundColor: 'white',
                    color: 'red',
                    padding: '2rem',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    textAlign: 'left'
                }}>
                    <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'red' }}>Application Crashed</h1>
                    <div style={{ marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {this.state.error && this.state.error.toString()}
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        Check the console for more details.
                    </div>
                    <pre style={{ backgroundColor: '#eee', padding: '1rem', borderRadius: '4px', overflowX: 'auto', fontSize: '0.9rem' }}>
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </pre>
                </div>
            );
        }

        return this.props.children;
    }
}

export default SimpleErrorBoundary;
