import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { service } from "../services/api";

jest.mock("axios", () => {
  const mockAxiosInstance = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => mockAxiosInstance),
      post: jest.fn(),
    },
  };
});

jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedAxios = axios.create() as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
};

describe("Service API (api.ts)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // CT-01: Login (Caminho Feliz)
  it("CT-01: deve autenticar o usuário com sucesso e salvar o token no SecureStore", async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        token: "jwt-token-valido-123",
        type: "Bearer",
        username: "pedro",
        email: "pedro@cra.com",
        roles: ["USER"],
      },
    });

    const token = await service.login({
      email: "pedro@cra.com",
      password: "Password@123",
    });

    expect(mockedAxios.post).toHaveBeenCalledWith("/auth/login", {
      email: "pedro@cra.com",
      password: "Password@123",
    });
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "token",
      "jwt-token-valido-123"
    );
    expect(token).toBe("jwt-token-valido-123");
  });

  // CT-02: Login (Tratamento de Erro)
  it("CT-02: deve propagar erro quando as credenciais de login forem inválidas (401)", async () => {
    const authError = new Error("Request failed with status code 401");
    mockedAxios.post.mockRejectedValueOnce(authError);

    await expect(
      service.login({ email: "errado@cra.com", password: "123" })
    ).rejects.toThrow("Request failed with status code 401");
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });

  // CT-03: Listagem de Postagens Aprovadas
  it("CT-03: deve buscar apenas as postagens com status Aprovada", async () => {
    const mockPostagens = [
      { id: "1", nome: "Lucas Silva", idade: 9, status: "Aprovada" },
    ];
    mockedAxios.get.mockResolvedValueOnce({ data: mockPostagens });

    const resultado = await service.getPostagensAprovadas();

    expect(mockedAxios.get).toHaveBeenCalledWith("/postagem?status=Aprovada");
    expect(resultado).toEqual(mockPostagens);
  });

  // CT-04: Criação de Postagem e Alteração de Status
  it("CT-04: deve criar uma nova postagem e permitir alterar o status pelo admin", async () => {
    mockedAxios.post.mockResolvedValueOnce({ status: 201 });
    mockedAxios.patch.mockResolvedValueOnce({ status: 200 });

    const novaPostagem = {
      nome: "Ana Clara",
      idade: 7,
      cep: "01310-100",
      ultimaLocalidade: "Av. Paulista, São Paulo - SP",
      fotoPerfil: "https://supabase.co/storage/foto.jpg",
      informacoesAdicionais: "Vestia camiseta azul",
      data: new Date("2026-10-15"),
    };

    await service.criarPostagem(novaPostagem);
    expect(mockedAxios.post).toHaveBeenCalledWith("/postagem", novaPostagem);

    await service.mudarStatusPostagem("Encontrado", "post-123");
    expect(mockedAxios.patch).toHaveBeenCalledWith(
      "/postagem/status/post-123",
      { status: "Encontrado" }
    );
  });

  // CT-05: Busca e Formatação de Comentários (JSON estruturado)
  it("CT-05: deve fazer o parse corretamente de comentários salvos em JSON na mensagem", async () => {
    const rawComments = [
      {
        id: "c1",
        postagemId: "post-1",
        mensagem: JSON.stringify({
          texto: "Vi próximo à estação de metrô",
          autor: "Maria Oliveira",
          status: "Pendente",
          data: "2026-11-05T14:00:00.000Z",
        }),
      },
    ];
    mockedAxios.get.mockResolvedValueOnce({ data: rawComments });

    const comentarios = await service.getComentariosByPostagemId("post-1");

    expect(mockedAxios.get).toHaveBeenCalledWith("/comentario/post-1");
    expect(comentarios).toHaveLength(1);
    expect(comentarios[0]).toEqual({
      id: "c1",
      postagemId: "post-1",
      texto: "Vi próximo à estação de metrô",
      autor: "Maria Oliveira",
      status: "Pendente",
      data: "2026-11-05T14:00:00.000Z",
    });
  });

  // CT-06: Tratamento de Erro 404 em Comentários
  it("CT-06: deve retornar lista vazia [] quando o endpoint de comentários retornar 404", async () => {
    mockedAxios.get.mockRejectedValueOnce({
      response: { status: 404 },
      message: "Not Found",
    });

    const comentarios = await service.getComentariosByPostagemId("post-inexistente");
    expect(comentarios).toEqual([]);
  });

  // CT-07: Criação e Moderação de Comentários
  it("CT-07: deve enviar novo comentário como Pendente e permitir moderar para Aprovada", async () => {
    mockedAxios.post.mockResolvedValue({ status: 200 });

    await service.criarComentario("post-1", "Nova pista importante", "João");

    expect(mockedAxios.post).toHaveBeenCalledWith(
      "/comentario",
      expect.objectContaining({
        postagemId: "post-1",
        mensagem: expect.stringContaining('"status":"Pendente"'),
      })
    );

    await service.moderarComentario(
      {
        id: "c1",
        postagemId: "post-1",
        texto: "Nova pista importante",
        autor: "João",
        status: "Pendente",
      },
      "Aprovada"
    );

    expect(mockedAxios.post).toHaveBeenLastCalledWith(
      "/comentario",
      expect.objectContaining({
        id: "c1",
        postagemId: "post-1",
        mensagem: expect.stringContaining('"status":"Aprovada"'),
      })
    );
  });
});

