import React, { useState } from 'react';
import api from '../utils/api';
import {
    Button,
    Input,
    Select,
    Stack,
    Box,
    FormLabel,
    FormControl,        // Added
    FormErrorMessage,   // Added
    Grid,               // Added
    GridItem,           // Added
    Heading             // Added
} from '@chakra-ui/react';
import { useAlert } from 'context/AlertContext';

export default function AdminCreateUser({ onSuccess }) {
  // Notify other parts of the app
  React.useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('app:modal-open')); } catch (e) {}
    return () => { try { window.dispatchEvent(new CustomEvent('app:modal-close')); } catch (e) {} };
  }, []);

  const [role, setRole] = useState('Student');
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', password: '', department: '', student_no: '', course: '', yr_section: '', position: '', contact_number: '', plate_number: '', vehicle_color: '', vehicle_type: 'Car', brand: '', model: '', faculty_id: '', employee_id: '', username: '' });
  const [orNumber, setOrNumber] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [orFile, setOrFile] = useState(null);
  const [crFile, setCrFile] = useState(null);
  const [orNumberError, setOrNumberError] = useState('');
  const [crNumberError, setCrNumberError] = useState('');
  const [checkingUnique, setCheckingUnique] = useState(false);
  const [plateError, setPlateError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [contactError, setContactError] = useState('');
  const { showAlert } = useAlert();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    // Reset specific field errors on submit attempt
    setPlateError(''); setEmailError(''); setContactError(''); setOrNumberError(''); setCrNumberError('');

    try {
      // Client-side required field check
      const missing = [];
      const requiredBase = ['firstname', 'lastname', 'email', 'password'];
      const requiredVehicle = ['plate_number', 'vehicle_color', 'vehicle_type', 'brand', 'model', 'orNumber', 'crNumber'];
      const requiredFiles = ['orFile', 'crFile'];

      let fieldsToCheck = [...requiredBase];

      if (role !== 'Guard') {
          fieldsToCheck.push('department', 'contact_number', ...requiredVehicle);
          if (role === 'Student') fieldsToCheck.push('student_no', 'course', 'yr_section');
          if (role === 'Faculty' || role === 'Employee') fieldsToCheck.push('position');
      } else {
          fieldsToCheck.push('username');
      }

      fieldsToCheck.forEach(f => {
        if (f === 'orNumber') { if (!orNumber || !orNumber.trim()) missing.push('OR Number'); return; }
        if (f === 'crNumber') { if (!crNumber || !crNumber.trim()) missing.push('CR Number'); return; }
        const val = (f in form) ? form[f] : null;
        if (!val || (typeof val === 'string' && !val.trim())) {
             // Make field names more readable
             const readableName = f.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
             missing.push(readableName);
        }
      });

       // Check files only for non-Guards
       if (role !== 'Guard') {
          if (!orFile) missing.push('OR Document (PDF)');
          if (!crFile) missing.push('CR Document (PDF)');
      }


      if (missing.length) {
        showAlert('Please fill all required fields: ' + missing.join(', '), 'error');
        return;
      }

      // Uniqueness check
      const orVal = orNumber?.trim() || null;
      const crVal = crNumber?.trim() || null;
      const plateVal = form.plate_number?.trim() || null;
      const emailVal = form.email?.trim() || null;
      const contactVal = form.contact_number?.trim() || null;

      // Only perform check if at least one value needs checking
      if (orVal || crVal || plateVal || emailVal || contactVal) {
        setCheckingUnique(true);
        await api.initCsrf();
        const checkResp = await api.post('vehicles/check-unique', { or_number: orVal, cr_number: crVal, plate_number: plateVal, email: emailVal, contact_number: contactVal });
        setCheckingUnique(false);
        const exists = checkResp.data?.exists || {};

        let uniqueErrorsFound = false;
        if (exists.or_number) { setOrNumberError('OR number already in use'); uniqueErrorsFound = true; }
        if (exists.cr_number) { setCrNumberError('CR number already in use'); uniqueErrorsFound = true; }
        if (exists.plate_number) { setPlateError('Plate number already in use'); uniqueErrorsFound = true; }
        if (exists.email) { setEmailError('Email already in use'); uniqueErrorsFound = true; }
        if (exists.contact_number) { setContactError('Contact number already in use'); uniqueErrorsFound = true; }

        if (uniqueErrorsFound) {
          showAlert('One or more fields (Email, Plate, OR/CR, Contact) are already registered. Please check the form.', 'error');
          return;
        }
      }

      // Prepare FormData
      await api.initCsrf();
      const data = new FormData();
      Object.keys(form).forEach(key => data.append(key, form[key] || '')); // Append all form fields

      // Handle role-specific fields and overrides
      data.set('role', role); // Explicitly set role
      if (role === 'Guard') {
        data.delete('department'); data.delete('plate_number'); data.delete('vehicle_color');
        data.delete('vehicle_type'); data.delete('brand'); data.delete('model');
        data.delete('student_no'); data.delete('course'); data.delete('yr_section');
        data.delete('faculty_id'); data.delete('employee_id');
      } else {
         data.delete('username'); // Remove username if not Guard
      }
      if (role !== 'Student') {
          data.delete('student_no'); data.delete('course'); data.delete('yr_section');
      }
       if (role === 'Student' || role === 'Guard') {
          data.delete('position');
          data.delete('employee_id'); // Ensure these are removed if not applicable
      }
       if (role === 'Student' || role === 'Guard' || role === 'Employee') {
           data.delete('faculty_id'); // Ensure removed if not Faculty
       }


      // Append files and numbers
      if (orFile) data.append('or_file', orFile);
      if (crFile) data.append('cr_file', crFile);
      data.append('or_number', orNumber || '');
      data.append('cr_number', crNumber || '');

      const endpoint = `admin/create-${String(role).toLowerCase()}`;
      console.debug('AdminCreateUser: posting to', endpoint);
      const res = await api.post(endpoint, data, { headers: { 'Content-Type': 'multipart/form-data' } });

      showAlert(`Successfully created ${role}: ${form.firstname} ${form.lastname} 🎉`, 'success');
      if (onSuccess) onSuccess(res.data);

    } catch (err) {
      console.error('AdminCreateUser error response:', err.response || err);
      const resp = err.response?.data;
      let msg = 'Error creating user: ' + (resp?.message || err.message || 'Unknown error');
      if (resp?.errors) { // Use 'errors' if backend sends validation errors this way
        const errorDetails = Object.entries(resp.errors)
            .map(([field, messages]) => `${field}: ${messages.join(', ')}`)
            .join('; ');
        msg = `Please correct the following errors: ${errorDetails}`;
        // Optionally set individual field errors here if needed based on resp.errors keys
        if (resp.errors.email) setEmailError(resp.errors.email[0]);
        if (resp.errors.plate_number) setPlateError(resp.errors.plate_number[0]);
        // etc. for other fields
      }
      showAlert(msg, 'error', 8000);
    } finally {
        setCheckingUnique(false); // Ensure this is always reset
    }
  };

  // Simplified uniqueness check (onBlur removed for simplicity, handled pre-submit)
  // If needed, individual onBlur checks can be added back similar to the handleCheckField logic previously used

  return (
    // Increased overall padding
    <Box p={{ base: 4, md: 6 }} w="100%" maxW="800px">
      <Heading size="md" mb={6}>Create New {role}</Heading>

      {/* Role Selection */}
      <FormControl mb={6} maxW="320px">
        <FormLabel>Select Role</FormLabel>
        <Select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="Student">Student</option>
          <option value="Faculty">Faculty</option>
          <option value="Employee">Employee</option>
          <option value="Guard">Guard</option>
        </Select>
      </FormControl>

      <form onSubmit={submit}>
        <Stack spacing={4}> {/* Consistent spacing for sections */}

          {/* --- Basic Information --- */}
          <Heading size="sm" mb={2}>User Information</Heading>
          <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
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
            <GridItem>
               <FormControl isRequired isInvalid={!!emailError}>
                    <FormLabel>Email</FormLabel>
                    <Input type="email" name="email" value={form.email} onChange={onChange} />
                    {emailError && <FormErrorMessage>{emailError}</FormErrorMessage>}
                </FormControl>
            </GridItem>
            <GridItem>
              <FormControl isRequired>
                <FormLabel>Password</FormLabel>
                <Input type="password" name="password" value={form.password} onChange={onChange} />
              </FormControl>
            </GridItem>
          </Grid>

          {/* --- Role Specific User Details --- */}
          {role !== 'Guard' && (
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
              <GridItem>
                <FormControl isRequired>
                  <FormLabel>Department</FormLabel>
                  <Input name="department" value={form.department} onChange={onChange} />
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isRequired isInvalid={!!contactError}>
                    <FormLabel>Contact Number</FormLabel>
                    <Input name="contact_number" value={form.contact_number} onChange={onChange} />
                    {contactError && <FormErrorMessage>{contactError}</FormErrorMessage>}
                </FormControl>
              </GridItem>
            </Grid>
          )}

          {role === 'Student' && (
            <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
              <GridItem><FormControl isRequired><FormLabel>Student No</FormLabel><Input name="student_no" value={form.student_no} onChange={onChange} /></FormControl></GridItem>
              <GridItem><FormControl isRequired><FormLabel>Course</FormLabel><Input name="course" value={form.course} onChange={onChange} /></FormControl></GridItem>
              <GridItem><FormControl isRequired><FormLabel>Year & Section</FormLabel><Input name="yr_section" value={form.yr_section} onChange={onChange} /></FormControl></GridItem>
            </Grid>
          )}

          {(role === 'Faculty' || role === 'Employee') && (
            <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
               <GridItem><FormControl isRequired><FormLabel>Position</FormLabel><Input name="position" value={form.position} onChange={onChange} /></FormControl></GridItem>
               {/* Conditionally render Employee ID based on role */}
               {role === 'Employee' && <GridItem><FormControl><FormLabel>Employee ID</FormLabel><Input name="employee_id" value={form.employee_id || ''} onChange={onChange} /></FormControl></GridItem>}
               {role === 'Faculty' && <GridItem><FormControl><FormLabel>Faculty ID</FormLabel><Input name="faculty_id" value={form.faculty_id || ''} onChange={onChange} /></FormControl></GridItem>}
            </Grid>
          )}

          {role === 'Guard' && (
             <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
               <GridItem><FormControl isRequired><FormLabel>Username</FormLabel><Input name="username" value={form.username || ''} onChange={onChange} /></FormControl></GridItem>
               <GridItem><FormControl><FormLabel>Position</FormLabel><Input name="position" value={form.position} onChange={onChange} /></FormControl></GridItem>
               <GridItem><FormControl><FormLabel>Contact Number</FormLabel><Input name="contact_number" value={form.contact_number || ''} onChange={onChange} /></FormControl></GridItem>
            </Grid>
          )}

          {/* --- Vehicle Information (Not for Guards) --- */}
          {role !== 'Guard' && (
            <>
              <Heading size="sm" mt={4} mb={2}>Vehicle Information</Heading>
              <FormControl isRequired isInvalid={!!plateError}>
                  <FormLabel>Plate Number</FormLabel>
                  <Input name="plate_number" value={form.plate_number} onChange={onChange} />
                  {plateError && <FormErrorMessage>{plateError}</FormErrorMessage>}
              </FormControl>

              <Grid templateColumns={{ base: "1fr", md: "repeat(4, 1fr)" }} gap={4}>
                  <GridItem><FormControl isRequired><FormLabel>Vehicle Color</FormLabel><Input name="vehicle_color" value={form.vehicle_color} onChange={onChange} /></FormControl></GridItem>
                  <GridItem>
                      <FormControl isRequired>
                          <FormLabel>Vehicle Type</FormLabel>
                          <Select name="vehicle_type" value={form.vehicle_type || 'Car'} onChange={onChange}>
                              <option value="Car">Car</option>
                              <option value="Motorcycle">Motorcycle</option>
                          </Select>
                      </FormControl>
                  </GridItem>
                  <GridItem><FormControl isRequired><FormLabel>Brand</FormLabel><Input name="brand" value={form.brand} onChange={onChange} /></FormControl></GridItem>
                  <GridItem><FormControl isRequired><FormLabel>Model</FormLabel><Input name="model" value={form.model} onChange={onChange} /></FormControl></GridItem>
              </Grid>

              <Grid templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }} gap={4}>
                   <GridItem>
                       <FormControl isRequired isInvalid={!!orNumberError}>
                           <FormLabel>OR Number</FormLabel>
                           <Input name="or_number" value={orNumber} onChange={(e) => { setOrNumber(e.target.value); setOrNumberError(''); }} />
                           {orNumberError && <FormErrorMessage>{orNumberError}</FormErrorMessage>}
                       </FormControl>
                   </GridItem>
                   <GridItem>
                       <FormControl isRequired isInvalid={!!crNumberError}>
                           <FormLabel>CR Number</FormLabel>
                           <Input name="cr_number" value={crNumber} onChange={(e) => { setCrNumber(e.target.value); setCrNumberError(''); }} />
                           {crNumberError && <FormErrorMessage>{crNumberError}</FormErrorMessage>}
                       </FormControl>
                   </GridItem>
                   <GridItem>
                       <FormControl isRequired>
                           <FormLabel>OR Document (PDF)</FormLabel>
                           <Input type="file" p={1.5} accept="application/pdf" onChange={(e) => setOrFile(e.target.files[0])} />
                       </FormControl>
                   </GridItem>
                   <GridItem>
                       <FormControl isRequired>
                           <FormLabel>CR Document (PDF)</FormLabel>
                           <Input type="file" p={1.5} accept="application/pdf" onChange={(e) => setCrFile(e.target.files[0])} />
                       </FormControl>
                   </GridItem>
              </Grid>
            </>
          )}

          {/* --- Action Buttons --- */}
          <Stack direction="row" justify="flex-end" pt={4} spacing={3}>
            <Button variant="ghost" onClick={() => { if (onSuccess) onSuccess(null); }}>Cancel</Button>
            <Button
              colorScheme="red"
              type="submit"
              isLoading={checkingUnique}
              // Simplified isDisabled check, relying more on pre-submit check results
              isDisabled={checkingUnique || !!plateError || !!emailError || !!contactError || !!orNumberError || !!crNumberError}
            >
                Create {role}
            </Button>
          </Stack>

        </Stack>
      </form>
    </Box>
  );
}