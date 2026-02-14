import { Box, Dialog, HStack, IconButton, Image, Portal, Text } from '@chakra-ui/react'
import { FiChevronLeft, FiChevronRight, FiX } from 'react-icons/fi'

export default function ImageLightbox({ open, onOpenChange, title, images, activeIndex, onPrev, onNext }) {
  const activeSrc = images?.[activeIndex] || ''

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(details) => onOpenChange(details.open)}
      size="xl"
      placement="center"
    >
      <Portal>
        <Dialog.Backdrop backdropFilter="blur(4px)" />
        <Dialog.Positioner>
          <Dialog.Content
            bg="bg.elevated"
            border="1px solid"
            borderColor="border.subtle"
            maxW="980px"
            boxShadow="0 30px 80px rgba(0,0,0,0.55)"
          >
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.CloseTrigger asChild>
                <IconButton aria-label="Close" variant="ghost" size="sm">
                  <FiX />
                </IconButton>
              </Dialog.CloseTrigger>
            </Dialog.Header>
            <Dialog.Body>
              <Box borderRadius="lg" overflow="hidden" bg="#000">
                <Image src={activeSrc} alt={title} w="full" maxH="70vh" objectFit="contain" />
              </Box>
              <HStack justify="space-between" mt={4}>
                <IconButton aria-label="Previous image" onClick={onPrev} disabled={!images?.length || images.length < 2} size="sm">
                  <FiChevronLeft />
                </IconButton>
                <Text color="text.muted" fontSize="sm">
                  {images?.length ? `${activeIndex + 1} / ${images.length}` : '0 / 0'}
                </Text>
                <IconButton aria-label="Next image" onClick={onNext} disabled={!images?.length || images.length < 2} size="sm">
                  <FiChevronRight />
                </IconButton>
              </HStack>
            </Dialog.Body>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  )
}
