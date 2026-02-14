import { useEffect, useState } from 'react'
import { Alert, Badge, Box, Card, HStack, Progress, SimpleGrid, Skeleton, Spinner, Stack, Stat, Status, Text } from '@chakra-ui/react'
import { client } from '../api/client'
import StatusPill from '../components/StatusPill'

const healthByState = {
  PENDING: { colorPalette: 'blue', label: 'Queued' },
  RUNNING: { colorPalette: 'orange', label: 'Live' },
  READY_FOR_REVIEW: { colorPalette: 'green', label: 'Review Ready' },
  EXPORTED: { colorPalette: 'green', label: 'Exported' },
  FAILED: { colorPalette: 'red', label: 'Failed' },
}

const progressToneByState = {
  PENDING: 'blue',
  RUNNING: 'cyan',
  READY_FOR_REVIEW: 'green',
  EXPORTED: 'green',
  FAILED: 'red',
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

  return (
    <Stack gap={5}>
      <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border.subtle">
        <Card.Header>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
            <Card.Title fontSize={{ base: 'xl', md: '2xl' }}>Run Status</Card.Title>
            <HStack gap={2}>
              <Status.Root colorPalette={health.colorPalette} size="sm">
                <Status.Indicator />
                {health.label}
              </Status.Root>
              {status?.state && <StatusPill value={status.state} />}
            </HStack>
          </HStack>
          <Card.Description color="text.muted">
            Run ID: {runId}
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
                <Text fontWeight="600">
                  Stage: {status.stage}
                </Text>
                {status.state === 'RUNNING' && (
                  <HStack color="text.muted" fontSize="sm">
                    <Spinner size="xs" color="cyan.300" />
                    <Text>Live updates every 2s</Text>
                  </HStack>
                )}
              </HStack>

              <Progress.Root
                value={Number(status.progress_pct || 0)}
                colorPalette={progressToneByState[status.state] || 'gray'}
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

              {status.stage_message && (
                <Box px={3} py={2.5} borderRadius="md" border="1px solid" borderColor="border.subtle" bg="bg.elevated">
                  <Text fontSize="sm" color="text.muted">
                    {status.stage_message}
                  </Text>
                </Box>
              )}

              <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} gap={3}>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Flash Processed</Stat.Label>
                  <Stat.ValueText>{status.metrics?.flash_done || 0}</Stat.ValueText>
                  <Stat.HelpText>of {status.metrics?.packets_sent_flash || status.metrics?.candidate_total || 0}</Stat.HelpText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Pro Processed</Stat.Label>
                  <Stat.ValueText>{status.metrics?.pro_done || 0}</Stat.ValueText>
                  <Stat.HelpText>of {status.metrics?.packets_sent_pro || status.metrics?.pro_queued || 0}</Stat.HelpText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Finalized Packets</Stat.Label>
                  <Stat.ValueText>{status.metrics?.packets_finalized || 0}</Stat.ValueText>
                  <Stat.HelpText>merged output</Stat.HelpText>
                </Stat.Root>
                <Stat.Root size="sm" bg="bg.elevated" px={3} py={2.5} borderRadius="md">
                  <Stat.Label>Flash Uncertain</Stat.Label>
                  <Stat.ValueText>{status.metrics?.flash_uncertain || 0}</Stat.ValueText>
                  <Stat.HelpText>escalated to Pro</Stat.HelpText>
                </Stat.Root>
              </SimpleGrid>

              {status.error_message && (
                <Alert.Root status="error" borderRadius="md">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Run Failed</Alert.Title>
                    <Alert.Description>{status.error_message}</Alert.Description>
                  </Alert.Content>
                </Alert.Root>
              )}
            </Stack>
          )}
        </Card.Body>
      </Card.Root>

      {error && (
        <Alert.Root status="error" borderRadius="md">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Status Poll Error</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      <Card.Root variant="elevated" bg="bg.surface" border="1px solid" borderColor="border.subtle">
        <Card.Header>
          <HStack justify="space-between" align="center">
            <Card.Title fontSize="lg">Pipeline Logs</Card.Title>
            <Badge colorPalette="gray" variant="surface">
              tail=40
            </Badge>
          </HStack>
        </Card.Header>
        <Card.Body>
          <Box
            border="1px solid"
            borderColor="border.subtle"
            borderRadius="md"
            bg="bg.elevated"
            maxH="320px"
            overflowY="auto"
            px={3}
            py={2}
          >
            <Stack gap={1.5}>
              {logs.map((line, idx) => (
                <Text key={idx} fontFamily="mono" fontSize="xs" color="text.muted" lineHeight="1.5">
                  [{line.stage}] {line.event}: {line.message}
                </Text>
              ))}
              {logs.length === 0 && (
                <Text fontSize="sm" color="text.soft">
                  Waiting for logs...
                </Text>
              )}
            </Stack>
          </Box>
        </Card.Body>
      </Card.Root>
    </Stack>
  )
}
