import { supabase, SUPABASE_URL } from "./supabase.js";

const msg = document.getElementById("msg");
const show = (m) => { msg.textContent = m; };

function friendlyError(error) {
  const message = error?.message || "";
  if (message.toLowerCase().includes("failed to fetch") || message.toLowerCase().includes("network")) {
    return "No se pudo conectar con el servidor de VEJOTEK. La página está funcionando, pero la conexión con Supabase no respondió. Espera unos segundos y vuelve a intentarlo.";
  }
  return message || "No fue posible completar la operación.";
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  show("Conectando…");
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: document.getElementById("email").value.trim(),
      password: document.getElementById("password").value
    });
    if (error) return show(friendlyError(error));

    const { data: p, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (profileError) return show("La cuenta existe, pero no se pudo cargar su perfil. Intenta nuevamente.");
    location.href = p?.role === "admin" ? "admin.html" : "socio.html";
  } catch (error) {
    show(friendlyError(error));
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  show("Creando cuenta…");
  try {
    const { error } = await supabase.auth.signUp({
      email: document.getElementById("signupEmail").value.trim(),
      password: document.getElementById("signupPassword").value,
      options: {
        data: { name: document.getElementById("name").value.trim() }
      }
    });

    if (error) return show(friendlyError(error));
    show("Cuenta creada correctamente. Si Supabase solicita confirmar el correo, revisa tu bandeja de entrada.");
  } catch (error) {
    show(friendlyError(error));
  }
});
