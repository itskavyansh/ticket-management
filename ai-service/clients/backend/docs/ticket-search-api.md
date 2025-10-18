# Ticket Search and Filtering API

This document describes the enhanced ticket search and filtering capabilities implemented in the AI Ticket Management Platform.

## Overview

The ticket search system provides powerful filtering, full-text search, and pagination capabilities to help users efficiently find and manage tickets.

## Endpoints

### Basic Search
```
GET /api/tickets/search
```

### Advanced Search with Facets
```
GET /api/tickets/search/advanced
```

## Query Parameters

### Basic Parameters
- `q` (string): Full-text search query
- `page` (number): Page number (default: 1)
- `limit` (number): Results per page (default: 20, max: 100)
- `sortBy` (string): Sort field (createdAt, updatedAt, priority, slaDeadline, status, customerName, escalationLevel, timeSpent, relevance)
- `sortOrder` (string): Sort direction (asc, desc)
- `includeResolved` (boolean): Include resolved tickets (default: false)
- `includeClosed` (boolean): Include closed/cancelled tickets (default: false)

### Filter Parameters

#### Status Filters
- `status` (array): Filter by ticket status (open, in_progress, pending_customer, resolved, closed, cancelled)

#### Priority Filters
- `priority` (array): Filter by priority (low, medium, high, critical)

#### Category Filters
- `category` (array): Filter by category (hardware, software, network, security, general)

#### Assignment Filters
- `assignedTechnicianId` (string): Filter by assigned technician
- `customerId` (string): Filter by customer

#### Customer Filters
- `customerTier` (array): Filter by customer tier (basic, premium, enterprise)

#### Date Range Filters
- `createdAfter` (ISO date): Tickets created after this date
- `createdBefore` (ISO date): Tickets created before this date
- `updatedAfter` (ISO date): Tickets updated after this date
- `updatedBefore` (ISO date): Tickets updated before this date

#### SLA and Risk Filters
- `slaRisk` (string): Filter by SLA risk level (low, medium, high)
- `isOverdue` (boolean): Filter overdue tickets

#### Content Filters
- `tags` (array): Filter by tags
- `hasAttachments` (boolean): Filter tickets with/without attachments

#### Escalation Filters
- `escalationLevel` (array): Filter by escalation level (0-5)

#### Time Tracking Filters
- `timeSpentMin` (number): Minimum time spent (minutes)
- `timeSpentMax` (number): Maximum time spent (minutes)
- `resolutionTimeMin` (number): Minimum resolution time (minutes)
- `resolutionTimeMax` (number): Maximum resolution time (minutes)

## Example Requests

### Basic Search
```bash
GET /api/tickets/search?q=network&status=open,in_progress&priority=high&page=1&limit=20
```

### Advanced Filtering
```bash
GET /api/tickets/search?customerId=123&createdAfter=2024-01-01&slaRisk=high&hasAttachments=true
```

### Complex Query
```bash
GET /api/tickets/search/advanced?q=server&status=open&priority=critical,high&customerTier=enterprise&escalationLevel=0,1&sortBy=slaDeadline&sortOrder=asc
```

## Response Format

### Basic Search Response
```json
{
  "success": true,
  "data": [
    {
      "id": "ticket-123",
      "title": "Network connectivity issue",
      "description": "Unable to connect to the internet",
      "status": "open",
      "priority": "high",
      "category": "network",
      "customerId": "customer-456",
      "customerName": "Acme Corp",
      "customerTier": "enterprise",
      "assignedTechnicianId": "tech-789",
      "tags": ["network", "connectivity"],
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z",
      "slaDeadline": "2024-01-15T14:00:00Z",
      "escalationLevel": 0,
      "timeSpent": 120,
      "billableTime": 120
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 45,
    "hasMore": true,
    "totalPages": 3
  },
  "metadata": {
    "searchQuery": "network",
    "filtersApplied": 3,
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "includeResolved": false,
    "includeClosed": false
  }
}
```

### Advanced Search Response (includes facets)
```json
{
  "success": true,
  "data": [...],
  "pagination": {...},
  "facets": {
    "status": [
      { "value": "open", "count": 25 },
      { "value": "in_progress", "count": 15 },
      { "value": "pending_customer", "count": 5 }
    ],
    "priority": [
      { "value": "high", "count": 20 },
      { "value": "medium", "count": 15 },
      { "value": "critical", "count": 8 },
      { "value": "low", "count": 2 }
    ],
    "category": [
      { "value": "network", "count": 18 },
      { "value": "software", "count": 12 },
      { "value": "hardware", "count": 10 }
    ],
    "customerTier": [
      { "value": "enterprise", "count": 30 },
      { "value": "premium", "count": 10 },
      { "value": "basic", "count": 5 }
    ],
    "escalationLevel": [
      { "value": 0, "count": 35 },
      { "value": 1, "count": 8 },
      { "value": 2, "count": 2 }
    ],
    "tags": [
      { "value": "network", "count": 18 },
      { "value": "urgent", "count": 12 },
      { "value": "hardware", "count": 10 }
    ]
  },
  "metadata": {...}
}
```

## Search Features

### Full-Text Search
- Searches across ticket title, description, customer name, tags, and external ID
- Relevance scoring with weighted matches:
  - Title matches: Highest weight
  - Customer name matches: High weight
  - Tag exact matches: Medium-high weight
  - External ID matches: Medium-high weight
  - Tag partial matches: Medium weight
  - Description matches: Lower weight

### Advanced Filtering
- Multiple filter criteria can be combined
- Array-based filters support multiple values (OR logic)
- Date range filters for precise time-based queries
- Numeric range filters for time tracking data
- Boolean filters for binary conditions

### Sorting Options
- Multiple sort criteria with consistent secondary sorting
- Relevance-based sorting for search queries
- Priority-aware sorting with proper ordering
- Date-based sorting with millisecond precision

### Pagination
- Efficient pagination with configurable page sizes
- Total count and "has more" indicators
- Maximum result limits to prevent performance issues

### Performance Optimizations
- Intelligent index selection based on filter criteria
- Post-processing filters for complex calculations
- Efficient query planning and execution
- Caching-friendly result structures

## Error Handling

### Validation Errors (400)
```json
{
  "success": false,
  "error": "Validation Error",
  "message": "createdAfter must be before createdBefore",
  "details": "Please use more specific filters or reduce page/limit values"
}
```

### Server Errors (500)
```json
{
  "success": false,
  "error": "Internal Server Error",
  "message": "Failed to search tickets"
}
```

## Rate Limiting

- Search endpoints are subject to standard API rate limiting
- Complex queries may have additional throttling
- Use pagination and specific filters to optimize performance

## Best Practices

1. **Use Specific Filters**: Apply relevant filters to reduce result sets
2. **Limit Page Size**: Use appropriate page sizes (10-50 items)
3. **Cache Results**: Cache search results when possible
4. **Progressive Loading**: Load additional pages as needed
5. **Index Optimization**: Use filters that leverage database indexes
6. **Faceted Search**: Use advanced search for filter discovery