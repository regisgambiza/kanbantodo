import { useState, useCallback } from 'react'
import Sidebar from './components/Sidebar.jsx'
import Board from './components/Board.jsx'
import TodayView from './components/TodayView.jsx'
import UpcomingView from './components/UpcomingView.jsx'
import AllProjectsView from './components/AllProjectsView.jsx'
import useProjects from './hooks/useProjects.js'
import CardDetailsModal from './components/CardDetailsModal.jsx'

export default function App() {
  const state = useProjects()
  const [activeView, setActiveView] = useState('project') // 'project', 'today', 'upcoming', 'all'
  const [selectedCardId, setSelectedCardId] = useState(null)

  const activeProject = state.projects.find((project) => project.id === state.activeProjectId)

  const handleOpenCardDetails = useCallback((card) => {
    setSelectedCardId(card.id)
  }, [])

  const handleCloseCardDetails = useCallback(() => {
    setSelectedCardId(null)
  }, [])

  const handleSaveCard = useCallback(async (fields) => {
    if (!selectedCardId) return null
    // Find the project that contains this card
    for (const project of state.projects) {
      const card = project.cards.find((c) => c.id === selectedCardId)
      if (card) {
        return state.editCard(project.id, selectedCardId, fields)
      }
    }
    return null
  }, [selectedCardId, state.projects, state.editCard])

  const handleDeleteCard = useCallback(async (cardId) => {
    // Find the project that contains this card
    for (const project of state.projects) {
      const card = project.cards.find((c) => c.id === cardId)
      if (card) {
        const removed = await state.removeCard(project.id, cardId)
        if (removed) {
          setSelectedCardId(null)
        }
        return removed
      }
    }
    return false
  }, [state.projects, state.removeCard])

  const selectedCard = state.projects.flatMap(p => p.cards || []).find((card) => card.id === selectedCardId)

  return (
    <div className="app-layout">
      <Sidebar 
        {...state} 
        activeView={activeView}
        setActiveView={setActiveView}
      />
      <main className="main-area">
        {state.loading && <div className="loading">Loading...</div>}
        {!state.loading && state.error && <div className="error-message">{state.error}</div>}
        {!state.loading && activeView === 'project' && activeProject && (
          <Board project={activeProject} {...state} openCardDetails={handleOpenCardDetails} />
        )}
        {!state.loading && activeView === 'today' && (
          <TodayView projects={state.projects} openCardDetails={handleOpenCardDetails} />
        )}
        {!state.loading && activeView === 'upcoming' && (
          <UpcomingView projects={state.projects} openCardDetails={handleOpenCardDetails} />
        )}
        {!state.loading && activeView === 'all' && (
          <AllProjectsView 
            projects={state.projects} 
            setActiveProjectId={state.setActiveProjectId}
            openCardDetails={handleOpenCardDetails}
          />
        )}
        {!state.loading && !activeProject && activeView === 'project' && (
          <div className="empty-state">Create a project to get started.</div>
        )}
      </main>

      {selectedCard && (
        <CardDetailsModal
          card={selectedCard}
          projectColor={selectedCard.projectColor || activeProject?.color}
          projectId={selectedCard.projectId || activeProject?.id}
          onClose={handleCloseCardDetails}
          onSave={handleSaveCard}
          onDeleteCard={handleDeleteCard}
          addRecurringTask={state.addRecurringTask}
          removeRecurringTask={state.removeRecurringTask}
          updateRecurringTask={state.updateRecurringTask}
          generateRecurringTask={state.generateRecurringTask}
          recurringTasks={state.recurringTasks}
          loadRecurringTasks={state.loadRecurringTasks}
        />
      )}
    </div>
  )
}
