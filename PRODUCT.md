# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Friends, fellow developers, and people from the owner's online circles (Telegram, GitHub, Instagram, Spotify) who land on zaebal.dev from a profile link. They are not evaluating a vendor; they come to see who ForeverInLaw is, what they have been building lately, and what they are listening to. Clients and recruiters may pass through, but the page is not tuned for them.

## Product Purpose

A personal home page for ForeverInLaw (Sergei), a developer who builds Telegram bots, P2P software, Go/Python backends, Tauri apps, and animated web. It exists as self-expression: a place that reads as *theirs*, collects their work and live activity, and points to every channel they are on. Success is a visitor leaving with a clear sense of the person: their taste, night-owl rhythm, music, and the things they ship.

## Positioning

Not a freelancer portfolio. The page is a living personal space: the work list sits next to what is playing on Spotify right now, their curated playlists, and their GitHub activity, so the visitor sees the work and the life around it together.

## Operating Context

- Visitors arrive mostly from social bios and messenger links, often on a phone, often at night.
- Live data: now-playing Spotify card served by a Cloudflare worker (`worker/`, proxied at `/api/now-playing`), playlists from `/api/playlists`, GitHub stats SVGs refreshed by a GitHub Action into `assets/`.
- Static site built with Vite (vanilla JS modules in `js/modules/`, CSS in `css/`), deployed to `zaebal.dev` via CNAME.

## Capabilities and Constraints

Must keep:
- Spotify now-playing card and the playlists collection.
- GitHub statistics (overview + contribution map, dark/light SVGs in `assets/`).
- Selected Works list with real entries (name, year, role Client/Solo/Team, status Active/WIP/OSS/Archived, stack tags, link, optional screenshot in `screenshots/`).
- Contact links: Telegram, GitHub, email (obfuscated), YouTube, Instagram, Spotify.

Optional, may be dropped in a redesign: the "Slide to enter" entry screen, the light theme toggle.

## Brand Commitments

- Name: ForeverInLaw; domain zaebal.dev.
- Voice: short, dry, a little self-ironic, in English ("I build things that move… Mostly after dark.", "The Grind — Proof of work.").
- The night-time rhythm and music are real parts of the identity; the current purple/pink look is not binding.

## Evidence on Hand

- Project entries and screenshots: `index.html`, `screenshots/*.webp`.
- GitHub stats SVGs: `assets/stats-*.svg`, `assets/chart-*.svg`.
- OG image `og.png`, favicon set.
- No testimonials, client logos, or metrics; do not invent them.

## Product Principles

- The person first: every section should say something about who they are, not just list output.
- Live over static: real now-playing, real activity, real dates beat decorative filler.
- Work is shown, not described: projects lead with name, status and what they are, then details.
- Fast and light on a phone at night.
