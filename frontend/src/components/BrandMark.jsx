import { Box, HStack, Icon, Text } from '@chakra-ui/react'
import { FaTrafficLight } from 'react-icons/fa6'
import { FiCamera } from 'react-icons/fi'

export default function BrandMark() {
  return (
    <HStack gap={3} align="center">
      <Box
        bg="linear-gradient(145deg, #2dd4bf 0%, #0891b2 45%, #0ea5e9 100%)"
        color="#021018"
        borderRadius="xl"
        p={2.5}
        boxShadow="0 0 0 1px rgba(255,255,255,0.1), 0 18px 40px rgba(45,212,191,0.24)"
        position="relative"
      >
        <Icon as={FaTrafficLight} boxSize={5} />
        <Icon as={FiCamera} boxSize={3} position="absolute" bottom="2px" right="2px" opacity={0.95} />
      </Box>
      <Box>
        <Text fontSize="xl" fontWeight="800" letterSpacing="0.4px" lineHeight="1">
          Civic Lens
        </Text>
        <Text fontSize="xs" color="text.muted" mt={1}>
          Road Intelligence Console
        </Text>
      </Box>
    </HStack>
  )
}
