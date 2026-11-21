# RoadForge public viewer and embedding

Status: implemented on `feat/public-roadmap-embed` for the 0.3.0 line.
This report describes the branch. It does not claim that the hosted Anvilary
demo serves this feature, and it does not change the 0.2.0 release metadata.
The license remains the PolyForm Noncommercial License 1.0.0.

Verdict: **PASS**

The checks below are the ones that actually ran. Limitations that were not
independently measured are listed at the end.

## Architecture

### Design decisions

Public access is a separate publication resource. It does not reuse owner,
editor, or viewer invite tokens, session tokens, passwords, or edit locks.
The FastAPI app owns publication. There is no second backend service and no
new WebSocket channel.

A browser-local roadmap cannot be published. Share explains that, and Enable
sharing opens the existing save confirmation. Saving a server copy does not
publish it.

While a publication stays `published`, a later publish keeps the same public
id. Saved changes to the allowlisted fields, including tasks added later,
become public. Unsaved browser edits do not. Unpublishing rotates the public
id. Republishing rotates it again. Deleting the roadmap rotates it in the
same transaction as the soft delete.

The live viewer polls the public JSON every 15 seconds while the tab is
visible, with `credentials: 'omit'` and `If-None-Match`. It does not
subscribe to private collaboration events.

### Data model

Migration `0012_add_roadmap_publications` adds `roadmap_publications`:

| Column | Role |
| --- | --- |
| `id` | Internal row id, prefix `rpub_` |
| `roadmap_id` | One row per roadmap, foreign key with `ON DELETE CASCADE` |
| `public_id` | Opaque `pub_` id, unique, not an invite token |
| `status` | `published` or `unpublished` |
| `published_at`, `unpublished_at`, `created_at`, `updated_at` | Lifecycle times |

Public reads join the publication to the roadmap and require `status =
published` and `roadmaps.deleted_at IS NULL`. The public id must match
`^pub_[A-Za-z0-9_-]{16,80}$`.

### Authorization

Owner sessions can read publication status, publish, and unpublish.
Editors, viewers, anonymous callers, and revoked owner sessions cannot
change publication state. The checks are in the existing participant
dependency. Hidden buttons are not the boundary.

Anonymous callers can read only the published projection and its PNG.
Unknown, unpublished, malformed, and deleted ids all return `404` with
`Published roadmap not found`.

### Public projection

The public payload is built from an allowlist over `roadmaps.name` and
`snapshot_json`. It is not the authenticated roadmap response with fields
removed.

Public: title; phase id, number, name, hex color, status, and recomputed
progress; task id, title, completion, complexity, tags, same-phase parent,
and dependencies that refer to known task ids.

Private: descriptions, estimates, assignees, claims, the task `next` flag,
external links, owner name, password material, participants, activity,
versions, and the internal roadmap id.

Non-hex colors become `#d97442`. Unknown status values become `future`.
The JSON body is capped at 800,000 bytes by dropping tasks from the end and
marking the payload truncated. The Share section lists the same public and
private groups.

### Viewer routes

| Surface | Path |
| --- | --- |
| Owner publication API | `GET`, `POST`, and `DELETE /api/roadmaps/{roadmap_id}/publication` |
| Public JSON | `GET /api/public/roadmaps/{public_id}` |
| Public PNG | `GET /api/public/roadmaps/{public_id}/preview.png` |
| Viewer page | `/p/{public_id}` |
| Embed page | `/embed/{public_id}` |

Snippet URLs use `ROADFORGE_WEB_BASE_URL`. They are not taken from the
request `Host` header. The supported deployment is one HTTPS origin: nginx
serves the web app and proxies `/api/` to FastAPI.

`frame-ancestors *` and the omission of `X-Frame-Options` apply only to
`/embed/` plus a `pub_` id. `/p/`, the workspace, and other pages keep
`frame-ancestors 'none'` and `X-Frame-Options: DENY`. The nginx `location
/embed/` repeats the other security headers and omits `X-Frame-Options`
because nginx does not inherit `add_header` once a location sets any.

`ROADFORGE_DEV_API_PROXY` is a local `next dev` stand-in for that `/api/`
proxy. Production leaves it unset.

### Image rendering

The PNG is drawn in-process with Pillow at 1200 by 630. It shows the title,
overall progress, at most five phases, and at most two top-level tasks per
phase, plus a bounded "+ N more" line and the Anvilary attribution. It does
not launch a browser, fetch remote URLs, or write the title into a PNG text
chunk. The font and logo are packaged in the API wheel. An in-process cache
holds at most 32 images, keyed by public id and revision.

Successful JSON uses `Cache-Control: public, max-age=15` and an ETag.
Successful images use `public, max-age=60`. Misses use `no-store`.
Public API responses send `X-Robots-Tag: noindex`. The viewer pages ask
robots not to index them.

### Cache and rate limits

Owner routes, per participant: publication read 60/minute, publish 10/minute,
unpublish 10/minute. Anonymous routes, per client IP: public JSON 120/minute,
preview image 30/minute.

