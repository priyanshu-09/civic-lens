import { Box, HStack, Icon, Text } from '@chakra-ui/react'
import { FaTrafficLight } from 'react-icons/fa6'
import { FiCamera } from 'react-icons/fi'

export default function BrandMark() {
  return (
    <HStack gap={3} align="center">
      <Box
        bg="linear-gradient(145deg, #29b8a9 0%, #238bb2 48%, #2f6ca8 100%)"
        color="#eaf8ff"
        borderRadius="xl"
        p={2.5}
        boxShadow="0 0 0 1px rgba(255,255,255,0.08), 0 10px 22px rgba(35,139,178,0.24)"
        position="relative"
      >
        <Icon as={FaTrafficLight} boxSize={5} />
        <Icon as={FiCamera} boxSize={3} position="absolute" bottom="2px" right="2px" opacity={0.92} />
      </Box>
      <Box>
        <Text fontSize="xl" fontWeight="800" letterSpacing="0.2px" lineHeight="1">
          Civic Lens
        </Text>
        <Text fontSize="xs" color="text.muted" mt={1}>
          Safer Roads, Clear Evidence
        </Text>
      </Box>
    </HStack>
  )
}
