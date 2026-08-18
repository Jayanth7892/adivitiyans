# Faculty Mentor Assignment — Implementation Plan

## What We're Building

Admin uploads a CSV → students get assigned to faculty mentors → faculty logs in and sees all their mentees with full progress/performance details, grouped by year.

---

## Current State (What Already Exists)

| ✅ Already Done | Location |
|---|---|
| `students.faculty_mentor_id` FK column | DB schema |
| `faculty` table (`faculty_id`, `name`, `email`) | DB schema |
| `GET /faculty/:id/mentees` — returns mentees list | `api.ts:2234` |
| `GET /faculty/by-email/:email` — exact email lookup | `api.ts:2218` |
| Faculty dashboard with mentee list + 360° drill-down | `FacultyDashboardPage.tsx` |

**What's missing:** CSV upload → auto-create faculty by name → assign students → year-grouped view + email fuzzy match

---

## Phase 1 — Backend (`api.ts`)

### 1A. New Route: `POST /mentor-assignments/upload`
**Role guard:** `admin` only

**Request body:**
```json
{
  "rows": [
    { "roll1": "24091A32A3", "roll2": "24091A32E9", "facultyName": "Dr B.Bhaskara Rao" },
    { "roll1": "24091A32J7", "roll2": "",            "facultyName": "Dr B.Bhaskara Rao" },
    { "roll1": "25095A3227", "roll2": "25095A3221",  "facultyName": "Dr P.Kiran Rao"    }
  ]
}
```

**Processing logic:**
```
For each row:
  1. Normalize facultyName → strip "Dr/Prof", lowercase, remove spaces
     "Dr B.Bhaskara Rao" → "bbhaskararao"

  2. Look up faculty by name (case-insensitive TRIM match):
     SELECT * FROM faculty WHERE LOWER(TRIM(name)) = LOWER(TRIM($1))

  3. If NOT found → auto-create faculty record:
     faculty_id = "FAC_" + slug   e.g. "FAC_BBHASKARARAO"
     name       = "Dr B.Bhaskara Rao"
     email      = placeholder "pending_bbhaskararao@rgmcet.edu.in"
     department = "CSE(Data Science)"
     role       = "mentor"

  4. For roll1 and roll2 (if not blank):
     UPDATE students SET faculty_mentor_id = <resolved_id>
     WHERE UPPER(roll_number) = UPPER($roll)

  5. Track: updated / notFoundRolls / autoCreatedFaculty
```

**Response:**
```json
{
  "updated": 12,
  "notFoundRolls": ["24091A32XX"],
  "autoCreatedFaculty": ["Dr P.Kiran Rao"],
  "alreadyExistedFaculty": ["Dr B.Bhaskara Rao"]
}
```

---

### 1B. Update: `GET /faculty/by-email/:email`
**Current:** exact email match only → 404 if not found

**New 3-tier lookup:**
```
Tier 1: Exact email match in faculty table → return ✅

Tier 2: Extract name token from email prefix
        "bhaskararao@rgmcet.edu.in" → "bhaskararao"
        Normalize all faculty names → find closest match
        Match found? → UPDATE faculty SET email = $1
                       → return faculty record ✅

Tier 3: No match → 404
        (Admin links manually via PATCH)
```

---

### 1C. New Route: `PATCH /faculty/:id/email`
**Role guard:** `admin` only

For role-based emails that can't be name-matched (e.g., `hcseds@rgmcet.edu.in`).

```json
PATCH /faculty/FAC_BBHASKARARAO/email
{ "email": "hcseds@rgmcet.edu.in" }
```

---

### 1D. New Route: `GET /faculty`
Lists all faculty records with mentee counts (for admin table).

```sql
SELECT f.*, COUNT(s.roll_number) AS mentee_count
FROM faculty f
LEFT JOIN students s ON s.faculty_mentor_id = f.faculty_id
GROUP BY f.faculty_id
ORDER BY f.name
```

---

## Phase 2 — Admin Dashboard (`AdminDashboardPage.tsx`)

### 2A. CSV Upload Card (in Faculty & Mentors tab)

```
┌──────────────────────────────────────────────────────┐
│ 📂 Upload Mentor Assignment CSV                      │
│                                                      │
│  Format: S.No | Roll 1 | Roll 2 | Faculty Name | PS │
│  (Roll 2 and PS No. are optional/ignored)            │
│                                                      │
│  [ Drop CSV here or click to browse ]                │
│                                                      │
│  ── Preview ─────────────────────────────────────── │
│  Dr B.Bhaskara Rao → 10 students                    │
│  Dr P.Kiran Rao    →  4 students  🆕 new faculty     │
│                                                      │
│              [Cancel]  [Upload & Assign →]           │
│                                                      │
│  Result:                                             │
│  ✅ 12 students assigned                             │
│  ⚠️  1 roll not found: 24091A32XX                    │
│  🆕  Dr P.Kiran Rao auto-created                     │
└──────────────────────────────────────────────────────┘
```

