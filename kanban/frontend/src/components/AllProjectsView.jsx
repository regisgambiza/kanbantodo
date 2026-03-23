import { useMemo, useState } from 'react'
import Card from './Card.jsx'

const COLUMNS = [
  { id: 'backlog', title: 'Backlog' },
  { id: 'todo', title: 'To Do' },
  { id: 'doing', title: 'In Progress' },
  { id: 'done', title: 'Done' },
]

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    return a.id - b.id
  })
}

export default function AllProjectsView({ projects, setActiveProjectId, openCardDetails }) {
  const [search, setSearch] = useState('')

  const allCards = useMemo(() => {
    const cards = []
    for (const project of projects) {
      for (const card of project.cards || []) {
        cards.push({ ...card, projectName: project.name, projectColor: project.color, projectId: project.id })
      }
    }
    return cards
  }, [projects])

  const filteredCards = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    if (!searchText) return allCards
    
    return allCards.filter((card) => {
      const haystack = [
        card.title || '',
        card.subtitle || '',
        card.description || '',
        card.projectName || '',
        ...(card.labels || []),
        ...(card.assignees || []),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(searchText)
    })
  }, [allCards, search])

  const cardsByColumn = useMemo(
    () =>
      COLUMNS.reduce((acc, column) => {
        acc[column.id] = sortCards(filteredCards.filter((card) => card.col === column.id))
        return acc
      }, {}),
    [filteredCards]
  )

  const totalTasks = allCards.length
  const doneCount = allCards.filter((card) => card.col === 'done').length
  const percentComplete = totalTasks === 0 ? 0 : Math.round((doneCount / totalTasks) * 100)

  return (
    <div className="all-projects-view">
      <div className="view-header">
        <div className="view-title-wrap">
          <span className="view-icon">📊</span>
          <h1>All Projects</h1>
        </div>
        <div className="view-stats">
          <span>{totalTasks} tasks</span>
          <span>{doneCount} done</span>
          <span>{percentComplete}% complete</span>
        </div>
      </div>

      <div className="view-toolbar">
        <input
          className="filter-input"
          type="text"
          placeholder="Search across all projects..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="view-content">
        <div className="board-columns">
          {COLUMNS.map((column) => (
            <section key={column.id} className="column">
              <header className="column-header">
                <div className="column-header-main">
                  <span className={`column-title column-title-${column.id}`}>{column.title}</span>
                  <span className="column-count">{cardsByColumn[column.id].length}</span>
                </div>
              </header>

              <div className="column-cards">
                {cardsByColumn[column.id].map((card) => (
                  <div
                    key={card.id}
                    className="card-drop-zone"
                  >
                    <Card
                      card={card}
                      projectColor={card.projectColor}
                      removeCard={() => {}}
                      onOpen={() => openCardDetails(card)}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
