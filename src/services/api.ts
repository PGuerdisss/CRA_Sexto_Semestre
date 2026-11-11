import axios from "axios";
import { LoginForm } from "../app/Login";
import * as SecureStore from "expo-secure-store";
import { AuthContext } from "../contexts/AuthContext";
import { useContext } from "react";
import { Postagem } from "../components/Postagens";
import { PostagemRequest } from "../components/Formulario";
import { RegisterForm } from "../app/Register";

const API_URL = (
  process.env.API_URL || "https://deploy-backend-5-semestre.onrender.com"
).replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

let guestTokenMemory: string | null = null;

async function getGuestToken(): Promise<string | null> {
  if (guestTokenMemory) {
    return guestTokenMemory;
  }
  try {
    const stored = await SecureStore.getItemAsync("guest_token");
    if (stored) {
      guestTokenMemory = stored;
      return stored;
    }
  } catch {}

  try {
    const response = await axios.post<LoginResponse>(
      `${API_URL}/auth/login`,
      {
        email: "visitante@cra.com",
        password: "visitante123",
      },
      { timeout: 15000 }
    );
    if (response.data?.token) {
      guestTokenMemory = response.data.token;
      await SecureStore.setItemAsync("guest_token", response.data.token);
      return response.data.token;
    }
  } catch (err) {
    try {
      await axios.post(
        `${API_URL}/auth/register`,
        {
          username: "visitante",
          password: "visitante123",
          email: "visitante@cra.com",
          cpf: "00000000000",
          telefone: "11999999999",
        },
        { timeout: 15000 }
      );
      const res2 = await axios.post<LoginResponse>(
        `${API_URL}/auth/login`,
        {
          email: "visitante@cra.com",
          password: "visitante123",
        },
        { timeout: 15000 }
      );
      if (res2.data?.token) {
        guestTokenMemory = res2.data.token;
        await SecureStore.setItemAsync("guest_token", res2.data.token);
        return res2.data.token;
      }
    } catch {
      // Ignora erro caso não consiga criar
    }
  }
  return null;
}

type LoginResponse = {
  token: string;
  type: string;
  username: string;
  email: string;
  roles: string[];
};

type Role = {
  name: string;
  description: string;
};

export type UserMeResponse = {
  id: string;
  username: string;
  email: string;
  roles: Role[];
};

