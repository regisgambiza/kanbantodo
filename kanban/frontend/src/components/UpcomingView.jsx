import { useMemo } from 'react'
import Card from './Card.jsx'

function parseLocalDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

export default function UpcomingView({ projects, openCardDetails }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const upcomingTasks = useMemo(() => {
    const tasks = []
    for (const project of projects) {
      for (const card of project.cards || []) {
        const dueDate = parseLocalDate(card.due_date)
        if (dueDate && dueDate >= today && dueDate <= nextWeek) {
          tasks.push({ ...card, projectName: project.name, projectColor: project.color })
        }
      }
    }
    return tasks.sort((a, b) => {
      const dateA = parseLocalDate(a.due_date)
      const dateB = parseLocalDate(b.due_date)
      if (dateA && dateB) {
        return dateA.getTime() - dateB.getTime()
      }
      return a.position - b.position
    })
  }, [projects])

  const doneCount = upcomingTasks.filter(t => t.col === 'done').length
  const totalCount = upcomingTasks.length

  function formatDate(dateStr) {
    const date = parseLocalDate(dateStr)
    if (!date) return ''
    const isToday = date.getTime() === today.getTime()
    const isTomorrow = new Date(today.getTime() + 86400000).getTime() === date.getTime()
    
    if (isToday) return 'Today'
    if (isTomorrow) return 'Tomorrow'
    
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  }

  return (
    <div className="upcoming-view">
      <div className="view-header">
        <div className="view-title-wrap">
          <span className="view-icon">📆</span>
          <h1>Upcoming</h1>
        </div>
        <div className="view-stats">
          <span>{doneCount}/{totalCount} tasks</span>
        </div>
      </div>

      <div className="view-content">
        {upcomingTasks.length === 0 ? (
          <div className="empty-state">No upcoming tasks in the next 7 days</div>
        ) : (
          <div className="tasks-list">
            {upcomingTasks.map((task) => (
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
                  <span className="due-date-badge">{formatDate(task.due_date)}</span>
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
