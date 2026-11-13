// ============================================================================
// CRA DESKTOP / WEB PC — CONECTADO EM TEMPO REAL AO BACKEND DO MOBILE
// ============================================================================

const DIRECT_BACKEND_URL = "https://deploy-backend-5-semestre.onrender.com";
const API_BASE = "/api";
let resolvedApiBase = API_BASE;

// IDs de registros de teste antigos/vazios ocultados com segurança
const LEGACY_DELETED_POST_IDS = new Set([
  "6adbfe897772a7145afe2af0",
  "6adc0c9001616d0070de8922",
  "6adc1f1a4109842fe2c85681",
  "6adc26657af6f34a8f6bd1e8",
  "6aef940bf634ce4d488e7d3c",
]);

// Coordenadas pré-mapeadas e verificadas para exibição instantânea de todos os casos
const KNOWN_ADDRESS_COORDS = {
  "rua mary garden, jardim rubilene, são paulo - sp": {
    latitude: -23.7039012,
    longitude: -46.6349372,
  },
  "rua manoel amaral, centro, diadema - sp": {
    latitude: -23.6915562,
    longitude: -46.6323483,
  },
  "rua joão fernandes de oliveira, centro, diadema - sp": {
    latitude: -23.6925922,
    longitude: -46.6326565,
  },
  "rua francisco alves, centro, diadema - sp": {
    latitude: -23.69325,
    longitude: -46.63315,
  },
  "rua antônio pedrozelli, centro, diadema - sp": {
    latitude: -23.6920223,
    longitude: -46.6317051,
  },
  "rua josé zara, centro, diadema - sp": {
    latitude: -23.6898626,
    longitude: -46.6301148,
  },
  "rua júlio prestes, centro, diadema - sp": {
    latitude: -23.6936982,
    longitude: -46.6307328,
  },
  "avenida nossa senhora das vitórias, centro, diadema - sp": {
    latitude: -23.6894719,
    longitude: -46.6274497,
  },
  "rua primeiro-sargento nestor romualdo tenório, centro, diadema - sp": {
    latitude: -23.6971141,
    longitude: -46.6289579,
  },
  "rua washington luiz, centro, diadema - sp": {
    latitude: -23.69285,
    longitude: -46.62585,
  },
  "rua são judas tadeu, centro, diadema - sp": {
    latitude: -23.6703435,
    longitude: -46.6183545,
  },
  "rua doutor carlos de rezende enout, parque doroteia, são paulo - sp": {
    latitude: -23.701392,
    longitude: -46.63936,
  },
};

let currentUser = null;
let userToken = localStorage.getItem("cra_user_token") || null;
let guestToken = localStorage.getItem("cra_guest_token") || null;

let allPosts = [];
let pendingPostsList = [];
let pendingCommentsList = [];
let adminStatusFilter = "ALL";

let uploadedPhotoDataUri = "";

// Estado do Mapa Desktop (Leaflet)
let leafletMap = null;
let leafletMarkersLayer = null;
let leafletRadiusCircle = null;
let mapCenterCoords = { latitude: -23.6918, longitude: -46.6295 }; // Região Diadema / Sul SP
let selectedMapRadiusKm = 0;
let hasFittedInitialBounds = false;
let mapUpdateCounter = 0;

const geocodeCache = (() => {
  try {
    const saved = localStorage.getItem("cra_geocode_cache_v2");
    return saved
      ? { ...KNOWN_ADDRESS_COORDS, ...JSON.parse(saved) }
      : { ...KNOWN_ADDRESS_COORDS };
  } catch {
    return { ...KNOWN_ADDRESS_COORDS };
  }
})();

function saveGeocodeToCache(key, coords) {
  if (!key || !coords) return;
  geocodeCache[key.toLowerCase().trim()] = coords;
  try {
    localStorage.setItem("cra_geocode_cache_v2", JSON.stringify(geocodeCache));
  } catch {}
}

// ============================================================================
// 1. COMUNICAÇÃO COM A API (COM TOKEN DE USUÁRIO OU VISITANTE)
// ============================================================================

async function rawFetchWithFallback(path, options = {}) {
  const base =
    typeof window !== "undefined" && window.location?.protocol === "file:"
      ? DIRECT_BACKEND_URL
      : resolvedApiBase;
  return fetch(`${base}${path}`, options);
}

async function getGuestToken() {
  if (guestToken) return guestToken;
  try {
    const res = await rawFetchWithFallback("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "visitante@cra.com",
        password: "visitante123",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        guestToken = data.token;
        localStorage.setItem("cra_guest_token", guestToken);
        return guestToken;
      }
    }
  } catch (err) {
    console.warn("Erro ao obter guest_token:", err);
  }
  return null;
}

