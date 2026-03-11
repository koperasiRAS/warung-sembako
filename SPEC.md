# Warung Sembako POS System - Specification Document

## 1. System Overview

### Project Name
**Warung Sembako POS** - A lightweight Point of Sale system for small retail shops

### Core Functionality
A fast, responsive POS system designed for retail shops (warungs) with product management, barcode scanning, transaction processing, financial tracking, and thermal receipt printing.

### Target Users
- **Owner**: Full access to all features including management and reporting
- **Cashier**: Transaction-focused access (POS, product viewing, basic transactions)

---

## 2. Technology Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Custom components with Lucide icons
- **State Management**: React hooks + Context API

### Backend
- **Runtime**: Next.js API Routes / Server Actions
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Image Storage**: Supabase Storage

### Deployment
- **Platform**: Hostinger Node.js hosting
- **Node Version**: 18.x or higher

---

## 3. UI/UX Specification

### Layout Structure

#### Authentication Pages
- **Login Page**: Centered card with logo, email/password fields, login button

#### Dashboard Layout (Owner)
- **Sidebar**: Fixed left sidebar (240px width on desktop, collapsible on mobile)
- **Header**: Top bar with user info, logout button
- **Content Area**: Main content with stats cards and data grids

#### POS Interface
- **Layout**: Split view - Product grid (left/top), Cart (right/bottom)
- **Mobile**: Full-width product grid with floating cart button

### Visual Design

#### Color Palette
| Role | Color | Hex Code |
|------|-------|----------|
| Primary | Deep Teal | #0D9488 |
| Primary Dark | Dark Teal | #0F766E |
| Secondary | Warm Orange | #F97316 |
| Background | Light Gray | #F8FAFC |
| Surface | White | #FFFFFF |
| Text Primary | Dark Slate | #1E293B |
| Text Secondary | Slate | #64748B |
| Success | Green | #22C55E |
| Warning | Amber | #F59E0B |
| Error | Red | #EF4444 |
| Cash | Green | #10B981 |
| Bank | Blue | #3B82F6 |

#### Typography
- **Font Family**: "Inter", system-ui, sans-serif
- **Headings**:
  - H1: 28px, font-weight 700
  - H2: 24px, font-weight 600
  - H3: 20px, font-weight 600
- **Body**: 14px, font-weight 400
- **Small**: 12px, font-weight 400

#### Spacing System
- Base unit: 4px
- Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64

#### Responsive Breakpoints
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

### Components

