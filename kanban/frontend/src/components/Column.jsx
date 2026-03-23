import { useMemo, useState } from 'react'
import Card from './Card.jsx'

export default function Column({
  projectId,
  colId,
  title,
  cards,
  allCards,
  projectColor,
  addCard,
  removeCard,
  moveCard,
  openCardDetails,
  taskCount,
  filtersActive,
}) {
  const [showForm, setShowForm] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskSubtitle, setTaskSubtitle] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [dropIndex, setDropIndex] = useState(null)

  const indexByCardId = useMemo(() => {
    const map = new Map()
    allCards.forEach((card, index) => {
      map.set(card.id, index)
    })
    return map
  }, [allCards])

  async function handleAddTask(event) {
    event.preventDefault()
    const trimmedTitle = taskTitle.trim()
    if (!trimmedTitle) return

    const created = await addCard(projectId, colId, trimmedTitle, taskSubtitle.trim())
    if (created) {
      setTaskTitle('')
      setTaskSubtitle('')
      setShowForm(false)
    }
  }

  async function handleDropAt(event, targetPosition) {
    event.preventDefault()
    setDragOver(false)

    const rawCardId = event.dataTransfer.getData('cardId')
    const cardId = Number(rawCardId)
    if (!Number.isFinite(cardId)) return

    await moveCard(projectId, cardId, colId, targetPosition)
    setDropIndex(null)
  }

  return (
    <section
      className={`column ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(event) => {
        event.preventDefault()
        if (!dragOver) {
          setDragOver(true)
        }
        if (dropIndex === null) {
          setDropIndex(allCards.length)
        }
      }}
      onDragLeave={() => {
        setDragOver(false)
        setDropIndex(null)
      }}
      onDrop={(event) => handleDropAt(event, dropIndex ?? allCards.length)}
    >
      <header className="column-header">
        <div className="column-header-main">
          <span className={`column-title column-title-${colId}`}>{title}</span>
          <span className="column-count">{taskCount}</span>
        </div>
      </header>

      {filtersActive && <div className="filter-hint">Filtered view</div>}

      <div className="column-cards">
        {cards.map((card) => {
          const actualIndex = indexByCardId.get(card.id) ?? 0
          return (
            <div
              key={card.id}
              className="card-drop-zone"
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
                setDropIndex(actualIndex)
              }}
              onDrop={(event) => handleDropAt(event, actualIndex)}
            >
              {dropIndex === actualIndex && <div className="drop-indicator" />}
              <Card
                card={card}
                projectColor={projectColor}
                removeCard={removeCard}
                onOpen={openCardDetails}
              />
            </div>
          )
        })}
        {dropIndex === allCards.length && <div className="drop-indicator" />}
      </div>

      <div className="column-footer">
        {!showForm && (
          <button
            type="button"
            className="add-task-btn"
            onClick={() => setShowForm(true)}
          >
            + Add task
          </button>
        )}
        {showForm && (
          <form className="new-task-form" onSubmit={handleAddTask}>
            <input
              type="text"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              placeholder="Task title"
              autoFocus
            />
            <input
              type="text"
              value={taskSubtitle}
              onChange={(event) => setTaskSubtitle(event.target.value)}
              placeholder="Subtitle (optional)"
            />
            <div className="new-task-actions">
              <button type="submit" className="submit-btn">
                Add
              </button>
              <button
                type="button"
                className="cancel-btn"
                onClick={() => {
                  setShowForm(false)
                  setTaskTitle('')
                  setTaskSubtitle('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
