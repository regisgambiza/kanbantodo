import Sidebar from './components/Sidebar.jsx'
import Board from './components/Board.jsx'
import useProjects from './hooks/useProjects.js'

export default function App() {
  const state = useProjects()
  const activeProject = state.projects.find((project) => project.id === state.activeProjectId)

  return (
    <div className="app-layout">
      <Sidebar {...state} />
      <main className="main-area">
        {state.loading && <div className="loading">Loading...</div>}
        {!state.loading && state.error && <div className="error-message">{state.error}</div>}
        {!state.loading && activeProject && <Board project={activeProject} {...state} />}
        {!state.loading && !activeProject && (
          <div className="empty-state">Create a project to get started.</div>
        )}
      </main>
    </div>
  )
}
