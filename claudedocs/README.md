# Cultural Diet Doctor - Documentation Index

Complete documentation for the Cultural Diet Doctor application.

## 📚 Documentation Suite

### Core Documentation

| Document | Description | Size | Last Updated |
|----------|-------------|------|--------------|
| **[API.md](API.md)** | Complete API endpoint reference with request/response examples | 20 KB | 2025-10-07 |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | System architecture, design patterns, and data flow | 26 KB | 2025-10-07 |
| **[DATABASE.md](DATABASE.md)** | Database schema, relationships, and performance optimization | 26 KB | 2025-10-07 |
| **[DEPLOYMENT.md](DEPLOYMENT.md)** | Deployment guide for development, production, and Docker | 17 KB | 2025-10-07 |
| **[SCREENSHOT_GUIDE.md](SCREENSHOT_GUIDE.md)** | Guide for capturing application screenshots | 10 KB | 2025-10-07 |

### Project Root Documentation

| Document | Description | Link |
|----------|-------------|------|
| **README.md** | Project overview and quick start guide | [../README.md](../README.md) |
| **CLAUDE.md** | Claude Code AI assistance guidelines | [../CLAUDE.md](../CLAUDE.md) |

---

## 🚀 Quick Start

### For Developers
1. Read [../README.md](../README.md) for project overview
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) for setup instructions
3. Consult [API.md](API.md) for endpoint details
4. Check [ARCHITECTURE.md](ARCHITECTURE.md) for system design

### For Database Work
1. Start with [DATABASE.md](DATABASE.md) for schema overview
2. Review table structures and relationships
3. Check indexes and performance optimization
4. Understand JSON field usage

### For Operations/DevOps
1. Read [DEPLOYMENT.md](DEPLOYMENT.md) thoroughly
2. Review environment configuration
3. Understand backup and recovery procedures
4. Set up monitoring and alerting

### For Documentation Updates
1. Review [SCREENSHOT_GUIDE.md](SCREENSHOT_GUIDE.md)
2. Capture updated screenshots
3. Update relevant documentation
4. Follow commit guidelines

---

## 📖 Documentation by Topic

### Architecture & Design
- **System Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md) - Overview, patterns, components
- **Data Model**: [DATABASE.md](DATABASE.md) - Schema, relationships, storage
- **API Design**: [API.md](API.md) - REST endpoints, authentication, responses

