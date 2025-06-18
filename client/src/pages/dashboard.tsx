import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle, Star, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { bookingsAPI, eventsAPI } from "../lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Booking } from "../types";

export default function Dashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: bookingsData, isLoading } = useQuery({
    queryKey: ["/api/bookings/my"],
    queryFn: bookingsAPI.getMyBookings,
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: number) => eventsAPI.cancelBooking(eventId),
    onSuccess: () => {
      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const bookings = bookingsData?.data || [];

  const upcomingBookings = bookings.filter(
    (booking) => new Date(booking.event?.date || '') > new Date()
  );
  
  const pastBookings = bookings.filter(
    (booking) => new Date(booking.event?.date || '') <= new Date()
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-6 w-96" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-slate-900">My Bookings</h2>
          <p className="mt-2 text-lg text-slate-600">
            Manage your event reservations
          </p>
        </div>

        {/* Booking Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-primary/10">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">
                    Upcoming Events
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {upcomingBookings.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-emerald-100">
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">Completed</p>
                  <p className="text-2xl font-bold text-slate-900">
                    {pastBookings.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-amber-100">
                  <Star className="h-6 w-6 text-amber-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-slate-600">
                    Total Attended
                  </p>
                  <p className="text-2xl font-bold text-slate-900">
                    {bookings.length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bookings List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="mx-auto h-12 w-12 text-slate-400" />
                <h3 className="mt-4 text-lg font-medium text-slate-900">
                  No bookings yet
                </h3>
                <p className="mt-2 text-slate-600">
                  Start by browsing and booking some amazing events!
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {bookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="py-6 hover:bg-slate-50 transition-colors rounded-lg px-4 -mx-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl">
                            {getEventIcon(booking.event?.tags || [])}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-slate-900">
                            {booking.event?.title}
                          </h4>
                          <div className="mt-1 flex items-center space-x-4 text-sm text-slate-600">
                            <span>{formatDate(booking.event?.date || '')}</span>
                            <span>{booking.event?.location}</span>
                          </div>
                          <div className="mt-1">
                            <Badge
                              variant={
                                new Date(booking.event?.date || '') > new Date()
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {new Date(booking.event?.date || '') > new Date()
                                ? "Confirmed"
                                : "Completed"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {new Date(booking.event?.date || '') > new Date() && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <X className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to cancel your booking for "{booking.event?.title}"? 
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelMutation.mutate(booking.eventId)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Cancel Booking
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
