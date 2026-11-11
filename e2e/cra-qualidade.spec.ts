import { test, expect } from "@playwright/test";

// ============================================================================
// MASSA DE DADOS SIMULADA (MOCKS) PARA TESTES DE QUALIDADE E2E (PLAYWRIGHT)
// ============================================================================

const MOCK_POSTAGENS_APROVADAS = [
  {
    id: "post-aprovado-1",
    nome: "Gabriel Henrique",
    idade: 8,
    ultimaLocalidade: "Rua Manoel Amaral, Centro, Diadema - SP",
    data: "2026-11-01",
    status: "Aprovada",
    fotoPerfil: "https://via.placeholder.com/300",
    informacoesAdicionais:
      "Criança vista pela última vez usando camiseta verde, bermuda jeans e tênis branco.",
    usuarioPostagem: {
      id: "user-1",
      nome: "João Silva",
      email: "joao@email.com",
    },
  },
  {
    id: "post-aprovado-2",
    nome: "Isabela Fernandes",
    idade: 10,
    ultimaLocalidade: "Rua Washington Luiz, Centro, Diadema - SP",
    data: "2026-10-30",
    status: "Aprovada",
    fotoPerfil: "https://via.placeholder.com/300",
    informacoesAdicionais:
      "Desapareceu próxima à praça central no período da tarde.",
    usuarioPostagem: {
      id: "user-2",
      nome: "Maria Fernandes",
      email: "maria@email.com",
    },
  },
];

const MOCK_POSTAGEM_PENDENTE = {
  id: "post-pendente-3",
  nome: "Raquel Oliveira",
  idade: 10,
  ultimaLocalidade:
    "Rua Doutor Carlos de Rezende Enout, Parque Doroteia, São Paulo - SP",
  data: "2026-10-08",
  status: "Pendente",
  fotoPerfil: "https://via.placeholder.com/300",
  informacoesAdicionais: "Usava mochila escolar rosa.",
  usuarioPostagem: {
    id: "user-cidadao",
    nome: "Pedro Cidadão",
    email: "pedro@cra.com",
  },
};

const MOCK_COMENTARIOS = [
  {
    id: "com-1",
    postagemId: "post-aprovado-1",
    mensagem: JSON.stringify({
      texto: "Vi uma criança com essas características perto do terminal.",
      autor: "Carlos Morador",
      status: "Aprovada",
      data: "2026-11-07T14:00:00.000Z",
    }),
  },
  {
    id: "com-2",
    postagemId: "post-aprovado-1",
    mensagem: JSON.stringify({
      texto: "Informação aguardando checagem do administrador.",
      autor: "Ana Souza",
      status: "Pendente",
      data: "2026-11-07T15:30:00.000Z",
    }),
  },
];

