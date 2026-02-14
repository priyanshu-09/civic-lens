import { Badge } from '@chakra-ui/react'

const toneByState = {
  PENDING: 'gray',
  RUNNING: 'cyan',
  READY_FOR_REVIEW: 'green',
  EXPORTED: 'blue',
  FAILED: 'red',
}

export default function StatusPill({ value }) {
  const tone = toneByState[value] || 'gray'
  return (
    <Badge
      colorPalette={tone}
      variant="subtle"
      borderRadius="full"
      px={3}
      py={1}
      fontSize="xs"
      letterSpacing="0.4px"
      textTransform="uppercase"
      fontWeight="700"
    >
      {value || 'UNKNOWN'}
    </Badge>
  )
}