### Development
- **Getting Started**: [../README.md](../README.md#getting-started)
- **Project Structure**: [ARCHITECTURE.md#project-structure](ARCHITECTURE.md#project-structure)
- **Development Setup**: [DEPLOYMENT.md#development-deployment](DEPLOYMENT.md#development-deployment)

### Database
- **Schema Overview**: [DATABASE.md#schema-overview](DATABASE.md#schema-overview)
- **Table Definitions**: [DATABASE.md#core-tables](DATABASE.md#core-tables)
- **Relationships**: [DATABASE.md#database-relationships](DATABASE.md#database-relationships)
- **Performance**: [DATABASE.md#performance-considerations](DATABASE.md#performance-considerations)

### API Reference
- **Authentication**: [API.md#authentication--user-management](API.md#authentication--user-management)
- **Recipes**: [API.md#recipe-management](API.md#recipe-management)
- **Meal Planning**: [API.md#meal-planning](API.md#meal-planning)
- **Shopping Lists**: [API.md#shopping-lists](API.md#shopping-lists)
- **Cultural Rules**: [API.md#cultural-rules--compliance](API.md#cultural-rules--compliance)

### Operations
- **Development Deploy**: [DEPLOYMENT.md#development-deployment](DEPLOYMENT.md#development-deployment)
- **Production Deploy**: [DEPLOYMENT.md#production-deployment](DEPLOYMENT.md#production-deployment)
- **Docker Deploy**: [DEPLOYMENT.md#docker-deployment](DEPLOYMENT.md#docker-deployment)
- **Database Backup**: [DEPLOYMENT.md#backup--recovery](DEPLOYMENT.md#backup--recovery)
- **Troubleshooting**: [DEPLOYMENT.md#troubleshooting](DEPLOYMENT.md#troubleshooting)

---

## 🔍 Finding Information

### By Feature

**User Management:**
- API: [API.md#authentication--user-management](API.md#authentication--user-management)
- Database: [DATABASE.md#users-table](DATABASE.md#users-table)
- Architecture: [ARCHITECTURE.md#authentication-system](ARCHITECTURE.md#authentication-system)

**Recipe System:**
- API: [API.md#recipe-management](API.md#recipe-management)
- Database: [DATABASE.md#recipes-table](DATABASE.md#recipes-table)
- Architecture: [ARCHITECTURE.md#recipe-search-flow](ARCHITECTURE.md#recipe-search-flow)

**Meal Planning:**
- API: [API.md#meal-planning](API.md#meal-planning)
- Database: [DATABASE.md#meal-plans-table](DATABASE.md#meal-plans-table)
- Architecture: [ARCHITECTURE.md#meal-plan-generator](ARCHITECTURE.md#meal-plan-generator)

**Shopping Lists:**
- API: [API.md#shopping-lists](API.md#shopping-lists)
- Database: [DATABASE.md#shopping-lists-table](DATABASE.md#shopping-lists-table)
- Architecture: [ARCHITECTURE.md#shopping-list-generator](ARCHITECTURE.md#shopping-list-generator)

**Cultural Rules:**
- API: [API.md#cultural-rules--compliance](API.md#cultural-rules--compliance)
- Database: [DATABASE.md#cultural-rules-table](DATABASE.md#cultural-rules-table)
- Architecture: [ARCHITECTURE.md#cultural-rules-engine](ARCHITECTURE.md#cultural-rules-engine)

### By Task

**Setting Up Development Environment:**
1. [DEPLOYMENT.md#development-deployment](DEPLOYMENT.md#development-deployment)
2. [../README.md#getting-started](../README.md#getting-started)

**Understanding Database Schema:**
1. [DATABASE.md#schema-overview](DATABASE.md#schema-overview)
2. [DATABASE.md#core-tables](DATABASE.md#core-tables)
3. [DATABASE.md#database-relationships](DATABASE.md#database-relationships)

**Deploying to Production:**
1. [DEPLOYMENT.md#production-deployment](DEPLOYMENT.md#production-deployment)
2. [DEPLOYMENT.md#security-checklist](DEPLOYMENT.md#security-checklist)
3. [DEPLOYMENT.md#monitoring](DEPLOYMENT.md#monitoring)

**Making API Calls:**
1. [API.md#authentication](API.md#authentication)
2. [API.md#api-endpoints-overview](API.md#api-endpoints-overview)
3. [API.md#error-response-format](API.md#error-response-format)

**Database Maintenance:**
1. [DEPLOYMENT.md#database-management](DEPLOYMENT.md#database-management)
2. [DATABASE.md#backup--maintenance](DATABASE.md#backup--maintenance)
3. [DEPLOYMENT.md#backup--recovery](DEPLOYMENT.md#backup--recovery)

---

## 📸 Screenshots

Application screenshots are stored in `screenshots/` directory:

```
screenshots/
├── dashboard.png          # Main dashboard view
├── recipes.png            # Recipe browser
├── recipe-detail.png      # Single recipe view
├── meal-plan.png          # 7-day meal plan
├── shopping-list.png      # Shopping list by retailer
└── settings.png           # User settings
```

**To capture screenshots**: See [SCREENSHOT_GUIDE.md](SCREENSHOT_GUIDE.md)

---

## 🔄 Document Updates

### Versioning
Documentation version matches application version. Current: **v1.0.0**

### Update Process
1. Make changes to documentation
2. Update "Last Updated" date in this index
3. Commit with descriptive message: `docs: update [document-name]`
4. Tag release if documenting new version

### Changelog
- **2025-10-07**: Initial comprehensive documentation suite created
  - API.md: Complete API reference
  - ARCHITECTURE.md: System architecture guide
  - DATABASE.md: Database schema documentation
  - DEPLOYMENT.md: Deployment and operations guide
  - SCREENSHOT_GUIDE.md: Screenshot capture guide

---

## 💡 Documentation Standards

### Markdown Style
- Use ATX-style headers (`#` not `===`)
- Code blocks with language hints (```typescript, ```sql, ```bash)
- Tables for structured data
- Links to related sections

### Code Examples
- Include working, tested examples
- Add comments for clarity
- Show request and response
- Include error cases

### Screenshots
- PNG format, optimized
- 1920x1080 or similar 16:9 ratio
- Descriptive alt text
- Updated quarterly or on UI changes

---

## 🆘 Getting Help

### Documentation Issues
- **Missing info**: Open issue with "documentation" label
- **Unclear sections**: Open issue with specific feedback
- **Broken links**: Open issue with "bug" label

### Application Issues
- **Bug reports**: See [../README.md#contributing](../README.md#contributing)
- **Feature requests**: GitHub Issues with "enhancement" label
- **Security issues**: Email security@example.com (private disclosure)

### Contributing to Docs
1. Fork repository
2. Update documentation
3. Test all links and code examples
4. Submit pull request with clear description
5. Respond to review feedback

---

## 📄 License

All documentation is licensed under MIT License, same as the application code.

---

## 🔗 External Resources

### Related Technologies
- [Node.js Documentation](https://nodejs.org/docs)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [SQLite Documentation](https://www.sqlite.org/docs.html)

### Best Practices
- [REST API Design](https://restfulapi.net/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Database Design Patterns](https://www.postgresql.org/docs/current/ddl-patterns.html)
- [Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)

---

**Last Updated**: 2025-10-07
**Documentation Version**: 1.0.0
**Application Version**: 1.0.0
