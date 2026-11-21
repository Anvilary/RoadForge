'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'

export interface PublicTask {
  id: string
  title: string
  done: boolean
  complexity: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  tags: string[]
  depends_on: string[]
  parent_id: string | null
}

export interface PublicPhase {
  id: string
  number: string
  name: string
  color: string
  status: 'done' | 'active' | 'next' | 'future'
  progress: number
  tasks: PublicTask[]
}

export interface PublicRoadmap {
  title: string
  revision: string
  progress: number
  task_count: number
  done_count: number
  truncated: boolean
  phases: PublicPhase[]
}

const STATUS_LABEL = {
  done: 'Done',
  active: 'Active',
  next: 'Next',
  future: 'Future',
} as const

const COMPLEXITY_LABEL = {
  very_low: 'Very low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  very_high: 'Very high',
} as const

function safeColor(color: string): string {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
    ? color
    : '#d97442'
}

function Attribution() {
  return (
    <footer className="public-roadmap-attribution">
      <a href="https://anvilary.tools/" target="_blank" rel="noopener noreferrer">
        <Image src="/brand/anvilary-tools/logo.png" alt="" width={20} height={20} />
        <span>Built with RoadForge by Anvilary.Tools</span>
      </a>
    </footer>
  )
}

function TaskTree({ tasks }: { tasks: PublicTask[] }) {
  const titles = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks])
  const children = useMemo(() => {
    const grouped = new Map<string, PublicTask[]>()
    for (const task of tasks) {
      if (!task.parent_id) continue
      const list = grouped.get(task.parent_id) ?? []
      list.push(task)
      grouped.set(task.parent_id, list)
    }
    return grouped
  }, [tasks])
  const [open, setOpen] = useState<Record<string, boolean>>({})

  const renderTask = (task: PublicTask, nested: boolean) => {
    const detailsId = `public-task-${task.id}`
    const dependencies = task.depends_on
      .map((id) => titles.get(id))
      .filter((title): title is string => Boolean(title))
    return (
      <li key={task.id} className={nested ? 'is-subtask' : undefined}>
        <div className="public-task-row">
          <span className={task.done ? 'public-task-mark done' : 'public-task-mark'} aria-hidden="true">
            {task.done ? '✓' : ''}
          </span>
          <span className="public-task-title">{task.title}</span>
          <span className="sr-only">{task.done ? 'Completed' : 'Open'}</span>
          <button
            type="button"
            aria-expanded={open[task.id] === true}
            aria-controls={detailsId}
            onClick={() => setOpen((current) => ({ ...current, [task.id]: !current[task.id] }))}
          >
            Details
          </button>
        </div>
        {open[task.id] && (
          <div className="public-task-details" id={detailsId}>
            <p>Complexity: {COMPLEXITY_LABEL[task.complexity]}</p>
            {task.tags.length > 0 && <p>Tags: {task.tags.join(', ')}</p>}
            {dependencies.length > 0 && <p>Depends on: {dependencies.join(', ')}</p>}
          </div>
        )}
        {(children.get(task.id)?.length ?? 0) > 0 && (
          <ul className="public-subtasks">
            {children.get(task.id)?.map((child) => renderTask(child, true))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <ul className="public-tasks">
      {tasks.filter((task) => !task.parent_id).map((task) => renderTask(task, false))}
    </ul>
  )
}

export function PublicRoadmapView({
  roadmap,
  mode,
}: {
  roadmap: PublicRoadmap
  mode: 'page' | 'embed'
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(roadmap.phases.map((phase) => [phase.id, true])),
  )

  return (
    <article className={`public-roadmap ${mode}`} data-testid="public-roadmap">
      <header className="public-roadmap-header">
        <p className="public-roadmap-kicker">Published roadmap</p>
        <h1 data-testid="public-roadmap-title">{roadmap.title}</h1>
        <div
          className="public-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={roadmap.progress}
          aria-label="Overall progress"
        >
          <span style={{ width: `${roadmap.progress}%` }} />
        </div>
        <p>
          {roadmap.progress}% complete · {roadmap.done_count} of {roadmap.task_count} tasks
        </p>
      </header>

      {roadmap.phases.length === 0 ? (
        <p className="public-roadmap-empty">This published roadmap has no phases yet.</p>
      ) : (
        <ol className="public-phases">
          {roadmap.phases.map((phase) => {
            const panelId = `public-phase-${phase.id}`
            const isOpen = expanded[phase.id] !== false
            return (
              <li key={phase.id} className="public-phase">
                <button
                  type="button"
                  className="public-phase-toggle"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  data-testid="phase-toggle"
                  onClick={() =>
                    setExpanded((current) => ({ ...current, [phase.id]: current[phase.id] === false }))
                  }
                >
                  <span className="public-phase-swatch" style={{ backgroundColor: safeColor(phase.color) }} />
                  {phase.number && <span className="public-phase-number">{phase.number}</span>}
                  <span className="public-phase-name">{phase.name}</span>
                  <span className="public-phase-status">{STATUS_LABEL[phase.status]}</span>
                  <span className="public-phase-progress">{phase.progress}%</span>
                </button>
                {isOpen && (
                  <div id={panelId} className="public-phase-panel">
                    <div
                      className="public-progress compact"
                      role="progressbar"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={phase.progress}
                      aria-label={`${phase.name} progress`}
                    >
                      <span style={{ width: `${phase.progress}%`, background: safeColor(phase.color) }} />
                    </div>
                    {phase.tasks.length === 0 ? (
                      <p className="public-roadmap-empty">No tasks in this phase.</p>
                    ) : (
                      <TaskTree tasks={phase.tasks} />
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}

      {roadmap.truncated && (
        <p>This public view is a bounded summary of a larger roadmap.</p>
      )}
      <Attribution />
    </article>
  )
}

export function PublicRoadmapMessage({
  title,
  body,
}: {
  title: string
  body: string
}) {
  return (
    <article className="public-roadmap" data-testid="public-roadmap-message">
      <header className="public-roadmap-header">
        <h1>{title}</h1>
        <p>{body}</p>
      </header>
      <Attribution />
    </article>
  )
}
