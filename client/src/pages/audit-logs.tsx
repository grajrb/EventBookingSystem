import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminAPI } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [actorId, setActorId] = useState('');
  const [targetType, setTargetType] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['auditLogs', page, action, actorId, targetType, start, end],
    queryFn: () => adminAPI.getAuditLogs({ page, limit: 25, action: action||undefined, actorId: actorId ? Number(actorId) : undefined, targetType: targetType||undefined, start: start||undefined, end: end||undefined }).then(r => r.data)
  });

  const logs = data?.logs || [];
  const pages = data?.pages || 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-3xl font-bold mb-6 text-slate-900">Audit Logs</h2>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <Input placeholder="Action" value={action} onChange={e=>setAction(e.target.value)} />
              <Input placeholder="Actor ID" value={actorId} onChange={e=>setActorId(e.target.value)} />
              <Input placeholder="Target Type" value={targetType} onChange={e=>setTargetType(e.target.value)} />
              <Input type="date" value={start} onChange={e=>setStart(e.target.value)} />
              <Input type="date" value={end} onChange={e=>setEnd(e.target.value)} />
              <Button onClick={() => { setPage(1); refetch(); }}>Apply</Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
          </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="p-4 text-slate-500">Loading...</div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-slate-500">No logs found</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Time</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Actor</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Target Type</TableHead>
                        <TableHead>Metadata</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((l: any) => (
                        <TableRow key={l.id} className="hover:bg-slate-50">
                          <TableCell className="text-xs">{new Date(l.createdAt).toLocaleString()}</TableCell>
                          <TableCell className="text-xs font-medium">{l.action}</TableCell>
                          <TableCell className="text-xs">{l.actorId}</TableCell>
                          <TableCell className="text-xs">{l.targetId}</TableCell>
                          <TableCell className="text-xs">{l.targetType}</TableCell>
                          <TableCell className="text-xs max-w-xs truncate" title={l.metadata}>{l.metadata}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <div className="flex items-center justify-between mt-4 text-sm">
                <span>Page {page} / {pages}</span>
                <div className="space-x-2">
                  <Button size="sm" variant="outline" disabled={page===1} onClick={() => setPage(p=>p-1)}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={page===pages} onClick={() => setPage(p=>p+1)}>Next</Button>
                </div>
              </div>
            </CardContent>
        </Card>
      </main>
    </div>
  );
}
