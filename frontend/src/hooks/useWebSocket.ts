import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardData, QueryLogEntry } from '../types'

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/stats')
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setError(false)
        }
      } catch {
        if (!cancelled) setError(true)
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return { data, error }
}

export function useWebSocket() {
  const [queries, setQueries] = useState<QueryLogEntry[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<number>(0)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!mountedRef.current || wsRef.current?.readyState === WebSocket.OPEN) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(protocol + '//' + window.location.host + '/ws')

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === 'query') {
          setQueries((prev) => [msg.data, ...prev].slice(0, 200))
        }
      } catch {}
    }

    ws.onclose = () => {
      if (mountedRef.current) {
        reconnectTimer.current = window.setTimeout(connect, 3000)
      }
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { queries }
}
