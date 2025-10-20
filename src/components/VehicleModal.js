import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import {
    Box,
    Input,
    Stack,
    Button,
    Select,
    FormLabel,
    Heading,
    Grid,
    GridItem,
    FormControl,
    FormErrorMessage,
    Text
} from '@chakra-ui/react';
import { useAlert } from 'context/AlertContext'; // Import useAlert

export default function VehicleModal({ user, vehicle, onClose, onSuccess }) {
  const { showAlert } = useAlert(); // Initialize the alert hook
  const [form, setForm] = useState({ plate_number: '', vehicle_color: '', vehicle_type: 'Car', brand: '', model: '' });
  const [orFile, setOrFile] = useState(null);
  const [crFile, setCrFile] = useState(null);
  const [orNumber, setOrNumber] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [orNumberError, setOrNumberError] = useState('');
  const [crNumberError, setCrNumberError] = useState('');
  const [plateError, setPlateError] = useState('');
  const [checkingUnique, setCheckingUnique] = useState(false);
  const [saving, setSaving] = useState(false);

  // populate form when editing an existing vehicle
  useEffect(() => {
    if (vehicle) {
      setForm({
        plate_number: vehicle.plate_number || user?.plate_number || '',
        vehicle_color: vehicle.vehicle_color || '',
        vehicle_type: vehicle.vehicle_type || 'Car',
        brand: vehicle.brand || '',
        model: vehicle.model || '',
      });
      setOrNumber(vehicle?.or_number || '');
      setCrNumber(vehicle?.cr_number || '');
    } else {
      // Reset to default for adding a new vehicle
      setForm({ plate_number: user?.plate_number || '', vehicle_color: '', vehicle_type: 'Car', brand: '', model: '' });
      setOrNumber('');
      setCrNumber('');
    }
    // Reset errors and files on open
    setOrFile(null);
    setCrFile(null);
    setPlateError('');
    setOrNumberError('');
    setCrNumberError('');
  }, [vehicle, user]);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    // Reset errors on new submission attempt
    setPlateError('');
    setOrNumberError('');
    setCrNumberError('');

    // --- ADDED: Client-side file validation for ADDING a vehicle ---
    if (!vehicle && (!orFile || !crFile)) {
        showAlert('Both OR and CR documents (PDF) are required when adding a new vehicle.', 'error');
        setSaving(false);
        return;
    }
    // --- END ADDED VALIDATION ---

    try {
      const orVal = orNumber?.trim() || null;
      const crVal = crNumber?.trim() || null;
      const plateVal = form.plate_number?.trim() || null;
      const plateNeedsCheck = plateVal && (!vehicle || (vehicle && String(vehicle.plate_number || '') !== String(plateVal)));

      // Pre-submission uniqueness check
      if (orVal || crVal || plateNeedsCheck) {
        setCheckingUnique(true);
        await api.initCsrf();
        const resp = await api.post('vehicles/check-unique', {
            or_number: orVal,
            cr_number: crVal,
            plate_number: plateNeedsCheck ? plateVal : null
        });
        setCheckingUnique(false);
        const exists = resp.data?.exists || {};

        let errorsFound = false;
        if (exists.or_number) { setOrNumberError('OR number already in use'); errorsFound = true; }
        if (exists.cr_number) { setCrNumberError('CR number already in use'); errorsFound = true; }
        // --- UPDATED: Plate error message ---
        if (exists.plate_number) { setPlateError('The vehicle already exists'); errorsFound = true; }

        if (errorsFound) {
            // --- UPDATED: More specific alert ---
            showAlert('Cannot save: Plate number, OR number, or CR number is already registered.', 'error');
            setSaving(false);
            return;
        }
      }

      const data = new FormData();
      if (!vehicle) data.append('user_id', user.id);
      data.append('plate_number', form.plate_number);
      data.append('vehicle_color', form.vehicle_color);
      data.append('vehicle_type', form.vehicle_type);
      data.append('brand', form.brand);
      data.append('model', form.model);
      if (orNumber) data.append('or_number', orNumber);
      if (crNumber) data.append('cr_number', crNumber);
      if (orFile) data.append('or_file', orFile);
      if (crFile) data.append('cr_file', crFile);

      if (vehicle) {
        data.append('_method', 'PUT');
        await api.post(`vehicles/${vehicle.id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
        showAlert('Vehicle updated successfully! ✅', 'success');
      } else {
        await api.post('vehicles', data, { headers: { 'Content-Type': 'multipart/form-data' } });
        showAlert('Vehicle added successfully! 🎉', 'success');
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Error saving vehicle:", err.response || err); // Log the full error for debugging

      const status = err.response?.status;
      const respData = err.response?.data;
      let userMessage = 'An unexpected error occurred while saving the vehicle. Please try again.'; // Default message

      if (status === 422 && respData?.errors) {
        // Handle validation errors specifically
        const errors = respData.errors;
        if (errors.plate_number) {
            // --- UPDATED: Plate error message ---
            userMessage = `Error: ${errors.plate_number[0].replace('plate number field', 'Plate Number')}`; // Make it title case
            setPlateError(errors.plate_number[0]); // Also set the field error
        } else if (errors.or_number) {
            userMessage = `Error: ${errors.or_number[0].replace('or number field', 'OR Number')}`;
            setOrNumberError(errors.or_number[0]);
        } else if (errors.cr_number) {
            userMessage = `Error: ${errors.cr_number[0].replace('cr number field', 'CR Number')}`;
            setCrNumberError(errors.cr_number[0]);
        } else if (errors.or_file) {
            userMessage = `Error: ${errors.or_file[0].replace('or file field', 'OR Document')}`;
        } else if (errors.cr_file) {
            userMessage = `Error: ${errors.cr_file[0].replace('cr file field', 'CR Document')}`;
        }
         else {
            // Generic validation message if specific fields aren't caught
             userMessage = respData.message || "Please check the form for errors.";
        }
      } else if (respData?.message) {
        // Use the general message from the backend if available (and not a 422 validation error)
        userMessage = respData.message;
      } else if (err.message) {
          // Fallback to the generic JS error message
          userMessage = err.message;
      }

      showAlert(userMessage, 'error', 8000);
    } finally {
      setSaving(false);
    }
  };


  const destroy = async () => {
    if (!vehicle) return;
    // Use a more descriptive confirmation
    if (!window.confirm(`Are you sure you want to permanently delete the vehicle with plate number "${vehicle.plate_number || 'N/A'}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`vehicles/${vehicle.id}`);
      showAlert('Vehicle deleted successfully. 🗑️', 'success');
      if (onSuccess) onSuccess();
    } catch (err) {
      showAlert('Delete error: ' + (err.response?.data?.message || err.message), 'error');
    }
  };

  return (
    <Box p={{ base: 4, md: 6 }} w="100%">
      <Heading size="md" mb={1}>{vehicle ? 'Edit Vehicle' : 'Add New Vehicle'}</Heading>
      <Text fontSize="md" color="gray.500" mb={6}>For user: <strong>{user?.name}</strong></Text>

      <form onSubmit={submit}>
        <Stack spacing={4}>
          {/* --- Row 1: Plate & Color --- */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
            <GridItem>
              <FormControl isRequired isInvalid={!!plateError}>
                <FormLabel>Plate Number</FormLabel>
                <Input name="plate_number" value={form.plate_number} onChange={(e) => { onChange(e); setPlateError(''); }} />
                {plateError && <FormErrorMessage>{plateError}</FormErrorMessage>}
              </FormControl>
            </GridItem>
            <GridItem>
              <FormControl isRequired>
                <FormLabel>Vehicle Color</FormLabel>
                <Input name="vehicle_color" placeholder="e.g., White" value={form.vehicle_color} onChange={onChange} />
              </FormControl>
            </GridItem>
          </Grid>

          {/* --- Row 2: Type, Brand, Model --- */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
            <GridItem>
              <FormControl isRequired>
                <FormLabel>Vehicle Type</FormLabel>
                <Select name="vehicle_type" value={form.vehicle_type} onChange={onChange}>
                  <option value="Car">Car</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Bicycle">Bicycle</option> {/* Added Bicycle */}
                </Select>
              </FormControl>
            </GridItem>
            <GridItem>
              <FormControl isRequired>
                <FormLabel>Brand</FormLabel>
                <Input name="brand" placeholder="e.g., Toyota" value={form.brand} onChange={onChange} />
              </FormControl>
            </GridItem>
            <GridItem>
              <FormControl isRequired>
                <FormLabel>Model</FormLabel>
                <Input name="model" placeholder="e.g., Vios" value={form.model} onChange={onChange} />
              </FormControl>
            </GridItem>
          </Grid>

          {/* --- Row 3: OR/CR Numbers --- */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
            <GridItem>
               {/* --- ADDED: isRequired for adding --- */}
              <FormControl isInvalid={!!orNumberError} isRequired={!vehicle}>
                <FormLabel>OR Number</FormLabel>
                <Input name="or_number" value={orNumber} onChange={(e) => { setOrNumber(e.target.value); setOrNumberError(''); }} />
                {orNumberError && <FormErrorMessage>{orNumberError}</FormErrorMessage>}
              </FormControl>
            </GridItem>
            <GridItem>
               {/* --- ADDED: isRequired for adding --- */}
              <FormControl isInvalid={!!crNumberError} isRequired={!vehicle}>
                <FormLabel>CR Number</FormLabel>
                <Input name="cr_number" value={crNumber} onChange={(e) => { setCrNumber(e.target.value); setCrNumberError(''); }} />
                {crNumberError && <FormErrorMessage>{crNumberError}</FormErrorMessage>}
              </FormControl>
            </GridItem>
          </Grid>

          {/* --- Row 4: OR/CR Files --- */}
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
            <GridItem>
               {/* --- ADDED: isRequired for adding --- */}
              <FormControl isRequired={!vehicle}>
                <FormLabel>OR Document (PDF)</FormLabel>
                <Input type="file" p={1.5} accept="application/pdf" onChange={(e) => setOrFile(e.target.files[0])} />
                 {/* Show note if editing and file already exists */}
                 {vehicle && vehicle.or_path && !orFile && <Text fontSize="xs" color="gray.500" mt={1}>Current file exists. Uploading a new file will replace it.</Text>}
              </FormControl>
            </GridItem>
            <GridItem>
               {/* --- ADDED: isRequired for adding --- */}
              <FormControl isRequired={!vehicle}>
                <FormLabel>CR Document (PDF)</FormLabel>
                <Input type="file" p={1.5} accept="application/pdf" onChange={(e) => setCrFile(e.target.files[0])} />
                {/* Show note if editing and file already exists */}
                {vehicle && vehicle.cr_path && !crFile && <Text fontSize="xs" color="gray.500" mt={1}>Current file exists. Uploading a new file will replace it.</Text>}
              </FormControl>
            </GridItem>
          </Grid>

          {/* --- Action Buttons --- */}
          <Stack direction={{ base: "column", sm: "row" }} justify="flex-end" pt={4} spacing={3}>
            {vehicle && <Button colorScheme="red" variant="outline" onClick={destroy} mr={{ sm: "auto" }}>Delete Vehicle</Button>}
            <Button variant="ghost" onClick={onClose} order={{ base: 2, sm: 1 }}>Cancel</Button>
            <Button colorScheme="red" type="submit" isLoading={saving || checkingUnique} isDisabled={!!plateError || !!orNumberError || !!crNumberError} order={{ base: 1, sm: 2 }}>
              {vehicle ? 'Save Changes' : 'Add Vehicle'}
            </Button>
          </Stack>
        </Stack>
      </form>
    </Box>
  );
}