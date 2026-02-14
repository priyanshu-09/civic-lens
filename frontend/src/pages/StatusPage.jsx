import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Card, HStack, Progress, SimpleGrid, Skeleton, Spinner, Stack, Stat, Status, Text } from '@chakra-ui/react'
import { client } from '../api/client'
import StatusPill from '../components/StatusPill'

const healthByState = {
  PENDING: { colorPalette: 'blue', label: 'Waiting' },
  RUNNING: { colorPalette: 'teal', label: 'Processing' },
  READY_FOR_REVIEW: { colorPalette: 'green', label: 'Ready' },
  EXPORTED: { colorPalette: 'green', label: 'Complete' },
  FAILED: { colorPalette: 'red', label: 'Issue found' },
}

const stageLabelByValue = {
  INGEST: 'Preparing video',
  LOCAL_PROPOSALS: 'Checking for incidents',
  GEMINI_FLASH: 'AI review (first pass)',
  GEMINI_PRO: 'AI review (deep check)',
  POSTPROCESS: 'Finalizing incident list',
  READY_FOR_REVIEW: 'Ready for your review',
  EXPORT: 'Building report package',
}

export default function StatusPage({ runId, onReviewReady }) {
  const [status, setStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    let statusTimer
    let logsTimer
    let stopped = false

    const pollStatus = async () => {
      if (stopped) return

      try {
        const statusResp = await client.get(`/api/runs/${runId}/status`)
        setStatus(statusResp.data)

        if (statusResp.data.state === 'READY_FOR_REVIEW' || statusResp.data.state === 'EXPORTED') {
          stopped = true
          onReviewReady()
          return
        }

        if (statusResp.data.state === 'FAILED') {
          stopped = true
          return
        }
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
        stopped = true
        return
      }

      statusTimer = setTimeout(pollStatus, 2000)
    }

    const pollLogs = async () => {
      if (stopped) return

      try {
        const logResp = await client.get(`/api/runs/${runId}/logs?tail=40`)
        setLogs(logResp.data.lines || [])
      } catch (err) {
        setError(err?.response?.data?.detail || err.message)
      }

      logsTimer = setTimeout(pollLogs, 6000)
    }

    pollStatus()
    pollLogs()

    return () => {
      stopped = true
      clearTimeout(statusTimer)
      clearTimeout(logsTimer)
    }
  }, [runId, onReviewReady])

  const health = healthByState[status?.state] || healthByState.PENDING

  const metrics = status?.metrics || {}

  const summary = useMemo(() => {
    const clipsChecked = Number(metrics.flash_done || 0) + Number(metrics.pro_done || 0)

    return {
      clipsChecked,
      potentialIncidents: Number(metrics.candidate_total || metrics.packets_sent_flash || 0),
      readyForReview: Number(metrics.packets_finalized || 0),
      needsExtraCheck: Number(metrics.flash_uncertain || 0),
    }
  }, [metrics])

  return (
    <Stack gap={5}>
      <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border">
        <Card.Header>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Card.Title fontSize={{ base: 'xl', md: '2xl' }}>Processing Video</Card.Title>
            <HStack gap={2}>
              <Status.Root colorPalette={health.colorPalette} size="sm">
                <Status.Indicator />
                {health.label}
              </Status.Root>
              {status?.state && <StatusPill value={status.state} />}
            </HStack>
          </HStack>
          <Card.Description color="text.muted">
            We are analyzing your video and preparing incidents for review.
          </Card.Description>
        </Card.Header>

        <Card.Body>
          {!status && (
            <Stack gap={4}>
              <Skeleton height="22px" borderRadius="md" />
              <Skeleton height="16px" borderRadius="md" />
              <Skeleton height="16px" borderRadius="md" />
              <Skeleton height="90px" borderRadius="lg" />
            </Stack>
          )}

          {status && (
            <Stack gap={4}>
              <HStack justify="space-between" align="center" flexWrap="wrap" gap={2}>
                <Text fontWeight="600">Current step: {stageLabelByValue[status.stage] || 'Processing'}</Text>
                {status.state === 'RUNNING' && (
                  <HStack color="text.muted" fontSize="sm">
                    <Spinner size="xs" color="teal.300" />
                    <Text>Live updates every few seconds</Text>
                  </HStack>
                )}
              </HStack>

              <Progress.Root value={Number(status.progress_pct || 0)} colorPalette={status.state === 'FAILED' ? 'red' : 'teal'} striped animated={status.state === 'RUNNING'}>
                <HStack justify="space-between" mb={1}>
                  <Progress.Label fontWeight="600">Overall progress</Progress.Label>
                  <Progress.ValueText color="text.muted" />
                </HStack>
                <Progress.Track>
                  <Progress.Range />
                </Progress.Track>
              </Progress.Root>

              {status.stage_message && (
                <Box px={3} py={2.5} borderRadius="md" border="1px solid" borderColor="border" bg="bg.elevated">
                  <Text fontSize="sm" color="text.muted">{status.stage_message}</Text>
                </Box>
              )}

              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={3}>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Clips checked</Stat.Label>
                  <Stat.ValueText>{summary.clipsChecked}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Possible incidents</Stat.Label>
                  <Stat.ValueText>{summary.potentialIncidents}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Ready for review</Stat.Label>
                  <Stat.ValueText>{summary.readyForReview}</Stat.ValueText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Needs extra checks</Stat.Label>
                  <Stat.ValueText>{summary.needsExtraCheck}</Stat.ValueText>
                </Stat.Root>
              </SimpleGrid>

              <Box as="details" border="1px dashed" borderColor="border" borderRadius="md" px={3} py={2.5} bg="bg.elevated">
                <Text as="summary" fontWeight="600" cursor="pointer">Technical details</Text>
                <Stack gap={2} mt={3}>
                  <Text fontSize="sm" color="text.muted">Session ID: {runId}</Text>
                  <Text fontSize="sm" color="text.muted">Raw state: {status.state}</Text>
                  <Text fontSize="sm" color="text.muted">Raw stage: {status.stage}</Text>
                  <Box border="1px solid" borderColor="border" borderRadius="md" bg="bg.surface" maxH="240px" overflowY="auto" px={3} py={2}>
                    <Stack gap={1.5}>
                      {logs.map((line, idx) => (
                        <Text key={idx} fontFamily="mono" fontSize="xs" color="text.muted" lineHeight="1.5">
                          [{line.stage}] {line.event}: {line.message}
                        </Text>
                      ))}
                      {logs.length === 0 && (
                        <Text fontSize="sm" color="text.soft">Waiting for logs...</Text>
                      )}
                    </Stack>
                  </Box>
                </Stack>
              </Box>

              {status.error_message && (
                <Alert.Root status="error" borderRadius="md" variant="subtle">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>We couldn't finish processing</Alert.Title>
                    <Alert.Description>{status.error_message}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              )}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      {error && (
        <Alert.Root status="error" borderRadius="md" variant="subtle">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Unable to fetch latest updates</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
    </Stack>
  )
}
