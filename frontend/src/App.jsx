import { useState } from 'react'
import { Badge, Box, Button, ButtonGroup, Card, Container, HStack, Icon, Stack, Text } from '@chakra-ui/react'
import { RiDashboardLine } from 'react-icons/ri'
import BrandMark from './components/BrandMark'
import UploadPage from './pages/UploadPage'
import StatusPage from './pages/StatusPage'
import ReviewPage from './pages/ReviewPage'

export default function App() {
  const [runId, setRunId] = useState('')
  const [screen, setScreen] = useState('upload')

  const screenTitleByKey = {
    upload: 'Upload Video',
    status: 'Processing',
    review: 'Review Incidents',
  }

  const navItems = [
    { key: 'upload', label: 'Upload', enabled: true },
    { key: 'status', label: 'Processing', enabled: Boolean(runId) },
    { key: 'review', label: 'Review', enabled: Boolean(runId) },
  ]

  return (
    <Container maxW="7xl" py={{ base: 5, md: 8 }} px={{ base: 4, md: 6 }}>
      <Stack gap={5}>
        <Card.Root
          variant="elevated"
          bg="bg.overlay"
          border="1px solid"
          borderColor="border"
          backdropFilter="blur(10px)"
          boxShadow="0 14px 34px rgba(2, 8, 20, 0.32)"
        >
          <Card.Body gap={4}>
            <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={4}>
              <Stack gap={2}>
                <BrandMark />
                <Text color="text.muted" maxW="2xl">
                  Upload road footage, track analysis progress, and review incident evidence before downloading your report.
                </Text>
              </Stack>
              <HStack
                px={3}
                py={2}
                borderRadius="lg"
                border="1px solid"
                borderColor="border"
                bg="bg.surface"
                color="text.muted"
              >
                <Icon as={RiDashboardLine} boxSize={4.5} />
                <Text fontSize="sm" fontWeight="600">
                  {screenTitleByKey[screen]}
                </Text>
              </HStack>
            </HStack>

            <HStack justify="space-between" align="center" flexWrap="wrap" gap={3}>
              <ButtonGroup size="sm" gap={2} wrap="wrap">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    variant={screen === item.key ? 'solid' : 'subtle'}
                    colorPalette={screen === item.key ? 'teal' : 'gray'}
                    disabled={!item.enabled}
                    onClick={() => setScreen(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </ButtonGroup>
              {runId && (
                <Badge colorPalette="gray" variant="subtle" px={3} py={1.5} borderRadius="full" color="text.muted">
                  Session: {runId.slice(0, 8)}
                </Badge>
              )}
            </HStack>
          </Card.Body>
        </Card.Root>

        <Box animationStyle="slide-fade-in" animationDuration="280ms" animationTimingFunction="ease-out">
          {screen === 'upload' && (
            <UploadPage
              onRunCreated={(id) => {
                setRunId(id)
                setScreen('status')
              }}
            />
          )}

          {screen === 'status' && runId && (
            <StatusPage
              runId={runId}
              onReviewReady={() => setScreen('review')}
            />
          )}

          {screen === 'review' && runId && <ReviewPage runId={runId} />}
        </Box>
      </Stack>
    </Container>
  )
}
