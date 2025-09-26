import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsAPI } from '@/lib/api';
import { useWebSocket } from './use-websocket';

export function useNotifications() {
  const queryClient = useQueryClient();
  const { lastMessage } = useWebSocket();
  const [unread, setUnread] = useState<number>(0);
  const [page, setPage] = useState(1);
  const limit = 10;

  // List notifications
  const listQuery = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => notificationsAPI.list(page, limit).then(r => r.data),
  });

  // Initialize unread from first fetch (derive) if needed
  useEffect(() => {
    if (listQuery.data && page === 1) {
      const unreadCalculated = listQuery.data.notifications.filter((n: any) => !n.read).length; // simplistic
      if (unread < unreadCalculated) setUnread(unreadCalculated); // don't overwrite server pushes downward
    }
  }, [listQuery.data, page]);

  // WebSocket unread count message handling
  useEffect(() => {
    if (lastMessage?.type === 'NOTIFICATION_COUNT') {
      const val = lastMessage.payload?.unread;
      if (typeof val === 'number') setUnread(val);
    }
  }, [lastMessage]);

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsAPI.markRead(id),
    onMutate: async (id) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const prev = queryClient.getQueryData<any>(['notifications', page]);
      if (prev) {
        const next = {
          ...prev,
          notifications: prev.notifications.map((n: any) => n.id === id ? { ...n, read: true } : n)
        };
        queryClient.setQueryData(['notifications', page], next);
      }
      setUnread(u => Math.max(0, u - 1));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['notifications', page], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsAPI.markAll(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['notifications'] });
      const pages = queryClient.getQueriesData({ queryKey: ['notifications'] });
      pages.forEach(([key, data]) => {
        if (data) {
          const updated = { ...data, notifications: data.notifications.map((n: any) => ({ ...n, read: true })) };
          queryClient.setQueryData(key as any, updated);
        }
      });
      setUnread(0);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markRead = useCallback((id: number) => markReadMutation.mutate(id), [markReadMutation]);
  const markAll = useCallback(() => markAllMutation.mutate(), [markAllMutation]);

  return {
    notifications: listQuery.data?.notifications || [],
    total: listQuery.data?.total || 0,
    page,
    pages: listQuery.data?.pages || 1,
    setPage,
    unread,
    markRead,
    markAll,
    isLoading: listQuery.isLoading,
  };
}
