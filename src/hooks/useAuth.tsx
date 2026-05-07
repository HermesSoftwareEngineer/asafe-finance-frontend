import { useQuery } from '@tanstack/react-query'
import { authApi } from '../lib/api'
import type { User } from '../types'

export function useAuth() {
  const { data, isLoading, error } = useQuery<User>({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.me()
      return res.data
    },
    retry: false,
    staleTime: 60_000,
  })

  return {
    user: data ?? null,
    isLoading,
    isAuthenticated: !!data && !error,
  }
}
