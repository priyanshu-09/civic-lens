import { useState } from 'react'
import { Alert, Badge, Box, Button, Card, Field, HStack, Input, Spinner, Stack, Text, Textarea } from '@chakra-ui/react'
import { FiUploadCloud } from 'react-icons/fi'
import { client } from '../api/client'

const defaultRoi = {
  stop_line_polygon: [[0.15, 0.7], [0.85, 0.7], [0.85, 0.74], [0.15, 0.74]],
  signal_roi_polygon: [[0.75, 0.05], [0.95, 0.05], [0.95, 0.25], [0.75, 0.25]],
  wrong_side_lane_polygon: [[0.0, 0.55], [0.45, 0.55], [0.45, 1.0], [0.0, 1.0]],
  expected_direction_vector: [1.0, 0.0],
}

export default function UploadPage({ onRunCreated }) {
  const [file, setFile] = useState(null)
  const [roiText, setRoiText] = useState(JSON.stringify(defaultRoi, null, 2))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!file) {
      setError('Select a video file first')
      return
    }
    setLoading(true)
    setError('')

    try {
      const form = new FormData()
      form.append('video', file)
      form.append('roi_config_json', roiText)
      const createResp = await client.post('/api/runs', form)
      const runId = createResp.data.run_id
      await client.post(`/api/runs/${runId}/start`)
      onRunCreated(runId)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card.Root
      variant="elevated"
      bg="bg.surface"
      border="1px solid"
      borderColor="border.subtle"
      boxShadow="0 24px 60px rgba(1, 6, 16, 0.35)"
    >
      <Card.Header>
        <Card.Title fontSize={{ base: 'xl', md: '2xl' }}>
          Upload Video
        </Card.Title>
        <Card.Description color="text.muted">
          Upload a 30-90s daytime dashcam clip and start analysis.
        </Card.Description>
      </Card.Header>
      <Card.Body>
        <Stack gap={5} position="relative">
          {loading && (
            <Box
              position="absolute"
              inset={0}
              zIndex={2}
              bg="bg.overlay"
              borderRadius="xl"
              display="flex"
              alignItems="center"
              justifyContent="center"
              backdropFilter="blur(6px)"
            >
              <HStack gap={3} px={4} py={3} borderRadius="lg" bg="bg.elevated" border="1px solid" borderColor="border.subtle">
                <Spinner color="cyan.300" size="sm" />
                <Text fontWeight="600">Starting analysis...</Text>
              </HStack>
            </Box>
          )}

          <Field.Root required>
            <Field.Label>Video File</Field.Label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <Field.HelperText color="text.soft">
              MP4/MOV recommended for fastest processing.
            </Field.HelperText>
          </Field.Root>

          {file && (
            <HStack
              justify="space-between"
              px={3}
              py={2.5}
              borderRadius="md"
              border="1px solid"
              borderColor="border.subtle"
              bg="bg.elevated"
              flexWrap="wrap"
              gap={2}
            >
              <HStack gap={2}>
                <FiUploadCloud />
                <Text fontWeight="600">{file.name}</Text>
              </HStack>
              <Badge colorPalette="cyan" variant="surface">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Badge>
            </HStack>
          )}

          <Field.Root>
            <Field.Label>ROI Config (JSON)</Field.Label>
            <Textarea
              value={roiText}
              onChange={(e) => setRoiText(e.target.value)}
              rows={12}
              fontFamily="mono"
              resize="vertical"
              bg="bg.elevated"
            />
          </Field.Root>

          {error && (
            <Alert.Root status="error" borderRadius="md">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Unable to start run</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}

          <Button
            onClick={submit}
            disabled={loading}
            loading={loading}
            loadingText="Starting..."
            colorPalette="cyan"
            size="lg"
            alignSelf="flex-start"
            px={8}
          >
            Analyze
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