async function apiRequest(path, options = {}, isRetry = false) {
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (userToken) {
    headers["Authorization"] = `Bearer ${userToken}`;
  } else {
    const gToken = await getGuestToken();
    if (gToken) {
      headers["Authorization"] = `Bearer ${gToken}`;
    }
  }

  const response = await rawFetchWithFallback(path, {
    ...options,
    method,
    headers,
  });

  if ((response.status === 401 || response.status === 403) && !isRetry && !userToken) {
    guestToken = null;
    localStorage.removeItem("cra_guest_token");
    const newGToken = await getGuestToken();
    if (newGToken) {
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${newGToken}`,
      };
      return rawFetchWithFallback(path, {
        ...options,
        method,
        headers: retryHeaders,
      });
    }
  }

  return response;
}

function isAdminUser() {
  return currentUser?.roles?.[0]?.name === "ADMIN";
}

function filterLegacyPosts(posts) {
  if (!Array.isArray(posts)) return [];
  return posts.filter((p) => {
    const id = p?.id || p?._id;
    if (id && LEGACY_DELETED_POST_IDS.has(String(id))) return false;
    if (!p?.nome || String(p.nome).trim() === "") return false;
    if (p.status === "Recusada" || p.status === "Excluida") return false;
    return true;
  });
}

// Converte qualquer data DD/MM/AAAA ou DD-MM-AAAA para AAAA-MM-DD (exigido pelo Spring Boot LocalDate)
function normalizeDateToISO(rawDate) {
  const trimmed = String(rawDate || "").trim();
  // Caso já esteja em YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  // Caso esteja em DD/MM/YYYY ou DD-MM-YYYY
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const dd = match[1].padStart(2, "0");
    const mm = match[2].padStart(2, "0");
    const yyyy = match[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  // Fallback para data de hoje em YYYY-MM-DD
  const hoje = new Date();
  const yyyy = hoje.getFullYear();
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const dd = String(hoje.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateForDisplay(rawDate) {
  const trimmed = String(rawDate || "").trim();
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  return trimmed || "Não informada";
}

// ============================================================================
// 2. AUTENTICAÇÃO E SESSÃO DO USUÁRIO
// ============================================================================

async function loadCurrentUser() {
  if (!userToken) {
    currentUser = null;
    updateUserUI();
    return;
  }

  try {
    const res = await apiRequest("/auth/me");
    if (res.ok) {
      currentUser = await res.json();
    } else {
      userToken = null;
      currentUser = null;
      localStorage.removeItem("cra_user_token");
    }
  } catch {
    currentUser = null;
  }
  updateUserUI();
}

function updateUserUI() {
  const isLogged = Boolean(currentUser);
  const isAdmin = isAdminUser();

  const avatarEl = document.getElementById("sidebar-user-avatar");
  const nameEl = document.getElementById("sidebar-user-name");
  const roleEl = document.getElementById("sidebar-user-role");
  const authBtn = document.getElementById("sidebar-auth-btn");
  const navAdminBtn = document.getElementById("nav-admin");
  const adminFilterGroup = document.getElementById("admin-filter-group");

  const reportGuestWarn = document.getElementById("report-guest-warning");
  const reportFormWrap = document.getElementById("report-form-wrapper");
  const reportSubmitBtn = document.getElementById("report-submit-btn");

  const profAvatar = document.getElementById("profile-avatar-letter");
  const profName = document.getElementById("profile-name");
  const profEmail = document.getElementById("profile-email");
  const profBadge = document.getElementById("profile-role-badge");
  const profActions = document.getElementById("profile-auth-actions");
  const profBoAssistant = document.getElementById("profile-bo-assistant");

  const mGuestBtn = document.getElementById("mheader-guest-btn");
  const mGuestBrand = document.getElementById("mheader-guest-brand");
  const mLoggedBrand = document.getElementById("mheader-logged-brand");
  const mBellBtn = document.getElementById("mheader-bell-btn");

  if (!isLogged) {
    avatarEl.textContent = "V";
    nameEl.textContent = "Visitante";
    roleEl.textContent = "Modo Leitura Pública";
    authBtn.textContent = "Entrar / Cadastrar";
    authBtn.className = "btn btn-primary";
    authBtn.onclick = () => openAuthModal("login");

    if (mGuestBtn) mGuestBtn.style.display = "inline-flex";
    if (mGuestBrand) mGuestBrand.style.display = "inline-flex";
    if (mLoggedBrand) mLoggedBrand.style.display = "none";
    if (mBellBtn) mBellBtn.style.display = "none";

    navAdminBtn.style.display = "none";
    adminFilterGroup.style.display = "none";

    // Visitante: exibe aviso de "Identificação Necessária" e oculta o formulário
    if (reportGuestWarn) reportGuestWarn.style.display = "block";
    if (reportFormWrap) reportFormWrap.style.display = "none";
    if (reportSubmitBtn) reportSubmitBtn.disabled = true;

    profAvatar.textContent = "V";
    profName.textContent = "Navegando como Visitante";
    profEmail.textContent =
      "Conecte-se ou cadastre-se para efetuar postagens, gerenciar alertas e acessar o auxílio de Boletim de Ocorrência.";
    profBadge.textContent = "Modo Visitante";
    profActions.innerHTML = `<button class="btn btn-primary" onclick="openAuthModal('login')">Conectar / Criar Conta</button>`;
    profBoAssistant.style.display = "none";
  } else {
    const initial = (currentUser.username || "U").charAt(0).toUpperCase();
    avatarEl.textContent = initial;
    nameEl.textContent = currentUser.username;
    roleEl.textContent = isAdmin ? "Administrador CRA" : "Usuário Cadastrado";

    authBtn.textContent = "Sair da Conta";
    authBtn.className = "btn btn-danger";
    authBtn.onclick = handleLogout;

    if (mGuestBtn) mGuestBtn.style.display = "none";
    if (mGuestBrand) mGuestBrand.style.display = "none";
    if (mLoggedBrand) mLoggedBrand.style.display = "inline-flex";
    if (mBellBtn) mBellBtn.style.display = "inline-flex";

    navAdminBtn.style.display = isAdmin ? "flex" : "none";
    adminFilterGroup.style.display = isAdmin ? "flex" : "none";

    // Usuário conectado: oculta o aviso de visitante e libera o formulário
    if (reportGuestWarn) reportGuestWarn.style.display = "none";
    if (reportFormWrap) reportFormWrap.style.display = "block";
    if (reportSubmitBtn) reportSubmitBtn.disabled = false;

    profAvatar.textContent = initial;
    profName.textContent = currentUser.username;
    profEmail.textContent = currentUser.email;
    profBadge.textContent = isAdmin
      ? "Administrador CRA"
      : "Usuário Cadastrado";
    profActions.innerHTML = `<button class="btn btn-danger" onclick="handleLogout()">Sair da Conta</button>`;

    // Exibe o Auxílio de B.O. e Delegacia Próxima para o Usuário Cadastrado (Não Admin)
    profBoAssistant.style.display = !isAdmin ? "block" : "none";
  }
}

function handleLogout() {
  userToken = null;
  currentUser = null;
  localStorage.removeItem("cra_user_token");
  updateUserUI();
  refreshAllData(false);
}

// ============================================================================
// 3. BUSCA DE POSTAGENS, COMENTÁRIOS E SINCRONIZAÇÃO COM O MOBILE
// ============================================================================

async function fetchPostsFromServer() {
  if (isAdminUser()) {
    const res = await apiRequest("/postagem");
    if (!res.ok) throw new Error("Erro ao carregar postagens");
    const data = await res.json();
    return filterLegacyPosts(data);
  } else {
    const res = await apiRequest("/postagem?status=Aprovada");
    if (!res.ok) throw new Error("Erro ao carregar postagens aprovadas");
    const data = await res.json();
    return filterLegacyPosts(data).filter((p) => p.status === "Aprovada");
  }
}

async function fetchCommentsByPostId(postId) {
  try {
    const res = await apiRequest(`/comentario/${postId}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];

    return data
      .map((c) => {
        let texto = c.mensagem || "";
        let autor = "Membro da Comunidade";
        let status = "Aprovada";
        let dataHora = "";

        try {
          if (
            typeof c.mensagem === "string" &&
            c.mensagem.trim().startsWith("{")
          ) {
            const parsed = JSON.parse(c.mensagem);
            texto = parsed.texto ?? texto;
            autor = parsed.autor || autor;
            status = parsed.status || status;
            dataHora = parsed.data || dataHora;
          }
        } catch {}

        return {
          id: c.id || c._id,
          postagemId: c.postagemId || postId,
          texto,
          autor,
          status,
          data: dataHora,
        };
      })
      .filter((c) => Boolean(c.texto && c.texto.trim().length > 0));
  } catch {
    return [];
  }
}

