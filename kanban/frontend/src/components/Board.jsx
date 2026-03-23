import { useMemo, useState } from 'react'
import CardDetailsModal from './CardDetailsModal.jsx'
import Column from './Column.jsx'

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

function parseLocalDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setHours(0, 0, 0, 0)
  return parsed
}

export default function Board({
  project,
  addCard,
  removeCard,
  moveCard,
  removeProject,
  editCard,
}) {
  const [selectedCardId, setSelectedCardId] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [labelFilter, setLabelFilter] = useState('all')
  const [assigneeFilter, setAssigneeFilter] = useState('all')
  const [dueFilter, setDueFilter] = useState('all')

  const selectedCard = project.cards.find((card) => card.id === selectedCardId) || null

  const totalTasks = project.cards.length
  const doneCount = project.cards.filter((card) => card.col === 'done').length
  const percentComplete = totalTasks === 0 ? 0 : Math.round((doneCount / totalTasks) * 100)

  const allLabels = useMemo(() => {
    const labels = new Set()
    for (const card of project.cards) {
      for (const label of card.labels || []) {
        labels.add(label)
      }
    }
    return [...labels].sort((a, b) => a.localeCompare(b))
  }, [project.cards])

  const allAssignees = useMemo(() => {
    const assignees = new Set()
    for (const card of project.cards) {
      for (const assignee of card.assignees || []) {
        assignees.add(assignee)
      }
    }
    return [...assignees].sort((a, b) => a.localeCompare(b))
  }, [project.cards])

  const filteredCards = useMemo(() => {
    const searchText = search.trim().toLowerCase()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const nextWeek = new Date(today)
    nextWeek.setDate(nextWeek.getDate() + 7)

    return project.cards.filter((card) => {
      if (statusFilter !== 'all' && card.col !== statusFilter) {
        return false
      }

      if (priorityFilter !== 'all' && card.priority !== priorityFilter) {
        return false
      }

      if (labelFilter !== 'all' && !(card.labels || []).includes(labelFilter)) {
        return false
      }

      if (assigneeFilter !== 'all' && !(card.assignees || []).includes(assigneeFilter)) {
        return false
      }

      if (searchText) {
        const haystack = [
          card.title || '',
          card.subtitle || '',
          card.description || '',
          ...(card.labels || []),
          ...(card.assignees || []),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(searchText)) {
          return false
        }
      }

      const dueDate = parseLocalDate(card.due_date)
      if (dueFilter === 'overdue') {
        if (!dueDate) return false
        if (card.col === 'done') return false
        return dueDate < today
      }
      if (dueFilter === 'today') {
        if (!dueDate) return false
        return dueDate.getTime() === today.getTime()
      }
      if (dueFilter === 'next7') {
        if (!dueDate) return false
        return dueDate >= today && dueDate <= nextWeek
      }
      if (dueFilter === 'no_due') {
        return !dueDate
      }

      return true
    })
  }, [
    assigneeFilter,
    dueFilter,
    labelFilter,
    priorityFilter,
    project.cards,
    search,
    statusFilter,
  ])

  const allCardsByColumn = useMemo(
    () =>
      COLUMNS.reduce((acc, column) => {
        acc[column.id] = sortCards(project.cards.filter((card) => card.col === column.id))
        return acc
      }, {}),
    [project.cards]
  )

  const visibleCardsByColumn = useMemo(
    () =>
      COLUMNS.reduce((acc, column) => {
        acc[column.id] = sortCards(filteredCards.filter((card) => card.col === column.id))
        return acc
      }, {}),
    [filteredCards]
  )

  const filtersActive =
    search.trim() ||
    statusFilter !== 'all' ||
    priorityFilter !== 'all' ||
    labelFilter !== 'all' ||
    assigneeFilter !== 'all' ||
    dueFilter !== 'all'

  async function handleRemoveProject() {
    if (!removeProject) return
    await removeProject(project.id)
  }

  async function handleSaveCard(fields) {
    if (!selectedCard) return null
    return editCard(project.id, selectedCard.id, fields)
  }

  async function handleDeleteCard(cardId) {
    const removed = await removeCard(project.id, cardId)
    if (removed) {
      setSelectedCardId(null)
    }
    return removed
  }

  return (
    <div className="board">
      <header className="board-header">
        <div className="board-title-wrap">
          <span className="board-project-dot" style={{ backgroundColor: project.color }} />
          <h1>{project.name}</h1>
        </div>
        <div className="board-header-right">
          <div className="board-stats">
            <span>{totalTasks} tasks</span>
            <span>{doneCount} done</span>
            <span>{percentComplete}% complete</span>
          </div>
          <button type="button" className="board-remove-btn" onClick={handleRemoveProject}>
            Remove
          </button>
        </div>
      </header>

      <div className="board-toolbar">
        <input
          className="filter-input"
          type="text"
          placeholder="Search title, description, labels, assignees..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All status</option>
          {COLUMNS.map((column) => (
            <option key={column.id} value={column.id}>
              {column.title}
            </option>
          ))}
        </select>
        <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
          <option value="all">All priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
        <select value={labelFilter} onChange={(event) => setLabelFilter(event.target.value)}>
          <option value="all">All labels</option>
          {allLabels.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
        <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}>
          <option value="all">All assignees</option>
          {allAssignees.map((assignee) => (
            <option key={assignee} value={assignee}>
              {assignee}
            </option>
          ))}
        </select>
        <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value)}>
          <option value="all">All due dates</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="next7">Due in 7 days</option>
          <option value="no_due">No due date</option>
        </select>
        <button
          type="button"
          className="clear-filters-btn"
          onClick={() => {
            setSearch('')
            setStatusFilter('all')
            setPriorityFilter('all')
            setLabelFilter('all')
            setAssigneeFilter('all')
            setDueFilter('all')
          }}
        >
          Clear
        </button>
      </div>

      <div className="filter-summary">
        Showing {filteredCards.length} of {project.cards.length} tasks
      </div>

      <div className="board-content">
        <div className="board-columns">
          {COLUMNS.map((column) => (
            <Column
              key={column.id}
              projectId={project.id}
              colId={column.id}
              title={column.title}
              cards={visibleCardsByColumn[column.id]}
              allCards={allCardsByColumn[column.id]}
              projectColor={project.color}
              addCard={addCard}
              removeCard={removeCard}
              moveCard={moveCard}
              openCardDetails={(card) => setSelectedCardId(card.id)}
              taskCount={allCardsByColumn[column.id].length}
              filtersActive={Boolean(filtersActive)}
            />
          ))}
        </div>
      </div>

      {selectedCard && (
        <CardDetailsModal
          card={selectedCard}
          projectColor={project.color}
          onClose={() => setSelectedCardId(null)}
          onSave={handleSaveCard}
          onDeleteCard={handleDeleteCard}
        />
      )}
    </div>
  )
}
