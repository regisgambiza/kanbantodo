import { useCallback, useEffect, useState } from 'react'
import {
  createCard,
  createProject,
  deleteCard,
  deleteProject,
  fetchProjects,
  updateCard,
  updateProject,
} from '../api/client.js'

const COLUMN_ORDER = ['backlog', 'todo', 'doing', 'done']

function sortCards(cards) {
  return [...cards].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position
    return a.id - b.id
  })
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item).trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index)
}

function normalizeObjectArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeCard(card) {
  return {
    ...card,
    subtitle: card.subtitle || '',
    description: card.description || '',
    due_date: card.due_date || null,
    priority: card.priority || 'medium',
    labels: normalizeStringArray(card.labels),
    assignees: normalizeStringArray(card.assignees),
    checklist: normalizeObjectArray(card.checklist),
    comments: normalizeObjectArray(card.comments),
    attachments: normalizeObjectArray(card.attachments),
  }
}

function normalizeProject(project) {
  return {
    ...project,
    cards: (project.cards || []).map(normalizeCard),
  }
}

function mergeCard(project, cardId, fields) {
  return {
    ...project,
    cards: project.cards.map((card) =>
      card.id === cardId ? normalizeCard({ ...card, ...fields }) : card
    ),
  }
}

function reorderProjectCards(project, cardId, targetCol, targetPosition) {
  const grouped = {
    backlog: sortCards(project.cards.filter((card) => card.col === 'backlog')),
    todo: sortCards(project.cards.filter((card) => card.col === 'todo')),
    doing: sortCards(project.cards.filter((card) => card.col === 'doing')),
    done: sortCards(project.cards.filter((card) => card.col === 'done')),
  }

  let movingCard = null
  for (const col of COLUMN_ORDER) {
    const index = grouped[col].findIndex((card) => card.id === cardId)
    if (index >= 0) {
      movingCard = grouped[col][index]
      grouped[col].splice(index, 1)
      break
    }
  }

  if (!movingCard) {
    return project
  }

  const destinationCol = COLUMN_ORDER.includes(targetCol) ? targetCol : movingCard.col
  const destinationCards = grouped[destinationCol]
  const requestedIndex =
    targetPosition === null || targetPosition === undefined
      ? destinationCards.length
      : Number.parseInt(targetPosition, 10)
  const insertIndex = Number.isFinite(requestedIndex)
    ? Math.max(0, Math.min(requestedIndex, destinationCards.length))
    : destinationCards.length

  destinationCards.splice(insertIndex, 0, { ...movingCard, col: destinationCol })

  const cardById = new Map()
  for (const col of COLUMN_ORDER) {
    grouped[col].forEach((card, index) => {
      cardById.set(card.id, normalizeCard({ ...card, col, position: index }))
    })
  }

  return {
    ...project,
    cards: project.cards.map((card) => cardById.get(card.id) || normalizeCard(card)),
  }
}

