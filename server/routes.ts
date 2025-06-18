import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { connectRedis, getEventSlots, setEventSlots, decrementEventSlots, incrementEventSlots, invalidateEventSlots } from "./services/redis";
import { hashPassword, comparePassword, generateToken } from "./services/auth";
import { authenticate, requireAdmin } from "./middleware/auth";
import { errorHandler, notFound, createError } from "./middleware/errorHandler";
import { insertUserSchema, insertEventSchema, insertBookingSchema, loginSchema, registerSchema } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Redis connection
  await connectRedis();

  // Auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        throw createError("User already exists with this email", 400);
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
      });

      // Generate token
      const token = generateToken(user);

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin,
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(email);
      if (!user) {
        throw createError("Invalid email or password", 401);
      }

      // Check password
      const isPasswordValid = await comparePassword(password, user.password);
      if (!isPasswordValid) {
        throw createError("Invalid email or password", 401);
      }

      // Generate token
      const token = generateToken(user);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin,
          },
          token,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", authenticate, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) {
        throw createError("User not found", 404);
      }

      res.json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          name: user.name,
          isAdmin: user.isAdmin,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // Event routes
  app.get("/api/events", async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 6;
      const search = req.query.search as string;
      const userId = req.user?.id;

      const result = await storage.getEvents(page, limit, search, userId);

      // Update cache for each event
      for (const event of result.events) {
        const cachedSlots = await getEventSlots(event.id);
        if (cachedSlots === null) {
          await setEventSlots(event.id, event.availableSlots);
        }
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/events/:id", async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        throw createError("Event not found", 404);
      }

      // Get cached slots or use database value
      const cachedSlots = await getEventSlots(eventId);
      if (cachedSlots !== null) {
        event.availableSlots = cachedSlots;
      } else {
        await setEventSlots(eventId, event.availableSlots);
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/events", authenticate, requireAdmin, async (req, res, next) => {
    try {
      const eventData = insertEventSchema.parse(req.body);
      
      const event = await storage.createEvent({
        ...eventData,
        createdBy: req.user!.id,
      });

      // Initialize cache
      await setEventSlots(event.id, event.availableSlots);

      res.status(201).json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/events/:id", authenticate, requireAdmin, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const eventData = insertEventSchema.partial().parse(req.body);

      const event = await storage.updateEvent(eventId, eventData);
      if (!event) {
        throw createError("Event not found", 404);
      }

      // Update cache if slots changed
      if (eventData.totalSlots !== undefined) {
        await invalidateEventSlots(eventId);
        await setEventSlots(eventId, event.availableSlots);
      }

      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/events/:id", authenticate, requireAdmin, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      
      const deleted = await storage.deleteEvent(eventId);
      if (!deleted) {
        throw createError("Event not found", 404);
      }

      // Clear cache
      await invalidateEventSlots(eventId);

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  });

  // Booking routes
  app.post("/api/events/:id/book", authenticate, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        throw createError("Event not found", 404);
      }

      // Check if user already booked
      const existingBooking = await storage.getBooking(userId, eventId);
      if (existingBooking) {
        throw createError("You have already booked this event", 400);
      }

      // Use Redis for optimistic concurrency control
      const cachedSlots = await getEventSlots(eventId);
      const currentSlots = cachedSlots !== null ? cachedSlots : event.availableSlots;

      if (currentSlots <= 0) {
        throw createError("Event is fully booked", 400);
      }

      // Decrement slots atomically
      const newSlots = await decrementEventSlots(eventId);
      if (newSlots === null || newSlots < 0) {
        // Restore slot if decrement failed
        await incrementEventSlots(eventId);
        throw createError("Failed to book event, please try again", 500);
      }

      try {
        // Create booking
        const booking = await storage.createBooking({
          userId,
          eventId,
        });

        // Update database
        await storage.updateEventSlots(eventId, newSlots);

        res.status(201).json({
          success: true,
          data: booking,
          message: "Event booked successfully",
        });
      } catch (error) {
        // Restore slot on booking failure
        await incrementEventSlots(eventId);
        throw error;
      }
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/events/:id/book", authenticate, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const userId = req.user!.id;

      // Check if booking exists
      const booking = await storage.getBooking(userId, eventId);
      if (!booking) {
        throw createError("Booking not found", 404);
      }

      // Delete booking
      const deleted = await storage.deleteBooking(userId, eventId);
      if (!deleted) {
        throw createError("Failed to cancel booking", 500);
      }

      // Increment available slots
      await incrementEventSlots(eventId);
      
      // Update database
      const event = await storage.getEvent(eventId);
      if (event) {
        await storage.updateEventSlots(eventId, event.availableSlots + 1);
      }

      res.json({
        success: true,
        message: "Booking cancelled successfully",
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/bookings/my", authenticate, async (req, res, next) => {
    try {
      const userId = req.user!.id;
      const bookings = await storage.getUserBookings(userId);

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/events/:id/bookings", authenticate, requireAdmin, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const bookings = await storage.getEventBookings(eventId);

      res.json({
        success: true,
        data: bookings,
      });
    } catch (error) {
      next(error);
    }
  });

  // Admin routes
  app.get("/api/admin/stats", authenticate, requireAdmin, async (req, res, next) => {
    try {
      const stats = await storage.getAdminStats();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  });

  // Error handling middleware
  app.use(notFound);
  app.use(errorHandler);

  const httpServer = createServer(app);
  return httpServer;
}
