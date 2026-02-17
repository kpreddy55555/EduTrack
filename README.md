# 🎓 EduTrack - Syllabus Management System

A modern, multi-tenant syllabus tracking system for educational institutions.

**Built for:** The Andhra Education Society's Junior College, Mumbai  
**Version:** 2.0.0  
**Status:** Production Ready ✅

---

## ✨ Features

### 🔐 Authentication
- Secure login with Supabase Auth
- Role-based access control
- Session management
- Auto-redirect based on role

### 📊 Dashboards
- **Faculty Dashboard** - Personalized view with your subjects and progress
- **Admin Dashboard** - Institution-wide overview with statistics
- Real-time progress tracking
- Recent activity display

### 📝 Syllabus Management
- Easy topic-wise entry
- Division & subject selection
- Date tracking per topic
- Lectures taken vs allocated
- Status management (Not Started/In Progress/Completed)
- Auto-calculated completion percentage
- Remarks field

### 📈 Progress Tracking
- Subject-wise progress view
- Division breakdowns
- Visual progress indicators
- Completion statistics

### 👥 Admin Features
- Faculty management
- Subject management
- Division management
- Settings configuration
- Reports (placeholder - Phase 2)

### 🎨 Beautiful UI
- Modern dark theme with glass effects
- Animated background elements
- Smooth transitions
- Fully responsive design
- Mobile-friendly interface

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Supabase

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```

Get your credentials from:
- Supabase Dashboard → Project Settings → API → Project API keys → `anon public`

### 3. Set Up Database

Run the SQL scripts in `SQL_Scripts/` folder in your Supabase SQL Editor (in order):
1. `01-schema.sql` - Create tables
2. `02-rls-policies.sql` - Security policies
3. `03-institution.sql` - Institution setup
4. `04-academic-year.sql` - Academic year
5. `05-users.sql` - Faculty members
6. `06-subjects.sql` - Subjects
7. `07-divisions.sql` - Divisions
8. `08-topics.sql` - Topics
9. `09-assignments.sql` - Faculty assignments
10. `PART-01` through `PART-10` - Historical syllabus entries (optional)

### 4. Run Development Server

```bash
npm run dev
```

### 5. Open Browser

Go to: http://localhost:3000

**Test Login:**
- Email: (any faculty email from database)
- Password: Welcome@123

---

## 📁 Project Structure

```
edutrack/
├── app/
│   ├── page.tsx                    # Login page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles + animations
│   ├── api/                        # API routes (if any)
│   └── (dashboard)/                # Protected dashboard routes
│       ├── layout.tsx              # Dashboard layout (sidebar + header)
│       ├── dashboard/page.tsx      # Main dashboard
│       ├── entries/page.tsx        # Syllabus entry form
│       ├── progress/page.tsx       # Progress tracking
│       ├── faculty/page.tsx        # Faculty management
│       ├── subjects/page.tsx       # Subject management
│       ├── divisions/page.tsx      # Division management
│       ├── settings/page.tsx       # Settings
│       └── reports/page.tsx        # Reports (Phase 2)
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # Client-side Supabase
│   │   └── server.ts               # Server-side Supabase
│   └── excel-utils.ts              # Excel export utilities
├── types/
│   └── database.types.ts           # TypeScript type definitions
├── components/
│   └── Modal.tsx                   # Reusable modal component
├── middleware.ts                   # Auth middleware protection
├── .env.local.example              # Environment variables template
├── package.json                    # Dependencies
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
└── README.md                       # This file
```

---

## 🔒 Routes

| URL | Page | Auth Required | Role |
|-----|------|---------------|------|
| `/` | Login | No | - |
| `/dashboard` | Dashboard | Yes | All |
| `/entries` | Syllabus Entry | Yes | Faculty |
| `/progress` | Progress View | Yes | All |
| `/faculty` | Faculty Management | Yes | Admin |
| `/subjects` | Subject Management | Yes | Admin |
| `/divisions` | Division Management | Yes | Admin |
| `/settings` | Settings | Yes | All |
| `/reports` | Reports | Yes | All |

---

## 🎨 Design System

**Theme:** Modern dark mode with glass morphism effects

**Colors:**
- Primary: Amber (#fbbf24 to #f59e0b)
- Success: Emerald (#10b981)
- Background: Slate (#0f172a, #1e293b)
- Text: White/Slate variations
- Accents: Glass effects with backdrop blur

**Typography:** Inter font family (via Tailwind)

**Components:**
- Glass cards with border glow
- Smooth hover transitions
- Animated background elements
- Responsive grid layouts

---

## 🔧 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Excel Export:** xlsx library
- **Deployment:** Vercel-ready

---

## 📊 Database Schema

### Tables
- `institutions` - Educational institutions
- `academic_years` - Academic year definitions
- `users` - Faculty and admin users
- `subjects` - Academic subjects
- `divisions` - Class divisions
- `topics` - Curriculum topics
- `faculty_assignments` - Faculty-subject-division mappings
- `syllabus_entries` - Teaching records

### Security
- Row Level Security (RLS) enabled
- Role-based access policies
- Institution data isolation

---

## 🚧 What's Next (Phase 2)

### Reports & Analytics
- [ ] Faculty progress reports
- [ ] Subject completion charts
- [ ] Monthly trend analysis
- [ ] Department comparisons
- [ ] Excel/PDF export integration

### Bulk Operations
- [ ] CSV/Excel data import
- [ ] Bulk entry templates
- [ ] Copy previous month
- [ ] Bulk status updates

### Enhancements
- [ ] Real-time charts (Chart.js)
- [ ] Email notifications
- [ ] Calendar view
- [ ] Progressive Web App (PWA)

---

## 📝 Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

---

## 🔐 Environment Variables

Required variables in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=        # Your Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # Your Supabase anon/public key
```

---

## 📞 Support

For issues or questions:
- Check documentation in `DOCS/` folder
- Review project review: `PROJECT_REVIEW.md`
- Contact institution admin

---

## 📄 License

Private - The Andhra Education Society's Junior College, Mumbai

---

**Built with ❤️ for educational excellence**

*Version 2.0.0 - January 2025*