GitHub's image proxy can keep a README image longer than `max-age=60`.
The Markdown URL does not need to change when a task changes. The live
viewer is the current published state.

## Security

### Privacy boundaries

Publishing is opt-in. A viewer invite does not publish a roadmap. Public
responses do not include participant records, passwords, invite tokens, or
session tokens. The publish response was asserted not to echo the owner
session token.

User text is rendered as text in the viewer. Markdown alt text strips
brackets and angle brackets. Iframe attributes are HTML-escaped. The PNG
rasterizes text and does not request URLs from the roadmap.

### Threat assessment

The new unauthenticated surface is the public id plus the projection and
PNG. Guessing a private roadmap id does not reach it. The same 404 is used
for missing and revoked publications. Public ids are `secrets.token_urlsafe`
values, not sequential numbers.

Framing is relaxed only on the embed document. The embed has no mutation
controls and does not send cookies. Authenticated API responses keep the
existing frame denial. The dev API rewrite accepts only an http(s) origin
with an empty path, so it is not an open proxy.

### Publication and revocation

Unpublishing rotates `public_id` and sets `unpublished`. New viewer, embed,
and image requests for the old id return 404. Copies already stored by a
browser, GitHub, or another site cannot be recalled. The Share section says
that. Republish issues a new id, so old snippets must be replaced. Soft
delete does the same rotation inside the roadmap delete transaction.

### Security tests

`apps/backend/tests/test_publication.py` and
`apps/backend/unit_tests/test_publication_projection.py` cover:

- owner publish and anonymous allowlist read
- editor, viewer, and anonymous publish rejected
- unpublish, republish, and delete stop the old public id
- malformed and unknown ids return the same 404
- revoked owner session returns 401 and cannot publish
- a saved task update changes the public revision
- public read rate limiting
- concurrent publish keeps one public id
- private fields dropped, oversized JSON truncated, Unicode title kept
- escaped absolute snippets
- deterministic PNG with no script payload

The full backend suite on disposable database `roadforge_pub_embed` was
477 passed and 5 skipped. Backend publication code was not changed after
that run. The user's `roadforge` and `roadforge_test` databases were not
migrated. Port 7878 was not used.

Migration `0012` was upgraded from an empty disposable database. An earlier
upgrade, downgrade to `0011`, and upgrade cycle on that database also
reached head before pytest `drop_all` removed the tables. After that, the
database was dropped and created again, then upgraded to head for the
browser run. The downgrade was not repeated after that recreate.

The browser spec asserted that `/embed/{public_id}` has no
`X-Frame-Options` and that its CSP contains `frame-ancestors *`, and that
`/p/{public_id}` sends `X-Frame-Options: DENY`. In development the CSP
header is report-only. Production still enforces CSP.

### Remaining risks

A zone-wide `X-Frame-Options: DENY` in front of nginx will blank the iframe
unless `/embed/` is excluded. Third parties can keep a downloaded PNG or
HTML snapshot after unpublish. The image cache is per process, so several
API workers can each render the same revision once. No separate load test
was run.

## Product

### Share modal

Publish roadmap is a fifth disclosure after the private invite sections and
password protection. It starts collapsed. The warning states that anyone
with the public link can view the roadmap and that later saved changes may
become public. The same panel lists what visitors receive and what stays
private.

After publish, the owner can copy the viewer link, the GitHub Markdown, and
the website embed, open the public preview, and unpublish. Clipboard success
and failure come from the browser result in the unit tests.

A local-only roadmap explains that publishing needs a server copy and offers
Enable sharing. The save modal says that saving does not publish.

On a short viewport the modal body scrolls and the footer stays visible.
Confirm publish and confirm unpublish scroll into view when they appear.
At 320px the copy actions wrap onto their own rows.

### Viewer

The public page shows the title, overall progress, phases, tasks, completion,
and public details. Phases expand and collapse from the pointer and the
keyboard. There is no workspace header, share modal, import/export control,
or task editor. The attribution "Built with RoadForge by Anvilary.Tools"
links to `https://anvilary.tools/` and uses the existing logo. The
unavailable state keeps that attribution.

### GitHub preview

The copied snippet is one Markdown image wrapped in a link, with absolute
URLs from the configured origin. The browser run saved a 1200 by 630 PNG
for the published starter roadmap. It shows the title, 11% progress, three
phases, two tasks each, and the attribution. A direct API fetch of that PNG
returned `image/png` and `max-age=60` before the web-origin proxy was added.
The passing browser run then fetched the same URL on the web origin.

### Website iframe

The copied snippet is an iframe with `loading="lazy"`, a 100% width, a
620px height, and no border. The browser embedded that HTML on a separate
page. The frame rendered the read-only roadmap and the attribution at
1280 by 800 and at 375 by 812. Content below 620px scrolls inside the frame.

### Mobile

Viewport screenshots were inspected at 320 by 700, 375 by 812, 768 by 1024,
1280 by 800, 1440 by 900, and 1920 by 1080. The viewer keeps phase color,
task text, and attribution at those sizes. The share modal fits the 320px
width. The Next.js dev indicator overlaps the footer in local screenshots.
That badge is not part of the production page.