async function refreshAllData(showFeedback = false) {
  try {
    allPosts = await fetchPostsFromServer();
    renderFeed();
    await updateMapPins();

    if (isAdminUser()) {
      await loadAdminNotifications();
    } else {
      pendingPostsList = [];
      pendingCommentsList = [];
      updateNotificationBadges();
    }

    if (showFeedback) {
      console.log("Sincronizado com sucesso!");
    }
  } catch (err) {
    console.error("Erro ao sincronizar:", err);
  }
}

async function loadAdminNotifications() {
  if (!isAdminUser()) return;
  try {
    pendingPostsList = allPosts.filter((p) => p.status === "Pendente");

    const commentPromises = allPosts.map((p) =>
      fetchCommentsByPostId(p.id || p._id)
    );
    const commentArrays = await Promise.all(commentPromises);
    pendingCommentsList = commentArrays
      .flat()
      .filter((c) => c.status === "Pendente");

    updateNotificationBadges();
  } catch (err) {
    console.warn("Erro ao buscar pendências do admin:", err);
  }
}

function updateNotificationBadges() {
  const total = pendingPostsList.length + pendingCommentsList.length;
  const bellBadge = document.getElementById("topbar-bell-badge");
  const mobileBellBadge = document.getElementById("mobile-bell-badge");
  const sideBadge = document.getElementById("sidebar-admin-badge");

  if (isAdminUser() && total > 0) {
    const label = total > 9 ? "9+" : String(total);
    bellBadge.style.display = "flex";
    bellBadge.textContent = label;
    if (mobileBellBadge) {
      mobileBellBadge.style.display = "flex";
      mobileBellBadge.textContent = label;
    }
    sideBadge.style.display = "inline-block";
    sideBadge.textContent = String(total);
  } else {
    bellBadge.style.display = "none";
    if (mobileBellBadge) mobileBellBadge.style.display = "none";
    sideBadge.style.display = "none";
  }
}

// ============================================================================
// 4. RENDERIZAÇÃO DO FEED DE ALERTAS NO PC
// ============================================================================

function setAdminStatusFilter(status) {
  adminStatusFilter = status;
  document
    .getElementById("filter-all")
    .classList.toggle("active", status === "ALL");
  document
    .getElementById("filter-aprovada")
    .classList.toggle("active", status === "Aprovada");
  document
    .getElementById("filter-pendente")
    .classList.toggle("active", status === "Pendente");
  renderFeed();
}

function isValidImageUrl(url) {
  return (
    Boolean(url) &&
    typeof url === "string" &&
    (url.startsWith("http") || url.startsWith("data:image/")) &&
    !url.includes("example.com")
  );
}

function renderFeed() {
  const container = document.getElementById("feed-container");
  const query = (
    document.getElementById("feed-search-input")?.value || ""
  )
    .trim()
    .toLowerCase();

  const filtered = allPosts.filter((post) => {
    if (
      isAdminUser() &&
      adminStatusFilter !== "ALL" &&
      post.status !== adminStatusFilter
    ) {
      return false;
    }
    if (!query) return true;
    const nome = (post.nome || "").toLowerCase();
    const loc = (post.ultimaLocalidade || "").toLowerCase();
    return nome.includes(query) || loc.includes(query);
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <div style="margin-bottom: 12px; display:flex; justify-content:center">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
        </div>
        <h3 style="font-size: 18px; color: #0f172a">Nenhuma postagem encontrada</h3>
        <p style="font-size: 14px; color: #64748b; margin-top: 6px">
          Crie um novo alerta pelo botão "+ Novo Alerta" ou pelo aplicativo no celular.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = `<div class="posts-grid">${filtered
    .map((post) => {
      const postId = post.id || post._id;
      const statusClass =
        post.status === "Encontrado"
          ? "encontrado"
          : post.status === "Não encontrado"
          ? "finalizado"
          : (post.status || "Aprovada").toLowerCase();

      const statusLabel =
        post.status === "Pendente"
          ? "Aguardando Aprovação"
          : post.status === "Encontrado"
          ? "Encontrada"
          : post.status === "Não encontrado"
          ? "Caso Finalizado"
          : post.status === "Recusada"
          ? "Reprovada"
          : "Alerta Ativo";

      const imgHtml = isValidImageUrl(post.fotoPerfil)
        ? `<img src="${post.fotoPerfil}" alt="${escapeHtml(post.nome)}" />`
        : `<div style="display:flex;align-items:center;justify-content:center;color:#94a3b8"><svg width="54" height="54" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

      let adminButtons = "";
      let deleteForeverBtn = "";
      if (isAdminUser()) {
        if (post.status === "Pendente") {
          adminButtons = `
            <button class="btn btn-success" style="flex:1" onclick="changePostStatus('${postId}', 'Aprovada')">Aprovar</button>
            <button class="btn btn-danger" style="flex:1" onclick="changePostStatus('${postId}', 'Recusada')">Reprovar</button>
          `;
        } else if (post.status === "Aprovada") {
          adminButtons = `
            <button class="btn btn-success" style="flex:1" onclick="changePostStatus('${postId}', 'Encontrado')">Encontrada</button>
            <button class="btn btn-secondary-dark" style="flex:1" onclick="changePostStatus('${postId}', 'Não encontrado')">Finalizar Caso</button>
          `;
        } else if (
          post.status === "Encontrado" ||
          post.status === "Não encontrado"
        ) {
          adminButtons = `
            <button class="btn btn-outline" style="flex:1" onclick="changePostStatus('${postId}', 'Aprovada')">Reabrir Alerta</button>
          `;
        }

        deleteForeverBtn = `
          <button
            class="btn"
            style="width:100%;margin-top:4px;background:#fee2e2;color:#dc2626;border:1px solid #fca5a5"
            onclick="deletePostPermanently('${postId}', '${escapeHtml(
          post.nome
        ).replace(/'/g, "\\'")}')"
          >
            Apagar Postagem Para Sempre
          </button>
        `;
      }

      return `
        <article class="post-card">
          <div class="post-image-wrap">
            ${imgHtml}
            <span class="status-pill ${statusClass}">${statusLabel}</span>
          </div>
          <div class="post-body">
            <div class="post-name">${escapeHtml(post.nome)}</div>
            <div class="post-meta">
              <div class="post-meta-row"><strong>Idade:</strong> ${
                post.idade
              } anos</div>
              <div class="post-meta-row"><strong>Local:</strong> ${escapeHtml(
                post.ultimaLocalidade
              )}</div>
              <div class="post-meta-row"><strong>Data:</strong> ${escapeHtml(
                formatDateForDisplay(post.data)
              )}</div>
            </div>
            <p class="post-desc">${escapeHtml(
              post.informacoesAdicionais || ""
            )}</p>
            <div class="post-actions" style="flex-wrap: wrap;">
              <button class="btn btn-primary" style="width:100%" onclick="openPostDetailModal('${postId}')">
                Ver Detalhes e Comentários
              </button>
              ${
                adminButtons
                  ? `<div style="display:flex;gap:8px;width:100%;margin-top:4px">${adminButtons}</div>`
                  : ""
              }
              ${deleteForeverBtn}
            </div>
          </div>
        </article>
      `;
    })
    .join("")}</div>`;
}

async function deletePostPermanently(postId, postName) {
  const confirmed = confirm(
    `Tem certeza que deseja APAGAR PARA SEMPRE a postagem de "${postName}"?\n\nEsta ação removerá o registro permanentemente tanto do PC quanto do aplicativo Mobile.`
  );
  if (!confirmed) return;

  try {
    const res = await apiRequest(`/postagem/status/${postId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "Excluida" }),
    });
    if (res.ok) {
      await refreshAllData(false);
      closePostDetailModal();
      if (
        document
          .getElementById("notifications-modal")
          .classList.contains("open")
      ) {
        renderNotificationsModalContent();
      }
      alert(`A postagem de "${postName}" foi apagada permanentemente.`);
    } else {
      alert("Não foi possível excluir a postagem.");
    }
  } catch {
    alert("Erro de conexão ao tentar excluir a postagem.");
  }
}

