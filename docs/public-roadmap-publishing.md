# Public roadmap publishing

Status: implemented for RoadForge `0.3.0` on the integration release candidate.
Hosted deployments serve this feature only once updated to `0.3.0`.

RoadForge remains local-first. A roadmap stored only in the browser is private. Publishing
is an explicit owner action after the roadmap has a server copy.

The license remains the PolyForm Noncommercial License 1.0.0. Publishing a roadmap does
not change that license.

## What publishing does

An owner opens **Share** and expands **Publish roadmap**. The section stays collapsed
until they open it. Publishing creates one publication row for that roadmap and an opaque
`pub_` identifier.

Visitors do not sign in. They can open:

- the read-only viewer at `{ROADFORGE_WEB_BASE_URL}/p/{public_id}`
- the embeddable viewer at `{ROADFORGE_WEB_BASE_URL}/embed/{public_id}`
- a PNG preview at `{ROADFORGE_WEB_BASE_URL}/api/public/roadmaps/{public_id}/preview.png`

Those URLs come from the configured public origin. They are not built from the incoming
`Host` header and they do not contain invite tokens, session tokens, or passwords.

While a roadmap stays published, a later publish keeps the same public id. Saved changes
to the published fields, including tasks added later, become public. Unsaved browser edits
do not.

## Private sharing is different

Owner, editor, and viewer invites are access credentials. A viewer invite is not a public
publishing URL. Generating a viewer invite does not publish the roadmap.

| Actor | Publish, unpublish, or read publication status |
| --- | --- |
| Owner | yes, with a live owner session |
| Editor | no |
| Viewer | no |
| Anonymous visitor | can read only an explicitly published projection |
| Revoked owner session | no |

The server enforces this. Hidden buttons are not the authorization boundary.

## What becomes public

The public response is built from an allowlist. It is not the private roadmap response
with a few fields removed.

Public visitors receive:

- the roadmap title
- phase names, numbers, order, status, and hex colors
- task and subtask titles, order, completion, complexity, and tags
- dependencies between published tasks in the same phase
- progress computed from task completion

These stay private:

- descriptions, estimates, and assignees
- claims, participants, and the owner name
- external links, including GitHub links
- activity history, version history, and invite credentials
- the internal roadmap id

The Share section lists the same fields the server will publish. Colors that are not hex
values are replaced with the RoadForge ember color. The public JSON is size-capped. A
larger roadmap is summarized and marked truncated. The preview image shows at most five
phases and two tasks in each of those phases.

Roadmap titles and task text are rendered as text. They are not interpreted as HTML or
Markdown in the viewer. The PNG does not fetch remote images or URLs from the roadmap.

## Local-only roadmaps

A browser-local roadmap has no remotely updated public address. Share explains that, and
Enable sharing opens the existing save confirmation. RoadForge does not upload the roadmap
until that confirmation. The save modal also says that saving does not publish it.

## Viewer

The public viewer shows the title, overall progress, phases, tasks, subtasks, completion,
public tags, complexity, and dependencies. Phases can be expanded and collapsed. Task
details can be opened when the information is public. There are no edit controls, share
controls, import/export controls, or participant controls.

The viewer polls the public JSON about every 15 seconds while the tab is visible. It sends
no cookies and no bearer token. A `304` response means the saved revision has not changed.
The viewer does not subscribe to private collaboration events and does not show presence.

Every public viewer and unavailable state includes:

**Built with RoadForge by Anvilary.Tools**

The link goes to `https://anvilary.tools/` and uses the existing Anvilary Tools logo.
Ordinary embed options cannot remove that attribution.

## GitHub Markdown

GitHub README files do not run an interactive RoadForge iframe. Share copies a Markdown
image link:

```markdown
[![Roadmap title](https://example.invalid/api/public/roadmaps/pub_example/preview.png)](https://example.invalid/p/pub_example)
```

The real snippet uses the configured origin. It is valid Markdown: an image inside a link.
Renderers that block remote images will show the alt text or nothing. The viewer link
still works when pasted on its own.

The image endpoint returns the current published PNG with `Cache-Control: public, max-age=60`.
GitHub's image proxy can keep a preview longer than that. A README can therefore lag
behind the live viewer. Task updates do not require a new Markdown URL. Do not expect the
README image to change at the same moment the viewer changes.

The PNG is rendered in the API process with Pillow. It does not launch a browser.

## Website iframe

Share copies an iframe pointed at `/embed/{public_id}`. The frame is a read-only viewer.
It updates through the same polling as the full viewer.

Framing is allowed only for that embed route:

- the page CSP uses `frame-ancestors *` only when the path is `/embed/` plus a `pub_` id
- that response does not send `X-Frame-Options`
- workspace, marketing, `/p/`, and authenticated API routes keep frame denial

The reference nginx file repeats the other security headers on `location /embed/` and
omits `X-Frame-Options` there. If an edge such as Cloudflare sets `X-Frame-Options: DENY`
for every path, exclude `/embed/` or the iframe will be blank.

## Unpublish and deletion

Unpublishing rotates the public id and marks the publication unpublished. The old viewer,
embed, and image URLs then return `404` with `Published roadmap not found`. The same body
is used for unknown ids, so a guess does not reveal that a private roadmap exists.

Republishing issues a new public id. Old Markdown and iframe snippets stop working and
must be replaced.

Deleting the roadmap also unpublishes it and rotates the id in the same transaction.
A soft-deleted roadmap is not readable through a previously published id.

Unpublishing cannot remove copies that a browser, GitHub, or another site already stored.
The Share section says that.

## Self-hosting

Set `ROADFORGE_WEB_BASE_URL` to the public HTTPS origin with no path, and include that
origin in `ROADFORGE_CORS_ORIGINS`. The supported topology is one origin: nginx serves
the web app and proxies `/api/` to FastAPI. The viewer then requests
`/api/public/roadmaps/...` on that origin.

If the browser origin and API origin differ, the browser origin must be allowed by CORS.
Public reads use `credentials: 'omit'`. They do not need the participant session cookie.

`next dev` does not proxy `/api` unless `ROADFORGE_DEV_API_PROXY` is set to the API origin.
That variable is a local stand-in for the nginx `/api/` location. Leave it unset in production.
The copied image URL stays on the public web origin either way.

Apply migration `0012_add_roadmap_publications` with the normal `alembic upgrade head`
path. Do not apply it to a database you have not backed up.

Public reads are rate limited per trusted client IP: 120 roadmap reads per minute and
30 preview images per minute. Owner publication changes are limited per participant.
The image renderer keeps a small in-process cache keyed by public id and revision.

The API wheel includes the preview font, its license, and the Anvilary logo used inside
the PNG. The font is DejaVu Sans, under the license in
`apps/backend/src/api/features/publication/assets/DejaVu-LICENSE.txt`. The logo file is
the existing brand asset, not a regenerated mark.

## Security notes

- Publication management requires a current owner session. Revocation removes that access.
- Public responses do not include participant records, passwords, invite tokens, or session tokens.
- Public endpoints do not accept those credentials as a substitute for the public id.
- User-supplied text is escaped in Markdown alt text and iframe attributes, and rendered as text in the viewer.
- The image renderer does not request URLs found in roadmap content.
- Public JSON is bounded. Image rendering is bounded.
- `X-Robots-Tag: noindex, nofollow` is set on public API responses and on `/p/{public_id}` and `/embed/{public_id}` HTML documents alongside `noindex, nofollow` page metadata; published roadmaps are excluded from `/sitemap.xml`.

Remaining limits are listed in the implementation report:
[Public viewer and embedding report](architecture/roadforge-public-viewer-and-embedding-report.md).
