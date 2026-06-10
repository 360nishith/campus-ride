import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.querySelector('[data-rider-onboarding]');
  const errorEl = document.querySelector('[data-onboarding-error]');
  const successEl = document.querySelector('[data-onboarding-success]');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const emailInput = form?.querySelector('[name="email"]');
  const collegeIdSection = document.querySelector('[data-college-id-section]');
  const existingIdMessage = document.querySelector('[data-existing-id-message]');

  // --- Auth check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    if (errorEl) errorEl.textContent = 'Login before rider onboarding';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  // --- Already onboarded check ---
  const { data: riderProfile } = await supabase
    .from('rider_profiles')
    .select('rider_onboarding_complete')
    .eq('user_id', user.id)
    .maybeSingle();

  if (riderProfile?.rider_onboarding_complete) {
    window.location.href = 'rider-landing.html';
    return;
  }

  // --- Fetch existing student profile for pre-filling ---
  const { data: studentProfile } = await supabase
    .from('student_profiles')
    .select('usn, branch, study_year, phone')
    .eq('user_id', user.id)
    .maybeSingle();

  // --- Pre-fill email ---
  if (emailInput) emailInput.value = user.email;

  // --- Pre-fill from existing student profile ---
  if (studentProfile) {
    const nameInput = form?.querySelector('[name="name"]');
    const usnInput = form?.querySelector('[name="usn"]');
    const branchInput = form?.querySelector('[name="branch"]');
    const yearInput = form?.querySelector('[name="year"]');
    const phoneInput = form?.querySelector('[name="phone"]');

    if (nameInput && studentProfile.name) nameInput.value = studentProfile.name;
    if (usnInput && studentProfile.usn) usnInput.value = studentProfile.usn;
    if (branchInput && studentProfile.branch) branchInput.value = studentProfile.branch;
    if (yearInput && studentProfile.study_year) yearInput.value = studentProfile.study_year;
    if (phoneInput && studentProfile.phone) phoneInput.value = studentProfile.phone;
  }

  // --- Form submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';

    const formData = new FormData(form);
    const upiId = formData.get('upiId').toLowerCase();

    // --- Validate UPI ID ---
    const upiRegex = /^[a-z0-9._-]{2,255}@[a-z0-9.-]{2,64}$/i;
    if (!upiRegex.test(upiId)) {
      if (errorEl) errorEl.textContent = 'Invalid UPI ID format.';
      return;
    }

    if (submitBtn) submitBtn.disabled = true;

    try {
      const name = formData.get('name');
      const usn = formData.get('usn').toUpperCase();
      const branch = formData.get('branch').toUpperCase();
      const year = formData.get('year');
      const phoneRaw = formData.get('phone') || '';
      const phone = phoneRaw.replace(/\D/g, '').slice(-10);

      // --- Ensure user profile exists in public.profiles ---
      const { data: existingProfile, error: profileGetErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileGetErr) throw profileGetErr;

      if (!existingProfile) {
        const { error: profileInsErr } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: name || user.user_metadata?.full_name || user.email.split('@')[0],
            primary_role: 'rider',
          });
        if (profileInsErr) throw profileInsErr;
      }

      // --- Upload driving licence front ---
      const dlFront = formData.get('dlFront');
      const dlFrontExt = dlFront.name.split('.').pop();
      const dlFrontPath = `${user.id}/driving_license_front.${dlFrontExt}`;
      const { error: dlFrontErr } = await supabase.storage
        .from('verification-documents')
        .upload(dlFrontPath, dlFront, { upsert: true });
      if (dlFrontErr) throw dlFrontErr;

      // --- Upload driving licence back ---
      const dlBack = formData.get('dlBack');
      const dlBackExt = dlBack.name.split('.').pop();
      const dlBackPath = `${user.id}/driving_license_back.${dlBackExt}`;
      const { error: dlBackErr } = await supabase.storage
        .from('verification-documents')
        .upload(dlBackPath, dlBack, { upsert: true });
      if (dlBackErr) throw dlBackErr;

      // --- Insert driving licence document records ---
      const docRecords = [
        { user_id: user.id, document_type: 'driving_license_front', storage_path: dlFrontPath },
        { user_id: user.id, document_type: 'driving_license_back', storage_path: dlBackPath },
      ];

      // --- Upload college ID ---
      const idFront = formData.get('idFront');
      const idFrontExt = idFront.name.split('.').pop();
      const idFrontPath = `${user.id}/college_id_front.${idFrontExt}`;
      const { error: idFrontErr } = await supabase.storage
        .from('verification-documents')
        .upload(idFrontPath, idFront, { upsert: true });
      if (idFrontErr) throw idFrontErr;

      const idBack = formData.get('idBack');
      const idBackExt = idBack.name.split('.').pop();
      const idBackPath = `${user.id}/college_id_back.${idBackExt}`;
      const { error: idBackErr } = await supabase.storage
        .from('verification-documents')
        .upload(idBackPath, idBack, { upsert: true });
      if (idBackErr) throw idBackErr;

      docRecords.push(
        { user_id: user.id, document_type: 'college_id_front', storage_path: idFrontPath },
        { user_id: user.id, document_type: 'college_id_back', storage_path: idBackPath }
      );

      // --- Upsert all document records ---
      const { error: docErr } = await supabase
        .from('verification_documents')
        .upsert(docRecords, { onConflict: 'user_id,document_type' });
      if (docErr) throw docErr;

      // --- Upsert student profile ---
      const { error: studentErr } = await supabase
        .from('student_profiles')
        .upsert(
          {
            user_id: user.id,
            usn,
            branch,
            study_year: parseInt(year),
            phone,
            college_id_collected: true,
          },
          { onConflict: 'user_id' }
        );
      if (studentErr) throw studentErr;

      // --- Upsert rider profile ---
      const { error: riderErr } = await supabase
        .from('rider_profiles')
        .upsert(
          {
            user_id: user.id,
            upi_id: upiId,
            rider_onboarding_complete: true,
          },
          { onConflict: 'user_id' }
        );
      if (riderErr) throw riderErr;

      // --- Ensure rider role exists ---
      const { error: roleErr } = await supabase
        .from('user_roles')
        .upsert(
          { user_id: user.id, role: 'rider' },
          { onConflict: 'user_id,role' }
        );
      if (roleErr) throw roleErr;

      // --- Success ---
      if (successEl) successEl.textContent = 'Rider onboarding completed.';
      setTimeout(() => {
        window.location.href = 'rider-landing.html';
      }, 700);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || 'An error occurred during onboarding.';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
