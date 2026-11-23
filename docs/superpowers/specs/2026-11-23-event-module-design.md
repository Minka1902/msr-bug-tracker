# Event module: design

Cards: BUGTRK-53 (build it), BUGTRK-55 (plan it). Status: proposal, waiting for the decisions in [Open decisions](#open-decisions).

## Goal

One project per event, where everyone invited can see what's happening, say if they're coming, and take a share of the work. Five event types: a **shared meal**, a **gathering**, **glamping**, **camping** and a **hike**.

## What exists today

- `shared/src/modules.ts`: `event` is already in `COMING_SOON_MODULES`, with the icon `sparkles`, the step task types (`task`, `errand`, `discussion`) and the text "Weddings, birthdays and parties". It's already listed in the **Personal** and **Pro** plans.
- `calendar_events` (`009_calendar.sql`): project events with title, location, start, end, all-day, and attendees (`calendar_event_attendees`, users only). There's an ICS feed per user (`calendar/feed.ts`).
- `invites` (`008_invites.sql`): link or email invites into a project role, with `max_uses` and `expires_at`.
- `shopping_lists` / `shopping_items` (`010_household.sql`, `030_shopping_item_url.sql`): named lists of checkable items, with a link.
- `household_places` (`028`): saved addresses with maps links.
- Bots (Telegram/Discord) send digests and reminders in English, Hebrew and Russian (`029_bot_language`).
- The AI planner (`modules/planner`) turns an idea plus answers into dated steps, features and decisions, or hands it to the AI worker.

The Event module is mostly a new **template plus three small tables** on top of these.

## Event types

Each type is a template. Choosing it seeds the labels, a task timeline (dates relative to the event day), the lists, and which sections the event page shows.

| Type            | Seeds                                                                                                                                                                                                                                 | Sections shown                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shared meal** | Lists: _Dishes_ (slots by course: starter, main, side, dessert, drinks), _Shopping_. Tasks: send invites (-14d), confirm the menu (-3d), shop (-1d), set the table (0d). Labels: _Vegetarian_, _Vegan_, _Gluten-free_, _Nut allergy_. | Details, Guests and RSVP with diet, Who brings what, Seating (count only in the MVP)                                                       |
| **Gathering**   | Lists: _Who brings what_. Tasks: pick the venue (-21d), send invites (-14d), agenda (-3d).                                                                                                                                            | Details, Guests, Agenda (itinerary), Who brings what                                                                                       |
| **Glamping**    | Lists: _Packing (light)_. Tasks: book (-60d), pay the deposit (-45d), arrange rides (-7d).                                                                                                                                            | Details with the booking link, Guests, Rides, Packing, Costs                                                                               |
| **Camping**     | Lists: _Shared gear_, _Personal packing_, _Food per day_. Tasks: book the site / permit (-30d), gear check (-7d), buy food (-2d), check the weather and fire rules (-1d). Labels: _Gear_, _Food_, _Water_.                            | Details, Guests, Rides, Gear and packing, Meal plan per day, Weather, Costs                                                                |
| **Hike**        | Lists: _Personal packing_ (water per person: 1 L per 2 hours, worked out from the duration). Tasks: choose the trail (-14d), arrange the car shuttle (-3d), check the weather (-1d), send the safety contact the route (0d).          | Details with trail link, distance, climb, difficulty, start and end point; Guests; Rides and car shuttle; Packing; Safety contact; Weather |

## Shared building blocks

Every type uses the same blocks; the template only switches them on.

1. **Details.** Date or date range, start time, location (a saved Place, or a free address with Google Maps / Waze links), meeting point. Stored as one `calendar_events` row with `project_id`, so it shows in everyone's calendar and ICS feed.
2. **Guests and RSVP.** _Going / Maybe / Can't_, `+N` extra people, diet notes, "needs a ride". Guests can be members, or (see decision 2) people without an account who answer through an invite link.
3. **Who brings what.** A shopping list whose items can be **claimed** by a guest ("I'll bring it"). The host sees what is still unclaimed.
4. **Packing.** Two lists: _Shared_ (claimable, as above) and _Personal_ (a template each guest gets a private copy of).
5. **Rides.** Drivers offer seats; guests who need a ride pick a car. The hike type adds the **car shuttle** (cars left at the end point).
6. **Itinerary.** Ordered time slots for the day (or days), shown as a timeline.
7. **Costs and split.** Expenses with who paid; an even split, or per unit (glamping tents, rooms). It shows who owes whom with the fewest transfers.
8. **Timeline tasks.** The template's tasks are dated relative to the event day. Moving the event date moves every open task with it.
9. **Polls.** A `discussion` card with options ("Which weekend?", "Which trail?"). The host closes it with the decision.
10. **Reminders.** Bot reminders in the guest's language: RSVP still open (-7d), your item is still unclaimed (-2d), the plan for tomorrow (-1d, 18:00), and for hikes and camping, the weather and the safety contact.
11. **AI plan.** The startup planner, pointed at events: it asks how many guests, the budget and the place, then fills the lists and tasks for the chosen type.

## Data model (MVP)

New migration `032_events.sql`:

```sql
ALTER TABLE projects ADD COLUMN event_type text
  CHECK (event_type IN ('meal','gathering','glamping','camping','hike'));

CREATE TABLE event_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  rsvp text NOT NULL DEFAULT 'pending' CHECK (rsvp IN ('pending','going','maybe','declined')),
  extra integer NOT NULL DEFAULT 0 CHECK (extra BETWEEN 0 AND 20),
  diet text NOT NULL DEFAULT '' CHECK (char_length(diet) <= 300),
  needs_ride boolean NOT NULL DEFAULT false,
  token_hash bytea UNIQUE,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

ALTER TABLE shopping_items ADD COLUMN claimed_by uuid REFERENCES event_guests(id) ON DELETE SET NULL;
```

- `event_guests.user_id` is null for a guest without an account; their invite link carries a token (hashed, like `invites`).
- Headcount is `count(*) + sum(extra) WHERE rsvp = 'going'`, one query.
- Phase 2 adds `event_rides`, `event_slots` (itinerary), and Phase 3 `event_expenses`.

## Phases

| Phase       | Ships                                                                                                                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MVP**     | `event` becomes available. Event type picker, Details (calendar event), Guests and RSVP (members, plus link guests if decision 2 says yes), Who brings what with claims, timeline tasks, the five templates. |
| **Phase 2** | Packing (shared and personal), Rides and car shuttle, Itinerary, polls from templates, AI plan for events.                                                                                                   |
| **Phase 3** | Costs and split, RSVP and "I'll bring it" from the bot, weather for hikes and camping, a guest view that needs no sign-in at all.                                                                            |

## Open decisions

These are discussion cards under BUGTRK-53, for Michael:

1. **One event per project, or several?** One keeps the page simple; several suits "the family's events this year".
2. **Guests without an account?** Answering by link only is much easier for guests, but it needs a token-only public page and spam limits.
3. **Which plans include Event?** It's listed in Personal and Pro today. Keep that, or Pro only?
4. **Its own roles (Host / Co-host / Guest), or the household roles?** New roles are clearer; reusing household roles is less work.
5. **Cost split in the MVP, or Phase 3?** It's the most-wanted part of camping and glamping trips, but also the largest.
6. **The shared meal: build it in MSR, or link to Flavor AI** (FA-3 / FA-18)? Linking avoids two recipe and menu systems.

## Testing

- Server: RSVP counts, claim and unclaim, a link guest can answer only their own RSVP, moving the event date moves open timeline tasks, one statement per bulk change.
- Client: each template seeds its sections; RSVP on a phone; claiming an item.
- e2e: create a camping event, invite by link, the guest answers _Going_ with +1, claims the tent, and the host sees a headcount of 3 and the tent claimed.
