import { Icon } from '@/shared/ui/Icon'
import { LandingSectionFrame } from '@/features/marketing/components/LandingSectionFrame'

export function FeaturesSection() {
  return (
    <LandingSectionFrame
      id="features"
      className="features-section"
      title="Built for solo builders and small teams."
      lede="A focused set of features, sized to fit how real planning works. The public instance is a demo; teams can run RoadForge on infrastructure they control."
    >
      <div className="features">
        <div className="feature">
          <div className="feature-head">
            <div className="ic"><Icon name="device" size={20} /></div>
            <h3>Local-first</h3>
          </div>
          <p>
            Edits land in your browser storage first. No round-trips, no login
            spinner, and no internet connection required for solo planning.
          </p>
        </div>
        <div className="feature">
          <div className="feature-head">
            <div className="ic"><Icon name="export" size={20} /></div>
            <h3>Portable exports</h3>
          </div>
          <p>
            Keep a canonical JSON backup you can validate and re-import,
            alongside deterministic Markdown snapshots without service lock-in.
          </p>
        </div>
        <div className="feature">
          <div className="feature-head">
            <div className="ic"><Icon name="fold" size={20} /></div>
            <h3>Dependencies and progress</h3>
          </div>
          <p>
            Organize phases, tasks, subtasks, complexity ratings, and tags. Track
            prerequisite dependencies and phase progress while RoadForge surfaces
            recommended tasks without deciding your workflow for you.
          </p>
        </div>
        <div className="feature">
          <div className="feature-head">
            <div className="ic"><Icon name="robot" size={20} /></div>
            <h3>MCP and tool integration</h3>
          </div>
          <p>
            Connect coding agents through the included stdio MCP server
            (@anvilary/roadforge-mcp) and inspectable JSON format using scoped
            credentials while RoadForge remains the source of truth.
          </p>
        </div>
        <div className="feature">
          <div className="feature-head">
            <div className="ic"><Icon name="users" size={20} /></div>
            <h3>Optional accountless sharing</h3>
          </div>
          <p>
            Work locally first; explicitly save to a server only when you want
            owner, editor, and read-only viewer invite links, edit locks, restore
            history, and realtime collaboration.
          </p>
        </div>
        <div className="feature">
          <div className="feature-head">
            <div className="ic"><Icon name="shield" size={20} /></div>
            <h3>Fork and self-host</h3>
          </div>
          <p>
            Use the public hosted demo at roadforge.anvilary.tools to evaluate
            RoadForge. For sustained or larger-team use, run a fork or controlled
            clone on infrastructure you operate under its AGPL-3.0-or-later
            open-source license.
          </p>
        </div>
      </div>
    </LandingSectionFrame>
  )
}
