import React, { useState, useEffect } from 'react';
import api, { getImageUrl } from '../utils/api';
import VehicleModal from './VehicleModal';
import { Box, Heading, Table, Thead, Tbody, Tr, Th, Td, Button, Spinner } from '@chakra-ui/react';
import Modal from 'components/Modal';

export default function VehicleListModal({ user, onClose, onUpdated }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/vehicles', { params: { user_id: user.id } });
      // backend returns either {data: [...] } or [...]
      const list = res.data.data || res.data || [];
      // ensure we only show vehicles for this user
      setVehicles(list.filter(v => Number(v.user_id) === Number(user.id)));
    } catch (err) {
      console.error('Failed to load vehicles', err);
      setMessage('Failed to load vehicles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); }, [user, load]);

  const handleSuccess = () => {
    setEditing(null);
    load();
    if (onUpdated) onUpdated();
  };

  const [showAddModal, setShowAddModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);

  // open edit modal when editing is set
  useEffect(() => {
    setShowEditModal(!!editing);
  }, [editing]);

  return (
    <Box p={4} maxW={{ base: '90vw', md: '720px' }} minW={{ md: '560px' }}>
      <Heading size="md">Vehicles for {user?.name}</Heading>
      {loading ? (
        <Spinner mt={4} />
      ) : (
        <Box mt={4}>
          {vehicles.length === 0 ? <Box>No vehicles</Box> : (
            <Table variant="simple" size="sm">
              <Thead>
                <Tr><Th>Plate</Th><Th>Type</Th><Th>Color</Th><Th>OR</Th><Th>CR</Th><Th>Actions</Th></Tr>
              </Thead>
                <Tbody>
                  {vehicles.map(v => (
                    <Tr key={v.id}>
                      <Td>{v.plate_number}</Td>
                      <Td>{v.vehicle_type}</Td>
                      <Td>{v.vehicle_color}</Td>
                      <Td>
                        {v.or_number ? <Box fontSize="sm" mb={1}>{v.or_number}</Box> : <Box fontSize="sm" color="gray.500" mb={1}>—</Box>}
                        {v.or_path ? (
                          <Button size="sm" as="a" href={getImageUrl(v.or_path)} target="_blank" rel="noreferrer">OR</Button>
                        ) : null}
                      </Td>
                      <Td>
                        {v.cr_number ? <Box fontSize="sm" mb={1}>{v.cr_number}</Box> : <Box fontSize="sm" color="gray.500" mb={1}>—</Box>}
                        {v.cr_path ? (
                          <Button size="sm" as="a" href={getImageUrl(v.cr_path)} target="_blank" rel="noreferrer">CR</Button>
                        ) : null}
                      </Td>
                      <Td>
                        <Button size="sm" onClick={() => setEditing(v)}>Edit</Button>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
            </Table>
          )}
        </Box>
      )}

      <Box mt={4} display="flex" justifyContent="flex-end" gap={2}>
        <Button onClick={onClose} variant="ghost">Close</Button>
        <Button colorScheme="red" onClick={() => setShowAddModal(true)} isDisabled={vehicles.length >= 3}>Add Vehicle</Button>
      </Box>

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title={`Add vehicle for ${user?.name}`} maxWidth={{ base: '95vw', md: '760px' }}>
        <VehicleModal user={user} onClose={() => setShowAddModal(false)} onSuccess={() => { setShowAddModal(false); handleSuccess(); }} />
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => { setEditing(null); setShowEditModal(false); }} title={`Edit vehicle for ${user?.name}`} maxWidth={{ base: '95vw', md: '760px' }}>
        {editing && <VehicleModal user={user} vehicle={editing} onClose={() => { setEditing(null); setShowEditModal(false); }} onSuccess={() => { setEditing(null); setShowEditModal(false); handleSuccess(); }} />}
      </Modal>

      {message && <Box mt={2}>{message}</Box>}
    </Box>
  );
}
