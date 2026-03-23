import { useMemo } from 'react'
import Card from './Card.jsx'

function parseLocalDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

export default function TodayView({ projects, openCardDetails }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tasksDueToday = useMemo(() => {
    const tasks = []
    for (const project of projects) {
      for (const card of project.cards || []) {
        const dueDate = parseLocalDate(card.due_date)
        if (dueDate && dueDate.getTime() === today.getTime()) {
          tasks.push({ ...card, projectName: project.name, projectColor: project.color })
        }
      }
    }
    return tasks.sort((a, b) => {
      if (a.col !== b.col) {
        const order = { backlog: 0, todo: 1, doing: 2, done: 3 }
        return order[a.col] - order[b.col]
      }
      return a.position - b.position
    })
  }, [projects])

  const doneCount = tasksDueToday.filter(t => t.col === 'done').length
  const totalCount = tasksDueToday.length

  return (
    <div className="today-view">
      <div className="view-header">
        <div className="view-title-wrap">
          <span className="view-icon">📅</span>
          <h1>Today</h1>
        </div>
        <div className="view-stats">
          <span>{doneCount}/{totalCount} tasks</span>
        </div>
      </div>

      <div className="view-content">
        {tasksDueToday.length === 0 ? (
          <div className="empty-state">No tasks due today! 🎉</div>
        ) : (
          <div className="tasks-list">
            {tasksDueToday.map((task) => (
              <div
                key={task.id}
                className="task-list-item"
                onClick={() => openCardDetails(task)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    openCardDetails(task)
                  }
                }}
              >
                <div className="task-list-main">
                  <span
                    className="task-project-dot"
                    style={{ backgroundColor: task.projectColor }}
                    aria-hidden="true"
                  />
                  <div className="task-list-info">
                    <span className="task-list-title">{task.title}</span>
                    {task.subtitle && (
                      <span className="task-list-subtitle">{task.subtitle}</span>
                    )}
                  </div>
                </div>
                <div className="task-list-meta">
                  <span className={`priority-badge priority-${task.priority}`}>
                    {task.priority}
                  </span>
                  <span className="task-list-project">{task.projectName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
