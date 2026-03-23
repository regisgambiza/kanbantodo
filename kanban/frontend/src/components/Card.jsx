import { useState } from 'react'

function formatDueDate(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

export default function Card({ card, projectColor, removeCard, onOpen }) {
  const [isDragging, setIsDragging] = useState(false)

  return (
    <article
      className={`card ${isDragging ? 'dragging' : ''}`}
      draggable={true}
      onDragStart={(event) => {
        event.dataTransfer.setData('cardId', String(card.id))
        event.dataTransfer.setData('sourceCol', String(card.col))
        event.dataTransfer.effectAllowed = 'move'
        setIsDragging(true)
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={() => onOpen(card)}
      style={{ borderLeftColor: projectColor }}
    >
      <button
        type="button"
        className="card-delete"
        onClick={(event) => {
          event.stopPropagation()
          removeCard(card.project_id, card.id)
        }}
        aria-label={`Delete ${card.title}`}
      >
        x
      </button>
      <div className="card-title">{card.title}</div>
      {card.subtitle && <div className="card-subtitle">{card.subtitle}</div>}

      <div className="card-meta">
        <span className={`priority-badge priority-${card.priority || 'medium'}`}>
          {(card.priority || 'medium').toUpperCase()}
        </span>
        {card.due_date && <span className="due-badge">Due {formatDueDate(card.due_date)}</span>}
      </div>

      {(card.labels || []).length > 0 && (
        <div className="chip-list">
          {card.labels.slice(0, 3).map((label) => (
            <span key={label} className="chip">
              {label}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
