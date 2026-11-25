import { requestJson } from '@/shared/http/roadmap-http'

export interface PublicationStatus {
  status: 'published' | 'unpublished'
  publicId: string | null
  viewerUrl: string | null
  embedUrl: string | null
  imageUrl: string | null
  markdown: string | null
  embedHtml: string | null
  revision: string | null
  publishedAt: string | null
  publicFields: string[]
  privateFields: string[]
  warning: string
  automaticUpdateNote: string
  cacheNote: string
  revocationNote: string
}

interface ApiPublicationStatus {
  status: 'published' | 'unpublished'
  public_id: string | null
  viewer_url: string | null
  embed_url: string | null
  image_url: string | null
  markdown: string | null
  embed_html: string | null
  revision: string | null
  published_at: string | null
  public_fields: string[]
  private_fields: string[]
  warning: string
  automatic_update_note: string
  cache_note: string
  revocation_note: string
}

function toStatus(response: ApiPublicationStatus): PublicationStatus {
  return {
    status: response.status,
    publicId: response.public_id,
    viewerUrl: response.viewer_url,
    embedUrl: response.embed_url,
    imageUrl: response.image_url,
    markdown: response.markdown,
    embedHtml: response.embed_html,
    revision: response.revision,
    publishedAt: response.published_at,
    publicFields: response.public_fields,
    privateFields: response.private_fields,
    warning: response.warning,
    automaticUpdateNote: response.automatic_update_note,
    cacheNote: response.cache_note,
    revocationNote: response.revocation_note,
  }
}

export async function getPublication(
  roadmapId: string,
  sessionToken: string,
): Promise<PublicationStatus> {
  const data = await requestJson<ApiPublicationStatus>(
    `/api/roadmaps/${roadmapId}/publication`,
    {},
    sessionToken,
  )
  return toStatus(data)
}

export async function publishRoadmap(
  roadmapId: string,
  sessionToken: string,
): Promise<PublicationStatus> {
  const data = await requestJson<ApiPublicationStatus>(
    `/api/roadmaps/${roadmapId}/publication`,
    { method: 'POST' },
    sessionToken,
  )
  return toStatus(data)
}

export async function unpublishRoadmap(
  roadmapId: string,
  sessionToken: string,
): Promise<PublicationStatus> {
  const data = await requestJson<ApiPublicationStatus>(
    `/api/roadmaps/${roadmapId}/publication`,
    { method: 'DELETE' },
    sessionToken,
  )
  return toStatus(data)
}