async function changePostStatus(postId, newStatus) {
  try {
    const res = await apiRequest(`/postagem/status/${postId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      await refreshAllData(false);
      if (
        document
          .getElementById("notifications-modal")
          .classList.contains("open")
      ) {
        renderNotificationsModalContent();
      }
    } else {
      alert("Não foi possível alterar o status da postagem.");
    }
  } catch {
    alert("Erro de conexão ao alterar status da postagem.");
  }
}

// ============================================================================
// 5. DETALHES DA POSTAGEM E COMENTÁRIOS (SINCRONIZADOS COM O MOBILE)
// ============================================================================

async function openPostDetailModal(postId) {
  const post = allPosts.find((p) => (p.id || p._id) === postId);
  if (!post) return;

  const modal = document.getElementById("post-detail-modal");
  const body = document.getElementById("post-detail-body");
  modal.classList.add("open");

  body.innerHTML = `<p style="color:#64748b">Carregando informações e comentários...</p>`;

  const allComments = await fetchCommentsByPostId(postId);
  const visibleComments = isAdminUser()
    ? allComments.filter((c) => c.status !== "Recusada")
    : allComments.filter((c) => c.status === "Aprovada");

  const imgHtml = isValidImageUrl(post.fotoPerfil)
    ? `<img src="${post.fotoPerfil}" class="detail-photo" alt="${escapeHtml(
        post.nome
      )}" />`
    : `<div class="detail-photo" style="display:flex;align-items:center;justify-content:center;color:#94a3b8"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>`;

  const commentsHtml =
    visibleComments.length === 0
      ? `<p style="font-size:13px;color:#64748b;margin:10px 0">Nenhum comentário liberado ainda. Seja o primeiro a colaborar com informações sobre este caso.</p>`
      : visibleComments
          .map(
            (c) => `
          <div class="comment-item">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <strong style="font-size:13px;color:#0f172a">${escapeHtml(
                c.autor
              )}</strong>
              <span style="font-size:11px;color:${
                c.status === "Pendente" ? "#d97706" : "#10b981"
              };font-weight:700">${
              c.status === "Pendente" ? "Pendente" : "Verificado"
            }</span>
            </div>
            <p style="font-size:13px;color:#334155;line-height:1.5">${escapeHtml(
              c.texto
            )}</p>
          </div>
        `
          )
          .join("");

  const commentFormHtml = `
    <form onsubmit="handleCommentSubmit(event, '${postId}')" style="margin-top:14px;display:flex;gap:10px">
      <input
        type="text"
        id="new-comment-input"
        required
        placeholder="Escreva uma pista ou informação sobre o paradeiro..."
        style="flex:1;padding:11px 14px;border-radius:10px;border:1px solid #cbd5e1;font-size:13px"
      />
      <button type="submit" class="btn btn-primary">Enviar Comentário</button>
    </form>
    <p style="font-size:11px;color:#64748b;margin-top:6px">
      * Por segurança, novos comentários passam pela moderação da administração antes de ficarem públicos.
    </p>
  `;

  body.innerHTML = `
    <div class="detail-grid">
      <div>
        ${imgHtml}
      </div>
      <div>
        <span style="font-size:11px;font-weight:800;color:#dc2626;text-transform:uppercase;letter-spacing:0.6px">
          ALERTA DE DESAPARECIMENTO • ${escapeHtml(post.status)}
        </span>
        <h2 style="font-size:24px;color:#0f172a;margin:4px 0 12px">${escapeHtml(
          post.nome
        )}</h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;background:#f8fafc;padding:14px;border-radius:12px;border:1px solid #e2e8f0;font-size:13px">
          <div><strong>Idade:</strong> ${post.idade} anos</div>
          <div><strong>Data:</strong> ${escapeHtml(
            formatDateForDisplay(post.data)
          )}</div>
          <div style="grid-column:1/-1"><strong>Última Localidade:</strong> ${escapeHtml(
            post.ultimaLocalidade
          )}</div>
          ${
            post.cep
              ? `<div style="grid-column:1/-1"><strong>CEP:</strong> ${escapeHtml(
                  post.cep
                )}</div>`
              : ""
          }
          <div style="grid-column:1/-1"><strong>Reportado por:</strong> ${escapeHtml(
            post.usuarioPostagem?.nome || "Comunidade CRA"
          )}</div>
        </div>

        <h4 style="font-size:13px;color:#475569;text-transform:uppercase;margin:16px 0 6px">
          Informações e Características Adicionais
        </h4>
        <p style="font-size:14px;color:#334155;line-height:1.6;background:#ffffff;padding:12px;border-radius:10px;border:1px solid #e2e8f0">
          ${escapeHtml(post.informacoesAdicionais || "Sem detalhes adicionais.")}
        </p>

        <h4 style="font-size:13px;color:#475569;text-transform:uppercase;margin:20px 0 10px">
          Comentários e Informações da Comunidade (${visibleComments.length})
        </h4>
        <div id="detail-comments-list">
          ${commentsHtml}
        </div>
        ${commentFormHtml}
      </div>
    </div>
  `;
}

