import { useState, useEffect } from 'react'
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
  saveAsTemplate,
  templates,
  loadTemplates,
  removeTemplate,
  createProjectFromTemplate,
  showTemplates,
  setShowTemplates,
  generateAllRecurring,
}) {
  const [showForm, setShowForm] = useState(false)
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')

  useEffect(() => {
    if (showTemplates) {
      loadTemplates()
    }
  }, [showTemplates, loadTemplates])

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

  async function handleSaveAsTemplate() {
    if (!templateName.trim() || !activeProjectId) return
    const result = await saveAsTemplate(activeProjectId, templateName, templateDescription)
    if (result) {
      setTemplateName('')
      setTemplateDescription('')
      setShowSaveTemplate(false)
      loadTemplates()
    }
  }

  async function handleApplyTemplate(template) {
    const newProject = await createProjectFromTemplate(template.id, template.name + ' Project', template.color)
    if (newProject) {
      setActiveProjectId(newProject.id)
      setShowTemplates(false)
    }
  }

  async function handleDeleteTemplate(event, templateId) {
    event.stopPropagation()
    await removeTemplate(templateId)
  }

  async function handleGenerateRecurring() {
    if (activeProjectId) {
      await generateAllRecurring(activeProjectId)
    }
  }

  const activeProject = projects.find((p) => p.id === activeProjectId)

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
        <div className="sidebar-actions">
          <button
            type="button"
            className="sidebar-action-btn"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            📋 Templates
          </button>
          <button
            type="button"
            className="sidebar-action-btn"
            onClick={handleGenerateRecurring}
            disabled={!activeProjectId}
          >
            🔄 Generate
          </button>
          <button
            type="button"
            className="sidebar-action-btn"
            onClick={() => setShowSaveTemplate(true)}
            disabled={!activeProjectId}
          >
            💾 Save as Template
          </button>
        </div>

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

      {showTemplates && (
        <div className="templates-panel">
          <div className="templates-header">
            <span>Project Templates</span>
            <button
              type="button"
              className="close-btn"
              onClick={() => setShowTemplates(false)}
            >
              ×
            </button>
          </div>
          <div className="templates-list">
            {templates.length === 0 ? (
              <div className="empty-templates">No templates yet</div>
            ) : (
              templates.map((template) => (
                <div
                  key={template.id}
                  className="template-item"
                  onClick={() => handleApplyTemplate(template)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleApplyTemplate(template)
                    }
                  }}
                >
                  <div className="template-info">
                    <span
                      className="template-dot"
                      style={{ backgroundColor: template.color }}
                    />
                    <span className="template-name">{template.name}</span>
                  </div>
                  <button
                    type="button"
                    className="template-delete"
                    onClick={(event) => handleDeleteTemplate(event, template.id)}
                    aria-label={`Delete ${template.name}`}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {showSaveTemplate && (
        <div className="modal-overlay" onClick={() => setShowSaveTemplate(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Save Project as Template</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowSaveTemplate(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Template Name</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name"
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowSaveTemplate(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSaveAsTemplate}
                disabled={!templateName.trim()}
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
