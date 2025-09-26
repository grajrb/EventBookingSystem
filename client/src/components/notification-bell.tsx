import { Bell, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/use-notifications';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '@/components/ui/dropdown-menu';

export function NotificationBell() {
  const { notifications, unread, markRead, markAll, isLoading, page, setPage, pages } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell size={20} />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <Button size="sm" variant="ghost" onClick={() => markAll()} className="text-xs">Mark all</Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading && <div className="p-3 text-sm text-slate-500">Loading...</div>}
        {!isLoading && notifications.length === 0 && (
          <div className="p-3 text-sm text-slate-500">No notifications</div>
        )}
        {notifications.map(n => (
          <DropdownMenuItem key={n.id} className="flex items-start gap-2 py-2 focus:bg-slate-100 cursor-default">
            <div className="mt-0.5">
              {n.read ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <span className="h-2 w-2 rounded-full bg-blue-500 block" />}
            </div>
            <div className="flex-1">
              <div className={`text-sm font-medium ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</div>
              {n.body && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</div>}
              <div className="text-[10px] text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            {!n.read && (
              <Button size="xs" variant="ghost" onClick={() => markRead(n.id)} className="text-xs">Mark</Button>
            )}
          </DropdownMenuItem>
        ))}
        {pages > 1 && (
          <div className="flex items-center justify-between p-2 text-xs text-slate-500">
            <Button size="sm" variant="ghost" disabled={page===1} onClick={() => setPage(page-1)}>Prev</Button>
            <span>Page {page} / {pages}</span>
            <Button size="sm" variant="ghost" disabled={page===pages} onClick={() => setPage(page+1)}>Next</Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
