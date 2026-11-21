import type { Metadata } from 'next'
import { ProblemReportLink } from '@/shared/ui/ProblemReportLink'
import { HelpClient, type SectionData } from './HelpClient'
import './help.css'

export const metadata: Metadata = {
  title: 'Help · RoadForge',
  description: 'A practical guide to local roadmaps, sharing, backups, self-hosting, and recovery.',
}

export const SECTIONS: SectionData[] = [
  {
    id: 'start',
    tocTitle: 'Start a roadmap',
    title: 'Start a roadmap',
    content: (
      <>
        <p>
          Choose <strong>Blank roadmap</strong> for one empty Planning phase,
          or <strong>Starter example</strong> for three phases and nine tasks
          that demonstrate progress, focus, and dependencies. Everything is
          editable.
        </p>
        <p>
          Local roadmaps are stored in browser local storage and work
          offline. Clearing site data or changing browsers can remove them,
          so keep a JSON backup of anything important.
        </p>
      </>
    ),
  },
  {
    id: 'plan',
    tocTitle: 'Create phases and tasks',
    title: 'Create phases and tasks',
    content: (
      <>
        <p>
          Add phases from the roadmap toolbar. Add tasks inside each phase,
          then use task details for descriptions, estimates, assignees, tags,
          dependencies, and links.
        </p>
        <p>
          RoadForge can highlight one or more <strong>Recommended</strong> tasks.
          Recommendations are guidance, not a decision about what you must do
          next. Dependencies mark work as blocked until its prerequisites are
          done. Search and filters only change the current view; they never
          remove roadmap data.
        </p>
      </>
    ),
  },
  {
    id: 'portable',
    tocTitle: 'Import and export',
    title: 'Import and export',
    content: (
      <>
        <p>
          Open <strong>Import / Export</strong> from the workspace header.
          JSON is the portable backup format and can be imported again.
          Markdown is a readable snapshot for people and agents.
        </p>
        <p>
          RoadForge validates an import and shows a preview before changing
          anything. You can create a separate local roadmap, add safe new
          items, or replace the current roadmap. Session tokens, invite
          credentials, passwords, and edit locks are never exported.
        </p>
      </>
    ),
  },
  {
    id: 'collaborate',
    tocTitle: 'Save and share',
    title: 'Save and share',
    content: (
      <>
        <p>
          <strong>Save</strong> creates a server-backed copy and enables
          sharing. On `roadforge.anvilary.tools`, that server is the public
          hosted demo. Owner, editor, and viewer links are access credentials,
          so share them privately. Viewer invites grant read-only collaboration;
          they are not public publishing links.
        </p>
        <ul>
          <li><strong>Owner:</strong> edit, restore versions, manage links and participants, and override claims.</li>
          <li><strong>Editor:</strong> edit roadmap content and claim tasks.</li>
          <li><strong>Viewer:</strong> read the roadmap and activity without changing anything.</li>
        </ul>
        <p>
          An edit lock prevents two people from changing the same control at
          once. A task claim communicates who is working on a task; it does
          not assign permanent ownership.
        </p>
      </>
    ),
  },
  {
    id: 'deployment',
    tocTitle: 'Demo or self-host',
    title: 'Use the demo or self-host',
    content: (
      <>
        <p>
          The Anvilary-hosted RoadForge instance is for evaluation, examples,
          and light collaboration. It is not a managed team SaaS, durable
          backup service, or large-team production service. It has no hosted
          SLA, reserved per-team capacity, or guaranteed data-recovery service.
        </p>
        <p>
          If RoadForge becomes part of your team&apos;s operating workflow, especially
          for a larger team or long-running roadmap, fork the repository or
          maintain a controlled clone and self-host it. Your operator should
          own PostgreSQL backups and restores, retention, monitoring, capacity,
          upgrades, security configuration, and incident response. Load-test
          the expected concurrency before depending on the deployment.
        </p>
        <p>
          Forking and self-hosting remain subject to the repository&apos;s current
          PolyForm Noncommercial License 1.0.0; the current license does not
          grant commercial use.
        </p>
      </>
    ),
  },
  {
    id: 'recover',
    tocTitle: 'Resolve conflicts',
    title: 'Resolve save and conflict states',
    content: (
      <>
        <p>
          <strong>Saving</strong> means a request is in progress,{' '}
          <strong>Synced</strong> means the server accepted it, and{' '}
          <strong>Offline</strong> means RoadForge could not reach the server.
          Your browser copy remains available.
        </p>
        <p>
          A conflict means somebody saved a newer version first. Review the
          differences, then choose whether to keep your local version or load
          the server version. Loading the server version discards the local
          draft only after confirmation.
        </p>
      </>
    ),
  },
  {
    id: 'history',
    tocTitle: 'Activity and versions',
    title: 'Use activity and versions',
    content: (
      <>
        <p>
          Activity shows meaningful actions on a shared roadmap. Versions are
          explicit restore points. Owners and editors can inspect them; only
          owners can restore one. A restore creates a new restore point rather
          than deleting later history.
        </p>
      </>
    ),
  },
  {
    id: 'troubleshoot',
    tocTitle: 'Troubleshoot',
    title: 'Troubleshoot safely',
    content: (
      <>
        <ul>
          <li>If a local roadmap is missing, open the roadmap switcher and check whether browser site data was cleared.</li>
          <li>If sync is offline, keep working locally and retry after the server is reachable.</li>
          <li>If a session expired or was revoked, keep the local copy and rejoin through a current invite link.</li>
          <li>If an import fails, leave the original file unchanged and use the validation message to repair a copy.</li>
          <li>If a self-hosted team instance is slow or unstable, inspect resource/database/Redis/proxy metrics before adding workers blindly.</li>
        </ul>
        <p>
          Need help?{' '}
          <ProblemReportLink />
          . Do not include invite links, tokens, private roadmap exports,
          secrets, or private logs in a public issue.
        </p>
      </>
    ),
  },
  {
    id: 'limits',
    tocTitle: 'Known limitations',
    title: 'Known limitations',
    content: (
      <>
        <ul>
          <li>Browser storage is not a substitute for an exported backup.</li>
          <li>The public hosted instance is a demo/reference deployment with no uptime, capacity, or recovery SLA.</li>
          <li>RoadForge does not publish an arbitrary large-team concurrency guarantee; self-hosters must validate their expected load.</li>
          <li>Markdown is presentation-only and PDF export is not available.</li>
          <li>Conflicts require a deliberate choice; RoadForge does not silently merge competing edits.</li>
          <li>Accountless sharing identifies access credentials and display names, not verified personal identities.</li>
        </ul>
      </>
    ),
  },
]

export default function HelpPage() {
  return <HelpClient sections={SECTIONS} />
}
