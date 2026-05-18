# AGENTS.md

## Purpose

This repository contains backend services and APIs intended for production use.

All contributors must operate with the mindset of a senior backend engineer, prioritizing:

- correctness
- security
- maintainability
- observability
- testability
- documentation quality
- release safety

The standard is **production-grade engineering**, not prototyping.

---

## Core Engineering Standards

### Non-Negotiable Requirements

Every backend change MUST preserve or improve:

1. correctness
2. security
3. maintainability
4. observability
5. test coverage
6. documentation quality

No trade-offs that weaken architecture, readability, or safety are acceptable.

---

## Architecture Principles

### SOLID is Mandatory

All code must follow SOLID principles.

#### Single Responsibility Principle

- Each module/class/function must have one responsibility
- No mixing of validation, business logic, persistence, or transport

#### Open/Closed Principle

- Extend behavior via abstraction, not modification

#### Liskov Substitution Principle

- Implementations must behave consistently with their abstractions

#### Interface Segregation Principle

- Use small, focused interfaces

#### Dependency Inversion Principle

- Depend on abstractions, not implementations
- Inject dependencies (repositories, services, clients)

---

## Layered Architecture

Preferred structure:

- Controller / Handler
- Validation Layer
- Application / Service Layer
- Domain Layer
- Repository / Gateway Layer
- Infrastructure Layer

**Strict Rule:**
Business logic MUST NOT exist in controllers, DTOs, ORM models, or transport layers.

---

## API Requirements

### Contract Discipline

- Define explicit request/response contracts
- Maintain backward compatibility
- NEVER silently change:
  - field names
  - response structure
  - status codes
  - pagination behavior

---

### Error Handling (STRICT)

Error handling must be:

- consistent
- explicit
- debuggable
- safe (no sensitive leaks)

#### Mandatory Error Response Format

All APIs MUST return structured error responses:

```json
{
  "error": {
    "code": "STRING_CODE",
    "message": "Human readable explanation",
    "details": "Optional detailed context",
    "field": "Optional field name (for validation errors)",
    "requestId": "trace-id-if-available"
  }
}
```

#### Requirements

- Status codes MUST be correct and meaningful
- Messages MUST be clear, actionable, and verbose enough for debugging
- NEVER leak:
  - stack traces
  - SQL queries
  - internal service names
  - secrets or tokens

#### Examples

**Validation Error (400)**

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "Invalid email format",
    "field": "email"
  }
}
```

**Not Found (404)**

```json
{
  "error": {
    "code": "USER_NOT_FOUND",
    "message": "User with id '123' does not exist"
  }
}
```

**Internal Error (500)**

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Unexpected error occurred. Please contact support with requestId"
  }
}
```

---

### Validation

- Validate ALL inputs at the boundary
- Cover:
  - body
  - query
  - path params
  - headers

- Never trust upstream systems

---

### Pagination / Filtering / Sorting

- Always define defaults
- Avoid unbounded queries
- Ensure deterministic ordering

---

### Versioning

- Follow existing strategy
- No mixed behavior under same version

---

## Documentation Requirements

### Mandatory Coverage

Every API must document:

- endpoint purpose
- method + route
- auth requirements
- headers
- params (path/query)
- request body schema
- response schema
- status codes
- validation rules
- error responses (examples REQUIRED)
- edge cases

### Quality Bar

Docs must be:

- accurate
- example-driven
- synced with implementation
- never placeholders

---

## Testing Requirements

### Unit Tests (MANDATORY)

Each change must include:

- success case
- validation failure
- edge case
- error path

### Integration Tests

Required when affecting:

- HTTP
- DB
- queues/events
- external services

### Regression Tests

- Required for every bug fix
- Must fail before fix

### Test Quality Rules

- Test behavior, not implementation
- Avoid fragile mocks
- Mock only boundaries
- Prefer table-driven tests

---

## Postman Requirements

Every API must:

- exist in Postman collection
- include:
  - headers
  - auth
  - params
  - sample request/response

### Test Scripts

Must validate:

- status code
- response structure
- required fields

### Environment Rules

- No hardcoded secrets
- Use variables

---

## Maintainability Rules

- Clean abstractions
- No hidden side effects
- Explicit dependencies
- Domain-driven naming

---

## Security Requirements

- No hardcoded secrets
- Strong validation
- Protect against:
  - injection
  - SSRF
  - unsafe deserialization

---

## Database Rules

- Prefer additive migrations
- Avoid destructive changes
- Handle messy real-world data
- Prevent N+1 queries

---

## Observability

- Structured logging
- Metrics
- Tracing (if present)
- Improve logs in bug fixes

---

## Workflow Checklist

### Before Coding

1. Identify affected components
2. Review existing patterns
3. Analyze contract impact
4. Identify doc/test/Postman impact

### During Implementation

1. Keep diff minimal
2. Follow SOLID
3. Update docs
4. Add tests
5. Update Postman

### Before Completion

1. Docs match implementation
2. Postman matches API
3. Tests cover behavior
4. No contract drift

---

## Completion Gate

A task is NOT complete unless:

- implementation is done
- tests added
- docs updated
- Postman updated
- risks documented

---

## Final Response Format

Every task completion MUST include:

1. Summary of changes
2. Affected APIs
3. Documentation updates
4. Tests added/updated
5. Postman updates
6. Architectural improvements
7. Risk level
8. Follow-ups

---

## Key Enhancement (NEW)

### Debuggability First Principle

All APIs must be designed so that:

- failures are **immediately understandable from response alone**
- QA and automation tests can diagnose issues without logs

#### Rules

- Error messages must explain:
  - what failed
  - why it failed
  - how to fix it (if applicable)

- Avoid vague messages like:
  - "Something went wrong"
  - "Invalid request"

- Prefer:
  - "Field 'email' must be a valid RFC 5322 email address"
  - "Order cannot be cancelled because it is already shipped"

---

## Directory Overrides

More specific AGENTS.md files override this file.
