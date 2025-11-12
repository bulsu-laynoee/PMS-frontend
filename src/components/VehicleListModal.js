import React, { useState, useEffect } from 'react';
import api, { getImageUrl } from '../utils/api';
import VehicleModal from './VehicleModal';
import {
    Box,
    Heading,
    Table,
    Thead,
    Tbody,
    Tr,
    Th,
    Td,
    Button,
    Spinner,
    Text,        // Added
    VStack,      // Added
    HStack,      // Added
    IconButton,  // Added
    Tag,         // Added
    Center       // Added
} from '@chakra-ui/react';
import Modal from 'components/Modal';
import { FiEdit, FiFileText, FiPlus } from 'react-icons/fi'; // Added icons

export default function VehicleListModal({ user, onClose, onUpdated }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(''); // Keep for potential non-alert messages

  const load = async () => {
    setLoading(true);
    setMessage(''); // Clear previous messages
    try {
      const res = await api.get('/vehicles', { params: { user_id: user.id } });
      const list = res.data.data || res.data || [];
      // Ensure we only show vehicles for this specific user ID
      setVehicles(list.filter(v => Number(v.user_id) === Number(user.id)));
    } catch (err) {
      console.error('Failed to load vehicles', err);
      setMessage('Failed to load vehicles. Please try again.'); // More user-friendly error
    } finally {
      setLoading(false);
    }
  };

  // Load vehicles when the modal receives a user
  useEffect(() => {
      if (user?.id) { // Only load if user.id is present
          load();
      } else {
          setLoading(false); // Stop loading if no valid user
          setVehicles([]);
          setMessage('Invalid user selected.');
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // Depend only on user.id

  const handleSuccess = () => {
    setEditing(null);
    setShowEditModal(false); // Close edit modal on success
    setShowAddModal(false);  // Close add modal on success
    load(); // Reload the list
    if (onUpdated) onUpdated(); // Notify parent if needed
  };

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);

  // open edit modal when editing vehicle is set
  useEffect(() => {
    setShowEditModal(!!editing);
  }, [editing]);

  return (
    // Increased padding and set width constraints
    <Box p={{ base: 4, md: 6 }} w="100%" maxW={{ base: '95vw', lg: '960px' }} minW={{ md: '600px' }}>
      <VStack align="stretch" spacing={5}>
        <Heading size="lg" textAlign="center">
          Vehicle Management
        </Heading>
        <Text textAlign="center" fontSize="lg" color="gray.600" mt={-3}>
            For User: <strong>{user?.name || 'N/A'}</strong>
        </Text>

        {loading ? (
          <Center h="200px"> <Spinner size="xl" color="red.500" /> </Center>
        ) : (
          <Box
            borderWidth="1px"
            borderRadius="lg"
            overflow="hidden" // Ensures border radius applies to table corners
            boxShadow="sm"
          >
            {/* Added overflow for responsiveness */}
            <Box overflowX="auto">
              {vehicles.length === 0 ? (
                  <Center p={10}>
                      <Text color="gray.500" fontStyle="italic">No vehicles registered for this user.</Text>
                  </Center>
                ) : (
                  <Table variant="striped" colorScheme="gray" size="md">
                      <Thead bg="gray.100">
                        <Tr>
                            <Th textAlign="center">Plate No.</Th>
                            <Th textAlign="center">Type</Th>
                            <Th textAlign="center">Color</Th>
                            <Th textAlign="center">Brand</Th>
                            <Th textAlign="center">Model</Th>
                            <Th textAlign="center">OR No.</Th>
                            <Th textAlign="center">CR No.</Th>
                            <Th textAlign="center">Actions</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                      {vehicles.map(v => (
                          <Tr key={v.id} _hover={{ bg: "red.50" }}>
                              <Td textAlign="center"><Tag size="md" variant="solid" colorScheme='teal'>{v.plate_number || 'N/A'}</Tag></Td>
                              <Td textAlign="center">{v.vehicle_type || 'N/A'}</Td>
                              <Td textAlign="center">{v.vehicle_color || 'N/A'}</Td>
                              <Td textAlign="center">{v.brand || 'N/A'}</Td>
                              <Td textAlign="center">{v.model || 'N/A'}</Td>
                              <Td textAlign="center">{v.or_number || <Text as="span" color="gray.400">—</Text>}</Td>
                              <Td textAlign="center">{v.cr_number || <Text as="span" color="gray.400">—</Text>}</Td>
                              <Td textAlign="center">
                                  <IconButton
                                      size="sm"
                                      icon={<FiEdit />}
                                      aria-label="Edit Vehicle"
                                      onClick={() => setEditing(v)}
                                      colorScheme="gray"
                                      variant="outline"
                                  />
                              </Td>
                          </Tr>
                      ))}
                      </Tbody>
                  </Table>
              )}
            </Box>
          </Box>
        )}

        {message && <Text color="red.600" textAlign="center">{message}</Text>}

        {/* Action Buttons at the bottom */}
        <HStack justifyContent="flex-end" spacing={3}>
          <Button onClick={onClose} variant="ghost">Close</Button>
          <Button
            colorScheme="red"
            leftIcon={<FiPlus />}
            onClick={() => setShowAddModal(true)}
            // --- THIS IS THE CHANGE ---
            isDisabled={vehicles.length >= 3}
          >
            Add Vehicle {vehicles.length < 3 ? '' : '(Max Reached)'} {/* Optional: Add text indication */}
          </Button>
        </HStack>
      </VStack>

      {/* --- Modals --- */}
      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add Vehicle`} maxWidth={{ base: '95vw', md: '760px' }}>
          {/* Render only when showAddModal is true */}
        {showAddModal && <VehicleModal user={user} onClose={() => setShowAddModal(false)} onSuccess={handleSuccess} />}
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setEditing(null)} title={`Edit Vehicle`} maxWidth={{ base: '95vw', md: '760px' }}>
        {/* Render only when editing is not null */}
        {editing && <VehicleModal user={user} vehicle={editing} onClose={() => setEditing(null)} onSuccess={handleSuccess} />}
      </Modal>

    </Box>
  );
}