import { createBrowserClient } from '@supabase/ssr'
import { useState, useEffect } from 'react'

let clientPromise: ReturnType<typeof createBrowserClient> | null = null

function getClient() {
  if (typeof window === 'undefined') {
    return null
  }
  if (!clientPromise) {
    clientPromise = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return clientPromise
}

export function createClient() {
  return getClient()
}

export function useClient() {
  const [client, setClient] = useState<ReturnType<typeof createBrowserClient> | null>(null)

  useEffect(() => {
    setClient(getClient())
  }, [])

  return client
}
