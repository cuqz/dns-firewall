import { useEffect, useRef, useState, useCallback } from 'react'
import type { WSMessage, QueryLogEntry, DashboardData } from '../types'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`

export function useWebSocket() {
  const [queries, setQueries] = useState<QueryLogEntry[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const maxLogs = 100

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const msg: WSMessage = JSON.parse(event.data)
          if (msg.type === 'query') {
            const entry = msg.data as QueryLogEntry
            setQueries((prev) => [entry, ...prev].slice(0, maxLogs))
          }
        } catch {}
      }

      ws.onclose = () => {
        setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [])

  return { queries }
}

export function useDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      const json = await res.json()
      setData(json)
    } catch {}
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [fetchStats])

  return { data, refetch: fetchStats }
}
