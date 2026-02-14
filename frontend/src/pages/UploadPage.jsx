import { useRef, useState } from 'react'
import { Alert, Badge, Box, Button, Card, HStack, Input, Spinner, Stack, Text } from '@chakra-ui/react'
import { FiUploadCloud, FiVideo } from 'react-icons/fi'
import { client } from '../api/client'

export default function UploadPage({ onRunCreated }) {
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const submit = async () => {
    if (!file) {
      setError('Please choose a video file first.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const form = new FormData()
      form.append('video', file)
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
      borderColor="border"
      boxShadow="0 16px 34px rgba(2, 8, 20, 0.30)"
      maxW="3xl"
      mx="auto"
    >
      <Card.Header>
        <Card.Title fontSize={{ base: 'xl', md: '2xl' }}>
          Upload a Traffic Video
        </Card.Title>
        <Card.Description color="text.muted">
          Add your road footage and we will find possible traffic incidents for you to review.
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
              <HStack gap={3} px={4} py={3} borderRadius="lg" bg="bg.elevated" border="1px solid" borderColor="border">
                <Spinner color="teal.300" size="sm" />
                <Text fontWeight="600">Starting your analysis...</Text>
              </HStack>
            </Box>
          )}

          <Input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            display="none"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />

          <Box
            border="1px dashed"
            borderColor="border"
            borderRadius="lg"
            px={{ base: 4, md: 6 }}
            py={{ base: 6, md: 8 }}
            bg="bg.elevated"
          >
            <Stack align="center" gap={3} textAlign="center">
              <Box
                w="12"
                h="12"
                borderRadius="full"
                bg="rgba(41, 184, 169, 0.18)"
                display="flex"
                alignItems="center"
                justifyContent="center"
                color="teal.200"
              >
                <FiVideo size={22} />
              </Box>
              <Text fontWeight="700" fontSize="lg">Choose your video file</Text>
              <Text color="text.muted" fontSize="sm">
                MP4 and MOV work best.
              </Text>
              <Button
                colorPalette="teal"
                variant="solid"
                onClick={() => fileInputRef.current?.click()}
              >
                <HStack gap={2}>
                  <FiUploadCloud />
                  <Text>Select Video</Text>
                </HStack>
              </Button>
            </Stack>
          </Box>

          {file && (
            <HStack
              justify="space-between"
              px={3}
              py={2.5}
              borderRadius="md"
              border="1px solid"
              borderColor="border"
              bg="bg.elevated"
              flexWrap="wrap"
              gap={2}
            >
              <HStack gap={2} color="text.primary">
                <FiUploadCloud />
                <Text fontWeight="600">{file.name}</Text>
              </HStack>
              <Badge colorPalette="gray" variant="subtle" color="text.muted">
                {(file.size / (1024 * 1024)).toFixed(1)} MB
              </Badge>
            </HStack>
          )}

          {error && (
            <Alert.Root status="error" borderRadius="md" variant="subtle">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Could not start analysis</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert.Root>
          )}

          <Button
            onClick={submit}
            disabled={loading}
            loading={loading}
            loadingText="Starting"
            colorPalette="teal"
            size="lg"
            alignSelf="center"
            minW="220px"
          >
            Start Analysis
          </Button>
        </Stack>
      </Card.Body>
    </Card.Root>
  )
}