### 2B. Faculty Records Table (in Faculty & Mentors tab)

```
┌──────────────────────────────────────────────────────────┐
│ Faculty Records                        [Upload CSV]      │
├───────────────────────┬──────────────┬────────┬─────────┤
│ NAME                  │ EMAIL        │MENTEES │ ACTION  │
├───────────────────────┼──────────────┼────────┼─────────┤
│ Dr B.Bhaskara Rao     │ hcseds@… ✅  │   24   │ 👥 View │
│ Dr P.Kiran Rao        │ ⚠️ Not linked │    8   │ ✏️ Link │
└───────────────────────┴──────────────┴────────┴─────────┘
```

- **👥 View** → opens mentee list for that faculty
- **✏️ Link** → modal to enter email → calls `PATCH /faculty/:id/email`

---

## Phase 3 — Faculty Dashboard (`FacultyDashboardPage.tsx`)

### 3A. Mentees Grouped by Year/Batch

**Current:** flat list  
**New:** collapsible year groups with at-a-glance stats

```
My Mentees — 52 total
┌──────────────────────────────────────────────────┐
│  52 Mentees  |  7.8 Avg CGPA  |  12 At Risk ⚠️   │
└──────────────────────────────────────────────────┘

▼ 4th Year · Batch 2022–2026  (11 students)
  NAME            ROLL        CGPA    LC    CERTS
  Ravi Kumar      22091A3227   8.5   145     3
  ⚠️ Sai Kumar    22091A3204   5.4     0     0   ← red: CGPA < 6

▼ 3rd Year · Batch 2023–2027  (14 students)
  ...

▼ 2nd Year · Batch 2024–2028  (15 students)
  ...

▼ 1st Year · Batch 2025–2029  (12 students)
  ...
```

> Red flag ⚠️ = CGPA below 6.0 or zero activity (0 LC solved, 0 certs)

### 3B. Click Student → Full 360° Profile (already works)
Faculty clicks any student → existing drill-down panel opens with all 8 tabs:
Personal Info · Academics · Coding Profiles · Tech Skills · Certs · Achievements · Placement

**No changes needed here.**

---

## File Changes Summary

| File | Change |
|---|---|
| [`api.ts`](file:///d:/dept/new/adivitiyans/backend/src/handlers/api.ts) | 4 routes: POST upload, GET faculty list, PATCH email, update by-email |
| [`AdminDashboardPage.tsx`](file:///d:/dept/new/adivitiyans/frontend/src/features/admin/AdminDashboardPage.tsx) | CSV upload card + faculty records table with email link modal |
| [`FacultyDashboardPage.tsx`](file:///d:/dept/new/adivitiyans/frontend/src/features/faculty/FacultyDashboardPage.tsx) | Mentee list grouped by year/batch, collapsible, at-risk flagging |

> [!NOTE]
> No DB schema changes needed — `faculty_mentor_id` and `faculty` table already exist.

---

## CSV Parsing (browser-side, no library needed)

```
Raw row:  "1,24091A32A3,24091A32E9,Dr B.Bhaskara Rao,102"

col[0] = "1"                    → skip (serial number)
col[1] = "24091A32A3"           → roll1
col[2] = "24091A32E9"           → roll2 (empty = skip)
col[3] = "Dr B.Bhaskara Rao"    → facultyName
col[4] = "102"                  → skip (problem statement no.)
```

Smart detection: if col[2] starts with letters and contains spaces (looks like a name), treat it as facultyName and col[3] as blank.

---

## Edge Cases

| Case | Handling |
|---|---|
| Roll number not in DB | Skipped, reported in `notFoundRolls[]` |
| Faculty name not in DB | Auto-created with generated `faculty_id` |
| Role-based email (`hcseds@`) | Admin manually links via ✏️ Link button |
| Name-based email (`bhaskararao@`) | Auto-matched on login via Tier 2 fuzzy |
| HOD who is also a mentor | Same faculty record → same mentee list |
| Same student in 2 rows | Last row wins (idempotent `UPDATE`) |
| Re-upload same CSV | Safe — no duplicates, just reassigns |
| Faculty name typo | Treated as new faculty — admin can re-upload with correct name |

---

## Implementation Order

```
Step 1 → backend: POST /mentor-assignments/upload  (core assignment)
Step 2 → backend: GET /faculty                     (admin list)
Step 3 → backend: PATCH /faculty/:id/email         (admin link)
Step 4 → backend: GET /faculty/by-email (update)   (login fuzzy match)
Step 5 → frontend: Admin CSV upload card
Step 6 → frontend: Admin faculty records table + email link modal
Step 7 → frontend: Faculty dashboard year-grouped mentee view
```
