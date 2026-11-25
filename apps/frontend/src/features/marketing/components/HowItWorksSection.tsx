import { Icon } from '@/shared/ui/Icon'
import { LandingSectionFrame } from '@/features/marketing/components/LandingSectionFrame'

export function HowItWorksSection() {
  return (
    <LandingSectionFrame
      id="how"
      title="Planning that stays in one place."
      lede="Keep milestones, phases, tasks, and dependencies in one structured roadmap built for solo builders and small teams - local by default, portable always."
    >
      <div className="steps">
        <div className="step-card">
          <div className="step-ic"><Icon name="device" size={17} /></div>
          <span className="num">STEP 01</span>
          <h3>Start locally.</h3>
          <p>
            Open RoadForge and name your roadmap. Everything saves to your browser local
            storage offline - no account, no setup, and no backend required.
          </p>
        </div>
        <div className="step-card">
          <div className="step-ic"><Icon name="fold" size={17} /></div>
          <span className="num">STEP 02</span>
          <h3>Plan in phases.</h3>
          <p>
            Group work into phases. Add tasks, subtasks, tags, and note what depends on what
            so blocked work and phase progress update automatically while RoadForge can surface
            recommended tasks without choosing your next action.
          </p>
        </div>
        <div className="step-card">
          <div className="step-ic"><Icon name="users" size={17} /></div>
          <span className="num">STEP 03</span>
          <h3>Share on your terms.</h3>
          <p>
            Export portable JSON backups or Markdown anytime, or save to a server for shared links.
            Use the hosted demo for evaluation and light collaboration, or fork and self-host
            RoadForge when your team needs an instance it controls.
          </p>
        </div>
      </div>
      <div className="flow-strip" aria-hidden="true">
        <span>Local roadmap</span>
        <span className="flow-sep">→</span>
        <span>Portable JSON</span>
        <span className="flow-sep">→</span>
        <span>Demo or self-hosted sync</span>
      </div>
    </LandingSectionFrame>
  )
}
