import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface BookingWithDetails {
  id: string | number;
  user: {
    name: string;
    email: string;
  };
  status: string;
  createdAt: string;
}

interface AttendeeListProps {
  isOpen: boolean;
  onClose: () => void;
  attendees: BookingWithDetails[];
  eventTitle: string;
}

export default function AttendeeList({
  isOpen,
  onClose,
  attendees,
  eventTitle,
}: AttendeeListProps) {
  const [search, setSearch] = useState("");

  const filteredAttendees = attendees.filter(
    (attendee) =>
      attendee.user.name.toLowerCase().includes(search.toLowerCase()) ||
      attendee.user.email.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Attendees - {eventTitle}</DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="relative mb-4">
          <Input
            placeholder="Search attendees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
          <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
        </div>

        {/* Attendees Table */}
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Booked On</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAttendees.map((attendee) => (
                <TableRow key={attendee.id}>
                  <TableCell className="font-medium">{attendee.user.name}</TableCell>
                  <TableCell>{attendee.user.email}</TableCell>
                  <TableCell>
                    <span className="capitalize px-2 py-1 text-sm rounded-full bg-emerald-100 text-emerald-700">
                      {attendee.status}
                    </span>
                  </TableCell>
                  <TableCell>{formatDate(attendee.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filteredAttendees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                    No attendees found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
