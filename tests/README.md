## Cultural Diet App - Comprehensive Testing Suite

This directory contains the complete testing suite for the Cultural Diet application, covering all aspects of cultural compliance, functionality, and integration.

### Test Structure

```
tests/
├── backend/                 # Backend API Tests
│   ├── unit/               # Unit tests for individual components
│   ├── integration/        # Integration tests for API endpoints
│   ├── cultural/           # Cultural compliance testing
│   └── performance/        # Performance and load testing
├── frontend/               # Frontend Tests
│   ├── components/         # Component tests
│   ├── pages/             # Page tests
│   ├── integration/       # Frontend-backend integration
│   └── accessibility/     # WCAG compliance testing
├── e2e/                   # End-to-End Tests
│   ├── user-journeys/     # Complete user workflows
│   ├── cultural/          # Cultural compliance flows
│   └── cross-platform/    # Platform-specific testing
├── integration/           # System Integration Tests
│   ├── database/          # Database operations testing
│   ├── retail/           # Retail partner integration
│   └── deployment/       # Docker and deployment testing
├── security/             # Security Testing
│   ├── authentication/   # Auth and authorization
│   ├── input-validation/ # Input validation and XSS
│   └── api-security/     # API security testing
└── reports/              # Test Reports and Results
    ├── functional/       # Functional test results
    ├── cultural/         # Cultural compliance reports
    ├── performance/      # Performance metrics
    └── security/         # Security assessment
```

### Testing Focus Areas

#### 1. Cultural Compliance Testing
- Hindu dietary restrictions (no red meat)
- Ayurvedic dosha recommendations
- Traditional medicine guidelines
- Cultural authenticity validation

#### 2. Functional Testing
- User onboarding flows
- Meal plan generation
- Shopping list creation
- Recipe management

#### 3. Integration Testing
- Frontend-backend communication
- Database operations
- Retail partner APIs
- Docker deployment

#### 4. Quality Assurance
- Security validation
- Performance testing
- Accessibility compliance
- Cross-platform compatibility

### Testing Commands

```bash
# Backend Tests
npm run test:backend

# Frontend Tests
npm run test:frontend

# E2E Tests
npm run test:e2e

# Cultural Compliance Tests
npm run test:cultural

# All Tests
npm run test:all

# Test with Coverage
npm run test:coverage
```