A saved completion change was visible after reload: the public viewer moved
from "1 of 9 tasks" to "2 of 9 tasks", and the first phase moved to 67%.
The 15 second poll itself is covered by the loader unit test, not by waiting
out the interval in the browser.

## Validation

### Backend

Command, from `apps/backend`, with
`TEST_DATABASE_URL=postgresql+asyncpg://roadforge:roadforge_dev@localhost:5433/roadforge_pub_embed`
and `safe-run`:

`477 passed, 5 skipped` in 35.36s.

`uv build --wheel` placed `DejaVuSans.ttf`, `DejaVu-LICENSE.txt`, and
`anvilary-logo.png` inside `roadforge_api-0.2.0-py3-none-any.whl`.
Ruff was clean on the publication changes after its autofix.

### Frontend

Targeted Vitest, `maxWorkers=2`: publication view, loader, section, Share
modal, and CSP. The last full targeted run before the confirm-scroll guard
was 33 passed aside from two section failures caused by jsdom missing
`scrollIntoView`. After the guard, `PublicRoadmapSection.test.tsx` passed
8 tests. Share modal remained 9 passed, with the existing `act()` warnings
from share-link loading.

`tsc --noEmit` exited 0 before the final scroll guard. The guard is a
type-safe function check. ESLint on the changed frontend files reported 0
errors. `ShareModal.tsx` still has its pre-existing unused `loading`
warning.

`tools/check-web-import-cycles.mjs` and `tools/check-product-copy.mjs`
passed. Product copy covered 26 surfaces. `tools/check-doc-links.mjs`
passed after this report existed: 158 local links in 69 files.
`tools/check-no-em-dash.mjs` passed on the tracked tree before these commits.
The new documents were scanned separately for U+2014 and U+2013 and had none.

### Browser

`playwright test --config playwright.public-viewer.config.ts --workers=1`
under `safe-run`, web on `127.0.0.1:3196`, API on `127.0.0.1:7896`,
database `roadforge_pub_embed`.

The final passing run completed the owner flow: local save, collapsed
publish section, confirmation, published snippets, viewer keyboard toggle,
six viewer sizes, PNG bytes, embed framing headers, iframe at two sizes,
saved task update, unpublish, and the unavailable viewer. Result:
`1 passed`.

Screenshots under `apps/frontend/test-results/public-viewer/` were inspected.
They are gitignored.

### Accessibility

The phase toggle uses `aria-expanded`. Enter collapsed and expanded it in
the browser. Overall progress exposes a progressbar with an accessible name.
The attribution is a link whose name includes the visible credit. The public
page has no disabled editing controls. An automated axe scan was not run.

### Performance

No separate latency or throughput benchmark was run. Bounds that are in the
code: JSON cap, image phase and task caps, 32-image cache, and the rate
limits above. The browser PNG response was about 50 KB for the starter
roadmap.

### Build

The API wheel build succeeded. A production Next.js build was not run in
this session. `next dev` served the browser test.

## Git

- Starting revision: `358dfdba5f97dd4211daad2f4415aa5406be5c98`
- Branch: `feat/public-roadmap-embed`
- Worktree: `/home/alteixeira20/Projects/Anvilary-Tools/RoadForge-public-viewer`
- Primary checkout `/home/alteixeira20/Projects/Anvilary-Tools/RoadForge` was
  left unchanged. No merge, push, pull request, tag, or deploy was made.
- Commits above the starting revision:
  - `4d75fdd904d31f686b76b74bb2b00f233220b7bb` feat(publication): add opt-in public roadmap access
  - `80524af5887934255faec62ac4f1d10f827dacae` feat(publication): add the read-only public viewer
  - `449decc51ed0740ea5f3c8cb99041dbf125d5cdd` feat(sharing): add publish controls to Share
  - the documentation commit that adds this report
- Final HEAD is the documentation commit. Working tree after that commit
  is clean apart from ignored test artifacts.

## Limitations

- GitHub and other sites can cache the PNG longer than `max-age=60`. The
  README can lag the live viewer. The Markdown URL stays stable.
- Not every Markdown renderer loads remote images. The viewer URL is the
  fallback. Only the generated syntax was checked, not GitHub's live
  renderer.
- Self-hosting needs `ROADFORGE_WEB_BASE_URL` as an HTTPS origin with no
  path, that origin in `ROADFORGE_CORS_ORIGINS`, migration `0012`, and a
  reverse proxy that serves `/api/` and allows framing only on `/embed/`.
- An edge policy that sends `X-Frame-Options: DENY` for every path will
  block the iframe.
- Unpublish does not erase copies that third parties already fetched.
- The 15 second poll was unit-tested. The browser proved the saved revision
  by reloading, not by waiting for the next poll.
- No automated accessibility audit and no load test were run.
- The local Next.js dev badge overlaps the share footer in development
  screenshots.
- App, web, MCP, and API versions remain 0.2.0. This branch is the 0.3.0
  feature work and is not generally available.
