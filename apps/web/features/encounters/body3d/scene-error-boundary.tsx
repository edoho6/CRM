'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Catches a model that fails to load or a WebGL context that cannot be made,
 * and shows what the parent hands it instead of taking the page down.
 *
 * Nothing about the error is sent anywhere: it happens on the treatment page,
 * and a stack trace from there is one request away from a patient's name.
 */
export class SceneErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[body3d] the 3D view failed to load', error, info.componentStack);
    }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
