import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { eventsAPI } from "../lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Event } from "../types";

const eventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(1, "Location is required"),
  date: z.string().min(1, "Date and time is required"),
  totalSlots: z.number().min(1, "Must have at least 1 slot"),
  tags: z.string(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface EventFormProps {
  isOpen: boolean;
  onClose: () => void;
  event?: Event;
}

export default function EventForm({ isOpen, onClose, event }: EventFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!event;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: event
      ? {
          title: event.title,
          description: event.description,
          location: event.location,
          date: new Date(event.date).toISOString().slice(0, 16),
          totalSlots: event.totalSlots,
          tags: event.tags ? event.tags.join(", ") : "",
        }
      : {
          title: "",
          description: "",
          location: "",
          date: "",
          totalSlots: 1,
          tags: "",
        },
  });

  useEffect(() => {
    if (isOpen) {
      if (event) {
        reset({
          title: event.title,
          description: event.description,
          location: event.location,
          date: new Date(event.date).toISOString().slice(0, 16),
          totalSlots: event.totalSlots,
          tags: event.tags ? event.tags.join(", ") : "",
        });
      } else {
        reset({
          title: "",
          description: "",
          location: "",
          date: "",
          totalSlots: 1,
          tags: "",
        });
      }
    }
  }, [event, isOpen, reset]);

  const createMutation = useMutation({
    mutationFn: eventsAPI.createEvent,
    onSuccess: () => {
      toast({
        title: "Event Created",
        description: "Event has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      reset();
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => eventsAPI.updateEvent(event!.id, data),
    onSuccess: () => {
      toast({
        title: "Event Updated",
        description: "Event has been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    const eventData = {
      ...data,
      date: new Date(data.date).toISOString(),
      tags: data.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
    };

    if (isEditing && event) {
      updateMutation.mutate(eventData);
    } else {
      createMutation.mutate(eventData);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Event" : "Create New Event"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                {...register("title")}
                placeholder="Enter event title"
              />
              {errors.title && (
                <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                {...register("location")}
                placeholder="Enter location"
              />
              {errors.location && (
                <p className="text-sm text-red-600 mt-1">{errors.location.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={3}
              {...register("description")}
              placeholder="Describe your event"
            />
            {errors.description && (
              <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="date">Date & Time</Label>
              <Input
                id="date"
                type="datetime-local"
                {...register("date")}
              />
              {errors.date && (
                <p className="text-sm text-red-600 mt-1">{errors.date.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="totalSlots">Total Slots</Label>
              <Input
                id="totalSlots"
                type="number"
                min="1"
                {...register("totalSlots", { valueAsNumber: true })}
                placeholder="Number of available slots"
              />
              {errors.totalSlots && (
                <p className="text-sm text-red-600 mt-1">{errors.totalSlots.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              {...register("tags")}
              placeholder="Enter tags separated by commas (e.g., Technology, Networking)"
            />
            {errors.tags && (
              <p className="text-sm text-red-600 mt-1">{errors.tags.message}</p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-4 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending 
                ? (isEditing ? "Updating..." : "Creating...") 
                : (isEditing ? "Update Event" : "Create Event")
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
