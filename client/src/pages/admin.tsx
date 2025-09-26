import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Users, TrendingUp, Percent, Plus, Edit, Trash2, UserCheck, Search, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import EventForm from "../components/event-form";
import AttendeeList from "../components/attendee-list";
import { eventsAPI, adminAPI } from "../lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Event, User } from "../types";
import type { BookingWithDetails } from "../components/attendee-list";

export default function Admin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [isAttendeeListOpen, setIsAttendeeListOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event>();
  const [selectedEventAttendees, setSelectedEventAttendees] = useState<BookingWithDetails[]>([]);

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: adminAPI.getStats,
  });

  const [userPage, setUserPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'createdAt' | 'email' | 'name' | 'lastLogin' | 'isAdmin'>('createdAt');
  const [userDirection, setUserDirection] = useState<'asc' | 'desc'>('desc');
  const usersQueryKey = ['/api/admin/users', userPage, userSearch, userSort, userDirection];
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: usersQueryKey,
    queryFn: () => adminAPI.getUsers({ page: userPage, limit: 10, search: userSearch || undefined, sort: userSort, direction: userDirection }),
  });

  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["/api/events", 1, search],
    queryFn: () => eventsAPI.getEvents(1, 50, search || undefined),
  });

  const { data: attendeesData } = useQuery({
    queryKey: ["/api/events/bookings", selectedEvent?.id],
    queryFn: () => selectedEvent ? eventsAPI.getEventBookings(selectedEvent.id) : null,
    enabled: !!selectedEvent,
  });

  const deleteMutation = useMutation({
    mutationFn: eventsAPI.deleteEvent,
    onSuccess: () => {
      toast({
        title: "Event Deleted",
        description: "Event has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (id: number) => adminAPI.promoteUser(id),
    onSuccess: () => {
      toast({ title: 'User Promoted', description: 'User has been granted admin privileges.' });
      refetchUsers();
    },
    onError: (error: Error) => {
      toast({ title: 'Promotion Failed', description: error.message, variant: 'destructive' });
    },
  });

  const demoteMutation = useMutation({
    mutationFn: (id: number) => adminAPI.demoteUser(id),
    onSuccess: () => {
      toast({ title: 'User Demoted', description: 'Admin privileges removed.' });
      refetchUsers();
    },
    onError: (error: Error) => {
      toast({ title: 'Demotion Failed', description: error.message, variant: 'destructive' });
    },
  });

  const stats = statsData?.data;
  const events = eventsData?.data.events || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getEventIcon = (tags: string[]) => {
    if (tags.includes("Technology")) return "💻";
    if (tags.includes("Arts & Culture")) return "🎨";
    if (tags.includes("Music")) return "🎵";
    if (tags.includes("Sports")) return "⚽";
    if (tags.includes("Business")) return "💼";
    return "📅";
  };

  const handleEdit = (event: Event) => {
    setEditingEvent(event);
    setIsEventFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsEventFormOpen(false);
    setEditingEvent(undefined);
  };

  const exportToCSV = async (eventId?: number) => {
    try {
      let bookings;
      let filename;
      
      if (eventId) {
        // Export bookings for a specific event
        const response = await eventsAPI.getEventBookings(eventId);
        bookings = response.data;
        const event = events.find(e => e.id === eventId);
        filename = `bookings-${event?.title.replace(/\s+/g, '-').toLowerCase()}-${new Date().toISOString().split('T')[0]}.csv`;
      } else {
        // Export all bookings
        const eventsWithBookings = await Promise.all(
          events.map(async (event) => {
            const response = await eventsAPI.getEventBookings(event.id);
            return response.data.map(booking => ({
              ...booking,
              eventTitle: event.title,
              eventDate: event.date
            }));
          })
        );
        bookings = eventsWithBookings.flat();
        filename = `all-bookings-${new Date().toISOString().split('T')[0]}.csv`;
      }
      
      // Create CSV content
      const headers = ['Booking ID', 'Event', 'Date', 'User Name', 'User Email', 'Status', 'Booked On'];
      const csvContent = [
        headers.join(','),
        ...bookings.map((booking: any) => [
          booking.id,
          booking.event?.title || booking.eventTitle,
          new Date(booking.event?.date || booking.eventDate).toLocaleDateString(),
          booking.user?.name,
          booking.user?.email,
          booking.status,
          new Date(booking.createdAt).toLocaleDateString()
        ].join(','))
      ].join('\n');
      
      // Download the CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Export Successful",
        description: "Your bookings have been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "There was an error exporting the bookings",
        variant: "destructive",
      });
    }
  };

  const handleViewAttendees = (event: Event) => {
    setSelectedEvent(event);
    setIsAttendeeListOpen(true);
  };

  if (statsLoading || eventsLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </main>
      </div>
    );
  }

  const usersPayload = usersData?.data;
  const users = usersPayload?.users || [] as User[];
  const totalPages = usersPayload?.pages || 1;

  const toggleSort = (field: typeof userSort) => {
    if (userSort === field) {
      setUserDirection(userDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSort(field);
      setUserDirection('asc');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Admin Dashboard</h2>
            <p className="mt-2 text-lg text-slate-600">
              Manage events and view booking analytics
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex gap-2">
            <Button
              onClick={() => exportToCSV()}
              variant="outline"
              className="shadow-sm"
            >
              <Download className="mr-2 h-4 w-4" />
              Export All Bookings
            </Button>
            <Button
              onClick={() => setIsEventFormOpen(true)}
              className="shadow-sm"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Event
            </Button>
          </div>
        </div>

        {/* Admin Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Total Events</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.totalEvents || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-emerald-100">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Total Bookings</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.totalBookings || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-amber-100">
                  <TrendingUp className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">This Month</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.thisMonth || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-red-100">
                  <Percent className="h-6 w-6 text-red-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Occupancy Rate</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {stats?.occupancyRate || 0}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Management */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="py-8 text-center text-slate-500">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="py-8 text-center text-slate-500">No users found.</div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Input
                    placeholder="Search users..."
                    value={userSearch}
                    onChange={e => { setUserSearch(e.target.value); setUserPage(1); }}
                    className="max-w-xs"
                  />
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('name')}>User {userSort==='name' ? (userDirection==='asc'?'▲':'▼') : ''}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('email')}>Email {userSort==='email' ? (userDirection==='asc'?'▲':'▼') : ''}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('isAdmin')}>Role {userSort==='isAdmin' ? (userDirection==='asc'?'▲':'▼') : ''}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('lastLogin')}>Last Login {userSort==='lastLogin' ? (userDirection==='asc'?'▲':'▼') : ''}</TableHead>
                        <TableHead className="cursor-pointer" onClick={() => toggleSort('createdAt')}>Created {userSort==='createdAt' ? (userDirection==='asc'?'▲':'▼') : ''}</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map(u => (
                        <TableRow key={u.id} className="hover:bg-slate-50">
                          <TableCell className="font-medium text-slate-900">{u.name}</TableCell>
                          <TableCell className="text-slate-600">{u.email}</TableCell>
                          <TableCell>{u.isAdmin ? <Badge>Admin</Badge> : <Badge variant="secondary">User</Badge>}</TableCell>
                          <TableCell className="text-sm text-slate-500">{u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : '—'}</TableCell>
                          <TableCell className="text-sm text-slate-500">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}</TableCell>
                          <TableCell className="space-x-2">
                            {!u.isAdmin && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={promoteMutation.isPending}
                                onClick={() => promoteMutation.mutate(u.id)}
                              >
                                {promoteMutation.isPending ? 'Promoting...' : 'Promote'}
                              </Button>
                            )}
                            {u.isAdmin && (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={demoteMutation.isPending}
                                onClick={() => demoteMutation.mutate(u.id)}
                              >
                                {demoteMutation.isPending ? 'Demoting...' : 'Demote'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-slate-600">Page {userPage} of {totalPages}</div>
                  <div className="space-x-2">
                    <Button size="sm" variant="outline" disabled={userPage===1} onClick={() => setUserPage(p=>p-1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={userPage===totalPages} onClick={() => setUserPage(p=>p+1)}>Next</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Events Management Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle>Event Management</CardTitle>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="sm" onClick={() => exportToCSV()}>
                <Download className="mr-1 h-4 w-4" />
                Export All Bookings CSV
              </Button>
              <div className="relative">
                <Input
                  placeholder="Search events..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 w-64"
                />
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-medium text-slate-900">
                  No events found
                </h3>
                <p className="mt-2 text-slate-600">
                  {search ? "Try adjusting your search terms" : "Start by creating your first event"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Bookings</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event) => {
                      const occupancyPercentage = event.totalSlots > 0 
                        ? Math.round(((event.totalSlots - event.availableSlots) / event.totalSlots) * 100)
                        : 0;
                      
                      return (
                        <TableRow key={event.id} className="hover:bg-slate-50">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-lg">
                                {getEventIcon(event.tags)}
                              </div>
                              <div>
                                <div className="font-medium text-slate-900">
                                  {event.title}
                                </div>
                                <div className="text-sm text-slate-500">
                                  {event.location}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-900">
                            {formatDate(event.date)}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">
                                {event.totalSlots - event.availableSlots} / {event.totalSlots}
                              </div>
                              <div className="w-full bg-slate-200 rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full" 
                                  style={{ width: `${occupancyPercentage}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={new Date(event.date) > new Date() ? "default" : "secondary"}>
                              {new Date(event.date) > new Date() ? "Active" : "Completed"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(event)}
                                title="Edit Event"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={() => exportToCSV(event.id)}
                                title="Export Bookings"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setSelectedEventAttendees(attendeesData?.data || []);
                                  setIsAttendeeListOpen(true);
                                  handleViewAttendees(event);
                                }}
                                title="View Attendees"
                              >
                                <UserCheck className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Event</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{event.title}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(event.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Delete Event
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Form Modal */}
        <EventForm
          isOpen={isEventFormOpen}
          onClose={handleCloseForm}
          event={editingEvent}
        />

        {/* Attendee List Modal */}
        <AttendeeList
          isOpen={isAttendeeListOpen}
          onClose={() => {
            setIsAttendeeListOpen(false);
            setSelectedEvent(undefined);
          }}
          attendees={(attendeesData?.data as BookingWithDetails[]) || []}
          eventTitle={selectedEvent?.title || ""}
        />
      </main>
    </div>
  );
}
