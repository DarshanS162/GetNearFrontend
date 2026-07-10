Act as a Senior Software Architect with 15+ years of experience designing scalable food delivery platforms similar to Swiggy, Zomato, Uber Eats, and Blinkit.

Technology Stack:
- Frontend: React (Vite)
- Backend: Supabase
- Database: PostgreSQL
- Authentication: Supabase Auth
- File Storage: Supabase Storage
- Payment: Razorpay
- Database creation method: SQL Migration Files only
- Include indexes, foreign keys, constraints, created_at, updated_at and soft delete where required.
1. Generate SQL migration files only.
2. Do NOT use Supabase Table Editor.
3. Every table should be created using CREATE TABLE statements.
4. Add proper PRIMARY KEY, FOREIGN KEY, UNIQUE constraints, CHECK constraints, DEFAULT values and INDEXES.
5. Use UUID as primary keys.
6. Use gen_random_uuid() for UUID generation.
7. Include created_at and updated_at timestamps in every table.
8. Add ON DELETE behavior wherever appropriate.
9. Follow PostgreSQL best practices.
10. Database should be scalable for future multi-restaurant support.
11. Follow proper naming conventions using snake_case.
12. Add comments explaining each table and important columns.
13. Create migration in logical order based on dependencies.
The system should be designed as production ready.

===================================
BUSINESS REQUIREMENT
===================================

Initially there will be only ONE restaurant.

However the database must be designed so that later multiple restaurants can be added without changing schema.

===================================
CUSTOMER FLOW
===================================

Customer opens website.

↓

Application automatically requests browser location.

↓

Nearest restaurant branch is selected.

↓

Customer can browse menu without login.

↓

Customer can search products.

↓

Customer can filter by category.

↓

Customer can add products into cart WITHOUT LOGIN.

↓

Once customer clicks Checkout OR Place Order,

User must register/login using Mobile Number OTP (Supabase Phone Authentication).

↓

If account doesn't exist, automatically create user profile.

↓

Customer adds delivery address.

↓

Customer places order.

↓

Payment using Razorpay.

↓

Order created.

===================================
ADMIN FLOW
===================================

Restaurant is NOT self registered.

Restaurant will be onboarded only by Super Admin.

Admin Panel Features:

Dashboard

Restaurant Management

Restaurant Branches

Category Management

Product Management

Product Images

Offers

Orders

Customers

Payments

Coupons

Delivery Charges

Business Settings

Operating Hours

Holiday Management

Reports

Profile

===================================
AUTHENTICATION
===================================

Customer

- Phone OTP
- Google Login (optional future)

Restaurant Owner

Created only by Admin.

Admin

Manual account.

Use Supabase Auth.

Create separate profile tables.

Never use auth.users directly inside application.

===================================
DATABASE REQUIREMENTS
===================================

Create migrations for all tables.

Every migration should include:

Primary Key

Foreign Keys

Indexes

Unique Constraints

Check Constraints

Default Values

Triggers to update updated_at

ON DELETE behavior

===================================
TABLES
===================================

roles

users

restaurants

restaurant_branches

addresses

categories

products

product_images

cart

cart_items

orders

order_items

payments

coupons

coupon_usages

offers

business_settings

delivery_charges

operating_hours

holidays

notifications

reviews

favorites

===================================
USER TABLE
===================================

Should contain

id

auth_user_uuid

role_id

full_name

phone

email

profile_image

is_active

created_at

updated_at

===================================
RESTAURANT TABLE
===================================

Restaurant details

GST

FSSAI

Logo

Banner

Contact

Business status

===================================
PRODUCT TABLE
===================================

Restaurant

Category

Name

Description

Veg / Non Veg

MRP

Selling Price

Discount

Preparation Time

Available

Featured

Image

===================================
ORDER TABLE
===================================

Restaurant

Branch

Customer

Address

Subtotal

Discount

Delivery Charge

Tax

Grand Total

Payment Status

Order Status

Payment Method

Razorpay Order Id

Razorpay Payment Id

===================================
PAYMENTS
===================================

Store

Transaction ID

Provider

Amount

Currency

Status

Webhook Response

===================================
ADMIN MODULES
===================================

Restaurant CRUD

Branch CRUD

Category CRUD

Product CRUD

Offer CRUD

Coupon CRUD

Order Management

Customer Management

Dashboard Analytics

Payment History

Reports

Business Settings

===================================
DELIVERABLES
===================================

Generate:

1. Folder wise SQL Migration Files

Example

001_create_roles.sql

002_create_users.sql

003_create_restaurants.sql

...

2. Every migration should be executable independently.

3. Add all Foreign Keys.

4. Add indexes on searchable columns.

5. Add constraints.

6. Add comments explaining why every table exists.

7. Use PostgreSQL best practices.

8. Follow production level naming conventions.

9. Use snake_case.

10. Generate ER Diagram (Mermaid).

11. Explain relationship between every table.

12. Mention future scalability considerations.

The final architecture should be clean, scalable, enterprise-level, and follow industry best practices suitable for a production food ordering platform.