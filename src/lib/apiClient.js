export async function getDocument() {
  return unwrapPayload(await fetchJson('/api/document'), '/api/document')
}

export async function putDocument(documentPayload) {
  return unwrapPayload(
    await fetchJson('/api/document', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(documentPayload)
    }),
    '/api/document'
  )
}

export async function putSelection(selectionPayload) {
  return fetchJson('/api/selection', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(selectionPayload)
  })
}

export async function createAnnotation(annotationPayload) {
  return validateAnnotationResponse(
    await fetchJson('/api/annotations', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(annotationPayload)
    }),
    '/api/annotations'
  )
}

export async function copyFeedbackFile(markdown) {
  return fetchJson('/api/feedback-file', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ markdown })
  })
}

async function fetchJson(url, options) {
  let response
  try {
    response = await fetch(url, options)
  } catch (error) {
    throw new Error(`Network request failed (${url}): ${formatErrorMessage(error)}`)
  }

  if (!response.ok) {
    throw new Error(`${response.status}: ${await readErrorBody(response)} (${url})`)
  }

  const body = await readSuccessBody(response, url)
  if (!body) return {}

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Invalid JSON response (${url})`)
  }
}

function unwrapPayload(responsePayload, url) {
  if (
    !responsePayload ||
    typeof responsePayload !== 'object' ||
    !Object.prototype.hasOwnProperty.call(responsePayload, 'payload')
  ) {
    throw new Error(`Missing payload in response (${url})`)
  }
  return responsePayload.payload
}

function validateAnnotationResponse(responsePayload, url) {
  if (!isObject(responsePayload?.annotation) || !isObject(responsePayload?.payload)) {
    throw new Error(`Malformed annotation response (${url})`)
  }
  return responsePayload
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

async function readErrorBody(response) {
  try {
    return (await response.text()) || '<empty response body>'
  } catch {
    return '<unreadable response body>'
  }
}

async function readSuccessBody(response, url) {
  try {
    return await response.text()
  } catch {
    throw new Error(`Unable to read response body (${url})`)
  }
}

function formatErrorMessage(error) {
  return error instanceof Error && error.message ? error.message : String(error)
}
