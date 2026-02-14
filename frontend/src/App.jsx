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
    upload: 'Create Run',
    status: 'Pipeline Live Status',
    review: 'Incident Review',
  }

  const navItems = [
    { key: 'upload', label: 'New Run', enabled: true },
    { key: 'status', label: 'Status', enabled: Boolean(runId) },
    { key: 'review', label: 'Review', enabled: Boolean(runId) },
  ]

  return (
    <Container maxW="7xl" py={{ base: 5, md: 8 }} px={{ base: 4, md: 6 }}>
      <Stack gap={5}>
        <Card.Root
          variant="elevated"
          bg="bg.overlay"
          border="1px solid"
          borderColor="border.subtle"
          backdropFilter="blur(12px)"
          boxShadow="0 20px 55px rgba(0, 0, 0, 0.35)"
        >
          <Card.Body gap={4}>
            <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={4}>
              <Stack gap={2}>
                <BrandMark />
                <Text color="text.muted" maxW="2xl">
                  Monitor traffic incident detection runs, inspect live packet lineage, and finalize review decisions.
                </Text>
              </Stack>
              <HStack
                px={3}
                py={2}
                borderRadius="lg"
                border="1px solid"
                borderColor="border.subtle"
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
                    colorPalette={screen === item.key ? 'cyan' : 'gray'}
                    disabled={!item.enabled}
                    onClick={() => setScreen(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </ButtonGroup>
              {runId && (
                <Badge colorPalette="cyan" variant="surface" px={3} py={1.5} borderRadius="full">
                  Run: {runId}
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
