'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'
import App from '@/components/App'

export default function Home() {
  const { loadFromStorage, token } = useAppStore()

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  return <App />
}
