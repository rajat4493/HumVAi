import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

/** Last line of defence: a crash shows a calm message instead of a blank page. Saved progress is not touched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The game hit an unexpected error', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="panel-screen" role="alert" data-testid="crashed">
        <h1 className="display">Something went wrong</h1>
        <p>The game hit an unexpected problem. Your progress is saved on this device and has not been changed.</p>
        <button className="btn" onClick={() => window.location.reload()}>
          Reload the game
        </button>
      </main>
    );
  }
}