function closePostDetailModal() {
  document.getElementById("post-detail-modal").classList.remove("open");
}

async function handleCommentSubmit(event, postId) {
  event.preventDefault();
  const input = document.getElementById("new-comment-input");
  const texto = (input?.value || "").trim();
  if (!texto) return;

  try {
    const payload = {
      postagemId: postId,
      mensagem: JSON.stringify({
        texto,
        autor: currentUser?.username || "Membro da Comunidade",
        status: "Pendente",
        data: new Date().toISOString(),
      }),
    };

    const res = await apiRequest("/comentario", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      input.value = "";
      alert(
        "Comentário enviado com sucesso! Ele ficará visível assim que aprovado pela moderação."
      );
      await refreshAllData(false);
      await openPostDetailModal(postId);
    } else {
      alert("Não foi possível enviar o comentário.");
    }
  } catch {
    alert("Erro ao enviar comentário.");
  }
}

// ============================================================================
// 6. FORMULÁRIO DE CRIAR POSTAGEM NO PC (COM FOTO BASE64 E VIACEP)
// ============================================================================

function handlePhotoSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const img = new Image();
    img.onload = function () {
      const maxDim = 480;
      let width = img.width;
      let height = img.height;
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      uploadedPhotoDataUri = canvas.toDataURL("image/jpeg", 0.65);

      const preview = document.getElementById("report-photo-preview");
      const placeholder = document.getElementById("photo-upload-placeholder");
      preview.src = uploadedPhotoDataUri;
      preview.style.display = "inline-block";
      placeholder.innerHTML = `<div style="font-weight:700;color:#10b981">Foto pronta para envio (clique para trocar)</div>`;
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

async function buscarCepAutomatico() {
  const cepRaw = document.getElementById("report-cep")?.value || "";
  const cep = cepRaw.replace(/\D/g, "");
  if (cep.length !== 8) return;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (res.ok) {
      const data = await res.json();
      if (!data.erro) {
        const partes = [
          data.logradouro,
          data.bairro,
          data.localidade ? `${data.localidade} - ${data.uf}` : "",
        ].filter(Boolean);
        if (partes.length > 0) {
          const fullAddr = partes.join(", ");
          document.getElementById("report-localidade").value = fullAddr;

          // Também já salva a coordenada do CEP em cache para o Mapa
          try {
            const resAwesome = await fetch(
              `https://cep.awesomeapi.com.br/json/${cep}`
            );
            if (resAwesome.ok) {
              const jsonAw = await resAwesome.json();
              if (jsonAw.lat && jsonAw.lng) {
                saveGeocodeToCache(fullAddr, {
                  latitude: parseFloat(jsonAw.lat),
                  longitude: parseFloat(jsonAw.lng),
                });
              }
            }
          } catch {}
        }
      }
    }
  } catch {}
}

async function submitReportForm(event) {
  event.preventDefault();

  if (!currentUser) {
    alert("Você precisa estar conectado à sua conta para cadastrar um alerta.");
    openAuthModal("login");
    return;
  }

  if (!uploadedPhotoDataUri) {
    alert("Por favor, selecione uma fotografia da pessoa desaparecida.");
    return;
  }

  const btn = document.getElementById("report-submit-btn");
  btn.disabled = true;
  btn.textContent = "Enviando alerta...";

  try {
    const nome = document.getElementById("report-nome").value.trim();
    const idade = Number(document.getElementById("report-idade").value);
    const cep = document.getElementById("report-cep").value.trim();
    const rawData = document.getElementById("report-data").value.trim();
    const dataISO = normalizeDateToISO(rawData);
    const ultimaLocalidade = document
      .getElementById("report-localidade")
      .value.trim();
    const informacoesAdicionais = document
      .getElementById("report-info")
      .value.trim();

    // Faz o pré-geocoding do endereço informado para aparecer imediatamente no mapa
    if (cep) {
      const cleanCep = cep.replace(/\D/g, "");
      if (cleanCep.length === 8) {
        try {
          const rCep = await fetch(
            `https://cep.awesomeapi.com.br/json/${cleanCep}`
          );
          if (rCep.ok) {
            const jCep = await rCep.json();
            if (jCep.lat && jCep.lng) {
              saveGeocodeToCache(ultimaLocalidade, {
                latitude: parseFloat(jCep.lat),
                longitude: parseFloat(jCep.lng),
              });
            }
          }
        } catch {}
      }
    }

    const payload = {
      nome,
      idade,
      cep,
      data: dataISO,
      ultimaLocalidade,
      informacoesAdicionais,
      fotoPerfil: uploadedPhotoDataUri,
    };

    const res = await apiRequest("/postagem", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (res.ok || res.status === 201) {
      alert(
        `Alerta de "${nome}" enviado com sucesso! Ele foi encaminhado para análise e ficará visível no Feed e no Mapa assim que for aprovado pelo Administrador.`
      );
      document.getElementById("report-form").reset();
      uploadedPhotoDataUri = "";
      document.getElementById("report-photo-preview").style.display = "none";
      document.getElementById("photo-upload-placeholder").innerHTML = `
        <div style="margin-bottom: 8px; display:flex; justify-content:center">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0040a1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div style="font-weight: 700; color: #0040a1">
          Clique para selecionar uma foto do seu computador
        </div>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px">
          A imagem é otimizada automaticamente para aparecer no PC e no Celular
        </div>
      `;

      // Restaura a data padrão no campo
      const hoje = new Date();
      const dd = String(hoje.getDate()).padStart(2, "0");
      const mm = String(hoje.getMonth() + 1).padStart(2, "0");
      const yyyy = hoje.getFullYear();
      document.getElementById("report-data").value = `${dd}/${mm}/${yyyy}`;

      await refreshAllData(false);
      switchTab("feed");
    } else {
      const errText = await res.text();
      console.error("Erro retornado pelo backend:", res.status, errText);
      alert(
        `Não foi possível enviar o alerta (código ${res.status}). Verifique os dados e tente novamente.`
      );
    }
  } catch (err) {
    console.error("Falha ao enviar alerta:", err);
    alert("Falha de conexão ao registrar alerta.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Enviar Alerta de Desaparecimento";
  }
}

// ============================================================================
// 7. MAPA INTERATIVO DESKTOP (LEAFLET + PHOTON / AWESOMEAPI / CACHE)
// ============================================================================

function initDesktopMap() {
  if (leafletMap) {
    setTimeout(() => {
      leafletMap.invalidateSize();
      updateMapPins();
    }, 150);
    return;
  }

  leafletMap = L.map("desktop-map").setView(
    [mapCenterCoords.latitude, mapCenterCoords.longitude],
    14
  );

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors — CRA Desktop",
  }).addTo(leafletMap);

  leafletMarkersLayer = L.layerGroup().addTo(leafletMap);
  updateMapPins();
}

