import { users, events, bookings, type User, type Event, type Booking, type InsertUser, type InsertEvent, type InsertBooking, type EventWithBookings, type BookingWithDetails } from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, like, sql, count } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  listUsers(): Promise<User[]>;

  // Event operations
  getEvents(page: number, limit: number, search?: string, userId?: number): Promise<{ events: EventWithBookings[], total: number }>;
  getEvent(id: number): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: number, event: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: number): Promise<boolean>;
  updateEventSlots(eventId: number, newAvailableSlots: number): Promise<boolean>;

  // Booking operations
  createBooking(booking: InsertBooking): Promise<Booking>;
  getUserBookings(userId: number): Promise<BookingWithDetails[]>;
  getEventBookings(eventId: number): Promise<BookingWithDetails[]>;
  getBooking(userId: number, eventId: number): Promise<Booking | undefined>;
  deleteBooking(userId: number, eventId: number): Promise<boolean>;

  // Admin operations
  getAdminStats(): Promise<{
    totalEvents: number;
    totalBookings: number;
    thisMonth: number;
    occupancyRate: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user || undefined;
    } catch (error) {
      console.error('Database error in getUser:', error);
      throw new Error(`Failed to get user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user || undefined;
    } catch (error) {
      console.error('Database error in getUserByEmail:', error);
      throw new Error(`Failed to get user by email: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    try {
      const [user] = await db
        .insert(users)
        .values(insertUser)
        .returning();
      return user;
    } catch (error) {
      console.error('Database error in createUser:', error);
      throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listUsers(): Promise<User[]> {
    try {
      const result = await db.select().from(users);
      return result;
    } catch (error) {
      console.error('Database error in listUsers:', error);
      throw new Error('Failed to list users');
    }
  }

  async getEvents(page: number, limit: number, search?: string, userId?: number): Promise<{ events: EventWithBookings[], total: number }> {
    const offset = (page - 1) * limit;
    
    let whereClause = sql`1 = 1`;
    
    if (search) {
      const searchClause = or(
        like(events.title, `%${search}%`),
        sql`${events.tags} && ${[search]}`
      );
      whereClause = searchClause || sql`1 = 1`;
    }

    // Get events with booking counts
    const eventsQuery = db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        location: events.location,
        date: events.date,
        totalSlots: events.totalSlots,
        availableSlots: events.availableSlots,
        image: events.image,
        tags: events.tags,
        createdBy: events.createdBy,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
        bookingCount: sql<number>`COALESCE(${count(bookings.id)}, 0)`,
        isBooked: userId ? sql<boolean>`CASE WHEN ${bookings.userId} = ${userId} THEN true ELSE false END` : sql<boolean>`false`,
      })
      .from(events)
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(whereClause)
      .groupBy(events.id, bookings.userId)
      .orderBy(desc(events.date))
      .limit(limit)
      .offset(offset);

    const totalQuery = db
      .select({ count: sql<number>`count(*)` })
      .from(events)
      .where(whereClause);

    const [eventsResult, totalResult] = await Promise.all([
      eventsQuery,
      totalQuery
    ]);

    return {
      events: eventsResult.map((event: any) => ({
        ...event,
        bookingCount: Number(event.bookingCount),
        isBooked: Boolean(event.isBooked),
      })),
      total: Number(totalResult[0].count)
    };
  }

  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event || undefined;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const eventData = {
      ...insertEvent,
      availableSlots: insertEvent.totalSlots,
    };
    
    const [event] = await db
      .insert(events)
      .values(eventData)
      .returning();
    return event;
  }

  async updateEvent(id: number, insertEvent: Partial<InsertEvent>): Promise<Event | undefined> {
    const [event] = await db
      .update(events)
      .set({ ...insertEvent, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return event || undefined;
  }

  async deleteEvent(id: number): Promise<boolean> {
    const result = await db.delete(events).where(eq(events.id, id));
    return (result.rowCount || 0) > 0;
  }

  async updateEventSlots(eventId: number, newAvailableSlots: number): Promise<boolean> {
    const result = await db
      .update(events)
      .set({ 
        availableSlots: newAvailableSlots,
        updatedAt: new Date()
      })
      .where(eq(events.id, eventId));
    return (result.rowCount || 0) > 0;
  }

  async createBooking(insertBooking: InsertBooking): Promise<Booking> {
    const [booking] = await db
      .insert(bookings)
      .values(insertBooking)
      .returning();
    return booking;
  }

  async getUserBookings(userId: number): Promise<BookingWithDetails[]> {
    const result = await db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        eventId: bookings.eventId,
        status: bookings.status,
        createdAt: bookings.createdAt,
        event: {
          id: events.id,
          title: events.title,
          description: events.description,
          location: events.location,
          date: events.date,
          totalSlots: events.totalSlots,
          availableSlots: events.availableSlots,
          image: events.image,
          tags: events.tags,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        },
        user: {
          id: users.id,
          email: users.email,
          password: users.password,
          name: users.name,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
        },
      })
      .from(bookings)
      .innerJoin(events, eq(bookings.eventId, events.id))
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(events.date));

    return result.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      eventId: row.eventId,
      status: row.status,
      createdAt: row.createdAt,
      event: row.event,
      user: row.user,
    }));
  }

  async getEventBookings(eventId: number): Promise<BookingWithDetails[]> {
    const result = await db
      .select({
        id: bookings.id,
        userId: bookings.userId,
        eventId: bookings.eventId,
        status: bookings.status,
        createdAt: bookings.createdAt,
        event: {
          id: events.id,
          title: events.title,
          description: events.description,
          location: events.location,
          date: events.date,
          totalSlots: events.totalSlots,
          availableSlots: events.availableSlots,
          image: events.image,
          tags: events.tags,
          createdBy: events.createdBy,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
        },
        user: {
          id: users.id,
          email: users.email,
          password: users.password,
          name: users.name,
          isAdmin: users.isAdmin,
          createdAt: users.createdAt,
        },
      })
      .from(bookings)
      .innerJoin(events, eq(bookings.eventId, events.id))
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.eventId, eventId))
      .orderBy(desc(bookings.createdAt));

    return result.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      eventId: row.eventId,
      status: row.status,
      createdAt: row.createdAt,
      event: row.event,
      user: row.user,
    }));
  }

  async getBooking(userId: number, eventId: number): Promise<Booking | undefined> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.userId, userId), eq(bookings.eventId, eventId)));
    return booking || undefined;
  }

  async deleteBooking(userId: number, eventId: number): Promise<boolean> {
    const result = await db
      .delete(bookings)
      .where(and(eq(bookings.userId, userId), eq(bookings.eventId, eventId)));
    return (result.rowCount || 0) > 0;
  }

  async getAdminStats(): Promise<{
    totalEvents: number;
    totalBookings: number;
    thisMonth: number;
    occupancyRate: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalEventsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(events);

    const [totalBookingsResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings);

    const [thisMonthResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bookings)
      .where(sql`${bookings.createdAt} >= ${startOfMonth}`);

    const [occupancyResult] = await db
      .select({
        totalSlots: sql<number>`sum(${events.totalSlots})`,
        bookedSlots: sql<number>`sum(${events.totalSlots} - ${events.availableSlots})`,
      })
      .from(events);

    const occupancyRate = occupancyResult.totalSlots > 0 
      ? Math.round((occupancyResult.bookedSlots / occupancyResult.totalSlots) * 100)
      : 0;

    return {
      totalEvents: Number(totalEventsResult.count),
      totalBookings: Number(totalBookingsResult.count),
      thisMonth: Number(thisMonthResult.count),
      occupancyRate,
    };
  }

  async updateUser(id: number, updates: Partial<User>): Promise<void> {
    await db.update(users).set(updates).where(eq(users.id, id));
  }
}

export const storage = new DatabaseStorage();
