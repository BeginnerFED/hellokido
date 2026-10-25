import { Component, type ErrorInfo, type ReactNode } from 'react'
import { messages } from '@hellokido/core/i18n'
import { readSavedLocale } from '../providers/I18n'

type State = { failed: boolean }

/** Keeps a render error from leaving a blank page. Sits outside every provider. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Unexpected error:', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const text = messages[readSavedLocale()].shell.errors
    return (
      <div className="grid min-h-dvh place-items-center bg-ground px-6 text-ink">
        <div className="max-w-sm text-center">
          <h1 className="text-xl font-semibold">{text.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">{text.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 h-11 rounded-control bg-accent-solid px-5 text-sm font-medium text-on-accent shadow-piece"
          >
            {text.reload}
          </button>
        </div>
      </div>
    )
  }
}