async function geocodeAddress(query, cepOptional) {
  if (!query && !cepOptional) return null;
  const cacheKey = String(query || cepOptional)
    .toLowerCase()
    .trim();

  if (geocodeCache[cacheKey]) {
    return geocodeCache[cacheKey];
  }

  // 1. Tenta por CEP via AwesomeAPI
  const cepClean = String(
    cepOptional ||
      query?.match(/\b\d{5}-?\d{3}\b/)?.[0] ||
      query?.match(/\b\d{8}\b/)?.[0] ||
      ""
  ).replace(/\D/g, "");

  if (cepClean.length === 8) {
    try {
      const resCep = await fetch(
        `https://cep.awesomeapi.com.br/json/${cepClean}`
      );
      if (resCep.ok) {
        const dataCep = await resCep.json();
        if (dataCep.lat && dataCep.lng) {
          const coords = {
            latitude: parseFloat(dataCep.lat),
            longitude: parseFloat(dataCep.lng),
          };
          saveGeocodeToCache(cacheKey, coords);
          return coords;
        }
      }
    } catch {}
  }

  // 2. Tenta via Photon Komoot (OpenStreetMap sem bloqueio 403 / rate-limit estrito)
  if (query) {
    const parts = query.split(",");
    const ruaCidade =
      parts.length > 2
        ? `${parts[0].trim()}, ${parts[parts.length - 1].trim()}`
        : query;

    for (const candidate of [ruaCidade, query]) {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
          `${candidate}, Brasil`
        )}&limit=1`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const c = data?.features?.[0]?.geometry?.coordinates;
          if (Array.isArray(c) && c.length >= 2) {
            const coords = {
              latitude: parseFloat(c[1]),
              longitude: parseFloat(c[0]),
            };
            saveGeocodeToCache(cacheKey, coords);
            return coords;
          }
        }
      } catch {}
    }

    // 3. Fallback garantido por cidade para que nenhum caso deixe de aparecer no mapa
    const lower = cacheKey;
    const fallbackCoords = {
      latitude: lower.includes("diadema") ? -23.6915 : -23.55052,
      longitude: lower.includes("diadema") ? -46.6285 : -46.633308,
    };
    saveGeocodeToCache(cacheKey, fallbackCoords);
    return fallbackCoords;
  }

  return null;
}

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function updateMapPins() {
  if (!leafletMap || !leafletMarkersLayer) return;
  const currentRun = ++mapUpdateCounter;

  const resolvedMarkers = [];
  const boundsPoints = [];

  for (let idx = 0; idx < allPosts.length; idx++) {
    const post = allPosts[idx];
    const locText = post.ultimaLocalidade || post.cep;
    if (!locText) continue;

    const coords = await geocodeAddress(post.ultimaLocalidade, post.cep);
    if (currentRun !== mapUpdateCounter) return; // Evita condição de corrida
    if (!coords) continue;

    // Pequeno deslocamento caso dois alertas tenham exatamente o mesmo endereço
    const angle = (idx * 137.5 * Math.PI) / 180;
    const offsetLat = idx === 0 ? 0 : Math.cos(angle) * 0.00018;
    const offsetLng = idx === 0 ? 0 : Math.sin(angle) * 0.00018;
    const finalLat = coords.latitude + offsetLat;
    const finalLng = coords.longitude + offsetLng;

    if (selectedMapRadiusKm > 0) {
      const dist = calcDistanceKm(
        mapCenterCoords.latitude,
        mapCenterCoords.longitude,
        finalLat,
        finalLng
      );
      if (dist > selectedMapRadiusKm) continue;
    }

    const postId = post.id || post._id;
    const innerPin = isValidImageUrl(post.fotoPerfil)
      ? `<img src="${post.fotoPerfil}" alt="${escapeHtml(post.nome)}" />`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;

    const icon = L.divIcon({
      className: "",
      html: `<div class="custom-Case-pin" title="${escapeHtml(
        post.nome
      )}">${innerPin}</div>`,
      iconSize: [54, 54],
      iconAnchor: [27, 27],
    });

    const marker = L.marker([finalLat, finalLng], { icon });
    marker.bindPopup(`
      <div style="min-width:200px;font-family:'Public Sans',sans-serif">
        <strong style="font-size:15px;color:#0f172a">${escapeHtml(
          post.nome
        )}</strong>
        <div style="font-size:12px;color:#475569;margin:4px 0">${
          post.idade
        } anos • ${escapeHtml(post.ultimaLocalidade)}</div>
        <button
          onclick="openPostDetailModal('${postId}')"
          style="margin-top:6px;width:100%;padding:7px 10px;background:#0040a1;color:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:700;font-size:12px"
        >
          Ver Postagem Completa
        </button>
      </div>
    `);

    resolvedMarkers.push(marker);
    boundsPoints.push([finalLat, finalLng]);
  }

  if (currentRun !== mapUpdateCounter) return;

  leafletMarkersLayer.clearLayers();
  if (leafletRadiusCircle) {
    leafletMap.removeLayer(leafletRadiusCircle);
    leafletRadiusCircle = null;
  }

  if (selectedMapRadiusKm > 0) {
    leafletRadiusCircle = L.circle(
      [mapCenterCoords.latitude, mapCenterCoords.longitude],
      {
        radius: selectedMapRadiusKm * 1000,
        color: "#0040A1",
        fillColor: "#3B82F6",
        fillOpacity: 0.12,
      }
    ).addTo(leafletMap);
  }

  for (const m of resolvedMarkers) {
    leafletMarkersLayer.addLayer(m);
  }

  if (!hasFittedInitialBounds && boundsPoints.length > 0) {
    hasFittedInitialBounds = true;
    try {
      leafletMap.fitBounds(boundsPoints, { padding: [45, 45], maxZoom: 15 });
    } catch {}
  }
}

