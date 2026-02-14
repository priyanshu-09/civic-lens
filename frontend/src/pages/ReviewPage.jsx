import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  AspectRatio,
  Badge,
  Box,
  Button,
  Card,
  HStack,
  Image,
  NativeSelect,
  Progress,
  SimpleGrid,
  Skeleton,
  Spinner,
  Stack,
  Stat,
  Status,
  Text,
  Textarea,
} from '@chakra-ui/react'
import { client } from '../api/client'
import ImageLightbox from '../components/ImageLightbox'
import StatusPill from '../components/StatusPill'

const stageHealthByState = {
  PENDING: { colorPalette: 'blue', label: 'Waiting' },
  RUNNING: { colorPalette: 'teal', label: 'Processing' },
  READY_FOR_REVIEW: { colorPalette: 'green', label: 'Ready to review' },
  EXPORTED: { colorPalette: 'green', label: 'Complete' },
  FAILED: { colorPalette: 'red', label: 'Needs attention' },
}

const typeLabelByValue = {
  NO_HELMET: 'No Helmet',
  RED_LIGHT_JUMP: 'Red Light Jump',
  WRONG_SIDE_DRIVING: 'Wrong-Side Driving',
  RECKLESS_DRIVING: 'Reckless Driving',
}

const sourceLabelByValue = {
  GEMINI_FLASH: 'AI first pass',
  GEMINI_PRO: 'AI deep check',
  POSTPROCESS: 'Final merge',
}

const stageLabelByValue = {
  INGEST: 'Preparing video',
  LOCAL_PROPOSALS: 'Checking for incidents',
  GEMINI_FLASH: 'AI review (first pass)',
  GEMINI_PRO: 'AI review (deep check)',
  POSTPROCESS: 'Finalizing incident list',
  READY_FOR_REVIEW: 'Ready to review',
  EXPORT: 'Building report package',
}

const priorityFromRisk = (riskValue) => {
  const risk = Number(riskValue || 0)
  if (risk >= 70) return { label: 'High', tone: 'red' }
  if (risk >= 40) return { label: 'Medium', tone: 'orange' }
  return { label: 'Low', tone: 'green' }
}

const formatSeconds = (val) => `${Number(val || 0).toFixed(1)}s`

function MetaCard({ label, value, tone = 'gray' }) {
  return (
    <Box border="1px solid" borderColor="border" borderRadius="md" bg="bg.elevated" px={3} py={2.5}>
      <Text fontSize="xs" color="text.soft" mb={1}>{label}</Text>
      <Badge colorPalette={tone} variant="subtle" size="sm">{value}</Badge>
    </Box>
  )
}

