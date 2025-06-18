import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import EventCard from "../components/event-card";
import EventForm from "../components/event-form";
import Pagination from "../components/pagination";
import { eventsAPI } from "../lib/api";
import { useAuth } from "../hooks/use-auth";

export default function Home() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isEventFormOpen, setIsEventFormOpen] = useState(false);
  const limit = 6;

  const { data, isLoading } = useQuery({
    queryKey: ["/api/events", page, search],
    queryFn: () => eventsAPI.getEvents(page, limit, search || undefined),
  });

  const events = data?.data.events || [];
  const total = data?.data.total || 0;
  const totalPages = Math.ceil(total / limit);

  const handleSearch = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Discover Events
              </h2>
              <p className="mt-2 text-lg text-slate-600">
                Find and book amazing events happening around you
              </p>
            </div>
            {user?.isAdmin && (
              <div className="mt-4 md:mt-0 md:ml-4">
                <Button
                  onClick={() => setIsEventFormOpen(true)}
                  className="shadow-sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
              </div>
            )}
          </div>

          {/* Search and Filters */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search events by title or tags..."
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
              </div>
            </div>

            {/* Date Filter */}
            <div>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Dates" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Dates</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="technology">Technology</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="arts">Arts & Culture</SelectItem>
                  <SelectItem value="sports">Sports</SelectItem>
                  <SelectItem value="music">Music</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Events Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <Search className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-4 text-lg font-medium text-slate-900">
                No events found
              </h3>
              <p className="mt-2 text-slate-600">
                {search
                  ? "Try adjusting your search terms"
                  : "No events are currently available"}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            {/* Pagination */}
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={total}
              itemsPerPage={limit}
            />
          </>
        )}

        {/* Event Form Modal */}
        <EventForm
          isOpen={isEventFormOpen}
          onClose={() => setIsEventFormOpen(false)}
        />
      </main>
    </div>
  );
}
