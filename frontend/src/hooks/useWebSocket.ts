import { useState, useEffect, useRef, useCallback } from 'react'
import type { DashboardData, QueryLogEntry } from '../types'

export function useDashboard(since?: string, until?: string, groupBy?: string) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  useEffect(() => {
    let cancelled = false
    const fetchStats = async () => {
      try {
        let url = '/api/stats'
        const params: string[] = []
        if (since && until) {
          params.push('since=' + encodeURIComponent(since), 'until=' + encodeURIComponent(until))
        }
        if (groupBy) params.push('group_by=' + encodeURIComponent(groupBy))
        if (params.length) url += '?' + params.join('&')
        const res = await fetch(url)
        if (!res.ok) throw new Error('HTTP ' + res.status)
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setError(false)
          setLastRefresh(new Date())
        }
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    setLoading(true)
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [since, until, groupBy])

  return { data, error, loading, lastRefresh }
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