api.interceptors.request.use(async (config) => {
  // 1. Tenta pegar o token do usuário logado
  const token = await SecureStore.getItemAsync("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  }

  // 2. Se for requisição GET de postagens ou comentários e não houver usuário logado,
  // utiliza o token de visitante para liberar a leitura pelo Spring Security
  const isPublicGet =
    (config.url?.includes("/postagem") || config.url?.includes("/comentario")) &&
    config.method?.toLowerCase() === "get";

  if (isPublicGet) {
    const guestToken = await getGuestToken();
    if (guestToken) {
      config.headers.Authorization = `Bearer ${guestToken}`;
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isPublicGet =
      (originalRequest?.url?.includes("/postagem") ||
        originalRequest?.url?.includes("/comentario")) &&
      originalRequest?.method?.toLowerCase() === "get";

    // Se o erro foi 401 ou 403 em leitura pública, tenta com o guest_token
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      !originalRequest._retry &&
      isPublicGet
    ) {
      originalRequest._retry = true;
      guestTokenMemory = null;
      try {
        await SecureStore.deleteItemAsync("guest_token");
      } catch {}
      const newToken = await getGuestToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

async function login(dados: LoginForm): Promise<string> {
  try {
    const response = await api.post<LoginResponse>("/auth/login", dados);
    await SecureStore.setItemAsync("token", response.data.token);
    return response.data.token;
  } catch (error) {
    throw error;
  }
}

async function mudarStatusPostagem(status: string, id: string): Promise<void> {
  try {
    const url = `/postagem/status/${id}`;
    const response = await api.patch<String>(url, { status: status });
    console.log(response.status);
  } catch (error) {
    throw error;
  }
}

async function register(dados: RegisterForm): Promise<void> {
  try {
    const response = await api.post("/auth/register", dados);
  } catch (error) {
    throw error;
  }
}

const LEGACY_DELETED_POST_IDS = new Set([
  "6adbfe897772a7145afe2af0",
  "6adc0c9001616d0070de8922",
  "6adc1f1a4109842fe2c85681",
  "6adc26657af6f34a8f6bd1e8",
  "6aef940bf634ce4d488e7d3c",
]);

function filterLegacyPosts(posts: Postagem[]): Postagem[] {
  if (!Array.isArray(posts)) return posts;
  return posts.filter((p) => {
    const id = p?.id || (p as any)?._id;
    if (id && LEGACY_DELETED_POST_IDS.has(String(id))) return false;
    if (!p?.nome || String(p.nome).trim() === "") return false;
    if (p.status === "Excluida") return false;
    return true;
  });
}

async function getPostagensAprovadas() {
  try {
    const response = await api.get<Postagem[]>("/postagem?status=Aprovada");
    const filtered = filterLegacyPosts(response.data || []);
    console.log(filtered);

    return filtered;
  } catch (error) {
    throw error;
  }
}

async function getTodasPostagens() {
  try {
    const response = await api.get<Postagem[]>("/postagem");
    const filtered = filterLegacyPosts(response.data);
    console.log(filtered);

    return filtered;
  } catch (error) {
    throw error;
  }
}

async function getSelfUser() {
  try {
    const response = await api.get<UserMeResponse>("/auth/me");

    return response.data;
  } catch (error) {
    throw error;
  }
}

async function getPostagensById(id: string) {
  try {
    const response = await api.get<Postagem>(`/postagem/${id}`);

    return response.data;
  } catch (error) {
    throw error;
  }
}

async function criarPostagem(postagem: PostagemRequest) {
  try {
    const response = await api.post("/postagem", postagem);
  } catch (error) {
    throw error;
  }
}

export type ComentarioFormatado = {
  id: string;
  postagemId: string;
  texto: string;
  autor: string;
  status: "Pendente" | "Aprovada" | "Recusada";
  data?: string;
};

async function getComentariosByPostagemId(
  postagemId: string
): Promise<ComentarioFormatado[]> {
  try {
    const response = await api.get<any[]>(`/comentario/${postagemId}`);
    if (!Array.isArray(response.data)) return [];

    return response.data.map((c) => {
      let texto = c.mensagem || "";
      let autor = "Membro da Comunidade";
      let status: "Pendente" | "Aprovada" | "Recusada" = "Aprovada";
      let data = "";

      try {
        if (typeof c.mensagem === "string" && c.mensagem.trim().startsWith("{")) {
          const parsed = JSON.parse(c.mensagem);
          texto = parsed.texto || texto;
          autor = parsed.autor || autor;
          status = parsed.status || status;
          data = parsed.data || data;
        }
      } catch {}

      return {
        id: c.id || c._id,
        postagemId: c.postagemId || postagemId,
        texto,
        autor,
        status,
        data,
      };
    }).filter((c) => Boolean(c.texto && c.texto.trim().length > 0));
  } catch (error: any) {
    if (error.response?.status === 404) {
      return [];
    }
    console.log("Erro ao buscar comentários da postagem:", error?.message);
    return [];
  }
}

async function criarComentario(
  postagemId: string,
  texto: string,
  autor: string
): Promise<void> {
  try {
    const payload = {
      postagemId,
      mensagem: JSON.stringify({
        texto,
        autor,
        status: "Pendente",
        data: new Date().toISOString(),
      }),
    };
    await api.post("/comentario", payload);
  } catch (error) {
    throw error;
  }
}

async function moderarComentario(
  comentario: ComentarioFormatado,
  novoStatus: "Aprovada" | "Recusada"
): Promise<void> {
  try {
    const payload = {
      id: comentario.id,
      postagemId: comentario.postagemId,
      mensagem: JSON.stringify({
        texto: comentario.texto,
        autor: comentario.autor,
        status: novoStatus,
        data: comentario.data || new Date().toISOString(),
      }),
    };
    await api.post("/comentario", payload);
  } catch (error) {
    throw error;
  }
}

async function getComentariosPendentes(): Promise<ComentarioFormatado[]> {
  try {
    const postagens = await getTodasPostagens();
    if (!postagens || !Array.isArray(postagens)) return [];

    const todosComentarios: ComentarioFormatado[] = [];
    for (const post of postagens) {
      const postId = post.id || (post as any)._id;
      if (!postId) continue;
      const comentarios = await getComentariosByPostagemId(postId);
      const pendentes = comentarios.filter((c) => c.status === "Pendente");
      todosComentarios.push(...pendentes);
    }
    return todosComentarios;
  } catch (err) {
    console.log("Erro ao carregar comentários pendentes:", err);
    return [];
  }
}

export const service = {
  login,
  register,
  getPostagensAprovadas,
  criarPostagem,
  getPostagensById,
  getSelfUser,
  mudarStatusPostagem,
  getTodasPostagens,
  getComentariosByPostagemId,
  criarComentario,
  moderarComentario,
  getComentariosPendentes,
};

