import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import { connectRedis } from "./services/redis";
import { hashPassword, comparePassword, generateToken } from "./services/auth";
import { authenticate, requireAdmin } from "./middleware/auth";
import { errorHandler, notFound, createError } from "./middleware/errorHandler";
import { insertUserSchema, insertEventSchema, loginSchema, registerSchema } from "@shared/schema";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize Redis (optional)
connectRedis().catch(() => console.log('Redis not available, using database fallback'));

// Auth routes
app.post("/api/auth/register", async (req, res, next) => {
  try {
    const userData = registerSchema.parse(req.body);
    
    const existingUser = await storage.getUserByEmail(userData.email);
    if (existingUser) {
      throw createError("User already exists with this email", 400);
    }

    const hashedPassword = await hashPassword(userData.password);
    
    const user = await storage.createUser({
      ...userData,
      password: hashedPassword,
    });

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
    
    const user = await storage.getUserByEmail(email);
    if (!user) {
      throw createError("Invalid email or password", 401);
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      throw createError("Invalid email or password", 401);
    }

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

// Events routes
app.get("/api/events", async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 6;
    const search = req.query.search as string;

    const result = await storage.getEvents(page, limit, search);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Error handling
app.use(notFound);
app.use(errorHandler);

const port = 5000;
const server = createServer(app);

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running on port ${port}`);
});