export default function ReviewPage({ runId }) {
  const [events, setEvents] = useState([])
  const [trace, setTrace] = useState({ packets: [] })
  const [status, setStatus] = useState(null)
  const [decisions, setDecisions] = useState({})
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [provisional, setProvisional] = useState(true)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxImages, setLightboxImages] = useState([])
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [lightboxTitle, setLightboxTitle] = useState('')

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => Number(a.start_time || 0) - Number(b.start_time || 0)),
    [events],
  )

  useEffect(() => {
    let timer
    let stopped = false
    let lastKnownState = ''

    const poll = async () => {
      if (stopped) return

      try {
        const [statusResp, eventsResp, traceResp] = await Promise.all([
          client.get(`/api/runs/${runId}/status`),
          client.get(`/api/runs/${runId}/events`),
          client.get(`/api/runs/${runId}/trace`),
        ])

        lastKnownState = statusResp.data?.state || lastKnownState
        setStatus(statusResp.data)
        setEvents(eventsResp.data.events || [])
        setTrace(traceResp.data || { packets: [] })
        setProvisional(Boolean(eventsResp.data?.provisional || traceResp.data?.provisional))
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }

      const done = ['READY_FOR_REVIEW', 'EXPORTED', 'FAILED'].includes(lastKnownState)
      timer = setTimeout(poll, done ? 5000 : 2000)
    }

    poll()

    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [runId])

  const traceByPacketId = useMemo(() => {
    const entries = Array.isArray(trace.packets) ? trace.packets : []
    const map = {}
    entries.forEach((entry) => {
      map[entry.packet_id] = entry
    })
    return map
  }, [trace])

  const livePackets = useMemo(() => {
    const entries = Array.isArray(trace.packets) ? trace.packets : []
    return [...entries].sort((a, b) => Number(b?.local?.local_score || 0) - Number(a?.local?.local_score || 0))
  }, [trace])

  const saveDecision = async (eventId) => {
    const decision = decisions[eventId] || { decision: 'ACCEPT', reviewer_notes: '', include_plate: false }

    try {
      await client.post(`/api/runs/${runId}/events/${eventId}/review`, decision)
      setMessage('Your decision has been saved.')
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const exportPack = async () => {
    try {
      const resp = await client.get(`/api/runs/${runId}/export`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(resp.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `case_pack_${runId}.zip`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    }
  }

  const artifactUrl = (path) => {
    if (!path) return ''
    const encoded = encodeURIComponent(path)
    return `${client.defaults.baseURL}/api/runs/${runId}/artifact?path=${encoded}`
  }

  const openEvidenceLightbox = ({ title, images, index = 0 }) => {
    if (!images?.length) return
    setLightboxTitle(title)
    setLightboxImages(images)
    setLightboxIndex(index)
    setLightboxOpen(true)
  }

  const stageHealth = stageHealthByState[status?.state] || stageHealthByState.PENDING
  const isLoading = !status && !error && events.length === 0 && livePackets.length === 0

  const uncertainCount = sortedEvents.filter((event) => event.uncertain).length

  return (
    <Stack gap={5}>
      <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border">
        <Card.Header>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Card.Title fontSize={{ base: 'xl', md: '2xl' }}>Review Incidents</Card.Title>
            <HStack gap={2}>
              <Status.Root colorPalette={stageHealth.colorPalette} size="sm">
                <Status.Indicator />
                {stageHealth.label}
              </Status.Root>
              {status?.state && <StatusPill value={status.state} />}
              <Badge colorPalette={provisional ? 'teal' : 'green'} variant="subtle" px={3} py={1.5}>
                {provisional ? 'Updating live' : 'Final list'}
              </Badge>
            </HStack>
          </HStack>
          <Card.Description color="text.muted">
            Confirm each incident before downloading the final report package.
          </Card.Description>
        </Card.Header>
        <Card.Body>
          {isLoading && (
            <Stack gap={3}>
              <Skeleton height="20px" borderRadius="md" />
              <Skeleton height="20px" borderRadius="md" />
              <Skeleton height="80px" borderRadius="lg" />
            </Stack>
          )}

          {status && (
            <Stack gap={4}>
              <Progress.Root
                value={Number(status.progress_pct || 0)}
                colorPalette={status.state === 'FAILED' ? 'red' : 'teal'}
                striped
                animated={status.state === 'RUNNING'}
              >
                <HStack justify="space-between" mb={1}>
                  <Progress.Label fontWeight="600">Analysis progress</Progress.Label>
                  <Progress.ValueText color="text.muted" />
                </HStack>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>

              <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Incidents found</Stat.Label>
                  <Stat.ValueText>{sortedEvents.length}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Need attention</Stat.Label>
                  <Stat.ValueText>{uncertainCount}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Incoming checks</Stat.Label>
                  <Stat.ValueText>{livePackets.length}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Current step</Stat.Label>
                  <Stat.ValueText fontSize="md">{stageLabelByValue[status.stage] || 'Processing'}</Stat.ValueText>
                </Stat.Root>
              </SimpleGrid>
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      {error && (
        <Alert.Root status="error" borderRadius="md" variant="subtle">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Could not load review data</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {message && (
        <Alert.Root status="success" borderRadius="md" variant="subtle">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Saved</Alert.Title>
            <Alert.Description>{message}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {sortedEvents.length === 0 && livePackets.length === 0 && !isLoading && (
        <Card.Root variant="outline" bg="bg.surface" borderColor="border">
          <Card.Body>
            <Text color="text.muted">No incidents are ready yet. Please wait while we continue processing.</Text>
          </Card.Body>
        </Card.Root>
      )}

      {sortedEvents.length === 0 && livePackets.length > 0 && (
        <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border">
          <Card.Header>
            <Card.Title fontSize="lg">Incoming Potential Incidents</Card.Title>
            <Card.Description color="text.muted">
              These are possible incidents that are still being verified.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <Stack gap={3}>
              {livePackets.map((packet) => {
                const anchors = Array.isArray(packet.anchor_frames)
                  ? packet.anchor_frames.map((frame) => frame.path).filter(Boolean)
                  : []

                return (
                  <Card.Root key={packet.packet_id} variant="outline" bg="bg.elevated" borderColor="border">
                    <Card.Body gap={3}>
                      <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                        <Text fontWeight="700">{typeLabelByValue[packet.local?.proposed_event_type] || 'Potential incident'}</Text>
                        <Badge colorPalette="teal" variant="subtle">Being verified</Badge>
                      </HStack>

                      <HStack gap={2} flexWrap="wrap">
                        <Badge colorPalette="gray" variant="subtle">
                          Confidence {Math.round(Number(packet.local?.local_score || 0) * 100)}%
                        </Badge>
                      </HStack>

                      {anchors.length > 0 && (
                        <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={3}>
                          {anchors.slice(0, 3).map((path, idx) => {
                            const src = artifactUrl(path)
                            return (
                              <Box
                                key={src}
                                as="button"
                                type="button"
                                onClick={() =>
                                  openEvidenceLightbox({
                                    title: 'Potential Incident Frames',
                                    images: anchors.map((imgPath) => artifactUrl(imgPath)),
                                    index: idx,
                                  })
                                }
                                borderRadius="md"
                                overflow="hidden"
                                border="1px solid"
                                borderColor="border"
                              >
                                <AspectRatio ratio={16 / 9}>
                                  <Image src={src} alt={`potential-${idx + 1}`} objectFit="cover" />
                                </AspectRatio>
                              </Box>
                            )
                          })}
                        </SimpleGrid>
                      )}

                      <Box as="details" border="1px dashed" borderColor="border" borderRadius="md" px={3} py={2}>
                        <Text as="summary" fontWeight="600" cursor="pointer">Technical details</Text>
                        <Stack gap={1.5} mt={2}>
                          <Text fontSize="sm" color="text.muted">Packet: {packet.packet_id}</Text>
                          <Text fontSize="sm" color="text.muted">Routing: {(packet.routing?.routing_reason || []).join(', ') || 'N/A'}</Text>
                        </Stack>
                      </Box>
                    </Card.Body>
                  </Card.Root>
                )
              })}
            </Stack>
          </Card.Body>
        </Card.Root>
      )}

      {sortedEvents.map((event) => {
        const start = Number(event.start_time || 0)
        const end = Number(event.end_time || 0)
        const confidence = Number(event.confidence || 0)
        const traceEntry = traceByPacketId[event.packet_id]
        const evidenceFrames = Array.isArray(event.evidence_frames) ? event.evidence_frames : []
        const priority = priorityFromRisk(event.risk_score)

        return (
          <Card.Root key={event.event_id} variant="elevated" bg="bg.surface" border="1px solid" borderColor="border">
            <Card.Header>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <Stack gap={1}>
                  <Card.Title fontSize="lg">{typeLabelByValue[event.event_type] || event.event_type}</Card.Title>
                  <Text color="text.muted" fontSize="sm">
                    Time in video: {formatSeconds(start)} - {formatSeconds(end)}
                  </Text>
                </Stack>
                <HStack gap={2}>
                  <Badge colorPalette="blue" variant="subtle">Confidence {Math.round(confidence * 100)}%</Badge>
                  <Badge colorPalette={priority.tone} variant="subtle">Priority {priority.label}</Badge>
                </HStack>
              </HStack>
            </Card.Header>

            <Card.Body>
              <Stack gap={4}>
                {event.explanation_short && (
                  <Box px={3} py={2.5} borderRadius="md" bg="bg.elevated" border="1px solid" borderColor="border">
                    <Text fontSize="sm" color="text.muted">{event.explanation_short}</Text>
                  </Box>
                )}

                {evidenceFrames.length > 0 && (
                  <Stack gap={2}>
                    <Text fontWeight="600" fontSize="sm">Evidence</Text>
                    <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={3}>
                      {evidenceFrames.slice(0, 3).map((path, idx) => {
                        const src = artifactUrl(path)
                        return (
                          <Box
                            key={src}
                            as="button"
                            type="button"
                            onClick={() =>
                              openEvidenceLightbox({
                                title: `${typeLabelByValue[event.event_type] || 'Incident'} Evidence`,
                                images: evidenceFrames.map((imgPath) => artifactUrl(imgPath)),
                                index: idx,
                              })
                            }
                            borderRadius="md"
                            overflow="hidden"
                            border="1px solid"
                            borderColor="border"
                            transition="transform 160ms ease"
                            _hover={{ transform: 'translateY(-2px)' }}
                          >
                            <AspectRatio ratio={16 / 9}>
                              <Image src={src} alt={`${event.event_id}-${idx + 1}`} objectFit="cover" />
                            </AspectRatio>
                          </Box>
                        )
                      })}
                    </SimpleGrid>
                  </Stack>
                )}

                <SimpleGrid columns={{ base: 1, sm: 2, md: 3 }} gap={3}>
                  <MetaCard label="Detected by" value={sourceLabelByValue[event.source_stage] || 'AI analysis'} tone="gray" />
                  <MetaCard label="Plate number" value={event.plate_text || 'Not visible'} tone={event.plate_text ? 'green' : 'gray'} />
                  <MetaCard label="Review status" value={event.uncertain ? 'Needs attention' : 'Looks clear'} tone={event.uncertain ? 'orange' : 'green'} />
                </SimpleGrid>

                <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
                  <Box>
                    <Text fontWeight="600" fontSize="sm" mb={1.5}>Decision</Text>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={(decisions[event.event_id] || {}).decision || 'ACCEPT'}
                        onChange={(e) =>
                          setDecisions((d) => ({
                            ...d,
                            [event.event_id]: { ...(d[event.event_id] || {}), decision: e.target.value },
                          }))
                        }
                        bg="bg.elevated"
                      >
                        <option value="ACCEPT">Accept</option>
                        <option value="REJECT">Reject</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Box>

                  <Box>
                    <Text fontWeight="600" fontSize="sm" mb={1.5}>Notes</Text>
                    <Textarea
                      rows={3}
                      placeholder="Add any notes for this incident"
                      value={(decisions[event.event_id] || {}).reviewer_notes || ''}
                      onChange={(e) =>
                        setDecisions((d) => ({
                          ...d,
                          [event.event_id]: { ...(d[event.event_id] || {}), reviewer_notes: e.target.value },
                        }))
                      }
                      bg="bg.elevated"
                    />
                  </Box>
                </SimpleGrid>

                <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                  <HStack as="label" gap={2} cursor="pointer" color="text.muted" fontSize="sm">
                    <Box
                      as="input"
                      type="checkbox"
                      checked={(decisions[event.event_id] || {}).include_plate || false}
                      onChange={(e) =>
                        setDecisions((d) => ({
                          ...d,
                          [event.event_id]: { ...(d[event.event_id] || {}), include_plate: e.target.checked },
                        }))
                      }
                      accentColor="#29b8a9"
                    />
                    <Text>Include plate number in report</Text>
                  </HStack>

                  <Button colorPalette="teal" onClick={() => saveDecision(event.event_id)}>
                    Save Decision
                  </Button>
                </HStack>

                {traceEntry && (
                  <Box as="details" border="1px dashed" borderColor="border" borderRadius="md" px={3} py={2.5} bg="bg.elevated">
                    <Text as="summary" fontWeight="600" cursor="pointer">Technical details</Text>
                    <Stack gap={2} mt={3}>
                      <Text fontSize="sm" color="text.muted">Event ID: {event.event_id}</Text>
                      <Text fontSize="sm" color="text.muted">Packet: {event.packet_id || 'N/A'}</Text>
                      <Text fontSize="sm" color="text.muted">Local score: {Number(traceEntry.local?.local_score || 0).toFixed(3)}</Text>
                      <Text fontSize="sm" color="text.muted">AI routing: {(traceEntry.routing?.routing_reason || []).join(', ') || 'N/A'}</Text>
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Card.Body>
          </Card.Root>
        )
      })}

      <HStack justify="flex-end">
        <Button colorPalette="blue" size="lg" onClick={exportPack}>
          Download Report Package
        </Button>
      </HStack>

      <ImageLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        title={lightboxTitle}
        images={lightboxImages}
        activeIndex={lightboxIndex}
        onPrev={() => setLightboxIndex((i) => (i <= 0 ? lightboxImages.length - 1 : i - 1))}
        onNext={() => setLightboxIndex((i) => (i >= lightboxImages.length - 1 ? 0 : i + 1))}
      />
    </Stack>
  )
}
