import { useEffect, useMemo, useState } from 'react'
import { Alert, Badge, Box, Button, Card, DataList, HStack, Image, NativeSelect, Progress, SimpleGrid, Skeleton, Spinner, Stack, Stat, Status, Text, Textarea } from '@chakra-ui/react'
import { client } from '../api/client'
import ImageLightbox from '../components/ImageLightbox'
import StatusPill from '../components/StatusPill'

const stageHealthByState = {
  PENDING: { colorPalette: 'blue', label: 'Queued' },
  RUNNING: { colorPalette: 'orange', label: 'Live' },
  READY_FOR_REVIEW: { colorPalette: 'green', label: 'Review Ready' },
  EXPORTED: { colorPalette: 'cyan', label: 'Exported' },
  FAILED: { colorPalette: 'red', label: 'Failed' },
}

const traceTone = {
  ok: 'green',
  fallback: 'orange',
  pending: 'gray',
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

  const sortedEvents = useMemo(() => [...events].sort((a, b) => Number(a.start_time || 0) - Number(b.start_time || 0)), [events])

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
        const isProv = Boolean(eventsResp.data?.provisional || traceResp.data?.provisional)
        setProvisional(isProv)
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
    return [...entries].sort((a, b) => {
      const aScore = Number(a?.local?.local_score || 0)
      const bScore = Number(b?.local?.local_score || 0)
      return bScore - aScore
    })
  }, [trace])

  const saveDecision = async (eventId) => {
    const decision = decisions[eventId] || { decision: 'ACCEPT', reviewer_notes: '', include_plate: false }
    try {
      await client.post(`/api/runs/${runId}/events/${eventId}/review`, decision)
      setMessage(`Saved decision for ${eventId}`)
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

  return (
    <Stack gap={5}>
      <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border.subtle">
        <Card.Header>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Card.Title fontSize={{ base: 'xl', md: '2xl' }}>Review Violations</Card.Title>
            <HStack gap={2}>
              <Status.Root colorPalette={stageHealth.colorPalette} size="sm">
                <Status.Indicator />
                {stageHealth.label}
              </Status.Root>
              {status?.state && <StatusPill value={status.state} />}
              <Badge colorPalette={provisional ? 'orange' : 'green'} variant="surface" px={3} py={1.5}>
                {provisional ? 'LIVE' : 'FINAL'}
              </Badge>
            </HStack>
          </HStack>
          <Card.Description color="text.muted">Run ID: {runId}</Card.Description>
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
                colorPalette={status.state === 'FAILED' ? 'red' : 'cyan'}
                striped
                animated={status.state === 'RUNNING'}
              >
                <HStack justify="space-between" mb={1}>
                  <Progress.Label fontWeight="600">Pipeline Progress</Progress.Label>
                  <Progress.ValueText color="text.muted" />
                </HStack>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>
              <SimpleGrid columns={{ base: 2, md: 4 }} gap={3}>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Events</Stat.Label>
                  <Stat.ValueText>{sortedEvents.length}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Live Packets</Stat.Label>
                  <Stat.ValueText>{livePackets.length}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Stage</Stat.Label>
                  <Stat.ValueText fontSize="md">{status.stage}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Stream</Stat.Label>
                  <Stat.ValueText fontSize="md">
                    {status.state === 'RUNNING' ? (
                      <HStack gap={2}>
                        <Spinner size="xs" color="cyan.300" />
                        <Text>Live</Text>
                      </HStack>
                    ) : (
                      'Idle'
                    )}
                  </Stat.ValueText>
                </Stat.Root>
              </SimpleGrid>
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      {error && (
        <Alert.Root status="error" borderRadius="md">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Review Error</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      {message && (
        <Alert.Root status="success" borderRadius="md">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Saved</Alert.Title>
            <Alert.Description>{message}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {sortedEvents.length === 0 && livePackets.length === 0 && !isLoading && (
        <Card.Root variant="outline" bg="bg.surface">
          <Card.Body>
            <Text color="text.muted">No events yet.</Text>
          </Card.Body>
        </Card.Root>
      )}

      {sortedEvents.length === 0 && livePackets.length > 0 && (
        <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border.subtle">
          <Card.Header>
            <Card.Title fontSize="lg">Live Packet Monitor</Card.Title>
            <Card.Description color="text.muted">
              Showing top packets by local score while final incidents are still forming.
            </Card.Description>
          </Card.Header>
          <Card.Body>
            <Stack gap={3}>
              {livePackets.map((packet) => {
                const anchors = Array.isArray(packet.anchor_frames) ? packet.anchor_frames.map((frame) => frame.path).filter(Boolean) : []
                return (
                  <Card.Root key={packet.packet_id} variant="outline" bg="bg.elevated">
                    <Card.Body gap={3}>
                      <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                        <Text fontWeight="700">{packet.packet_id}</Text>
                        <HStack gap={2}>
                          <Badge colorPalette={traceTone[packet.flash?.status] || traceTone.pending} variant="surface">
                            Flash: {packet.flash?.status || 'pending'}
                          </Badge>
                          <Badge colorPalette={traceTone[packet.pro?.status] || traceTone.pending} variant="surface">
                            Pro: {packet.pro?.status || 'pending'}
                          </Badge>
                        </HStack>
                      </HStack>

                      <DataList.Root size="sm" variant="subtle" orientation="vertical">
                        <DataList.Item>
                          <DataList.ItemLabel>Local Proposal</DataList.ItemLabel>
                          <DataList.ItemValue>{packet.local?.proposed_event_type || 'N/A'}</DataList.ItemValue>
                        </DataList.Item>
                        <DataList.Item>
                          <DataList.ItemLabel>Local Score</DataList.ItemLabel>
                          <DataList.ItemValue>{Number(packet.local?.local_score || 0).toFixed(3)}</DataList.ItemValue>
                        </DataList.Item>
                        <DataList.Item>
                          <DataList.ItemLabel>Routing</DataList.ItemLabel>
                          <DataList.ItemValue>{(packet.routing?.routing_reason || []).join(', ') || 'pending'}</DataList.ItemValue>
                        </DataList.Item>
                      </DataList.Root>

                      {anchors.length > 0 && (
                        <SimpleGrid columns={{ base: 2, md: 3 }} gap={2}>
                          {anchors.slice(0, 3).map((path, idx) => {
                            const src = artifactUrl(path)
                            return (
                              <Box
                                key={src}
                                as="button"
                                type="button"
                                onClick={() =>
                                  openEvidenceLightbox({
                                    title: `${packet.packet_id} - Anchor Frames`,
                                    images: anchors.map((imgPath) => artifactUrl(imgPath)),
                                    index: idx,
                                  })
                                }
                                borderRadius="md"
                                overflow="hidden"
                                border="1px solid"
                                borderColor="border.subtle"
                              >
                                <Image src={src} alt={`${packet.packet_id}-${idx + 1}`} h="92px" w="full" objectFit="cover" />
                              </Box>
                            )
                          })}
                        </SimpleGrid>
                      )}
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
        const risk = Number(event.risk_score || 0)
        const traceEntry = traceByPacketId[event.packet_id]
        const evidenceFrames = Array.isArray(event.evidence_frames) ? event.evidence_frames : []

        return (
          <Card.Root key={event.event_id} variant="elevated" bg="bg.surface" border="1px solid" borderColor="border.subtle">
            <Card.Header>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
                <Stack gap={1}>
                  <Card.Title fontSize="lg">{event.event_type}</Card.Title>
                  <Text color="text.muted" fontSize="sm">
                    Event ID: {event.event_id}
                  </Text>
                </Stack>
                <HStack gap={2}>
                  <Badge colorPalette={event.uncertain ? 'orange' : 'green'} variant="surface">
                    {event.uncertain ? 'Uncertain' : 'Validated'}
                  </Badge>
                  {event.provisional && (
                    <Badge colorPalette="orange" variant="subtle">Live</Badge>
                  )}
                </HStack>
              </HStack>
            </Card.Header>

            <Card.Body>
              <Stack gap={4}>
                <DataList.Root size="sm" variant="subtle" orientation="vertical">
                  <DataList.Item>
                    <DataList.ItemLabel>Packet</DataList.ItemLabel>
                    <DataList.ItemValue>{event.packet_id || 'N/A'}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>Source</DataList.ItemLabel>
                    <DataList.ItemValue>{event.source_stage || 'N/A'}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>Window</DataList.ItemLabel>
                    <DataList.ItemValue>{start.toFixed(2)}s - {end.toFixed(2)}s</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>Confidence</DataList.ItemLabel>
                    <DataList.ItemValue>{confidence.toFixed(2)}</DataList.ItemValue>
                  </DataList.Item>
                  <DataList.Item>
                    <DataList.ItemLabel>Risk</DataList.ItemLabel>
                    <DataList.ItemValue>{risk.toFixed(1)}</DataList.ItemValue>
                  </DataList.Item>
                </DataList.Root>

                <Box px={3} py={2.5} borderRadius="md" bg="bg.elevated" border="1px solid" borderColor="border.subtle">
                  <Text fontSize="sm" color="text.muted">{event.explanation_short}</Text>
                </Box>

                <HStack gap={2} flexWrap="wrap">
                  <Badge colorPalette="gray" variant="surface">
                    Plate: {event.plate_text || 'N/A'}
                  </Badge>
                  {event.plate_confidence != null && (
                    <Badge colorPalette="cyan" variant="subtle">
                      Plate conf {Number(event.plate_confidence).toFixed(2)}
                    </Badge>
                  )}
                </HStack>

                {evidenceFrames.length > 0 && (
                  <Stack gap={2}>
                    <Text fontWeight="600" fontSize="sm">Evidence Frames</Text>
                    <SimpleGrid columns={{ base: 2, md: 3 }} gap={2}>
                      {evidenceFrames.slice(0, 3).map((path, idx) => {
                        const src = artifactUrl(path)
                        return (
                          <Box
                            key={src}
                            as="button"
                            type="button"
                            onClick={() =>
                              openEvidenceLightbox({
                                title: `${event.event_type} - ${event.event_id}`,
                                images: evidenceFrames.map((imgPath) => artifactUrl(imgPath)),
                                index: idx,
                              })
                            }
                            borderRadius="md"
                            overflow="hidden"
                            border="1px solid"
                            borderColor="border.subtle"
                            transition="transform 160ms ease"
                            _hover={{ transform: 'translateY(-2px)' }}
                          >
                            <Image src={src} alt={`${event.event_id}-${idx + 1}`} h="104px" w="full" objectFit="cover" />
                          </Box>
                        )
                      })}
                    </SimpleGrid>
                  </Stack>
                )}

                {traceEntry && (
                  <Box as="details" px={3} py={2.5} borderRadius="md" bg="bg.elevated" border="1px dashed" borderColor="border.subtle">
                    <Text as="summary" fontWeight="600" cursor="pointer">Lineage Trace</Text>
                    <Stack gap={2} mt={3}>
                      <Text fontSize="sm" color="text.muted">
                        Local: {traceEntry.local?.proposed_event_type || 'N/A'} (score {Number(traceEntry.local?.local_score || 0).toFixed(3)})
                      </Text>
                      <Text fontSize="sm" color="text.muted">
                        Routing: {(traceEntry.routing?.routing_reason || []).join(', ') || 'N/A'}
                      </Text>
                      <HStack gap={2} flexWrap="wrap">
                        <Badge colorPalette={traceTone[traceEntry.flash?.status] || traceTone.pending} variant="surface">
                          Flash: {traceEntry.flash?.status || 'N/A'}
                        </Badge>
                        <Badge colorPalette={traceTone[traceEntry.pro?.status] || traceTone.pending} variant="surface">
                          Pro: {traceEntry.pro?.status || 'N/A'}
                        </Badge>
                      </HStack>
                      {Array.isArray(traceEntry.local?.reason_codes) && traceEntry.local.reason_codes.length > 0 && (
                        <Text fontSize="sm" color="text.muted">
                          Reasons: {traceEntry.local.reason_codes.join(', ')}
                        </Text>
                      )}
                    </Stack>
                  </Box>
                )}

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
                        <option value="ACCEPT">ACCEPT</option>
                        <option value="REJECT">REJECT</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Box>

                  <Box>
                    <Text fontWeight="600" fontSize="sm" mb={1.5}>Reviewer Notes</Text>
                    <Textarea
                      rows={3}
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
                      accentColor="#2dd4bf"
                    />
                    <Text>Include plate in report</Text>
                  </HStack>

                  <Button colorPalette="cyan" onClick={() => saveDecision(event.event_id)}>
                    Save Decision
                  </Button>
                </HStack>
              </Stack>
            </Card.Body>
          </Card.Root>
        )
      })}

      <HStack justify="flex-end">
        <Button colorPalette="blue" size="lg" onClick={exportPack}>
          Export Case Pack
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
