import { useState } from 'react'
import NewProjectForm from './NewProjectForm.jsx'

function projectCounts(cards) {
  const done = cards.filter((card) => card.col === 'done').length
  return { done, total: cards.length }
}

export default function Sidebar({
  projects,
  activeProjectId,
  setActiveProjectId,
  addProject,
  removeProject,
}) {
  const [showForm, setShowForm] = useState(false)

  async function handleCreateProject(name, color) {
    const created = await addProject(name, color)
    if (created) {
      setActiveProjectId(created.id)
      setShowForm(false)
    }
  }

  async function handleDeleteProject(event, projectId) {
    event.stopPropagation()
    await removeProject(projectId)
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">Projects</div>
      <div className="project-list">
        {projects.map((project) => {
          const counts = projectCounts(project.cards || [])
          const isActive = project.id === activeProjectId
          return (
            <div
              key={project.id}
              className={`project-row ${isActive ? 'active' : ''}`}
              onClick={() => setActiveProjectId(project.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setActiveProjectId(project.id)
                }
              }}
            >
              <span
                className="project-dot"
                style={{ backgroundColor: project.color }}
                aria-hidden="true"
              />
              <span className="project-name">{project.name}</span>
              <span className="project-count">
                {counts.done}/{counts.total}
              </span>
              <button
                type="button"
                className="project-delete"
                onClick={(event) => handleDeleteProject(event, project.id)}
                aria-label={`Delete ${project.name}`}
              >
                x
              </button>
            </div>
          )
        })}
      </div>

      <div className="sidebar-footer">
        {!showForm && (
          <button type="button" className="new-project-btn" onClick={() => setShowForm(true)}>
            + New project
          </button>
        )}
        {showForm && (
          <NewProjectForm
            onSubmit={handleCreateProject}
            onCancel={() => setShowForm(false)}
          />
        )}
      </div>
    </aside>
  )
}
