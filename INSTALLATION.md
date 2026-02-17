# 📖 INSTALLATION GUIDE

## Prerequisites

- **Node.js** 18 or higher
- **npm** or **yarn**
- **Supabase account** (free tier works!)
- **Git** (optional, for version control)

---

## Step 1: Extract Project

Extract the ZIP file to your desired location:
```
C:\Users\YourName\Projects\edutrack
```

---

## Step 2: Install Dependencies

Open terminal in the project folder and run:

```bash
npm install
```

This will install all required packages (~2 minutes).

**Expected packages:**
- next
- react
- @supabase/ssr
- @supabase/supabase-js
- xlsx
- tailwindcss
- typescript

---

## Step 3: Set Up Supabase

### 3.1 Create Supabase Project

1. Go to https://supabase.com
2. Click "New Project"
3. Fill in details:
   - Name: EduTrack (or any name)
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Wait for project to be ready (~2 minutes)

### 3.2 Get Credentials

1. Go to Project Settings → API
2. Copy:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

### 3.3 Configure Environment

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and paste your credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your-key-here
   ```

---

## Step 4: Import Database

### 4.1 Go to SQL Editor

In Supabase Dashboard:
- Click "SQL Editor" in left sidebar
- Click "New Query"

### 4.2 Run Scripts in Order

Run each script from `SQL_Scripts/` folder:

**Core Tables (Required):**
1. `01-schema.sql` - Creates all tables
2. `02-rls-policies.sql` - Security policies

**Master Data (Required):**
3. `03-institution.sql` - Your institution
4. `04-academic-year.sql` - Academic year
5. `05-users.sql` - Faculty members (30)
6. `06-subjects.sql` - Subjects (37)
7. `07-divisions.sql` - Divisions (22)
8. `08-topics.sql` - Topics (876)
9. `09-assignments.sql` - Faculty assignments (247)

**Historical Data (Optional but Recommended):**
10. `PART-01-syllabus-import.sql` through `PART-10-syllabus-import.sql`
    - These add 1,618 historical syllabus entries
    - Each takes ~30 seconds to run
    - Total time: ~5 minutes

### 4.3 Verify Import

Run this query to verify:
```sql
SELECT 
  (SELECT COUNT(*) FROM institutions) as institutions,
  (SELECT COUNT(*) FROM users) as users,
  (SELECT COUNT(*) FROM subjects) as subjects,
  (SELECT COUNT(*) FROM divisions) as divisions,
  (SELECT COUNT(*) FROM topics) as topics,
  (SELECT COUNT(*) FROM faculty_assignments) as assignments,
  (SELECT COUNT(*) FROM syllabus_entries) as entries;
```

**Expected counts:**
- institutions: 1
- users: 30
- subjects: 37
- divisions: 22
- topics: 876
- assignments: 247
- entries: ~1,700 (if you ran PART-01 to PART-10)

---

## Step 5: Run Development Server

```bash
npm run dev
```

Open browser: http://localhost:3000

You should see the beautiful login page! 🎉

---

## Step 6: Test Login

Use any faculty email from the database:

**Example logins:**
- Email: `preddy.k@andhraeducationsocietymumbai.org`
- Password: `Welcome@123`

**Admin login:**
- Email: `admin@sampleschool.edu`
- Password: `Welcome@123`

---

## Step 7: Verify Everything Works

### ✅ Test Checklist:

1. **Login** - Can you login successfully?
2. **Dashboard** - Do you see your subjects/stats?
3. **Navigation** - Can you click sidebar links?
4. **Entries Page** - Can you select division & subject?
5. **Data Entry** - Can you enter syllabus data?
6. **Save** - Does saving work?
7. **Admin Access** - Can admin see all data?

---

## 🐛 Troubleshooting

### "Module not found" errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### "Invalid Supabase URL"
- Verify `.env.local` exists
- Check URL format is correct
- Restart dev server (Ctrl+C, then `npm run dev`)

### "Cannot connect to database"
- Check Supabase project is active
- Verify API keys are correct
- Ensure RLS policies ran successfully

### "Login fails"
- Verify user exists in database
- Check password is `Welcome@123`
- Look at browser console (F12) for errors

### "No data showing"
- Verify all SQL scripts ran
- Check faculty_assignments exist
- Ensure RLS policies allow data access

### "Page not found" (404)
- Check URL is exactly `/dashboard` (lowercase)
- Verify middleware.ts exists
- Restart server

---

## 🚀 Production Deployment

### Option 1: Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

Vercel auto-detects Next.js and handles everything.

### Option 2: Build Manually

```bash
npm run build
npm start
```

Then deploy `/.next` folder to your server.

---

## 📝 Post-Installation

### Change Default Passwords
1. Go to Supabase Dashboard → Authentication → Users
2. Update passwords for all faculty
3. Send new credentials to faculty

### Customize
- Update institution name
- Change color scheme in `tailwind.config.ts`
- Add your logo
- Modify sidebar menu

### Backup
- Export database regularly
- Keep SQL scripts safe
- Version control with Git

---

## 🎯 Next Steps

Once installed:
1. Test with multiple users
2. Enter sample data
3. Verify all features work
4. Train faculty on usage
5. Plan Phase 2 features

---

## 📞 Need Help?

- Read `PROJECT_REVIEW.md` for detailed analysis
- Check `PHASE_2_ROADMAP.md` for upcoming features
- Review code comments in files

---

**Installation time:** ~30 minutes total

**You're all set! Enjoy using EduTrack! 🎉**
