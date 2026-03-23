const API_BASE = '/api'

async function request(path, options = {}) {
  const hasBody = options.body !== undefined
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const data = await response.json()
      if (data && data.error) {
        message = data.error
      }
    } catch {
      const text = await response.text()
      if (text) {
        message = text
      }
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return null
  }

  return response.json()
}

export async function fetchProjects() {
  return request('/projects', { method: 'GET' })
}

export async function createProject(name, color) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
  })
}

export async function updateProject(id, fields) {
  return request(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
}

export async function deleteProject(id) {
  return request(`/projects/${id}`, { method: 'DELETE' })
}

export async function createCard(projectId, col, title, subtitle, fields = {}) {
  return request(`/projects/${projectId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ col, title, subtitle, ...fields }),
  })
}

export async function updateCard(cardId, fields) {
  return request(`/cards/${cardId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
}

export async function deleteCard(cardId) {
  return request(`/cards/${cardId}`, { method: 'DELETE' })
}

// Templates API
export async function fetchTemplates() {
  return request('/templates', { method: 'GET' })
}

export async function createTemplate(name, description, color, wipLimits, cards) {
  return request('/templates', {
    method: 'POST',
    body: JSON.stringify({ name, description, color, wip_limits: wipLimits, cards }),
  })
}

export async function saveProjectAsTemplate(projectId, name, description) {
  return request(`/projects/${projectId}/save-as-template`, {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  })
}

export async function deleteTemplate(templateId) {
  return request(`/templates/${templateId}`, { method: 'DELETE' })
}

export async function applyTemplate(templateId, projectName, projectColor) {
  return request(`/templates/${templateId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ project_name: projectName, project_color: projectColor }),
  })
}

// Recurring Tasks API
export async function fetchRecurringTasks(projectId) {
  return request(`/projects/${projectId}/recurring-tasks`, { method: 'GET' })
}

export async function createRecurringTask(
  projectId,
  cardId,
  recurrenceType,
  recurrenceInterval,
  recurrenceStartDate,
  recurrenceEndDate
) {
  return request(`/projects/${projectId}/recurring-tasks`, {
    method: 'POST',
    body: JSON.stringify({
      card_id: cardId,
      recurrence_type: recurrenceType,
      recurrence_interval: recurrenceInterval,
      recurrence_start_date: recurrenceStartDate,
      recurrence_end_date: recurrenceEndDate,
    }),
  })
}

export async function updateRecurringTask(taskId, fields) {
  return request(`/recurring-tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
}

export async function deleteRecurringTask(taskId) {
  return request(`/recurring-tasks/${taskId}`, { method: 'DELETE' })
}

export async function generateRecurringTaskInstance(taskId) {
  return request(`/recurring-tasks/${taskId}/generate`, { method: 'POST' })
}

export async function generateAllRecurringTasks(projectId) {
  return request(`/projects/${projectId}/recurring-tasks/generate-all`, { method: 'POST' })
}
