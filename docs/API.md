# Event Booking System API Documentation

## Quick Start

To quickly get started with the API, you can import our [Postman Collection](api/postman_collection.json) into Postman:

1. Open Postman
2. Click "Import" button
3. Select the `postman_collection.json` file from the `docs/api` folder
4. Set up environment variables:
   - `baseUrl`: `http://localhost:3000` (for local development)
   - `authToken`: Your JWT token (obtained after login)

## Base URL

The base URL for all API endpoints is: `http://localhost:3000/api`

## Authentication

The API uses JWT (JSON Web Token) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

You can obtain a token through the login or register endpoints.

## Error Handling

All endpoints follow a consistent error response format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Too Many Requests
- `500`: Internal Server Error

## Rate Limiting

API requests are rate-limited to prevent abuse. Current limits:
- 100 requests per minute for authenticated users
- 30 requests per minute for unauthenticated users

## Endpoints

### Authentication

#### Register a New User
`POST /auth/register`

Create a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User Name",
      "isAdmin": false
    },
    "token": "jwt_token_here"
  }
}
```

#### Login
`POST /auth/login`

Authenticate a user and receive a JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "name": "User Name",
      "isAdmin": false
    },
    "token": "jwt_token_here"
  }
}
```

### Events

#### List Events
`GET /events`

Get a paginated list of events with optional search.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 6)
- `search` (optional): Search term for title or tags

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": 1,
        "title": "Event Title",
        "description": "Event description",
        "location": "Event location",
        "date": "2025-07-01T18:00:00.000Z",
        "totalSlots": 100,
        "availableSlots": 50,
        "image": "image_url",
        "tags": ["Technology", "Workshop"],
        "createdBy": 1,
        "createdAt": "2025-06-18T12:00:00.000Z",
        "updatedAt": "2025-06-18T12:00:00.000Z",
        "bookingCount": 50,
        "isBooked": false
      }
    ],
    "total": 10
  }
}
```

#### Get Single Event
`GET /events/:id`

Get detailed information about a specific event.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Event Title",
    "description": "Event description",
    "location": "Event location",
    "date": "2025-07-01T18:00:00.000Z",
    "totalSlots": 100,
    "availableSlots": 50,
    "image": "image_url",
    "tags": ["Technology", "Workshop"],
    "createdBy": 1,
    "createdAt": "2025-06-18T12:00:00.000Z",
    "updatedAt": "2025-06-18T12:00:00.000Z"
  }
}
```

#### Create Event
`POST /events`

Create a new event (requires admin privileges).

**Request Body:**
```json
{
  "title": "New Event",
  "description": "Event description",
  "location": "Event location",
  "date": "2025-07-01T18:00:00.000Z",
  "totalSlots": 100,
  "image": "image_url",
  "tags": ["Technology", "Workshop"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "New Event",
    "description": "Event description",
    "location": "Event location",
    "date": "2025-07-01T18:00:00.000Z",
    "totalSlots": 100,
    "availableSlots": 100,
    "image": "image_url",
    "tags": ["Technology", "Workshop"],
    "createdBy": 1,
    "createdAt": "2025-06-18T12:00:00.000Z",
    "updatedAt": "2025-06-18T12:00:00.000Z"
  }
}
```

#### Update Event
`PUT /events/:id`

Update an existing event (requires admin privileges).

**Request Body:**
```json
{
  "title": "Updated Event",
  "totalSlots": 150
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Updated Event",
    "description": "Event description",
    "location": "Event location",
    "date": "2025-07-01T18:00:00.000Z",
    "totalSlots": 150,
    "availableSlots": 100,
    "image": "image_url",
    "tags": ["Technology", "Workshop"],
    "createdBy": 1,
    "createdAt": "2025-06-18T12:00:00.000Z",
    "updatedAt": "2025-06-18T13:00:00.000Z"
  }
}
```

#### Delete Event
`DELETE /events/:id`

Delete an event (requires admin privileges).

**Response:**
```json
{
  "success": true,
  "message": "Event deleted successfully"
}
```

### Bookings

#### Book an Event
`POST /events/:id/book`

Create a booking for an event.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "userId": 1,
    "eventId": 1,
    "status": "confirmed",
    "createdAt": "2025-06-18T12:00:00.000Z"
  },
  "message": "Event booked successfully"
}
```

#### Cancel Booking
`DELETE /events/:id/book`

Cancel an existing booking.

**Response:**
```json
{
  "success": true,
  "message": "Booking cancelled successfully"
}
```

#### List User's Bookings
`GET /bookings/my`

Get all bookings for the authenticated user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "eventId": 1,
      "status": "confirmed",
      "createdAt": "2025-06-18T12:00:00.000Z",
      "event": {
        "id": 1,
        "title": "Event Title",
        "description": "Event description",
        "location": "Event location",
        "date": "2025-07-01T18:00:00.000Z",
        "totalSlots": 100,
        "availableSlots": 49,
        "image": "image_url",
        "tags": ["Technology", "Workshop"]
      },
      "user": {
        "id": 1,
        "email": "user@example.com",
        "name": "User Name"
      }
    }
  ]
}
```

### Admin

#### Get Admin Statistics
`GET /admin/stats`

Get system-wide statistics (requires admin privileges).

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 10,
    "totalBookings": 150,
    "thisMonth": 25,
    "occupancyRate": 60
  }
}
```

#### List Event Bookings
`GET /events/:id/bookings`

Get all bookings for a specific event (requires admin privileges).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "userId": 1,
      "eventId": 1,
      "status": "confirmed",
      "createdAt": "2025-06-18T12:00:00.000Z",
      "user": {
        "id": 1,
        "email": "user@example.com",
        "name": "User Name"
      }
    }
  ]
}
```

## Real-time Updates

### WebSocket Connection

Connect to `ws://localhost:3000` to receive real-time updates.

### Event Types

| Event Type | Description | Payload |
|------------|-------------|---------|
| `SLOT_UPDATE` | Sent when an event's available slots change | `{ eventId: number, availableSlots: number }` |
| `BOOKING_CREATED` | Sent when a new booking is created | `{ eventId: number, userId: number, bookingId: number }` |
| `BOOKING_CANCELLED` | Sent when a booking is cancelled | `{ eventId: number, userId: number, bookingId: number }` |
| `EVENT_UPDATED` | Sent when an event is updated | `{ eventId: number }` |

## Performance Optimizations

### Redis Caching

The API utilizes Redis caching for improved performance:

1. **Event Slots**: Cached with atomic operations for concurrency control
2. **Event Data**: Complete event objects are cached
3. **Event Lists**: Paginated and search results are cached
4. **Admin Stats**: Dashboard statistics are cached

Cache invalidation occurs automatically when related data is modified.
