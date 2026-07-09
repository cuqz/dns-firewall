import React from 'react'
import { Shield } from 'lucide-react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
          <div className="text-center max-w-sm px-8">
            <Shield className="w-12 h-12 text-[#f85149]/50 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-[#e8e8ee] mb-2">Something went wrong</h2>
            <p className="text-sm text-[#888] mb-4 font-mono text-left bg-[#111118] border border-[rgba(255,255,255,0.06)] rounded-lg p-3 text-[11px] break-all">
              {this.state.error?.message ?? 'Unknown error'}
            </p>
            <button
              onClick={this.handleRetry}
              className="px-5 py-2 bg-[#4a9eff] text-white text-sm font-medium rounded-lg hover:bg-[#3a8eef] transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
