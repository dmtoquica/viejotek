import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase.js";

const msg = document.getElementById("msg");
const show = (m) => { msg.textContent = m; };

function friendlyError(error) {
  const message = error?.message || "";
  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network")) {
    return "No se pudo conectar con Supabase desde este navegador. Pulsa F5 y vuelve a intentar. Si vuelve a salir este mensaje, usa el botón de diagnóstico que aparece abajo.";
  }
  return message || "No fue posible completar la operación.";
}

async function testConnection() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(SUPABASE_URL + "/auth/v1/settings", {
      method: "GET",
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) return { ok: true, text: "Conexión con Supabase: OK" };
    const body = await res.text();
    return { ok: false, text: "Supabase respondió HTTP " + res.status + (body ? " · " + body.slice(0,180) : "") };
  } catch (e) {
    return { ok: false, text: "Conexión bloqueada o no disponible: " + (e.name === "AbortError" ? "tiempo de espera agotado" : (e.message || e.name)) };
  }
}

async function rawAuth(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(SUPABASE_URL + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_PUBLISHABLE_KEY
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.msg || data.message || data.error_description || ("HTTP " + res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function signupFallback(email, password, name) {
  const data = await rawAuth("/auth/v1/signup", {
    email,
    password,
    data: { name }
  });
  return data;
}

async function loginFallback(email, password) {
  const data = await rawAuth("/auth/v1/token?grant_type=password", { email, password });
  return data;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  show("Conectando…");
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    let result = await supabase.auth.signInWithPassword({ email, password });

    if (result.error && /failed to fetch|network/i.test(result.error.message || "")) {
      show("Conexión directa…");
      const data = await loginFallback(email, password);
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
        result = { data: { user: data.user }, error: null };
      }
    }

    if (result.error) return show(friendlyError(result.error));

    const { data: p, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", result.data.user.id)
      .single();

    if (profileError) return show("La cuenta existe, pero no se pudo cargar su perfil. Intenta nuevamente.");
    location.href = p?.role === "admin" ? "admin.html" : "socio.html";
  } catch (error) {
    show("Error de acceso: " + (error.message || "No fue posible conectar."));
  }
});

document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  show("Creando cuenta…");

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const password = document.getElementById("signupPassword").value;

  try {
    let result = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } }
    });

    if (result.error && /failed to fetch|network/i.test(result.error.message || "")) {
      show("Probando conexión directa…");
      const data = await signupFallback(email, password, name);
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
      }
      result = { data, error: null };
    }

    if (result.error) return show(friendlyError(result.error));

    if (result.data?.session) {
      show("Cuenta creada e ingreso iniciado. Si todo está correcto, te llevaré al panel…");
      setTimeout(() => location.href = "admin.html", 700);
    } else {
      show("Cuenta creada correctamente. Revisa tu correo si Supabase solicita confirmación y luego inicia sesión.");
    }
  } catch (error) {
    show("Error de registro: " + (error.message || "No fue posible conectar."));
  }
});

const diagnostic = document.createElement("button");
diagnostic.type = "button";
diagnostic.className = "btn full";
diagnostic.textContent = "Probar conexión";
diagnostic.style.marginTop = "12px";
diagnostic.onclick = async () => {
  diagnostic.disabled = true;
  diagnostic.textContent = "Probando…";
  const result = await testConnection();
  show(result.text);
  diagnostic.disabled = false;
  diagnostic.textContent = "Probar conexión";
};
document.getElementById("msg").after(diagnostic);
