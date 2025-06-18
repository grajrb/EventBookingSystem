# EventHub - Event Booking System

## Overview

EventHub is a full-stack event booking system built with a modern React frontend and Express.js backend. The application allows users to discover, book, and manage events with real-time slot tracking. It features a role-based system with regular users and administrators, complete authentication, and a comprehensive event management system.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: TailwindCSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and bundling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Caching**: Redis for event slot management
- **Authentication**: JWT tokens with bcrypt password hashing
- **Deployment**: Single-server setup with built-in static file serving

## Key Components

### Database Schema (Drizzle ORM)
- **Users Table**: Stores user information with role-based access (admin/regular)
- **Events Table**: Event details including slots, location, and metadata
- **Bookings Table**: Junction table linking users to events with booking status

### Authentication System
- JWT-based authentication with secure token generation
- Password hashing using bcryptjs with configurable salt rounds
- Role-based authorization middleware for admin access
- Protected routes on both frontend and backend

### Event Management
- Full CRUD operations for events (admin only for create/update/delete)
- Real-time slot tracking with Redis caching
- Search functionality across event titles and descriptions
- Pagination for large event datasets
- Tag-based categorization system

### Booking System
- One booking per user per event constraint
- Real-time availability checking
- Automatic slot decrementing on booking
- Booking cancellation with slot restoration

## Data Flow

1. **User Authentication**: Login/register → JWT token → stored in localStorage
2. **Event Discovery**: Home page → paginated event list → search/filter capabilities
3. **Booking Process**: Event selection → availability check → booking creation → slot update
4. **Admin Management**: Admin dashboard → event CRUD operations → user management

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for Neon database
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router
- **shadcn/ui**: Comprehensive UI component library built on Radix UI

### Development Tools
- **Vite**: Fast development server and build tool
- **TypeScript**: Type safety across the entire stack
- **TailwindCSS**: Utility-first CSS framework
- **Zod**: Runtime type validation for forms and API

### Backend Services
- **Redis**: Event slot caching and session management
- **bcryptjs**: Password hashing
- **jsonwebtoken**: JWT token management

## Deployment Strategy

### Development Environment
- Vite dev server for frontend with HMR
- Express server with middleware for API routes
- PostgreSQL database connection via environment variables
- Redis connection for caching layer

### Production Build
- Vite builds frontend to `dist/public`
- esbuild bundles server code to `dist/index.js`
- Single server serves both static files and API routes
- Environment-based configuration for database and Redis connections

### Configuration
- Environment variables for database URL, JWT secrets, and Redis connection
- Drizzle configuration for database migrations
- TypeScript path mapping for clean imports
- Tailwind configuration for consistent theming

## Changelog

Changelog:
- June 18, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.