async function searchLocationOnMap() {
  const q = document.getElementById("map-search-input")?.value.trim();
  if (!q) return;
  const coords = await geocodeAddress(q);
  if (coords && leafletMap) {
    mapCenterCoords = coords;
    leafletMap.setView([coords.latitude, coords.longitude], 14);
    updateMapPins();
  } else {
    alert("Localização não encontrada.");
  }
}

function centerMapOnUserGPS() {
  if (!navigator.geolocation) {
    alert("Seu navegador não suporta geolocalização.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      mapCenterCoords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };
      if (leafletMap) {
        leafletMap.setView(
          [mapCenterCoords.latitude, mapCenterCoords.longitude],
          14
        );
        updateMapPins();
      }
    },
    () => {
      alert("Permita o acesso à localização no navegador para usar o GPS.");
    }
  );
}

function setMapRadius(km) {
  selectedMapRadiusKm = km;
  document.querySelectorAll(".radius-pills .radius-chip").forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.radius) === km);
  });
  updateMapPins();
}

// ============================================================================
// 8. AUXÍLIO B.O. E DELEGACIA PRÓXIMA NO PC (USUÁRIO CADASTRADO NÃO-ADMIN)
// ============================================================================

function locateNearbyPoliceStationsPC() {
  const box = document.getElementById("pc-delegacias-result");
  box.innerHTML = `<p style="font-size:13px;color:#0040a1;font-weight:600">Obtendo sua localização atual e buscando delegacias próximas...</p>`;

  if (!navigator.geolocation) {
    box.innerHTML = `<p style="font-size:13px;color:#dc2626">Seu navegador não suporta geolocalização. Use o botão "Abrir Delegacias no Google Maps".</p>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      const url = `https://photon.komoot.io/api/?q=Delegacia+de+Policia&lat=${latitude}&lon=${longitude}&limit=5`;

      try {
        const res = await fetch(url);
        const data = await res.json();
        const features = data?.features || [];
        if (features.length > 0) {
          const items = features
            .map((f) => {
              const lon = parseFloat(f.geometry.coordinates[0]);
              const lat = parseFloat(f.geometry.coordinates[1]);
              const dist = calcDistanceKm(latitude, longitude, lat, lon);
              const props = f.properties || {};
              const nome = props.name || "Delegacia de Polícia Civil";
              const end = [props.street, props.district, props.city]
                .filter(Boolean)
                .join(", ");
              return { nome, end: end || "Ver no mapa", lat, lon, dist };
            })
            .sort((a, b) => a.dist - b.dist);

          box.innerHTML =
            `<h4 style="font-size:13px;color:#0040a1;margin-bottom:8px">Delegacias Encontradas Próximas à Sua Posição:</h4>` +
            items
              .map(
                (it) => `
              <div class="delegacia-card">
                <div>
                  <strong style="font-size:14px;color:#0f172a">${escapeHtml(
                    it.nome
                  )}</strong>
                  <span style="margin-left:8px;background:#dbeafe;color:#0040a1;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700">
                    ${it.dist.toFixed(1)} km
                  </span>
                  <div style="font-size:12px;color:#64748b;margin-top:2px">${escapeHtml(
                    it.end
                  )}</div>
                </div>
                <a
                  href="https://www.google.com/maps/dir/?api=1&destination=${
                    it.lat
                  },${it.lon}"
                  target="_blank"
                  class="btn btn-primary"
                  style="text-decoration:none"
                >
                  Traçar Rota
                </a>
              </div>
            `
              )
              .join("");
        } else {
          openGoogleMapsPoliceSearchPC();
        }
      } catch {
        openGoogleMapsPoliceSearchPC();
      }
    },
    () => {
      box.innerHTML = `<p style="font-size:13px;color:#b45309">Permissão de localização não concedida no navegador. Abrindo busca de delegacias próximas no Google Maps...</p>`;
      openGoogleMapsPoliceSearchPC();
    }
  );
}

function openGoogleMapsPoliceSearchPC() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        window.open(
          `https://www.google.com/maps/search/Delegacia+de+Policia+Civil/@${latitude},${longitude},14z`,
          "_blank"
        );
      },
      () => {
        window.open(
          `https://www.google.com/maps/search/Delegacia+de+Policia+Civil`,
          "_blank"
        );
      }
    );
  } else {
    window.open(
      `https://www.google.com/maps/search/Delegacia+de+Policia+Civil`,
      "_blank"
    );
  }
}

// ============================================================================
// 9. MODAL DE NOTIFICAÇÕES E MODERAÇÃO DO ADMIN
// ============================================================================

async function openNotificationsModal() {
  const modal = document.getElementById("notifications-modal");
  modal.classList.add("open");
  if (isAdminUser()) {
    await loadAdminNotifications();
  }
  renderNotificationsModalContent();
}

function closeNotificationsModal() {
  document.getElementById("notifications-modal").classList.remove("open");
}

