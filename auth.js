import { supabase } from "./supabase-client.js";

const nmamitEmailPattern = /^[^\s@]+@nmamit\.in$/;
const forms = document.querySelectorAll("[data-account-form]");

forms.forEach((form) => {
  const emailInput = form.querySelector('input[name="email"]');
  const emailError = form.querySelector("[data-email-error]");
  const submitBtn = form.querySelector('button[type="submit"]');
  const mode = form.dataset.mode;
  const role = form.dataset.role;
  const originalBtnText = submitBtn.textContent;

  emailInput.addEventListener("input", () => {
    emailError.textContent = "";
    emailInput.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = emailInput.value.trim().toLowerCase();

    if (!nmamitEmailPattern.test(email)) {
      emailError.textContent = "enter valid email address";
      emailInput.setAttribute("aria-invalid", "true");
      emailInput.focus();
      return;
    }

    emailError.textContent = "";
    emailInput.removeAttribute("aria-invalid");

    // Disable button while request is in progress
    submitBtn.disabled = true;
    submitBtn.textContent = "Please wait...";

    try {
      if (mode === "signup") {
        const name =
          form.querySelector('input[name="name"]')?.value.trim() || "";
        const password =
          form.querySelector('input[name="password"]')?.value || "";

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name, role } },
        });

        if (error) {
          emailError.textContent = error.message;
          return;
        }

        // Redirect to onboarding
        if (role === "passenger") {
          window.location.href = "passenger-onboarding.html";
          return;
        }
        if (role === "rider") {
          window.location.href = "rider-onboarding.html";
          return;
        }
      }

      if (mode === "login") {
        const password =
          form.querySelector('input[name="password"]')?.value || "";

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          emailError.textContent = error.message;
          return;
        }

        const user = data.user;

        // Check onboarding status
        if (role === "passenger") {
          const { data: profile, error: profileErr } = await supabase
            .from("student_profiles")
            .select("college_id_collected")
            .eq("user_id", user.id)
            .maybeSingle();

          console.log("Passenger login profile check:", { profile, profileErr });

          if (!profile || !profile.college_id_collected) {
            window.location.href = "passenger-onboarding.html";
            return;
          }

          window.location.href = "passenger-landing.html";
          return;
        }

        if (role === "rider") {
          const { data: profile, error: profileErr } = await supabase
            .from("rider_profiles")
            .select("rider_onboarding_complete")
            .eq("user_id", user.id)
            .maybeSingle();

          console.log("Rider login profile check:", { profile, profileErr });

          if (!profile || !profile.rider_onboarding_complete) {
            window.location.href = "rider-onboarding.html";
            return;
          }

          window.location.href = "rider-landing.html";
          return;
        }
      }

      if (mode === "forgot-password") {
        const { error } = await supabase.auth.resetPasswordForEmail(email);

        if (error) {
          emailError.textContent = error.message;
          return;
        }

        emailError.textContent = "";
        emailError.style.color = "";
        const successMsg = form.querySelector("[data-email-error]");
        successMsg.textContent = "Password reset link sent to your email";
        successMsg.style.color = "var(--clr-success, #22c55e)";
        return;
      }
    } catch (err) {
      emailError.textContent = err.message || "Something went wrong";
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  });
});
