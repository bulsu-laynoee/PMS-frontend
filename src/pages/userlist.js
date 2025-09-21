import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Modal from 'components/Modal';
import AdminCreateUser from './AdminCreateUser';
import VehicleModal from 'components/VehicleModal';
import VehicleListModal from 'components/VehicleListModal';
import EditUserModal from 'components/EditUserModal';
import {
  Box,
  Button,
  IconButton,
  Input,
  Select,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Heading,
  HStack,
  VStack,
  Spinner,
  Link,
  Tag,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import { FiFileText, FiDownload, FiPlus, FiEye } from 'react-icons/fi';
import { FaUser, FaChalkboardTeacher, FaBriefcase, FaShieldAlt } from 'react-icons/fa';

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeRole, setActiveRole] = useState('All');
  const [isModalOpen, setModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [vehicleModalUser, setVehicleModalUser] = useState(null);
  const [vehicleListUser, setVehicleListUser] = useState(null);
  const [editUser, setEditUser] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([api.get('/users'), api.get('/vehicles')])
      .then(([uRes, vRes]) => {
        if (!mounted) return;
        setUsers(uRes.data.data || uRes.data || []);
        setVehicles(vRes.data.data || vRes.data || []);
      })
      .catch(err => {
        console.error('Failed to load users or vehicles', err);
      })
      .finally(() => mounted && setLoading(false));

    return () => { mounted = false; };
  }, [refreshKey]);

  // role list and counts for filter buttons
  const roles = ['All','Student','Faculty','Employee','Guard'];
  const counts = roles.reduce((acc, r) => {
    if (r === 'All') return { ...acc, All: users.length };
    const c = users.filter(u => (u.role||'').toLowerCase() === r.toLowerCase()).length;
    return { ...acc, [r]: c };
  }, {});

  // Map user_id -> plate numbers from vehicles
  const platesByUser = vehicles.reduce((acc, v) => {
    const uid = String(v.user_id);
    if (!acc[uid]) acc[uid] = [];
    if (v.plate_number && !acc[uid].includes(v.plate_number)) acc[uid].push(v.plate_number);
    return acc;
  }, {});

  const filtered = users.filter(u => {
    // hide Admins from the list and allow role filter
    if ((u.role || '').toLowerCase() === 'admin') return false;
    if (activeRole !== 'All' && activeRole !== (u.role || '')) return false;
    return (u.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(search.toLowerCase());
  });

  return (
    <Box p={{ base: 4, md: 8 }} bg="white" minH="100vh">
      <HStack justify="space-between" align="center" mb={6}>
        <Heading size="lg">User List</Heading>
        <HStack>
          <Button leftIcon={<FiPlus />} colorScheme="red" onClick={() => setModalOpen(true)}>Create User</Button>
          <Button variant="outline" onClick={() => navigate('/pendinglist')}>Pending</Button>
        </HStack>
      </HStack>

      <HStack justify="space-between" mb={4} align="center">
        <HStack>
          {roles.map(role => {
            const isActiveRole = activeRole === role;
            return (
              <Button
                key={role}
                size="sm"
                onClick={()=>setActiveRole(role)}
                data-role={role}
                style={{
                  backgroundColor: isActiveRole ? '#a73737' : 'white',
                  color: isActiveRole ? 'white' : '#333',
                  border: isActiveRole ? '1px solid #7f2d2d' : '1px solid #e6e6e6',
                  fontWeight: isActiveRole ? 700 : 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 14px',
                  borderRadius: 999,
                  cursor: 'pointer',
                }}
              >
                {(() => {
                  const r = role.toLowerCase();
                  if (r === 'faculty') return (<><FaChalkboardTeacher />&nbsp;</>);
                  if (r === 'employee') return (<><FaBriefcase />&nbsp;</>);
                  if (r === 'guard') return (<><FaShieldAlt />&nbsp;</>);
                  if (r === 'student') return (<><FaUser />&nbsp;</>);
                  return null;
                })()}
                {role}{role!=='All'?` (${counts[role]||0})`:''}
              </Button>
            );
          })}
        </HStack>

        <Input maxW="320px" placeholder="Search name or email..." value={search} onChange={(e)=>setSearch(e.target.value)} />
      </HStack>

      {loading ? (
        <Spinner />
      ) : (
        <Table variant="simple">
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Department</Th>
              <Th>Contact</Th>
              <Th>Plate Numbers</Th>
              <Th>OR</Th>
              <Th>CR</Th>
              <Th>Actions</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((u) => (
              <Tr key={u.id}>
                <Td>
                  <HStack>
                    {(() => {
                      const role = (u.role||'').toLowerCase();
                      if (role === 'faculty') return <FaChalkboardTeacher />;
                      if (role === 'employee') return <FaBriefcase />;
                      if (role === 'guard') return <FaShieldAlt />;
                      return <FaUser />;
                    })()}
                    <Box>{u.name}</Box>
                  </HStack>
                </Td>
                <Td>{u.email}</Td>
                <Td>{u.department || ''}</Td>
                <Td>{u.contact_number || ''}</Td>
                <Td>
                  <Wrap>
                    {(platesByUser[String(u.id)] || []).map(p => (
                      <WrapItem key={p}><Tag size="sm" colorScheme="gray">{p}</Tag></WrapItem>
                    ))}
                    {/* fallback to user_details plate_number if no vehicles */}
                    {((platesByUser[String(u.id)] || []).length === 0 && u.plate_number) ? (
                      <WrapItem><Tag size="sm">{u.plate_number}</Tag></WrapItem>
                    ) : null}
                  </Wrap>
                </Td>
                <Td>
                  {u.or_path ? (
                    <Link href={`http://localhost:8000/api/image/${u.or_path}`} isExternal><IconButton aria-label="OR" icon={<FiFileText />} size="sm" /></Link>
                  ) : ('')}
                </Td>
                <Td>
                  {u.cr_path ? (
                    <Link href={`http://localhost:8000/api/image/${u.cr_path}`} isExternal><IconButton aria-label="CR" icon={<FiDownload />} size="sm" /></Link>
                  ) : ('')}
                </Td>
                <Td>
                  <HStack>
                    <Button size="sm" colorScheme="gray" variant="outline" onClick={() => setEditUser(u)}>Edit</Button>
                    <Button size="sm" colorScheme="red" onClick={() => setVehicleModalUser(u)}>Add Vehicle</Button>
                    <Button leftIcon={<FiEye />} size="sm" colorScheme="blue" variant="ghost" onClick={() => setVehicleListUser(u)}>Vehicles</Button>
                  </HStack>
                  <Box mt={2} fontSize="12px">{u.vehicle_count ? `${u.vehicle_count} vehicle(s)` : ''}</Box>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Create User">
        <AdminCreateUser onSuccess={() => { setModalOpen(false); setRefreshKey(k => k + 1); }} />
      </Modal>

      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title={`Edit ${editUser?.name || ''}`}>
        {editUser && (
          <EditUserModal user={editUser} onClose={() => setEditUser(null)} onSaved={() => { setEditUser(null); setRefreshKey(k => k + 1); }} />
        )}
      </Modal>

      <Modal isOpen={!!vehicleModalUser} onClose={() => setVehicleModalUser(null)} title="Add Vehicle" maxWidth={{ base: '95vw', md: '760px' }}>
        {vehicleModalUser && (
          <VehicleModal user={vehicleModalUser} onClose={() => setVehicleModalUser(null)} onSuccess={() => { setVehicleModalUser(null); setRefreshKey(k => k + 1); }} />
        )}
      </Modal>

      <Modal isOpen={!!vehicleListUser} onClose={() => setVehicleListUser(null)} title="Vehicles">
        {vehicleListUser && (
          <VehicleListModal user={vehicleListUser} onClose={() => setVehicleListUser(null)} onUpdated={() => { setVehicleListUser(null); setRefreshKey(k => k + 1); }} />
        )}
      </Modal>
    </Box>
  );
};

export default UserList;
