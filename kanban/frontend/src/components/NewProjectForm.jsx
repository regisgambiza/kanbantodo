import { useState } from 'react'

const COLORS = [
  '#7F77DD',
  '#1D9E75',
  '#D85A30',
  '#378ADD',
  '#D4537E',
  '#BA7517',
  '#639922',
  '#888780',
]

export default function NewProjectForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])

  async function handleSubmit(event) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    await onSubmit(trimmedName, color)
  }

  return (
    <form
      className="new-project-form"
      onSubmit={handleSubmit}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onCancel()
        }
      }}
    >
      <input
        type="text"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Project name"
        autoFocus
      />
      <div className="color-swatches">
        {COLORS.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`swatch ${swatch === color ? 'selected' : ''}`}
            style={{ backgroundColor: swatch }}
            onClick={() => setColor(swatch)}
            aria-label={`Select color ${swatch}`}
          />
        ))}
      </div>
      <div className="new-project-actions">
        <button type="submit" className="submit-btn">
          Add
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
