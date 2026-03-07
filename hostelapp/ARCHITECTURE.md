# Hostel Management System — Enterprise Architecture

## Architecture Diagram (Text)

```
                            ┌──────────────────────────────────┐
                            │          LOAD BALANCER           │
                            │        (Nginx / AWS ALB)         │
                            └──────────┬───────────────────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                   │
              ┌─────▼─────┐   ┌───────▼──────┐   ┌───────▼──────┐
              │  API GW   │   │  WebSocket   │   │   Static     │
              │  Express   │   │  Server      │   │   Assets     │
              │  :3000     │   │  Socket.IO   │   │   (CDN/Nginx)│
              └─────┬─────┘   │  :3001       │   └──────────────┘
                    │         └───────┬──────┘
       ┌────────────┼────────────┐    │
       │            │            │    │
  ┌────▼───┐  ┌────▼───┐  ┌────▼────▼──┐
  │  Auth  │  │ Core   │  │ Notification│
  │Service │  │Service │  │  Service    │
  │        │  │        │  │             │
  └───┬────┘  └───┬────┘  └──────┬─────┘
      │           │               │
      └─────┬─────┘               │
            │                     │
     ┌──────▼─────────┐   ┌──────▼──────┐
     │    MySQL        │   │    Redis    │
     │  (Primary DB)   │   │  (Cache +   │
     │                 │   │   PubSub)   │
     └─────────────────┘   └─────────────┘
```

## Service Decomposition

### 1. API Gateway Layer (`server.js`)
- Request routing, rate limiting, CORS, security headers
- JWT validation at gateway level
- Request/response logging

### 2. Auth Service (`/services/auth/`)
- Registration, Login, Google OAuth
- JWT access tokens (15min) + refresh tokens (7d)
- Password hashing (bcrypt, 12 rounds)
- Token blacklisting on logout

### 3. Core Service (Modular Controllers)
- **Student Module**: Profile, CRUD
- **Warden Module**: Profile, CRUD  
- **Leave Module**: Student/Warden leave workflows
- **Complaint Module**: Filing, tracking, resolution
- **Room Module**: Room change requests
- **Meal Module**: Meal request management
- **Lab Module**: Computer lab slot booking

### 4. Notification Service (`/services/notifications/`)
- Socket.IO for real-time push
- Event-driven: leave approved → notify student
- Redis PubSub for multi-instance broadcasting

### 5. Audit Service (`/services/audit/`)
- Every mutation logged with actor, action, target, timestamp
- IP tracking, user-agent logging
- Queryable audit trail for compliance

### 6. Analytics Service (`/services/analytics/`)
- Dashboard aggregations (leave stats, complaint trends)
- Role-based data visibility
- Exportable reports

## Data Flow

```
Client Request
    → Nginx (SSL termination, rate limit)
    → Express API Gateway
        → Auth Middleware (JWT verify)
        → RBAC Middleware (role check)
        → Validation Middleware (Joi schema)
        → Controller (business logic)
        → Service Layer (DB queries)
        → Audit Logger (async write)
        → Response + WebSocket event
```

## Security Layers

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Transport | HTTPS/TLS | Encryption in transit |
| Gateway | Helmet, CORS, Rate Limit | Header security |
| Auth | JWT + Refresh + Blacklist | Identity verification |
| Authorization | RBAC Middleware | Role-based access |
| Input | Joi Validation | Injection prevention |
| Database | Parameterized queries | SQL injection prevention |
| Files | Multer + type validation | Upload security |
| Monitoring | Audit logs + error tracking | Forensics |

## Scaling Strategy

- **Horizontal**: Stateless API servers behind load balancer
- **Database**: Read replicas for analytics queries
- **Cache**: Redis for session store, query cache, rate limiting
- **WebSocket**: Redis PubSub adapter for multi-node Socket.IO
- **Files**: S3/MinIO for upload storage (not local disk)
- **Queue**: Bull/BullMQ for async jobs (email, reports)
