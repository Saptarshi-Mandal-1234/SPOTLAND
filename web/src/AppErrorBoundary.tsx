import { Component, type ReactNode } from 'react';

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="safety-fallback"><h1>Something didn’t load</h1><p>Your connection or an app update may be the cause. Reload to try again.</p><button onClick={() => location.reload()}>Reload SPOTLAND</button><p>For an emergency, <a href="tel:112">Call 112</a>. SPOTLAND does not replace emergency services.</p><a href="/">Return home</a></main>;
    return this.props.children;
  }
}
