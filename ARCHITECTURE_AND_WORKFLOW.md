# Project Architecture & Workflow Documentation

This document explains the step-by-step process, architecture, and workflow used to transform the provided static HTML/CSS files (`login.html`, `registration.html`, and `feed.html`) into a fully functional, full-stack application.

## 1. High-Level Architecture

The project adopts a modern full-stack architecture separated into two distinct layers:
- **Frontend:** Next.js (App Router) paired with TailwindCSS for styling and React functional components.
- **Backend:** Node.js with Express, powered by a MySQL database using Knex.js as the query builder.

### Tech Stack Overview

| Layer | Technologies |
| --- | --- |
| **Frontend** | React 19, Next.js 16 (App Router), TailwindCSS (v4), Socket.io-client |
| **Backend** | Node.js, Express.js, TypeScript, Knex.js, MySQL 2, Socket.io |
| **Authentication** | JSON Web Tokens (JWT), Bcrypt for password hashing |
| **Database** | Relational MySQL (`schema.sql` driven setup) |

---

## 2. Converting the Static Files to Frontend Components

The raw static files mapped directly to three main views. Using the component-driven paradigm of React/Next.js, the monolithic HTML structures were decomposed into modular, reusable UI pieces.

### A. Routing Mapping
- `static/login.html` $\rightarrow$ `frontend/app/login/page.tsx`
- `static/registration.html` $\rightarrow$ `frontend/app/register/page.tsx`
- `static/feed.html` $\rightarrow$ `frontend/app/feed/page.tsx`

### B. Component Breakdown (`feed.html`)
The `feed.html` was the most complex file. To manage its structure and improve maintainability, it was split into several distinct React components housed in `frontend/app/components/`:

- `Header.tsx`: Contains the horizontal navigation bar, search inputs, user profile icon settings, and top-level navigation items.
- `LeftSidebar.tsx`: Holds the user's quick links, groups, pages, and navigation shortcuts.
- `RightSidebar.tsx`: Displays sponsor boxes, contacts/friends lists, and active statuses.
- `StoriesPlaceholder.tsx`: The scrollable horizontal list of stories at the top of the feed layout.
- `CreatePostBox.tsx`: The input area allowing users to type content, upload images, set visibility (Public/Private), and submit a new post.
- `PostItem.tsx`: A reusable component used to map over the dynamic feed data. It represents a single post, managing its like states, comments, replies, and dynamic timestamps.
- `Loader.tsx`: For showing asynchronous loading states naturally.

### C. Styling Integration
The raw static templates included pre-defined custom CSS implementations located at `static/assets`. The generic resets and base styles were imported broadly into the Next.js `globals.css`. By adopting TailwindCSS, dynamic style modifiers and interactive pseudo-classes could be embedded directly into JSX, allowing us to align exactly with the rigid design constraints.

---

## 3. Database Design

A solid data layer was conceptualized based on the interactive requirements visible in `feed.html`. The MySQL database schema (`backend/schema.sql`) implements robust relational structures required to support an eventually high-traffic social platform.

### Core Tables
1. **`users`**: Stores `first_name`, `last_name`, `email`, encrypted `password`, and optional `profile_picture`.
2. **`posts`**: Relates to `users(id)`. Stores the `content`, an `image_url` for media attachments, and a dynamic `visibility` enum (`'public'`, `'private'`).
3. **`comments`**: Enables n-level deep nested discussions by pointing to `post_id` and utilizing a self-referencing `parent_id` (for replies).
4. **`likes`**: A polymorphic association table supporting `target_type` (`'post'`, `'comment'`) and `target_id`. Enforces a unique constraint to ensure users can only like a target once.
5. **`notifications`**: To track and manage asynchronous notifications when a user interacts (likes, comments) with another user's post.

---

## 4. Backend Routing & Workflow

The Node.js backend (`backend/src/routes`) exposes RESTful endpoints, secured via JWT middleware.

### Authentication Flow (`backend/src/routes/auth.ts`)
1. **Registration**: Validates input, hashes the incoming password via `bcryptjs`, then stores the user in the database.
2. **Login**: Verifies credentials. On success, signs a JWT containing the `user_id` and forwards it to the client. The frontend then persists this token to handle protected routes and API calls.

### Feed & Interactivity Flow (`backend/src/routes/posts.ts`)
1. **Fetching the Feed**: 
   - A highly optimized route uses Knex to construct SQL joins tying `posts` to their respective author `users` fields.
   - For a logged-in user, the query filters out other users' `private` posts, adhering strictly to the visibility rules modeled in the requirements.
   - Results are sorted descending by `created_at` utilizing standard best DB indexing practices for millions of reads.
2. **Creating Posts**: Uses `multer` to handle `multipart/form-data` allowing textual data and image uploads tightly coupled in a single transactional request.
3. **Dynamic Interactivity**: Dedicated endpoints to toggle *Like* systems and inject nested *Comments/Replies*. 

### Real-time Considerations
The backend initializes `socket.io` in the overarching `package.json` stack. This paves the way for live streaming of new posts, comment triggers, and instant typing indicators mirroring the highest UX benchmarks of a real social platform.

---

## 5. Security Practices

- **Authentication Guarding**: The frontend uses a root layout or specific HOC checks to immediately boot unauthenticated users back to the `/login` route.
- **SQL Injection Prevention**: Heavy reliance on `knex.js` automatically mitigates raw SQL injection due to driver-level parameterized query compilation.
- **Data Pruning**: Passwords and sensitive user markers are stripped off the user model in the API responses before transmission to the frontend endpoints.

## Conclusion

By carefully dismantling the initial flat HTML mockups into logical React component trees and backing them with a robust Express + MySQL infrastructure handling authentication and dynamic states, an inherently resilient, scalable, and highly interactive application architecture was realized.
