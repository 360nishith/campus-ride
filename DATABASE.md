# Campus Ride Supabase Database

This repo currently stores everything in `localStorage`. The SQL in
`supabase/schema.sql` converts that browser-only model into real Supabase
tables with Auth, Storage, and row-level security.

## Current frontend storage map

| Current key/file | Meaning | Supabase table |
| --- | --- | --- |
| `campusRideCurrentUser` in `auth.js` | Logged in email, role, name | Supabase Auth + `profiles` + `user_roles` |
| `campusRideStudentVerifications` | Shared passenger/rider student details and uploaded ID filenames | `student_profiles`, `rider_profiles`, `verification_documents` |
| `campusRideRiderRides` | Rides posted by riders | `rides` |
| `campusRidePassengerBookings` | Passenger-selected ride and UPI payment link | `ride_bookings` |
| `campusRideApplications` | Rider dashboard ride requests | `ride_bookings` with `pending/accepted/rejected` status |

## Main entities

- `profiles`: one row per Supabase Auth user. Only `@nmamit.in` emails are allowed.
- `user_roles`: lets one student be both a passenger and a rider.
- `student_profiles`: USN, branch, year, phone, usual pickup, and college ID verification state.
- `rider_profiles`: rider-specific onboarding fields such as UPI ID.
- `verification_documents`: private Storage paths for college ID and driving licence images.
- `rides`: rider-created routes, seats, cost per km, optional distance/time/vehicle details.
- `ride_bookings`: passenger ride requests/bookings and payment state.

## Suggested Supabase setup

1. Create a Supabase project.
2. In Authentication settings, enable email/password login.
3. Paste `supabase/schema.sql` into the SQL Editor and run it.
4. In the frontend, replace localStorage auth with `supabase.auth.signUp()` and pass metadata:

```js
{
  email,
  password,
  options: {
    data: {
      full_name: name,
      role: "passenger" // or "rider"
    }
  }
}
```

5. Upload verification images to the private `verification-documents` bucket using paths like:

```text
<auth-user-id>/college_id_front.jpg
<auth-user-id>/driving_license_front.jpg
```

6. Insert the uploaded file paths into `verification_documents`.

## Notes for the current app

- The frontend does not collect ride departure time or vehicle details yet, but the database has optional columns for them because passengers already display `time` and `vehicle` in demo data.
- `available_rides` is a view that gives passenger pages the rider name, UPI ID, route, seats, and fare inputs in one query.
- Accepted bookings determine `seats_booked`; it is exposed through `ride_seat_summary` instead of being manually edited in multiple places.
