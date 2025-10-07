# Cultural Diet App Backend

A comprehensive backend system for managing cultural dietary preferences, Ayurvedic nutrition, and traditional food practices with local-first operation using SQLite.

## 🌟 Features

### Core Functionality
- **User Management**: Profile management with cultural and dietary preferences
- **Recipe Database**: Authentic recipes with cultural and Ayurvedic metadata
- **Meal Planning**: Smart meal generation based on cultural rules and preferences
- **Shopping Lists**: Retailer-organized shopping with cultural ingredient mapping
- **Product Catalog**: Multi-retailer product database with cultural classifications
- **Cultural Rules Engine**: Comprehensive validation for dietary and cultural compliance

### Cultural & Dietary Features
- **Hindu Dietary Compliance**: No red meat, traditional food practices
- **Ayurvedic Dosha Support**: Vata, Pitta, Kapha-based meal recommendations
- **Multi-Cultural**: North Indian, South Indian, Mughlai, Gujarati, and international cuisines
- **Retailer Integration**: Patel Brothers, Subzi Mandi, Hanuman, Trader Joe's
- **Dietary Restrictions**: Vegetarian, vegan, medical restrictions, cultural requirements

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js + Express + TypeScript
- **Database**: SQLite (local-first operation)
- **Architecture**: Repository pattern with service layer
- **Authentication**: JWT-based with bcrypt password hashing
- **Validation**: Joi schema validation with cultural compliance checking

### Project Structure
```
src/
├── controllers/         # API route handlers
├── repositories/        # Data access layer (Repository pattern)
├── services/           # Business logic (Cultural rules engine)
├── middleware/         # Authentication, validation, error handling
├── utils/              # Validation, auth, error utilities
├── types/              # TypeScript type definitions
├── database/           # Database schema, migration, seeding
└── server.ts           # Main application entry point
```

## 🚀 Getting Started

### Prerequisites
- **Docker**: Docker Desktop (recommended) or Docker Engine + Docker Compose
- **OR Node.js**: Node.js 18+ and npm (for native development)
- Git

### Option 1: Docker deployment (Recommended)

1. **Quick Start**
```bash
git clone <repository-url>
cd cultural-diet-app
./quick-start.sh
```

2. **Or manual Docker setup**
```bash
# Start development environment
./deploy.sh dev up

# Access the application
# Frontend: http://localhost:3001
# Backend API: http://localhost:3000
# Health Check: http://localhost:3000/health
```

3. **Docker documentation**
📖 See [DOCKER_SETUP.md](./DOCKER_SETUP.md) for comprehensive Docker documentation

### Option 2: Native development

1. **Clone and setup**
```bash
git clone <repository-url>
cd diet_doctor
npm install
```

2. **Environment configuration**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Database setup**
```bash
# Run database migration
npm run migrate

# Seed with sample data
npm run seed
```

4. **Start development server**
```bash
npm run dev
```

The server will start on `http://localhost:3000`

### Available Scripts
- `npm run dev` - Development server with auto-reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run seed` - Seed sample data
- `npm run test` - Run tests
- `npm run lint` - Run linting

## 📚 API Documentation

### Base URLs
- **Development**: `http://localhost:3000/api/v1`
- **Health Check**: `http://localhost:3000/health`

### Authentication
All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Core Endpoints

#### User Management
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `POST /users/change-password` - Change password
- `DELETE /users/account` - Delete account

#### Recipes
- `GET /recipes` - Search recipes with cultural filters
- `GET /recipes/:id` - Get recipe details
- `GET /recipes/favorites` - Get user's favorite recipes
- `POST /recipes/:id/favorite` - Add to favorites
- `POST /recipes/:id/rate` - Rate recipe
- `POST /recipes` - Create new recipe

#### Meal Planning
- `POST /meal-plans/generate` - Generate meal plan
- `GET /meal-plans` - Get user's meal plans
- `GET /meal-plans/:date` - Get meal plan for specific date
- `PUT /meal-plans/:date` - Update meal plan
- `GET /meal-plans/stats` - Get meal planning statistics

#### Shopping Lists
- `POST /shopping-lists` - Create shopping list
- `GET /shopping-lists` - Get user's shopping lists
- `GET /shopping-lists/:id` - Get shopping list details
- `POST /shopping-lists/:id/items` - Add item to list
- `PATCH /shopping-lists/:id/items/:itemId` - Update item status
- `POST /shopping-lists/from-meal-plan` - Generate from meal plan

