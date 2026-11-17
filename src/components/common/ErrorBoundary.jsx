import React from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            width: '100vw',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            boxSizing: 'border-box'
          }}
        >
          <div
            style={{
              maxWidth: '500px',
              width: '100%',
              backgroundColor: '#1E293B',
              borderRadius: '20px',
              padding: '2.5rem',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.25rem',
                border: '1px solid rgba(239, 68, 68, 0.25)'
              }}
            >
              <AlertCircle size={28} />
            </div>

            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem', letterSpacing: '-0.02em' }}>
              Unexpected Application State
            </h2>
            <p style={{ fontSize: '0.88rem', color: '#94A3B8', margin: '0 0 1.75rem', lineHeight: 1.5 }}>
              The PMS terminal encountered an issue while loading this view. You can reload the terminal or return to the main dashboard.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  backgroundColor: '#2563EB',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={15} />
                <span>Reload Terminal</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: '10px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <Home size={15} />
                <span>Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