#### Cards
- Background: White (#FFFFFF)
- Border: 1px solid #E2E8F0
- Border radius: 12px
- Padding: 20px
- Shadow: 0 1px 3px rgba(0,0,0,0.1)

#### Buttons
- **Primary**: Background #0D9488, text white, hover #0F766E
- **Secondary**: Background #F1F5F9, text #1E293B, hover #E2E8F0
- **Danger**: Background #FEE2E2, text #DC2626, hover #FECACA
- Border radius: 8px
- Padding: 10px 16px
- Font weight: 500

#### Form Inputs
- Background: White
- Border: 1px solid #CBD5E1
- Border radius: 8px
- Padding: 10px 14px
- Focus: Border #0D9488, ring 2px #0D9488/20

#### Product Cards (POS)
- Grid layout: 3 columns mobile, 4 columns tablet, 5 columns desktop
- Card size: Responsive, min 100px width
- Image: Aspect ratio 1:1, object-fit cover
- Lazy loading enabled

#### Cart Items
- Horizontal layout with quantity controls
- Swipe to delete on mobile

---

## 4. Database Schema

### Tables

#### profiles (extends auth.users)
```sql
id: uuid (FK to auth.users.id)
email: text
full_name: text
role: text ('owner' | 'cashier')
created_at: timestamptz
```

#### categories
```sql
id: uuid (PK)
name: text (unique)
description: text
created_at: timestamptz
updated_at: timestamptz
```

#### products
```sql
id: uuid (PK)
name: text
price: decimal(10,2)
stock: integer
category_id: uuid (FK to categories)
barcode: text (unique, indexed)
sku: text
image_url: text
created_at: timestamptz
updated_at: timestamptz
```

#### transactions
```sql
id: uuid (PK)
total: decimal(10,2)
payment_method: text ('cash' | 'qris' | 'transfer')
cashier_id: uuid (FK to profiles)
status: text ('completed' | 'voided')
created_at: timestamptz
```

#### transaction_items
```sql
id: uuid (PK)
transaction_id: uuid (FK to transactions)
product_id: uuid (FK to products)
qty: integer
price: decimal(10,2)
created_at: timestamptz
```

#### expenses
```sql
id: uuid (PK)
title: text
amount: decimal(10,2)
payment_method: text ('cash' | 'bank')
note: text
created_at: timestamptz
```

#### daily_balances
```sql
id: uuid (PK)
date: date (unique)
cash_balance: decimal(10,2)
bank_balance: decimal(10,2)
opening_cash: decimal(10,2)
created_at: timestamptz
updated_at: timestamptz
```

---

## 5. Functionality Specification

### Authentication

#### Login Flow
1. User enters email and password
2. Supabase Auth validates credentials
3. On success, redirect to dashboard (owner) or POS (cashier)
4. Store user session in cookie

#### Role-Based Access
- **Owner**: /dashboard, /products, /categories, /transactions, /expenses, /reports
- **Cashier**: /pos, /products (view only)

### Dashboard (Owner)

#### Stats Cards (SSR with 60s cache)
- Today's Total Sales (sum of completed transactions)
- Today's Transaction Count
- Cash Balance (from daily_balances)
- Bank Balance (from daily_balances)
- Low Stock Products (< 10 items)

#### Data Refresh
- Auto-refresh every 60 seconds
- Manual refresh button

### Product Management

#### CRUD Operations
- Create: Form with name, price, stock, category, barcode, SKU, image
- Read: Table with search, filter by category
- Update: Pre-filled form
- Delete: Confirmation modal

#### Image Upload
- Max size: 2MB
- Formats: JPG, PNG, WebP
- Auto-resize to 800x800
- Lazy loading with blur placeholder

### Category Management

#### CRUD Operations
- Simple name and description fields
- List view with product count

### POS Interface

#### Product Search
- Real-time search by name or barcode
- Debounced input (300ms)

#### Barcode Scanning
- Listen for rapid keyboard input
- Detect barcode pattern (10-20 digits, fast input)
- Auto-lookup and add to cart

#### Cart Management
- Add product (tap or scan)
- Adjust quantity (+/- buttons, direct input)
- Remove item (swipe or delete button)
- Clear cart

#### Payment Processing
1. Select payment method (cash/QRIS/transfer)
2. For cash: Show amount due, calculate change
3. Process transaction
4. Update stock automatically
5. Show receipt popup
6. No page reload - SPA transition

### Receipt Generation

#### Thermal Printer Format (58mm)
```
================================
WARUNG SEMBAKO
Jl. Contoh No. 123
================================
DATE: 11/03/2026 14:30:00
TRX: ABC123456789
CASHIER: John
--------------------------------
ITEM           QTY   PRICE
Mie Goreng     2    5,000
Teh Pucuk      1    3,000
--------------------------------
TOTAL              13,000
PAYMENT: CASH      20,000
CHANGE:             7,000
================================
Terima Kasih
================================
```

#### Print Function
- CSS media print styles
- 58mm width constraint
- Hidden UI elements during print

### Transaction History

#### List View
- Pagination: 20 items per page
- Columns: Date, ID, Total, Payment, Cashier
- Filter by date range
- Search by transaction ID

#### Detail View
- Full transaction items
- Receipt reprint option

### Financial Tracking

#### Balance System
- Cash: Only affected by cash transactions and cash expenses
- Bank: Affected by QRIS, transfer transactions, and bank expenses
- Daily balance auto-calculation

#### Expense Management
- Add expense with title, amount, payment method, note
- List view with pagination
- Edit and delete functionality

---

## 6. API Endpoints

### Authentication
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products (paginated)
- `POST /api/products` - Create product
- `PUT /api/products/[id]` - Update product
- `DELETE /api/products/[id]` - Delete product
- `GET /api/products/barcode/[code]` - Get by barcode

### Categories
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/[id]` - Update category
- `DELETE /api/categories/[id]` - Delete category

### Transactions
- `GET /api/transactions` - List transactions (paginated)
- `GET /api/transactions/[id]` - Get transaction detail
- `POST /api/transactions` - Create transaction

### Expenses
- `GET /api/expenses` - List expenses
- `POST /api/expenses` - Create expense
- `PUT /api/expenses/[id]` - Update expense
- `DELETE /api/expenses/[id]` - Delete expense

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics

---

## 7. Performance Optimization

### Database
- Index on products.barcode
- Index on transactions.created_at
- Index on transaction_items.transaction_id
- Use SELECT with specific columns, not SELECT *

### Caching
- Dashboard stats: 60 second cache
- Product list: 30 second cache
- Categories: 5 minute cache

### Frontend
- Lazy load product images (loading="lazy")
- Pagination for all lists
- Debounced search inputs
- Optimistic UI updates for cart

### Build
- Next.js production build
- Code splitting by route
- Static assets optimization

---

## 8. Folder Structure

```
/app
  /api
    /auth
    /products
    /categories
    /transactions
    /expenses
    /dashboard
  /(auth)
    /login
  /(dashboard)
    /layout.tsx
    /dashboard
    /products
    /categories
    /transactions
    /expenses
  /pos
  /layout.tsx
  /page.tsx (redirect)
/components
  /ui
    Button.tsx
    Card.tsx
    Input.tsx
    Modal.tsx
    Table.tsx
    ...
  /pos
    ProductGrid.tsx
    Cart.tsx
    BarcodeScanner.tsx
    Receipt.tsx
  /dashboard
    StatsCard.tsx
    SalesChart.tsx
  /layout
    Sidebar.tsx
    Header.tsx
/lib
  /supabase
    client.ts
    server.ts
    types.ts
  /database
    schema.sql
    seed.ts
/services
  /product.service.ts
  /transaction.service.ts
  /balance.service.ts
/hooks
  /useCart.ts
  /useAuth.ts
  /useDebounce.ts
/types
  /index.ts
/public
  /images
```

---

## 9. Security Considerations

- Row Level Security (RLS) on all tables
- Role-based access control
- Input validation on all forms
- CSRF protection via Next.js
- Secure cookie for sessions
- Environment variables for sensitive data

---

## 10. Acceptance Criteria

### Authentication
- [ ] Users can login with email/password
- [ ] Invalid credentials show error message
- [ ] Role-based redirect after login
- [ ] Logout clears session

### Dashboard
- [ ] Shows today's sales total
- [ ] Shows transaction count
- [ ] Shows cash and bank balances
- [ ] Shows low stock products
- [ ] Data refreshes every 60 seconds

### Products
- [ ] Can create new product with all fields
- [ ] Can edit existing product
- [ ] Can delete product with confirmation
- [ ] Images load lazily
- [ ] Barcode is unique

### POS
- [ ] Products display in responsive grid
- [ ] Can search products by name
- [ ] Barcode scanner adds products
- [ ] Cart quantity adjustable
- [ ] Payment method selectable
- [ ] Transaction saves to database
- [ ] Stock updates automatically
- [ ] Receipt displays correctly
- [ ] Page does not reload

### Receipt
- [ ] Correct 58mm width
- [ ] All required fields present
- [ ] Browser print works

### Transaction History
- [ ] Paginated list loads
- [ ] Can view details
- [ ] Filter by date works

### Expenses
- [ ] Can add expense
- [ ] Balance updates correctly
- [ ] List view with pagination

### Responsive
- [ ] Mobile layout works
- [ ] Touch-friendly buttons
- [ ] No horizontal scroll