function renderNotificationsModalContent() {
  const body = document.getElementById("notifications-modal-body");
  if (!isAdminUser()) {
    body.innerHTML = `
      <div class="empty-state-box" style="padding:36px">
        <div style="margin-bottom:10px;display:flex;justify-content:center">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        </div>
        <h3>Tudo atualizado!</h3>
        <p style="font-size:13px;color:#64748b;margin-top:6px">
          Os alertas do PC e do aplicativo Mobile estão sincronizados em tempo real (${allPosts.length} casos ativos).
        </p>
      </div>
    `;
    return;
  }

  if (pendingPostsList.length === 0 && pendingCommentsList.length === 0) {
    body.innerHTML = `
      <div class="empty-state-box" style="padding:36px">
        <div style="margin-bottom:10px;display:flex;justify-content:center">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#0040a1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        </div>
        <h3>Nenhuma pendência de moderação!</h3>
        <p style="font-size:13px;color:#64748b;margin-top:6px">
          Todas as postagens e comentários enviados pelo PC ou Mobile já foram revisados.
        </p>
      </div>
    `;
    return;
  }

  const postsSection =
    pendingPostsList.length > 0
      ? `
        <h4 style="color:#0040a1;margin-bottom:10px">Postagens Aguardando Liberação (${
          pendingPostsList.length
        })</h4>
        ${pendingPostsList
          .map((p) => {
            const pid = p.id || p._id;
            return `
              <div class="delegacia-card" style="margin-bottom:10px">
                <div>
                  <strong style="font-size:15px">${escapeHtml(p.nome)}</strong>
                  <div style="font-size:12px;color:#64748b">${
                    p.idade
                  } anos • ${escapeHtml(p.ultimaLocalidade)}</div>
                </div>
                <div style="display:flex;gap:8px">
                  <button class="btn btn-outline" onclick="closeNotificationsModal();openPostDetailModal('${pid}')">Ver</button>
                  <button class="btn btn-success" onclick="changePostStatus('${pid}', 'Aprovada')">Aprovar</button>
                  <button class="btn btn-danger" onclick="changePostStatus('${pid}', 'Recusada')">Recusar</button>
                </div>
              </div>
            `;
          })
          .join("")}
      `
      : "";

  const commentsSection =
    pendingCommentsList.length > 0
      ? `
        <h4 style="color:#0040a1;margin:18px 0 10px">Comentários Aguardando Liberação (${
          pendingCommentsList.length
        })</h4>
        ${pendingCommentsList
          .map(
            (c, idx) => `
            <div class="delegacia-card" style="margin-bottom:10px">
              <div>
                <strong style="font-size:13px">${escapeHtml(
                  c.autor
                )}</strong>
                <div style="font-size:13px;color:#334155;font-style:italic;margin-top:3px">"${escapeHtml(
                  c.texto
                )}"</div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn btn-success" onclick="moderateCommentByIndex(${idx}, 'Aprovada')">Liberar</button>
                <button class="btn btn-danger" onclick="moderateCommentByIndex(${idx}, 'Recusada')">Recusar</button>
              </div>
            </div>
          `
          )
          .join("")}
      `
      : "";

  body.innerHTML = postsSection + commentsSection;
}

async function moderateCommentByIndex(idx, novoStatus) {
  const c = pendingCommentsList[idx];
  if (!c) return;
  try {
    const payload = {
      id: c.id,
      postagemId: c.postagemId,
      mensagem: JSON.stringify({
        texto: c.texto,
        autor: c.autor,
        status: novoStatus,
        data: c.data || new Date().toISOString(),
      }),
    };
    const res = await apiRequest("/comentario", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      await refreshAllData(false);
      renderNotificationsModalContent();
    }
  } catch {
    alert("Erro ao moderar comentário.");
  }
}

// ============================================================================
// 10. MODAL DE LOGIN E CADASTRO
// ============================================================================

function openAuthModal(mode = "login") {
  document.getElementById("auth-modal").classList.add("open");
  switchAuthMode(mode);
}

function closeAuthModal() {
  document.getElementById("auth-modal").classList.remove("open");
}

function switchAuthMode(mode) {
  const isLogin = mode === "login";
  document.getElementById("login-form").style.display = isLogin
    ? "block"
    : "none";
  document.getElementById("register-form").style.display = isLogin
    ? "none"
    : "block";
  document.getElementById("tab-btn-login").className = isLogin
    ? "btn btn-primary"
    : "btn btn-outline";
  document.getElementById("tab-btn-register").className = !isLogin
    ? "btn btn-primary"
    : "btn btn-outline";
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const btn = document.getElementById("login-submit-btn");
  btn.disabled = true;
  btn.textContent = "Conectando...";

  try {
    const res = await rawFetchWithFallback("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const data = await res.json();
      userToken = data.token;
      localStorage.setItem("cra_user_token", userToken);
      await loadCurrentUser();
      closeAuthModal();
      await refreshAllData(false);
    } else {
      alert("E-mail ou senha inválidos.");
    }
  } catch {
    alert("Erro ao conectar ao servidor.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar na Conta";
  }
}

async function handleRegisterSubmit(event) {
  event.preventDefault();
  const username = document.getElementById("reg-username").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const cpf = document.getElementById("reg-cpf").value.replace(/\D/g, "");
  const telefone = document
    .getElementById("reg-telefone")
    .value.replace(/\D/g, "");
  const password = document.getElementById("reg-password").value;

  const btn = document.getElementById("reg-submit-btn");
  btn.disabled = true;
  btn.textContent = "Criando conta...";

  try {
    const res = await rawFetchWithFallback("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, cpf, telefone, password }),
    });
    if (res.ok) {
      alert("Conta criada com sucesso! Faça seu login agora.");
      switchAuthMode("login");
      document.getElementById("login-email").value = email;
    } else {
      alert(
        "Não foi possível criar a conta. Verifique se o e-mail ou CPF já estão em uso."
      );
    }
  } catch {
    alert("Erro ao registrar conta.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Criar Minha Conta";
  }
}

// ============================================================================
// 11. NAVEGAÇÃO ENTRE ABAS E INICIALIZAÇÃO
// ============================================================================

function switchTab(tabName) {
  ["feed", "map", "report", "profile"].forEach((t) => {
    document
      .getElementById(`tab-${t}`)
      ?.classList.toggle("active", t === tabName);
    document
      .getElementById(`nav-${t}`)
      ?.classList.toggle("active", t === tabName);
    document
      .getElementById(`mnav-${t}`)
      ?.classList.toggle("active", t === tabName);
  });

  if (tabName === "map") {
    initDesktopMap();
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

window.addEventListener("DOMContentLoaded", async () => {
  const hoje = new Date();
  const dd = String(hoje.getDate()).padStart(2, "0");
  const mm = String(hoje.getMonth() + 1).padStart(2, "0");
  const yyyy = hoje.getFullYear();
  const dataInput = document.getElementById("report-data");
  if (dataInput) dataInput.value = `${dd}/${mm}/${yyyy}`;

  await loadCurrentUser();
  await refreshAllData(false);

  setInterval(() => {
    if (!document.hidden) {
      refreshAllData(false);
    }
  }, 45000);
});
