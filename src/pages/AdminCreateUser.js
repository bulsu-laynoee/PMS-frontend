import React, { useState } from 'react';
import api from '../utils/api';
import { Button, Input, Select, Stack, Box, FormLabel } from '@chakra-ui/react';
import { useAlert } from 'context/AlertContext';

export default function AdminCreateUser({ onSuccess }) {
  // Notify other parts of the app that a modal (create user) is open so
  // floating toolbars can hide when account creation overlays the UI.
  React.useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('app:modal-open')); } catch (e) {}
    return () => { try { window.dispatchEvent(new CustomEvent('app:modal-close')); } catch (e) {} };
  }, []);
  const [role, setRole] = useState('Student');
  const [form, setForm] = useState({ firstname: '', lastname: '', email: '', password: '', department: '', student_no: '', course: '', yr_section: '', position: '', contact_number: '', plate_number: '', vehicle_color: '', vehicle_type: '', brand: '', model: '', faculty_id: '', employee_id: '', username: '' });
  const [orNumber, setOrNumber] = useState('');
  const [crNumber, setCrNumber] = useState('');
  const [orFile, setOrFile] = useState(null);
  const [crFile, setCrFile] = useState(null);
  const [message, setMessage] = useState('');
  const [orNumberError, setOrNumberError] = useState('');
  const [crNumberError, setCrNumberError] = useState('');
  const [checkingUnique, setCheckingUnique] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    try {
      // Client-side: require all fields for Student/Faculty/Employee (nothing optional)
      const missing = [];
      if (role !== 'Guard') {
        // required user fields
        ['firstname','lastname','email','password','department','contact_number','plate_number','vehicle_color','vehicle_type','brand','model','orNumber','crNumber'].forEach(f => {
          // handle orNumber/crNumber separately
          if (f === 'orNumber') { if (!orNumber || !orNumber.trim()) missing.push('OR number'); return; }
          if (f === 'crNumber') { if (!crNumber || !crNumber.trim()) missing.push('CR number'); return; }
          const val = (f in form) ? form[f] : null;
          if (!val || (typeof val === 'string' && !val.trim())) missing.push(f);
        });
        // files
        if (!orFile) missing.push('OR PDF');
        if (!crFile) missing.push('CR PDF');
      } else {
        // Guard: require username, email, password
        if (!form.username || !form.username.trim()) missing.push('username');
        if (!form.email || !form.email.trim()) missing.push('email');
        if (!form.password || !form.password.trim()) missing.push('password');
      }
      if (missing.length) {
        setMessage('Please fill required fields: ' + missing.join(', '));
        return;
      }

      // Run a quick uniqueness check before attempting to submit
      const orVal = orNumber?.trim() || null;
      const crVal = crNumber?.trim() || null;
      const plateVal = form.plate_number?.trim() || null;
      const emailVal = form.email?.trim() || null;
      const contactVal = form.contact_number?.trim() || null;
      if (orVal || crVal || plateVal || emailVal || contactVal) {
        setCheckingUnique(true);
        await api.initCsrf();
        const checkResp = await api.post('vehicles/check-unique', { or_number: orVal, cr_number: crVal, plate_number: plateVal, email: emailVal, contact_number: contactVal });
        setCheckingUnique(false);
        const exists = checkResp.data?.exists || {};
        // OR/CR
        if (exists.or_number) setOrNumberError('OR number already in use'); else setOrNumberError('');
        if (exists.cr_number) setCrNumberError('CR number already in use'); else setCrNumberError('');
        // plate/email/contact
        if (exists.plate_number) {
          window.showAlert('Plate number already in use', 'error', 6000);
          setMessage('Plate number already in use');
          return;
        }
        if (exists.email) {
          window.showAlert('Email already in use', 'error', 6000);
          setMessage('Email already in use');
          return;
        }
        if (exists.contact_number) {
          window.showAlert('Contact number already in use', 'error', 6000);
          setMessage('Contact number already in use');
          return;
        }
      }
      // Ensure CSRF cookie is initialized for Sanctum-protected endpoints
      await api.initCsrf();
      const data = new FormData();
      // If creating a guard, include username explicitly
      if (role === 'Guard') {
        data.append('username', form.username || '');
        // include contact number for guards if provided
        if (form.contact_number) data.append('contact_number', form.contact_number);
      }
      data.append('firstname', form.firstname);
      data.append('lastname', form.lastname);
      data.append('email', form.email);
      data.append('password', form.password);
      data.append('department', form.department);
      data.append('contact_number', form.contact_number);
      data.append('plate_number', form.plate_number);
  // vehicle details
  data.append('vehicle_color', form.vehicle_color);
  data.append('vehicle_type', form.vehicle_type);
  data.append('brand', form.brand);
  data.append('model', form.model);
      if (role === 'Student') {
        data.append('student_no', form.student_no);
        data.append('course', form.course);
        data.append('yr_section', form.yr_section);
        data.append('faculty_id', form.faculty_id || '');
        data.append('employee_id', form.employee_id || '');
      } else {
        data.append('position', form.position);
        data.append('faculty_id', form.faculty_id || '');
        data.append('employee_id', form.employee_id || '');
      }
  // Prefer separate files but keep backward compatible single field
    if (orFile) data.append('or_file', orFile);
    if (crFile) data.append('cr_file', crFile);
  if (orNumber) data.append('or_number', orNumber);
  if (crNumber) data.append('cr_number', crNumber);

  // include vehicle fields explicitly for backend
  if (form.vehicle_color) data.append('vehicle_color', form.vehicle_color);
  if (form.vehicle_type) data.append('vehicle_type', form.vehicle_type);
  if (form.brand) data.append('brand', form.brand);
  if (form.model) data.append('model', form.model);

  // Backend routes use kebab-case: create-student, create-faculty, create-employee, create-guard
  // IMPORTANT: do NOT prefix with a leading slash because api.baseURL already contains the '/api' path.
  const endpoint = `admin/create-${String(role).toLowerCase()}`;
  // Debug: show which endpoint we're posting to (resolved relative to api.baseURL)
  console.debug('AdminCreateUser: posting to', endpoint, '->', api.defaults.baseURL.replace(/\/$/, '') + '/' + endpoint);
        const res = await api.post(endpoint, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    // show success alert and callback
    window.showAlert('Created: ' + JSON.stringify(res.data), 'success', 3000);
    if (onSuccess) onSuccess(res.data);
    } catch (err) {
        // Try to extract validation details from the response (backend sends data => validation errors)
        const resp = err.response?.data;
        let msg = 'Error: ' + (resp?.message || err.message || 'Unknown error');
        if (resp?.data) {
          // If it's a validator messages bag, render fields -> messages
          if (typeof resp.data === 'object') {
            const parts = [];
            for (const [field, val] of Object.entries(resp.data)) {
              if (Array.isArray(val)) parts.push(`${field}: ${val.join(', ')}`);
              else parts.push(`${field}: ${String(val)}`);
            }
            if (parts.length) msg += '\n' + parts.join('\n');
          } else {
            msg += '\n' + JSON.stringify(resp.data);
          }
        }

        // Additional diagnostics for non-validation errors (keep validation messages clean)
        try {
          const status = err.response?.status;
          if (status && status !== 422) {
            const cfg = err.response?.config;
            if (cfg) {
              // build a sensible URL: ensure single slash between baseURL and url
              const base = cfg.baseURL ? cfg.baseURL.replace(/\/$/, '') : '';
              const urlPart = cfg.url ? (cfg.url.startsWith('/') ? cfg.url : `/${cfg.url}`) : '';
              const called = base + urlPart;
              console.error('AdminCreateUser request:', cfg.method, called);
              msg += `\nRequest: ${cfg.method?.toUpperCase() || 'POST'} ${called}`;
            }
          }
        } catch (e) {
          // ignore diagnostics errors
        }

        console.error('AdminCreateUser error response:', err.response || err);
        // show error alert via context helper
        try { window.showAlert(msg, 'error', 8000); } catch (e) { setMessage(msg); }
    }
  };

  // Trigger uniqueness check (called onBlur of inputs)
  const handleCheckUnique = async () => {
    const orVal = orNumber?.trim() || null;
    const crVal = crNumber?.trim() || null;
    if (!orVal && !crVal) {
      setOrNumberError(''); setCrNumberError('');
      return;
    }
    try {
      setCheckingUnique(true);
      await api.initCsrf();
      const resp = await api.post('vehicles/check-unique', { or_number: orVal, cr_number: crVal });
      setCheckingUnique(false);
      const exists = resp.data?.exists || {};
      if (exists.or_number) setOrNumberError('OR number already in use'); else setOrNumberError('');
      if (exists.cr_number) setCrNumberError('CR number already in use'); else setCrNumberError('');
    } catch (e) {
      setCheckingUnique(false);
      // network or server error: don't block user, but surface a message
      console.error('check-unique error', e);
      setMessage('Could not validate OR/CR uniqueness at this time.');
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2 style={{ marginTop: 0 }}>Create {role}</h2>

      <Box mb={4}>
        <FormLabel>Role</FormLabel>
        <Select value={role} onChange={(e) => setRole(e.target.value)} maxW="320px">
          <option>Student</option>
          <option>Faculty</option>
          <option>Employee</option>
          <option>Guard</option>
        </Select>
      </Box>

      <form onSubmit={submit}>
        <Stack spacing={3} maxW="720px">
          <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
            <Input name="firstname" placeholder="First name" value={form.firstname} onChange={onChange} isRequired />
            <Input name="lastname" placeholder="Last name" value={form.lastname} onChange={onChange} isRequired />
          </Stack>

          <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
            <Input name="email" placeholder="Email" value={form.email} onChange={onChange} isRequired />
            <Input name="password" placeholder="Password" value={form.password} onChange={onChange} isRequired />
          </Stack>

          {role !== 'Guard' && (
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
              <Input name="department" placeholder="Department" value={form.department} onChange={onChange} />
              <Input name="contact_number" placeholder="Contact number" value={form.contact_number} onChange={onChange} />
            </Stack>
          )}

          {role === 'Student' && (
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
              <Input name="student_no" placeholder="Student No" value={form.student_no} onChange={onChange} />
              <Input name="course" placeholder="Course" value={form.course} onChange={onChange} />
              <Input name="yr_section" placeholder="Yr & Section" value={form.yr_section} onChange={onChange} />
            </Stack>
          )}

          {(role === 'Faculty' || role === 'Employee') && (
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
              <Input name="position" placeholder="Position" value={form.position} onChange={onChange} />
              <Input name="employee_id" placeholder="Employee ID" value={form.employee_id || ''} onChange={onChange} />
            </Stack>
          )}

          {role === 'Guard' && (
            <>
              <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
                <Input name="username" placeholder="Username" value={form.username || ''} onChange={onChange} />
                <Input name="position" placeholder="Position" value={form.position} onChange={onChange} />
                <Input name="contact_number" placeholder="Contact number" value={form.contact_number || ''} onChange={onChange} />
              </Stack>
            </>
          )}

          {role !== 'Guard' && (
            <Input name="plate_number" placeholder="Plate number" value={form.plate_number} onChange={onChange} isRequired />
          )}

          {(role === 'Student' || role === 'Faculty' || role === 'Employee') && (
            <Stack direction={{ base: 'column', md: 'row' }} spacing={6} align="center">
              <Box>
                <FormLabel fontSize="sm">Official Receipt (OR) PDF</FormLabel>
                <Input type="file" accept="application/pdf" onChange={(e) => setOrFile(e.target.files[0])} />
              </Box>
              <Box>
                <FormLabel fontSize="sm">Certificate of Registration (CR) PDF</FormLabel>
                <Input type="file" accept="application/pdf" onChange={(e) => setCrFile(e.target.files[0])} />
              </Box>
            </Stack>
          )}

          {role !== 'Guard' && (
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
              <Input name="vehicle_color" placeholder="Vehicle color" value={form.vehicle_color} onChange={onChange} isRequired />
              <Input name="vehicle_type" placeholder="Vehicle type" value={form.vehicle_type} onChange={onChange} isRequired />
              <Input name="brand" placeholder="Brand" value={form.brand} onChange={onChange} isRequired />
              <Input name="model" placeholder="Model" value={form.model} onChange={onChange} isRequired />
            </Stack>
          )}

          {(role === 'Student' || role === 'Faculty' || role === 'Employee') && (
            <Stack direction={{ base: 'column', md: 'row' }} spacing={3}>
              <div style={{ flex: 1 }}>
                <Input name="or_number" placeholder="OR number" value={orNumber} onChange={(e) => { setOrNumber(e.target.value); setOrNumberError(''); }} onBlur={handleCheckUnique} isInvalid={!!orNumberError} isRequired />
                {orNumberError && <Box color="red.500" fontSize="sm" mt={1}>{orNumberError}</Box>}
              </div>
              <div style={{ flex: 1 }}>
                <Input name="cr_number" placeholder="CR number" value={crNumber} onChange={(e) => { setCrNumber(e.target.value); setCrNumberError(''); }} onBlur={handleCheckUnique} isInvalid={!!crNumberError} isRequired />
                {crNumberError && <Box color="red.500" fontSize="sm" mt={1}>{crNumberError}</Box>}
              </div>
            </Stack>
          )}

          <Stack direction="row" justify="flex-end" spacing={3}>
            <Button variant="outline" onClick={() => { if (onSuccess) onSuccess(null); }}>Cancel</Button>
            <Button colorScheme="red" type="submit" isLoading={checkingUnique}>Create {role}</Button>
          </Stack>

          {message && <Box mt={2}>{message}</Box>}
        </Stack>
      </form>
    </div>
  );
}
