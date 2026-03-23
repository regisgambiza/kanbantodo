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
