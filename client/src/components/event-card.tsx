import { Calendar, MapPin, Users, Info } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { eventsAPI } from "../lib/api";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket, WS_EVENTS } from "@/hooks/use-websocket";
import type { Event } from "../types";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event: initialEvent }: EventCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [event, setEvent] = useState<Event>(initialEvent);
  const { lastMessage } = useWebSocket();
  const [recentlyUpdated, setRecentlyUpdated] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  
  // Update the event when the props change
  useEffect(() => {
    setEvent(initialEvent);
  }, [initialEvent]);
  
  // Listen for real-time updates via WebSocket
  useEffect(() => {
    if (lastMessage?.type === WS_EVENTS.SLOT_UPDATE && 
        lastMessage.payload.eventId === event.id) {
      setEvent(prev => ({
        ...prev,
        availableSlots: lastMessage.payload.availableSlots
      }));
      
      // Show update indicator
      setRecentlyUpdated(true);
      
      // Clear existing timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      
      // Hide update indicator after 3 seconds
      timeoutRef.current = window.setTimeout(() => {
        setRecentlyUpdated(false);
        timeoutRef.current = null;
      }, 3000);
    }
  }, [lastMessage, event.id]);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const bookMutation = useMutation({
    mutationFn: () => eventsAPI.bookEvent(event.id),
    onSuccess: () => {
      toast({
        title: "Booking Confirmed!",
        description: `Your seat has been reserved for "${event.title}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Booking Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

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

  const isFullyBooked = event.availableSlots <= 0;
  const isAlreadyBooked = event.isBooked;

  return (
    <Card className={`overflow-hidden hover:shadow-md transition-all duration-200 ${recentlyUpdated ? 'ring-2 ring-primary/50' : ''}`}>
      <div className="w-full h-48 bg-slate-200 flex items-center justify-center">
        {event.image ? (
          <img
            src={event.image}
            alt={event.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-slate-500">
            <Calendar size={48} />
          </div>
        )}
      </div>
      
      <CardContent className="p-6">
        {/* Event Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {event.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Event Title */}
        <h3 className="text-xl font-semibold text-slate-900 mb-2">
          {event.title}
        </h3>
        
        {/* Event Description */}
        <p className="text-slate-600 text-sm mb-4 line-clamp-2">
          {event.description}
        </p>
        
        {/* Event Details */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-slate-600">
            <Calendar className="mr-2 h-4 w-4 text-slate-400" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center text-sm text-slate-600">
            <MapPin className="mr-2 h-4 w-4 text-slate-400" />
            <span>{event.location}</span>
          </div>
          <div className="flex items-center text-sm">
            <Users className="mr-2 h-4 w-4 text-slate-400" />
            {isFullyBooked ? (
              <span className="text-red-600 font-medium">Fully Booked</span>
            ) : (
              <>
                <span className={`font-medium ${recentlyUpdated ? 'text-primary animate-pulse' : 'text-emerald-600'}`}>
                  {event.availableSlots} spots available
                </span>
                <span className="text-slate-500 ml-1">
                  of {event.totalSlots}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {isAlreadyBooked ? (
            <Button variant="outline" className="flex-1" disabled>
              Already Booked
            </Button>
          ) : isFullyBooked ? (
            <Button variant="secondary" className="flex-1" disabled>
              Fully Booked
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={() => bookMutation.mutate()}
              disabled={bookMutation.isPending}
            >
              {bookMutation.isPending ? "Booking..." : "Book Now"}
            </Button>
          )}
          <Button variant="outline" size="icon">
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
