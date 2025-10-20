import React, { useState, useEffect } from 'react';
import {
    Box,
    Button,
    Input,
    Stack,
    Heading,
    FormControl,
    FormLabel,
    Grid,
    GridItem,
    Text,
} from '@chakra-ui/react';
import api from '../utils/api';
import { useAlert } from 'context/AlertContext'; // Import useAlert

export default function EditUserModal({ user, onClose, onSaved }) {
  // useEffect to notify app about modal state (good practice, kept as is)
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('app:modal-open')); } catch (e) {}
    return () => { try { window.dispatchEvent(new CustomEvent('app:modal-close')); } catch (e) {} };
  }, []);

  const { showAlert } = useAlert(); // Initialize alert hook
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', department: '', contact_number: '' });
  const [initialForm, setInitialForm] = useState({}); // To track changes
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Split name into firstname/lastname
    const parts = (user.name || '').split(' ');
    const firstname = parts.shift() || '';
    const lastname = parts.join(' ') || '';
    const initialData = {
        firstname,
        lastname,
        email: user.email || '',
        department: user.department || '',
        contact_number: user.contact_number || ''
    };
    setForm(initialData);
    setInitialForm(initialData); // Store the initial state for comparison
  }, [user]);

  const onChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  // --- VALIDATION LOGIC ---
  // Check if any changes have been made
  const isChanged = JSON.stringify(form) !== JSON.stringify(initialForm);
  // Check if any of the required fields are blank
  const hasBlankFields = Object.values(form).some(value => value.trim() === '');


  const submit = async (e) => {
    e.preventDefault();
    if (!user) return;

    // --- VALIDATION CHECKS ---
    if (hasBlankFields) {
        showAlert('All fields are required. Please fill in any blank fields.', 'error');
        return;
    }
    if (!isChanged) {
        showAlert('No changes have been made.', 'info');
        return;
    }

    setLoading(true);
    try {
      const payload = { ...form }; // Use the current form state
      await api.put(`/users/${user.id}`, payload);
      showAlert('User details saved successfully! ✅', 'success');
      if (onSaved) onSaved();
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'An unknown error occurred.';
      showAlert(`Save failed: ${errorMessage}`, 'error', 8000);
      console.error("Error updating user:", err.response || err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Box p={{ base: 4, md: 6 }} w="100%" maxW={{ base: '90vw', md: '720px' }}>
      <Heading size="md" mb={1}>Edit User Details</Heading>
      <Text color="gray.500" mb={6}>Editing profile for: <strong>{user.name}</strong></Text>

      <form onSubmit={submit}>
        <Stack spacing={4}>
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)"}} gap={4}>
                <GridItem>
                    <FormControl isRequired>
                        <FormLabel>First Name</FormLabel>
                        <Input name="firstname" value={form.firstname} onChange={onChange} />
                    </FormControl>
                </GridItem>
                <GridItem>
                    <FormControl isRequired>
                        <FormLabel>Last Name</FormLabel>
                        <Input name="lastname" value={form.lastname} onChange={onChange} />
                    </FormControl>
                </GridItem>
            </Grid>

            <FormControl isRequired>
                <FormLabel>Email</FormLabel>
                <Input type="email" name="email" value={form.email} onChange={onChange} />
            </FormControl>

            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)"}} gap={4}>
                <GridItem>
                    <FormControl isRequired>
                        <FormLabel>Department</FormLabel>
                        <Input name="department" value={form.department} onChange={onChange} />
                    </FormControl>
                </GridItem>
                <GridItem>
                    <FormControl isRequired>
                        <FormLabel>Contact Number</FormLabel>
                        <Input name="contact_number" value={form.contact_number} onChange={onChange} />
                    </FormControl>
                </GridItem>
            </Grid>

            <Stack direction="row" justify="flex-end" pt={4} spacing={3}>
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button
                    colorScheme="red"
                    type="submit"
                    isLoading={loading}
                    // --- VALIDATION: Disable button if no changes or fields are blank ---
                    isDisabled={!isChanged || hasBlankFields || loading}
                >
                    Save Changes
                </Button>
            </Stack>
        </Stack>
      </form>
    </Box>
  );
}