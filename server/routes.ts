import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  connectRedis,
  getEventSlots,
  setEventSlots,
  decrementEventSlots,
  incrementEventSlots,
  invalidateEventSlots,
  getEventData,
  setEventData,
  invalidateEventData,
  getEventList,
  setEventList,
  invalidateEventLists,
  getAdminStats,
  setAdminStats,
  invalidateAdminStats
} from "./services/redis";
import { hashPassword, comparePassword, generateToken } from "./services/auth";
import { authenticate, requireAdmin } from "./middleware/auth";
import { errorHandler, notFound, createError } from "./middleware/errorHandler";
import crypto from 'crypto';
import { insertUserSchema, insertEventSchema, insertBookingSchema, loginSchema, registerSchema, profileUpdateSchema, insertNotificationSchema } from "@shared/schema";
import { imageProxyHandler } from './imageProxy';
import { publishWebSocketMessage } from './services/redis';
import { broadcastToUser } from './websocket';
import { broadcast, WS_EVENTS } from "./websocket";
import rateLimit from 'express-rate-limit';
import { recordAudit } from './services/audit';

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const server = createServer(app);
  
  // Initialize Redis connection (optional)
  try {
    await connectRedis();
  } catch (error) {
    console.log('Redis connection failed, continuing without Redis caching');
  }

  // Auth routes
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const userData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        throw createError("User already exists", 400);
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

  // Admin: promote a user to admin (must already be admin)
  const promoteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many promotion attempts, try later' }
  });
  app.post('/api/admin/users/:id/promote', authenticate, requireAdmin, promoteLimiter, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      if (!user) {
        throw createError('User not found', 404);
      }
      if (user.isAdmin) {
        return res.json({ success: true, message: 'User is already an admin' });
      }
      await storage.updateUser(userId, { isAdmin: true } as any);
      recordAudit(req.user!.id, 'PROMOTE_USER', 'user', userId, { email: user.email });
      res.json({ success: true, message: 'User promoted to admin' });
    } catch (error) {
      next(error);
    }
  });

  // Admin: demote user (cannot demote self, must retain at least one admin)
  app.post('/api/admin/users/:id/demote', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const userId = parseInt(req.params.id);
      if (userId === req.user!.id) {
        throw createError('You cannot demote yourself', 400);
      }
      const user = await storage.getUser(userId);
      if (!user) throw createError('User not found', 404);
      if (!user.isAdmin) return res.json({ success: true, message: 'User is already not an admin' });
      // Ensure there will remain at least one admin
      const { users: allAdmins } = await storage.paginateUsers({ page: 1, limit: 1000, search: undefined, sortField: 'id', direction: 'asc' });
      const adminCount = allAdmins.filter(u => u.isAdmin).length;
      if (adminCount <= 1) {
        throw createError('Cannot demote the last remaining admin', 400);
      }
      await storage.updateUser(userId, { isAdmin: false } as any);
      recordAudit(req.user!.id, 'DEMOTE_USER', 'user', userId, { email: user.email });
      res.json({ success: true, message: 'User demoted from admin' });
    } catch (error) {
      next(error);
    }
  });

  // Admin: list users
  app.get('/api/admin/users', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const page = Math.max(parseInt(req.query.page as string) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
      const search = (req.query.search as string)?.trim();
      const sort = (req.query.sort as string) || 'createdAt:desc';
      const [sortField, sortDir] = sort.split(':');
      const validSortFields = new Set(['createdAt','email','name','lastLogin','isAdmin']);
      const direction = sortDir === 'asc' ? 'asc' : 'desc';
      const field = validSortFields.has(sortField) ? sortField : 'createdAt';

      const { users, total } = await storage.paginateUsers({ page, limit, search, sortField: field, direction });
      res.json({ success: true, data: { users, total, page, pages: Math.ceil(total / limit) } });
    } catch (error) {
      next(error);
    }
  });

  // Admin: delete user (cannot delete self, cannot delete last admin if target is admin)
  app.delete('/api/admin/users/:id', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const targetId = parseInt(req.params.id);
      if (targetId === req.user!.id) throw createError('You cannot delete your own account', 400);
      const target = await storage.getUser(targetId);
      if (!target) throw createError('User not found', 404);
      if (target.isAdmin) {
        const { users: all } = await storage.paginateUsers({ page:1, limit:1000, sortField:'id', direction:'asc' });
        const adminCount = all.filter(u=>u.isAdmin).length;
        if (adminCount <= 1) throw createError('Cannot delete the last remaining admin', 400);
      }
      const ok = await storage.deleteUser(targetId);
      if (!ok) throw createError('Failed to delete user', 500);
      recordAudit(req.user!.id, 'DELETE_USER', 'user', targetId, { email: target.email });
      res.json({ success:true, message:'User deleted' });
    } catch (error) { next(error); }
  });

  // Profile routes
  app.get('/api/profile', authenticate, async (req, res, next) => {
    try {
      const user = await storage.getUser(req.user!.id);
      if (!user) throw createError('User not found', 404);
      let prefs: any = undefined;
      try { if (user.preferences) prefs = JSON.parse(user.preferences as any); } catch {}
      res.json({ success: true, data: { id:user.id, email:user.email, name:user.name, bio:user.bio, avatarUrl:user.avatarUrl, preferences:prefs, isAdmin:user.isAdmin } });
    } catch (error) { next(error); }
  });

  app.put('/api/profile', authenticate, async (req, res, next) => {
    try {
      const data = profileUpdateSchema.parse(req.body);
      const updated = await storage.updateUserProfile(req.user!.id, {
        ...data,
        preferences: data.preferences ? data.preferences : undefined,
      } as any);
      if (!updated) throw createError('User not found', 404);
      recordAudit(req.user!.id, 'UPDATE_PROFILE', 'user', req.user!.id, { fields: Object.keys(data) });
      let prefs: any = undefined; try { if (updated.preferences) prefs = JSON.parse(updated.preferences as any); } catch {}
      res.json({ success:true, data: { id:updated.id, email:updated.email, name:updated.name, bio:updated.bio, avatarUrl:updated.avatarUrl, preferences:prefs, isAdmin:updated.isAdmin } });
    } catch (error) { next(error); }
  });

  // Notifications
  app.post('/api/admin/notifications', authenticate, requireAdmin, async (req,res,next) => {
    try {
      const payload = insertNotificationSchema.parse(req.body); // single user notification
      const notif = await storage.createNotification(payload);
      recordAudit(req.user!.id, 'CREATE_NOTIFICATION', 'notification', notif.id, { userId: notif.userId, type: notif.type });
      // Broadcast unread count to that user only could be done via targeted WS (simplified broadcast)
      const unread = await storage.unreadCount(notif.userId);
      publishWebSocketMessage({ type: WS_EVENTS as any, payload: {} }); // placeholder to keep pattern
  broadcastToUser(notif.userId, { type: 'NOTIFICATION_COUNT', payload: { unread } });
      res.status(201).json({ success:true, data: notif, meta: { unread } });
    } catch (error) { next(error); }
  });

  app.get('/api/notifications', authenticate, async (req,res,next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const { notifications, total } = await storage.listNotifications(req.user!.id, page, limit);
      res.json({ success:true, data: { notifications, total, page, pages: Math.ceil(total/limit) } });
    } catch (error) { next(error); }
  });

  app.post('/api/notifications/:id/read', authenticate, async (req,res,next) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.markNotificationRead(req.user!.id, id);
      if (!ok) throw createError('Notification not found', 404);
      const unread = await storage.unreadCount(req.user!.id);
  broadcastToUser(req.user!.id, { type: 'NOTIFICATION_COUNT', payload: { unread } });
      res.json({ success:true, data:{ unread } });
    } catch (error) { next(error); }
  });

  app.post('/api/notifications/read-all', authenticate, async (req,res,next) => {
    try {
      const count = await storage.markAllNotificationsRead(req.user!.id);
      const unread = await storage.unreadCount(req.user!.id);
  broadcastToUser(req.user!.id, { type: 'NOTIFICATION_COUNT', payload: { unread } });
      res.json({ success:true, data:{ updated: count, unread } });
    } catch (error) { next(error); }
  });

  // Image proxy endpoint
  app.get('/api/image-proxy', imageProxyHandler);

  // Audit logs listing (admin)
  app.get('/api/admin/audit-logs', authenticate, requireAdmin, async (req,res,next) => {
    try {
      // Simple direct query to db via storage.db not exposed; implement lightweight query here
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = (page-1)*limit;
      const action = (req.query.action as string)?.trim();
      const actorId = req.query.actorId ? parseInt(req.query.actorId as string) : undefined;
      const targetType = (req.query.targetType as string)?.trim();
      const start = req.query.start ? new Date(req.query.start as string) : undefined;
      const end = req.query.end ? new Date(req.query.end as string) : undefined;
      // Dynamic where building using sql
      const filters: any[] = [];
      const { db } = await import('./db');
      const { auditLogs } = await import('@shared/schema');
      const { and, sql, eq, gte, lte } = await import('drizzle-orm');
      if (action) filters.push(eq(auditLogs.action, action));
      if (actorId) filters.push(eq(auditLogs.actorId, actorId));
      if (targetType) filters.push(eq(auditLogs.targetType, targetType));
      if (start) filters.push(sql`${auditLogs.createdAt} >= ${start}`);
      if (end) filters.push(sql`${auditLogs.createdAt} <= ${end}`);
      const where = filters.length ? and(...filters) : sql`1=1`;
      const rows = await db.select().from(auditLogs).where(where).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit).offset(offset);
      const [countRow] = await db.select({ count: sql<number>`count(*)` }).from(auditLogs).where(where);
      res.json({ success:true, data:{ logs: rows, total: Number(countRow.count), page, pages: Math.ceil(Number(countRow.count)/limit) } });
    } catch (error) { next(error); }
  });

  app.post("/api/auth/login", async (req, res, next) => {
    try {
      const { email, password } = loginSchema.parse(req.body);
      
      // If we can't connect to the database, use a mock user for testing
      // This allows the application to function without a database during development
      if (process.env.MOCK_DB === 'true' || process.env.NODE_ENV === 'development') {
        // Check if the email/password matches our test credentials
        if (email === 'test@example.com' && password === 'password') {
          const mockUser = {
            id: 1,
            email: 'test@example.com',
            name: 'Test User',
            isAdmin: true,
            // extra fields for typing completeness
            password: '',
            createdAt: new Date(),
            lastLogin: new Date(),
            bio: null as string | null,
            avatarUrl: null as string | null,
            preferences: null as string | null,
          };

          const token = generateToken(mockUser as any);
          
          return res.json({
            success: true,
            data: {
              user: mockUser,
              token,
            },
          });
        }
      }
      
      // Real database lookup
      try {
        const user = await storage.getUserByEmail(email);
        if (!user) {
          throw createError("Invalid credentials", 401);
        }

        // Check password
        const isPasswordValid = await comparePassword(password, user.password);
        if (!isPasswordValid) {
          throw createError("Invalid credentials", 401);
        }

        // Generate token
  const token = generateToken(user);

  // Update lastLogin (best effort)
  try { await storage.updateUser(user.id, { lastLogin: new Date() } as any); } catch {}

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
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/auth/me", authenticate, async (req, res, next) => {
    try {
      // If we're using mock DB, return the mock user
      if (process.env.MOCK_DB === 'true' || process.env.NODE_ENV === 'development') {
        // Check if the user ID is our test user
        if (req.user && req.user.id === 1) {
          return res.json({
            success: true,
            data: {
              id: 1,
              email: 'test@example.com',
              name: 'Test User',
              isAdmin: true,
            },
          });
        }
      }
      
      // Real database lookup
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
      const cachedEventList = await getEventList(page, limit, search);
      const finalResult = cachedEventList || result;

      // Update slot counts from per-event cache
      for (const event of finalResult.events) {
        const cachedSlots = await getEventSlots(event.id);
        if (cachedSlots === null) await setEventSlots(event.id, event.availableSlots); else event.availableSlots = cachedSlots;
      }

      if (!cachedEventList) await setEventList(page, limit, search, finalResult);

      const etagBase = finalResult.events
        .map((e: any) => `${e.id}:${new Date(e.updatedAt).getTime()}:${e.availableSlots}`)
        .join('|') + `|total:${finalResult.total}`;
      const etag = 'W/"' + crypto.createHash('sha1').update(etagBase).digest('hex') + '"';
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === etag) {
        res.status(304).setHeader('ETag', etag).end();
        return;
      }
      res.setHeader('ETag', etag);
      res.json({ success: true, data: finalResult });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/events/:id", async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      
      // Try to get from cache first
      const cachedEventData = await getEventData(eventId);
      if (cachedEventData) {
        // Still update the slots from cache if available
        const cachedSlots = await getEventSlots(eventId);
        if (cachedSlots !== null) {
          cachedEventData.availableSlots = cachedSlots;
        }
        
        return res.json({
          success: true,
          data: cachedEventData,
        });
      }
      
      // If not in cache, get from database
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
      
      // Cache the event data
      await setEventData(eventId, event);

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
      let dateValue = req.body.date;
      if (typeof dateValue === 'string') {
        dateValue = new Date(dateValue);
      }
      if (!(dateValue instanceof Date) || isNaN(dateValue.getTime())) {
        throw createError('Invalid date format', 400);
      }
      const eventData = insertEventSchema.parse({
        ...req.body,
        date: dateValue,
        createdBy: req.user!.id,
      });
  const event = await storage.createEvent(eventData);
  recordAudit(req.user!.id, 'CREATE_EVENT', 'event', event.id, { title: event.title });

      // Initialize cache
      await setEventSlots(event.id, event.availableSlots);
      await setEventData(event.id, event);
      
      // Invalidate event lists since a new event was added
      await invalidateEventLists();
      
      // Invalidate admin stats
      await invalidateAdminStats();

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
      let payload: any = { ...req.body };
      if (payload.date) {
        let d = payload.date;
        if (typeof d === 'string') d = new Date(d);
        if (!(d instanceof Date) || isNaN(d.getTime())) {
          throw createError('Invalid date format', 400);
        }
        payload.date = d;
      }
      const eventData = insertEventSchema.partial().parse(payload);

      const event = await storage.updateEvent(eventId, eventData);
      if (!event) {
        throw createError("Event not found", 404);
      }

      // Update cache if slots changed
      if (eventData.totalSlots !== undefined) {
        await invalidateEventSlots(eventId);
        await setEventSlots(eventId, event.availableSlots);
      }
      
      // Invalidate cached event data
      await invalidateEventData(eventId);
      await setEventData(eventId, event);
      
      // Invalidate event lists
      await invalidateEventLists();
      
      // Invalidate admin stats
      await invalidateAdminStats();

      recordAudit(req.user!.id, 'UPDATE_EVENT', 'event', event.id, { fields: Object.keys(eventData) });
      res.json({
        success: true,
        data: event,
      });
    } catch (error) {
      next(error);
    }
  });

  // Partial update (PATCH) for events (admin only)
  app.patch('/api/events/:id', authenticate, requireAdmin, async (req, res, next) => {
    try {
      const eventId = parseInt(req.params.id);
      const payload: any = { ...req.body };
      if (payload.date) {
        let d = payload.date;
        if (typeof d === 'string') d = new Date(d);
        if (!(d instanceof Date) || isNaN(d.getTime())) {
          throw createError('Invalid date format', 400);
        }
        payload.date = d;
      }
      // Use schema partial for validation (strip unknowns)
      const validated = insertEventSchema.partial().parse(payload);
      const updated = await storage.updateEvent(eventId, validated);
      if (!updated) throw createError('Event not found', 404);

      // Cache invalidations similar to PUT path
      if (validated.totalSlots !== undefined) {
        await invalidateEventSlots(eventId);
        await setEventSlots(eventId, updated.availableSlots);
      }
      await invalidateEventData(eventId);
      await setEventData(eventId, updated);
      await invalidateEventLists();
      await invalidateAdminStats();

      // Broadcast event update (slots or metadata)
      broadcast({
        type: WS_EVENTS.EVENT_UPDATED,
        payload: { eventId, fields: Object.keys(validated) }
      });

  recordAudit(req.user!.id, 'PATCH_EVENT', 'event', updated.id, { fields: Object.keys(validated) });
  res.json({ success: true, data: updated });
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

      // Clear caches
      await invalidateEventSlots(eventId);
      await invalidateEventData(eventId);
      await invalidateEventLists();
      await invalidateAdminStats();

      recordAudit(req.user!.id, 'DELETE_EVENT', 'event', eventId, {});
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

        // Invalidate event data cache but keep the updated slots
        await invalidateEventData(eventId);
        
        // Invalidate event lists
        await invalidateEventLists();
        
        // Invalidate admin stats
        await invalidateAdminStats();

        // Broadcast slot update via WebSocket
        broadcast({
          type: WS_EVENTS.SLOT_UPDATE,
          payload: {
            eventId,
            availableSlots: newSlots,
          },
        });

        // Broadcast booking created event
        broadcast({
          type: WS_EVENTS.BOOKING_CREATED,
          payload: {
            eventId,
            userId,
            bookingId: booking.id,
          },
        });

        recordAudit(req.user!.id, 'BOOK_EVENT', 'event', eventId, {});
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
            const cachedSlots = await getEventSlots(eventId);
            if (cachedSlots !== null) {
              await storage.updateEventSlots(eventId, cachedSlots);
            }
          }
          
          // Invalidate caches
          await invalidateEventData(eventId);
          await invalidateEventLists();
          await invalidateAdminStats();
    
          // Broadcast slot update via WebSocket
          const newSlots = await getEventSlots(eventId);
          broadcast({
            type: WS_EVENTS.SLOT_UPDATE,
            payload: {
              eventId,
              availableSlots: newSlots,
            },
          });
    
          recordAudit(req.user!.id, 'CANCEL_BOOKING', 'event', eventId, {});
          res.json({
            success: true,
            message: "Booking cancelled successfully",
          });
        } catch (error) {
          next(error);
        }
      });
    
      // Health check or root route
      app.get('/', (req, res) => {
        res.send('Event Booking System API is running.');
      });

      // (Removed local notFound/errorHandler registration; global handlers are attached in server/index.ts)
      
      return server;
    }