export default function useProjects() {
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    async function loadProjects() {
      setLoading(true)
      try {
        const data = await fetchProjects()
        if (!isMounted) return
        const normalized = data.map(normalizeProject)
        setProjects(normalized)
        setActiveProjectId(normalized.length > 0 ? normalized[0].id : null)
        setError('')
      } catch (err) {
        if (!isMounted) return
        setError(err.message || 'Failed to load projects')
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadProjects()
    return () => {
      isMounted = false
    }
  }, [])

  const addProject = useCallback(async (name, color) => {
    try {
      const project = normalizeProject(await createProject(name, color))
      setProjects((prev) => [...prev, project])
      setActiveProjectId((prev) => prev ?? project.id)
      setError('')
      return project
    } catch (err) {
      setError(err.message || 'Failed to create project')
      return null
    }
  }, [])

  const removeProject = useCallback(
    async (id) => {
      let snapshot = null

      setProjects((prev) => {
        snapshot = prev
        const remaining = prev.filter((project) => project.id !== id)
        setActiveProjectId((currentId) =>
          currentId === id ? (remaining.length > 0 ? remaining[0].id : null) : currentId
        )
        return remaining
      })

      try {
        await deleteProject(id)
        setError('')
        return true
      } catch (err) {
        if (snapshot) {
          setProjects(snapshot)
        }
        setError(err.message || 'Failed to delete project')
        return false
      }
    },
    []
  )

  const editProject = useCallback(async (id, fields) => {
    let snapshot = null
    const patch = { ...fields }

    setProjects((prev) => {
      snapshot = prev
      return prev.map((project) => {
        if (project.id !== id) return project
        return normalizeProject({ ...project, ...patch })
      })
    })

    try {
      const updated = normalizeProject(await updateProject(id, patch))
      setProjects((prev) =>
        prev.map((project) =>
          project.id === id
            ? {
                ...project,
                ...updated,
                cards: project.cards,
              }
            : project
        )
      )
      setError('')
      return updated
    } catch (err) {
      if (snapshot) {
        setProjects(snapshot)
      }
      setError(err.message || 'Failed to update project')
      return null
    }
  }, [])

  const addCard = useCallback(async (projectId, col, title, subtitle, extraFields = {}) => {
    const tempId = `temp-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
    const tempCard = normalizeCard({
      id: tempId,
      project_id: projectId,
      col,
      title,
      subtitle: subtitle || '',
      description: extraFields.description || '',
      due_date: extraFields.due_date || null,
      priority: extraFields.priority || 'medium',
      labels: extraFields.labels || [],
      assignees: extraFields.assignees || [],
      checklist: extraFields.checklist || [],
      comments: extraFields.comments || [],
      attachments: extraFields.attachments || [],
      position: 999999,
    })

    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId
          ? { ...project, cards: [...project.cards, tempCard] }
          : project
      )
    )

    try {
      const createdCard = normalizeCard(
        await createCard(projectId, col, title, subtitle, extraFields)
      )
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                cards: project.cards.map((card) =>
                  card.id === tempId ? createdCard : card
                ),
              }
            : project
        )
      )
      setError('')
      return createdCard
    } catch (err) {
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                cards: project.cards.filter((card) => card.id !== tempId),
              }
            : project
        )
      )
      setError(err.message || 'Failed to create card')
      return null
    }
  }, [])

  const removeCard = useCallback(async (projectId, cardId) => {
    let snapshot = null

    setProjects((prev) => {
      snapshot = prev
      return prev.map((project) =>
        project.id === projectId
          ? {
              ...project,
              cards: project.cards.filter((card) => card.id !== cardId),
            }
          : project
      )
    })

    try {
      await deleteCard(cardId)
      setError('')
      return true
    } catch (err) {
      if (snapshot) {
        setProjects(snapshot)
      }
      setError(err.message || 'Failed to delete card')
      return false
    }
  }, [])

  const editCard = useCallback(async (projectId, cardId, fields) => {
    let snapshot = null

    const patch = { ...fields }
    if ('labels' in patch) patch.labels = normalizeStringArray(patch.labels)
    if ('assignees' in patch) patch.assignees = normalizeStringArray(patch.assignees)
    if ('checklist' in patch) patch.checklist = normalizeObjectArray(patch.checklist)
    if ('comments' in patch) patch.comments = normalizeObjectArray(patch.comments)
    if ('attachments' in patch) patch.attachments = normalizeObjectArray(patch.attachments)

    setProjects((prev) => {
      snapshot = prev
      return prev.map((project) =>
        project.id === projectId ? mergeCard(project, cardId, patch) : project
      )
    })

    try {
      const updatedCard = normalizeCard(await updateCard(cardId, patch))
      setProjects((prev) =>
        prev.map((project) =>
          project.id === projectId
            ? {
                ...project,
                cards: project.cards.map((card) =>
                  card.id === cardId ? updatedCard : card
                ),
              }
            : project
        )
      )
      setError('')
      return updatedCard
    } catch (err) {
      if (snapshot) {
        setProjects(snapshot)
      }
      setError(err.message || 'Failed to update card')
      return null
    }
  }, [])

  const moveCard = useCallback(async (projectId, cardId, newCol, newPosition = null) => {
    let snapshot = null

    setProjects((prev) => {
      snapshot = prev
      return prev.map((project) =>
        project.id === projectId
          ? reorderProjectCards(project, cardId, newCol, newPosition)
          : project
      )
    })

    try {
      const payload = { col: newCol }
      if (newPosition !== null && newPosition !== undefined) {
        payload.position = newPosition
      }
      const updatedCard = normalizeCard(await updateCard(cardId, payload))
      setProjects((prev) =>
        prev.map((project) => {
          if (project.id !== projectId) return project
          const merged = {
            ...project,
            cards: project.cards.map((card) =>
              card.id === cardId ? updatedCard : card
            ),
          }
          return reorderProjectCards(
            merged,
            cardId,
            updatedCard.col,
            updatedCard.position
          )
        })
      )
      setError('')
      return true
    } catch (err) {
      if (snapshot) {
        setProjects(snapshot)
      }
      setError(err.message || 'Failed to move card')
      return false
    }
  }, [])

  return {
    projects,
    activeProjectId,
    setActiveProjectId,
    loading,
    error,
    addProject,
    removeProject,
    editProject,
    addCard,
    removeCard,
    editCard,
    moveCard,
  }
}