#### Product Catalog
- `GET /products` - Search products
- `GET /products/retailers` - Get retailer information
- `GET /products/categories` - Get product categories
- `GET /products/price-comparison` - Compare prices across retailers
- `GET /products/:retailer/:sku` - Get specific product

#### Cultural Rules
- `GET /cultural-rules` - Get cultural dietary rules
- `POST /cultural-rules/validate-recipe/:recipeId` - Validate recipe compliance
- `POST /cultural-rules/validate-ingredient` - Validate ingredient
- `GET /cultural-rules/substitutions` - Get ingredient substitutes
- `GET /cultural-rules/ayurvedic-recommendations` - Get Ayurvedic guidance
- `GET /cultural-rules/hindu-dietary-guidance` - Get Hindu dietary principles

## 🧘 Cultural Rules Engine

### Supported Dietary Systems
- **Hindu Dietary Restrictions**: No beef, limited pork, traditional practices
- **Ayurvedic Dosha System**: Vata/Pitta/Kapha balancing recommendations
- **Vegetarian/Vegan**: Plant-based dietary preferences
- **Medical Restrictions**: Gluten-free, lactose-free, allergies
- **Cultural Traditions**: Jain fasting, Sattvic principles

### Validation Features
- Recipe compliance checking with scoring system
- Ingredient validation with substitution suggestions
- Cultural authenticity verification
- Ayurvedic balance analysis

## 🛒 Retailer Integration

### Supported Retailers
- **Patel Brothers**: Indian grocery specialist
- **Subzi Mandi**: Fresh produce and Indian ingredients
- **Hanuman**: Traditional Indian food products
- **Trader Joe's**: Modern alternatives and organic options

### Features
- Price comparison across retailers
- Cultural ingredient mapping
- Shopping list generation by retailer
- Product substitution suggestions

## 📊 Database Schema

### Core Tables
- `users` - User profiles with cultural preferences
- `recipes` - Recipe database with cultural metadata
- `meal_plans` - User meal planning data
- `shopping_lists` - Shopping lists with retailer grouping
- `product_catalog` - Multi-retailer product database
- `cultural_rules` - Dietary and cultural restriction rules

### Relationships
- User → Meal Plans (1:N)
- User → Shopping Lists (1:N)
- User → Recipe Favorites (M:N)
- Product → Cultural Tags (M:N)
- Recipes → Ayurvedic Properties (1:1)

## 🔒 Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcrypt (12 rounds)
- Input validation with Joi schemas
- CORS configuration for frontend integration
- SQL injection prevention with parameterized queries
- Rate limiting ready (implementation optional)

## 🌍 Cultural Authenticity

### Recipe Standards
- Authentic recipes from cultural sources
- Traditional cooking methods preserved
- Cultural notes and historical context
- Regional cuisine differentiation

### Dietary Compliance
- Religious restriction enforcement
- Cultural practice respect and accuracy
- Traditional ingredient mapping
- Modern adaptation guidelines

## 🧪 Development

### Running Tests
```bash
npm test
```

### Code Quality
```bash
npm run lint          # ESLint checking
npm run typecheck     # TypeScript type checking
```

### Database Management
```bash
npm run migrate       # Run migrations
npm run migrate:down  # Rollback migrations
npm run seed         # Seed sample data
npm run seed:reset   # Reset and reseed
```

## 📈 Performance

### Optimization Features
- SQLite optimization with proper indexing
- Efficient query patterns with repository layer
- Lazy loading for large datasets
- Pagination for resource management
- JSON field optimization for complex data

### Local-First Operation
- Offline capability with local SQLite database
- No external database dependencies
- Fast local operation without network latency
- Simple deployment and scaling

## 🤝 Contributing

### Code Standards
- TypeScript strict mode enforced
- Comprehensive test coverage required
- Cultural accuracy and sensitivity mandatory
- Documentation updates for new features

### Cultural Sensitivity
- Respect for all dietary traditions required
- Accurate representation of cultural practices
- Community consultation for new cultural additions
- Proper attribution for traditional knowledge

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- Traditional recipe sources and cultural knowledge keepers
- Ayurvedic practitioners and nutritionists
- Community members providing authentic recipes
- Retail partners for product information

Built with ❤️ for cultural preservation and dietary freedom.