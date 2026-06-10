import { supabase } from './supabase-client.js';

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.querySelector('[data-passenger-onboarding]');
  const errorEl = document.querySelector('[data-onboarding-error]');
  const successEl = document.querySelector('[data-onboarding-success]');
  const submitBtn = form?.querySelector('button[type="submit"]');
  const emailInput = form?.querySelector('[name="email"]');

  // --- Auth check ---
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user || authError) {
    if (errorEl) errorEl.textContent = 'Login before passenger onboarding';
    if (submitBtn) submitBtn.disabled = true;
    return;
  }

  // --- Already onboarded check ---
  const { data: profile } = await supabase
    .from('student_profiles')
    .select('college_id_collected')
    .eq('user_id', user.id)
    .maybeSingle();

  if (profile?.college_id_collected) {
    window.location.href = 'passenger-landing.html';
    return;
  }

  // --- Pre-fill email ---
  if (emailInput) emailInput.value = user.email;

  // --- Form submit ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (errorEl) errorEl.textContent = '';
    if (successEl) successEl.textContent = '';
    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const name = formData.get('name');
      const usn = formData.get('usn').toUpperCase();
      const branch = formData.get('branch').toUpperCase();
      const year = formData.get('year');
      const phoneRaw = formData.get('phone') || '';
      const phone = phoneRaw.replace(/\D/g, '').slice(-10);
      const pickup = formData.get('pickup');
      const idFront = formData.get('idFront');
      const idBack = formData.get('idBack');

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
            primary_role: 'passenger',
          });
        if (profileInsErr) throw profileInsErr;
      }

      // --- Upload college ID front ---
      const frontExt = idFront.name.split('.').pop();
      const frontPath = `${user.id}/college_id_front.${frontExt}`;
      const { error: frontUploadErr } = await supabase.storage
        .from('verification-documents')
        .upload(frontPath, idFront, { upsert: true });
      if (frontUploadErr) throw frontUploadErr;

      // --- Upload college ID back ---
      const backExt = idBack.name.split('.').pop();
      const backPath = `${user.id}/college_id_back.${backExt}`;
      const { error: backUploadErr } = await supabase.storage
        .from('verification-documents')
        .upload(backPath, idBack, { upsert: true });
      if (backUploadErr) throw backUploadErr;

      // --- Insert document records ---
      const { error: docErr } = await supabase
        .from('verification_documents')
        .upsert(
          [
            { user_id: user.id, document_type: 'college_id_front', storage_path: frontPath },
            { user_id: user.id, document_type: 'college_id_back', storage_path: backPath },
          ],
          { onConflict: 'user_id,document_type' }
        );
      if (docErr) throw docErr;

      // --- Upsert student profile ---
      const { error: profileErr } = await supabase
        .from('student_profiles')
        .upsert(
          {
            user_id: user.id,
            usn,
            branch,
            study_year: parseInt(year),
            phone,
            usual_pickup: pickup,
            college_id_collected: true,
          },
          { onConflict: 'user_id' }
        );
      if (profileErr) throw profileErr;

      // --- Success ---
      if (successEl) successEl.textContent = 'Passenger onboarding completed.';
      setTimeout(() => {
        window.location.href = 'passenger-landing.html';
      }, 700);
    } catch (err) {
      if (errorEl) errorEl.textContent = err.message || 'An error occurred during onboarding.';
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
