import { Badge } from '@chakra-ui/react'

const stateConfig = {
  PENDING: { tone: 'blue', label: 'Queued' },
  RUNNING: { tone: 'cyan', label: 'Processing' },
  READY_FOR_REVIEW: { tone: 'green', label: 'Ready to review' },
  EXPORTED: { tone: 'blue', label: 'Downloaded' },
  FAILED: { tone: 'red', label: 'Needs attention' },
}

export default function StatusPill({ value }) {
  const config = stateConfig[value] || { tone: 'gray', label: 'Unknown' }

  return (
    <Badge
      colorPalette={config.tone}
      variant="subtle"
      borderRadius="full"
      px={3}
      py={1}
      fontSize="xs"
      fontWeight="700"
    >
      {config.label}
    </Badge>
  )
}
