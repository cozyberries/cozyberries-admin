# CozyBerries Admin Portal

Admin panel for CozyBerries e-commerce platform.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the environment template and fill in your values:

```bash
cp env.template .env.local
```

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `JWT_SECRET` - Secret key for JWT tokens
- `ADMIN_SETUP_KEY` - Secret key for initial admin setup
- `NEXT_PUBLIC_SITE_URL` - Admin app URL (http://localhost:3001 for development)
- `NEXT_PUBLIC_CUSTOMER_SITE_URL` - Customer app URL (http://localhost:3000 for development)

### 3. Run Development Server

```bash
npm run dev
```

The admin portal will be available at [http://localhost:3001](http://localhost:3001)

## Features

- **Dashboard**: Analytics and key metrics
- **Product Management**: CRUD operations for products
- **User Management**: View and manage users
- **Order Management**: Track and update orders
- **Expense Management**: Track business expenses
- **Settings**: Configure system settings

## Authentication

The admin portal uses Supabase authentication with role-based access control. Only users with the `admin` role in the `user_profiles` table can access the admin portal.

### Creating the First Admin

Use the setup page at `/setup` to create the first admin user.

## Deployment

### Vercel Deployment

1. Create a new Vercel project
2. Connect your repository
3. Configure environment variables
4. Deploy

Recommended domain structure:
- Customer app: `https://cozyberries.com`
- Admin app: `https://admin.cozyberries.com`

## Development

- Port: 3001 (to avoid conflicts with customer app on 3000)
- Framework: Next.js 15 with App Router
- Styling: Tailwind CSS
- UI Components: shadcn/ui
- Database: Supabase

## Documentation

See the `docs/` directory in the main repository for detailed documentation on:
- Admin setup guide
- JWT authentication
- API endpoints
- Database schema
