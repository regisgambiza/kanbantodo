import { useEffect, useState } from 'react'

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent']

function splitCommaValues(value) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index)
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
}

function formatCommentDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CardDetailsModal({
  card,
  projectColor,
  onClose,
  onSave,
  onDeleteCard,
}) {
  const [title, setTitle] = useState(card.title || '')
  const [subtitle, setSubtitle] = useState(card.subtitle || '')
  const [description, setDescription] = useState(card.description || '')
  const [dueDate, setDueDate] = useState(card.due_date || '')
  const [priority, setPriority] = useState(card.priority || 'medium')
  const [labelsInput, setLabelsInput] = useState((card.labels || []).join(', '))
  const [assigneesInput, setAssigneesInput] = useState((card.assignees || []).join(', '))
  const [checklistText, setChecklistText] = useState('')
  const [commentText, setCommentText] = useState('')
  const [attachmentName, setAttachmentName] = useState('')
  const [attachmentUrl, setAttachmentUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    setTitle(card.title || '')
    setSubtitle(card.subtitle || '')
    setDescription(card.description || '')
    setDueDate(card.due_date || '')
    setPriority(card.priority || 'medium')
    setLabelsInput((card.labels || []).join(', '))
    setAssigneesInput((card.assignees || []).join(', '))
    setLocalError('')
  }, [card])

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function persist(fields) {
    setBusy(true)
    setLocalError('')
    try {
      const updated = await onSave(fields)
      if (!updated) {
        setLocalError('Unable to save changes.')
      }
      return updated
    } finally {
      setBusy(false)
    }
  }

  async function handleSaveBasics(event) {
    event.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setLocalError('Title is required.')
      return
    }

    await persist({
      title: trimmedTitle,
      subtitle: subtitle.trim(),
      description: description.trim(),
      due_date: dueDate || null,
      priority,
      labels: splitCommaValues(labelsInput),
      assignees: splitCommaValues(assigneesInput),
    })
  }

  async function toggleChecklistItem(itemId) {
    const updatedChecklist = (card.checklist || []).map((item) =>
      item.id === itemId ? { ...item, done: !item.done } : item
    )
    await persist({ checklist: updatedChecklist })
  }

  async function deleteChecklistItem(itemId) {
    const updatedChecklist = (card.checklist || []).filter((item) => item.id !== itemId)
    await persist({ checklist: updatedChecklist })
  }

  async function addChecklistItem(event) {
    event.preventDefault()
    const text = checklistText.trim()
    if (!text) return
    const updatedChecklist = [
      ...(card.checklist || []),
      { id: makeId('item'), text, done: false },
    ]
    setChecklistText('')
    await persist({ checklist: updatedChecklist })
  }

  async function addComment(event) {
    event.preventDefault()
    const body = commentText.trim()
    if (!body) return
    const updatedComments = [
      ...(card.comments || []),
      {
        id: makeId('comment'),
        author: 'You',
        body,
        created_at: new Date().toISOString(),
      },
    ]
    setCommentText('')
    await persist({ comments: updatedComments })
  }

  async function deleteComment(commentId) {
    const updatedComments = (card.comments || []).filter((comment) => comment.id !== commentId)
    await persist({ comments: updatedComments })
  }

  async function addAttachment(event) {
    event.preventDefault()
    const url = attachmentUrl.trim()
    if (!url) return
    const name = attachmentName.trim() || url
    const updatedAttachments = [
      ...(card.attachments || []),
      { id: makeId('attachment'), name, url },
    ]
    setAttachmentName('')
    setAttachmentUrl('')
    await persist({ attachments: updatedAttachments })
  }

  async function deleteAttachment(attachmentId) {
    const updatedAttachments = (card.attachments || []).filter(
      (attachment) => attachment.id !== attachmentId
    )
    await persist({ attachments: updatedAttachments })
  }

  async function handleDeleteCard() {
    const removed = await onDeleteCard(card.id)
    if (removed) {
      onClose()
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <div className="modal-panel">
        <div className="modal-header" style={{ borderLeftColor: projectColor }}>
          <h2>Card details</h2>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            x
          </button>
        </div>

        <form className="modal-section" onSubmit={handleSaveBasics}>
          <h3>Basics</h3>
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Title"
          />
          <input
            type="text"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            placeholder="Subtitle"
          />
          <textarea
            rows="3"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
          />
          <div className="modal-grid">
            <label>
              Due date
              <input
                type="date"
                value={dueDate || ''}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>
            <label>
              Priority
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <input
            type="text"
            value={labelsInput}
            onChange={(event) => setLabelsInput(event.target.value)}
            placeholder="Labels (comma separated)"
          />
          <input
            type="text"
            value={assigneesInput}
            onChange={(event) => setAssigneesInput(event.target.value)}
            placeholder="Assignees (comma separated)"
          />
          <button type="submit" className="modal-save-btn" disabled={busy}>
            Save details
          </button>
        </form>

        <section className="modal-section">
          <h3>Checklist</h3>
          <ul className="modal-list">
            {(card.checklist || []).map((item) => (
              <li key={item.id} className="modal-list-item">
                <label className="check-item">
                  <input
                    type="checkbox"
                    checked={Boolean(item.done)}
                    onChange={() => toggleChecklistItem(item.id)}
                  />
                  <span className={item.done ? 'done' : ''}>{item.text}</span>
                </label>
                <button type="button" onClick={() => deleteChecklistItem(item.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form className="modal-inline-form" onSubmit={addChecklistItem}>
            <input
              type="text"
              value={checklistText}
              onChange={(event) => setChecklistText(event.target.value)}
              placeholder="Add checklist item"
            />
            <button type="submit">Add</button>
          </form>
        </section>

        <section className="modal-section">
          <h3>Comments</h3>
          <ul className="modal-list">
            {(card.comments || []).map((comment) => (
              <li key={comment.id} className="modal-list-item stacked">
                <div className="comment-head">
                  <strong>{comment.author || 'You'}</strong>
                  <span>{formatCommentDate(comment.created_at)}</span>
                </div>
                <div>{comment.body}</div>
                <button type="button" onClick={() => deleteComment(comment.id)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>
          <form className="modal-inline-form" onSubmit={addComment}>
            <input
              type="text"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Write a comment"
            />
            <button type="submit">Post</button>
          </form>
        </section>

        <section className="modal-section">
          <h3>Attachments</h3>
          <ul className="modal-list">
            {(card.attachments || []).map((attachment) => (
              <li key={attachment.id} className="modal-list-item">
                <a href={attachment.url} target="_blank" rel="noreferrer">
                  {attachment.name}
                </a>
                <button type="button" onClick={() => deleteAttachment(attachment.id)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
          <form className="modal-inline-form stacked" onSubmit={addAttachment}>
            <input
              type="text"
              value={attachmentName}
              onChange={(event) => setAttachmentName(event.target.value)}
              placeholder="Attachment name"
            />
            <input
              type="url"
              value={attachmentUrl}
              onChange={(event) => setAttachmentUrl(event.target.value)}
              placeholder="https://..."
            />
            <button type="submit">Attach</button>
          </form>
        </section>

        {localError && <div className="modal-error">{localError}</div>}

        <div className="modal-footer">
          <button type="button" className="danger-btn" onClick={handleDeleteCard} disabled={busy}>
            Delete card
          </button>
        </div>
      </div>
    </div>
  )
}
