# Event Booking System

A full-stack application for browsing and booking event slots, with real-time availability updates.

## Features

- User authentication (signup/login)
- Event browsing with search and pagination
- Event booking with real-time slot availability
- Admin dashboard for event management
- User dashboard to view bookings
- CSV export for booking data
- Real-time slot availability updates via WebSockets
- Comprehensive Redis caching for improved performance

## Tech Stack

- **Frontend**: React.js with TailwindCSS and Radix UI
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL
- **Caching**: Redis
- **ORM**: Drizzle ORM
- **Authentication**: JWT-based
- **Real-time**: WebSockets

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- PostgreSQL database
- Redis server

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/event-booking-system.git
   cd event-booking-system
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your database and Redis connection details

4. Initialize the database:
   ```
   npm run db:push
   ```

5. Start the development server:
   ```
   npm run dev
   ```

The application will be available at http://localhost:3000

## API Documentation

For detailed API documentation, including:
- Authentication endpoints
- Event management endpoints
- Booking operations
- Admin functionalities
- WebSocket events
- Error handling
- Rate limiting

👉 Please refer to our comprehensive [API Documentation](docs/API.md).

## License

This project is licensed under the [MIT License](LICENSE). See the [LICENSE](LICENSE) file for details.

## Created By

Gaurav Raj