test.describe("Suíte E2E de Qualidade de Software — Sistema CRA (Playwright)", () => {
  // Configuração base dos interceptadores da API antes de cada cenário
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener("DOMContentLoaded", () => {
        if (typeof (window as any).L === "undefined") {
          (window as any).L = {
            map: () => ({
              setView: function () {
                return this;
              },
              invalidateSize: () => {},
              removeLayer: () => {},
              fitBounds: () => {},
            }),
            tileLayer: () => ({ addTo: () => {} }),
            layerGroup: () => ({
              addTo: function () {
                return this;
              },
              clearLayers: () => {
                const mapEl = document.getElementById("desktop-map");
                if (mapEl) mapEl.innerHTML = "";
              },
              addLayer: (marker: any) => {
                const mapEl = document.getElementById("desktop-map");
                if (mapEl && marker?.html) {
                  const div = document.createElement("div");
                  div.innerHTML = marker.html;
                  mapEl.appendChild(div);
                }
              },
            }),
            divIcon: (opts: any) => opts,
            marker: (_coords: any, opts: any) => ({
              html: opts?.icon?.html || "",
              bindPopup: function () {
                return this;
              },
            }),
            circle: () => ({ addTo: () => ({}) }),
          };
        }
      });
    });

    await page.route("**/api/auth/login", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.email === "visitante@cra.com") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            token: "fake-guest-jwt-token",
            username: "visitante",
            email: "visitante@cra.com",
            roles: ["USER"],
          }),
        });
      }
      if (body?.email === "admin@cra.com" && body?.password === "admin123") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            token: "fake-admin-jwt-token",
            username: "Admin CRA",
            email: "admin@cra.com",
            roles: ["ADMIN"],
          }),
        });
      }
      if (body?.email === "cidadao@cra.com" && body?.password === "123456") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            token: "fake-user-jwt-token",
            username: "Pedro Cidadão",
            email: "cidadao@cra.com",
            roles: ["USER"],
          }),
        });
      }
      return route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Credenciais inválidas" }),
      });
    });

    await page.route("**/api/auth/me", async (route) => {
      const auth = route.request().headers()["authorization"] || "";
      if (auth.includes("fake-admin-jwt-token")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "admin-1",
            username: "Admin CRA",
            email: "admin@cra.com",
            roles: [{ name: "ADMIN", description: "Administrador" }],
          }),
        });
      }
      if (auth.includes("fake-user-jwt-token")) {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "user-cidadao",
            username: "Pedro Cidadão",
            email: "cidadao@cra.com",
            roles: [{ name: "USER", description: "Usuário Cadastrado" }],
          }),
        });
      }
      return route.fulfill({ status: 401, body: "{}" });
    });

    await page.route(/\/api\/postagem/, async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === "GET") {
        if (url.includes("status=Aprovada")) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(MOCK_POSTAGENS_APROVADAS),
          });
        }
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            ...MOCK_POSTAGENS_APROVADAS,
            MOCK_POSTAGEM_PENDENTE,
          ]),
        });
      }

      if (method === "POST") {
        const payload = route.request().postDataJSON();
        // Valida se a data foi normalizada para ISO YYYY-MM-DD
        if (!/^\d{4}-\d{2}-\d{2}$/.test(payload?.data || "")) {
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ detail: "Failed to read request" }),
          });
        }
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            ...payload,
            id: "novo-post-id",
            status: "Pendente",
          }),
        });
      }

      if (method === "PATCH") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify("Status atualizado"),
        });
      }

      return route.continue();
    });

    await page.route(/\/api\/comentario/, async (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(MOCK_COMENTARIOS),
        });
      }
      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }
      return route.continue();
    });
  });

  // ==========================================================================
  // E2E-01: Adequação Funcional — Listagem de Alertas Aprovados e Filtro de Busca
  // ==========================================================================
  test("E2E-01: Deve renderizar apenas postagens aprovadas no feed público e filtrar por busca em tempo real", async ({
    page,
  }) => {
    await page.goto("/");

    // Verifica título principal e cabeçalho limpo
    await expect(page.locator("#topbar-title")).toHaveText(
      "Alertas Ativos na Comunidade"
    );

    // Verifica que apenas os 2 casos aprovados aparecem para o público (e o Pendente 'Raquel Oliveira' permanece oculto)
    await expect(page.locator(".post-card")).toHaveCount(2);
    await expect(page.getByText("Gabriel Henrique")).toBeVisible();
    await expect(page.getByText("Isabela Fernandes")).toBeVisible();
    await expect(page.getByText("Raquel Oliveira")).toHaveCount(0);

    // Testa filtro de busca por nome
    const searchInput = page.locator("#feed-search-input");
    await searchInput.fill("Isabela");
    await expect(page.locator(".post-card")).toHaveCount(1);
    await expect(page.getByText("Isabela Fernandes")).toBeVisible();
  });

  // ==========================================================================
  // E2E-02: Segurança e Controle de Acesso — Bloqueio de Visitante ao Reportar Caso
  // ==========================================================================
  test("E2E-02: Deve bloquear o formulário de cadastro para Visitante e exigir autenticação", async ({
    page,
  }) => {
    await page.goto("/");

    // Clica na aba "Reportar Desaparecimento" como Visitante (desconectado)
    await page.locator("#nav-report").click();

    // Verifica que o aviso de Identificação Necessária está visível e o formulário oculto
    const guestWarning = page.locator("#report-guest-warning");
    const formWrapper = page.locator("#report-form-wrapper");

    await expect(guestWarning).toBeVisible();
    await expect(guestWarning).toContainText("Identificação Necessária");
    await expect(guestWarning).toContainText(
      "Só é possível cadastrar um alerta de desaparecimento caso você esteja conectado"
    );
    await expect(formWrapper).toBeHidden();
  });

  // ==========================================================================
  // E2E-03: Usabilidade — Login de Usuário Cadastrado e Guia de Boletim de Ocorrência (Lei 11.259/05)
  // ==========================================================================
  test("E2E-03: Deve autenticar Usuário Cadastrado (Não-Admin), liberar formulário e exibir Auxílio de B.O. e Delegacia Próxima", async ({
    page,
  }) => {
    await page.goto("/");

    // Abre modal de login e autentica como Cidadão comum
    await page.locator("#sidebar-auth-btn").click();
    await page.locator("#login-email").fill("cidadao@cra.com");
    await page.locator("#login-password").fill("123456");
    await page.locator("#login-submit-btn").click();

    // Verifica identificação na barra lateral
    await expect(page.locator("#sidebar-user-name")).toHaveText(
      "Pedro Cidadão"
    );
    await expect(page.locator("#sidebar-user-role")).toHaveText(
      "Usuário Cadastrado"
    );

    // Verifica que na aba Reportar o formulário agora está liberado
    await page.locator("#nav-report").click();
    await expect(page.locator("#report-form-wrapper")).toBeVisible();
    await expect(page.locator("#report-guest-warning")).toBeHidden();

    // Navega para Meu Perfil & Auxílio B.O.
    await page.locator("#nav-profile").click();
    const boPanel = page.locator("#profile-bo-assistant");
    await expect(boPanel).toBeVisible();
    await expect(boPanel).toContainText("Lei da Busca Imediata");
    await expect(boPanel).toContainText("11.259/2005");
    await expect(
      boPanel.getByRole("button", {
        name: /Localizar Delegacias Próximas de Mim/i,
      })
    ).toBeVisible();
  });

  // ==========================================================================
  // E2E-04: Confiabilidade e Moderação — Fluxo de Administrador (Aprovar, Finalizar e Excluir Para Sempre)
  // ==========================================================================
  test("E2E-04: Deve exibir para o Admin os botões corretos conforme o status (Aprovar/Reprovar vs Encontrada/Finalizar) e permitir exclusão permanente", async ({
    page,
  }) => {
    await page.goto("/");

    // Autentica como Administrador
    await page.locator("#sidebar-auth-btn").click();
    await page.locator("#login-email").fill("admin@cra.com");
    await page.locator("#login-password").fill("admin123");
    await page.locator("#login-submit-btn").click();

    await expect(page.locator("#sidebar-user-role")).toHaveText(
      "Administrador CRA"
    );

    // O Admin visualiza todas as 3 postagens (2 Aprovadas + 1 Pendente)
    await expect(page.locator(".post-card")).toHaveCount(3);

    // Verifica que na postagem APROVADA ('Gabriel Henrique') aparecem 'Encontrada' e 'Finalizar Caso'
    const cardAprovado = page
      .locator(".post-card")
      .filter({ hasText: "Gabriel Henrique" });
    await expect(
      cardAprovado.getByRole("button", { name: /Encontrada/i })
    ).toBeVisible();
    await expect(
      cardAprovado.getByRole("button", { name: /Finalizar Caso/i })
    ).toBeVisible();
    await expect(
      cardAprovado.getByRole("button", { name: /Apagar Postagem Para Sempre/i })
    ).toBeVisible();

    // Verifica que na postagem PENDENTE ('Raquel Oliveira') aparecem 'Aprovar' e 'Reprovar'
    const cardPendente = page
      .locator(".post-card")
      .filter({ hasText: "Raquel Oliveira" });
    await expect(
      cardPendente.getByRole("button", { name: /Aprovar/i })
    ).toBeVisible();
    await expect(
      cardPendente.getByRole("button", { name: /Reprovar/i })
    ).toBeVisible();
    await expect(
      cardPendente.getByRole("button", { name: /Apagar Postagem Para Sempre/i })
    ).toBeVisible();

    // Verifica que na área de Perfil do Admin NÃO aparece o bloco de usuário comum de B.O.
    await page.locator("#nav-profile").click();
    await expect(page.locator("#profile-bo-assistant")).toBeHidden();
  });

  // ==========================================================================
  // E2E-05: Interoperabilidade — Detalhes do Caso, Comentários Moderados e Mapa Interativo
  // ==========================================================================
  test("E2E-05: Deve abrir detalhes da postagem, exibir apenas comentários aprovados para o público e carregar o Mapa de Casos", async ({
    page,
  }) => {
    await page.goto("/");

    // Abre detalhes do primeiro card
    await page
      .locator(".post-card")
      .filter({ hasText: "Gabriel Henrique" })
      .getByRole("button", { name: /Ver Detalhes e Comentários/i })
      .click();

    const modal = page.locator("#post-detail-modal");
    await expect(modal).toHaveClass(/open/);

    // Verifica que o comentário Aprovado aparece e o Pendente fica retido na moderação
    await expect(
      modal.getByText(
        "Vi uma criança com essas características perto do terminal."
      )
    ).toBeVisible();
    await expect(
      modal.getByText("Informação aguardando checagem do administrador.")
    ).toHaveCount(0);

    // Fecha modal e abre a aba do Mapa Interativo
    await modal.getByRole("button", { name: /Fechar/i }).click();
    await page.locator("#nav-map").click();

    await expect(page.locator("#desktop-map")).toBeVisible();
    await expect(page.locator(".custom-Case-pin")).toHaveCount(2);
  });
});

