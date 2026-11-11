import React from "react";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Postagens, Postagem } from "../components/Postagens";
import { AuthContext } from "../contexts/AuthContext";
import { service } from "../services/api";

jest.mock("../services/api", () => ({
  service: {
    getPostagensAprovadas: jest.fn(),
    getTodasPostagens: jest.fn(),
  },
}));

jest.mock("../components/PostagemItem", () => {
  const { Text } = require("react-native");
  return {
    PostagemItem: ({ item }: { item: Postagem }) => (
      <Text testID={`postagem-item-${item.id}`}>{item.nome}</Text>
    ),
  };
});

jest.mock("../components/TitulosPostagens", () => {
  const { Text } = require("react-native");
  return {
    TitulosPostagens: () => <Text>Alertas Ativos</Text>,
  };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

const mockPostagensList: Postagem[] = [
  {
    id: "101",
    nome: "Gabriel Santos",
    idade: 10,
    ultimaLocalidade: "Centro, São Paulo - SP",
    fotoPerfil: "https://exemplo.com/foto1.jpg",
    informacoesAdicionais: "Visto próximo à escola",
    data: "2026-11-01T10:00:00Z",
    status: "Aprovada",
    usuarioPostagem: { id: "u1", nome: "Carlos", email: "carlos@cra.com" },
  },
];

describe("Componente <Postagens />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // CT-08: Estado Inicial de Carregamento (Renderização)
  it("CT-08: deve exibir o indicador de carregamento ao iniciar a busca de postagens", () => {
    (service.getPostagensAprovadas as jest.Mock).mockReturnValue(
      new Promise(() => {})
    );

    const { getByText } = render(
      <AuthContext.Provider value={{ userToken: null, setUserToken: jest.fn() }}>
        <Postagens />
      </AuthContext.Provider>
    );

    expect(getByText("Carregando postagens...")).toBeTruthy();
    expect(getByText("Conectando aos servidores do CRA...")).toBeTruthy();
  });

  // CT-09: Renderização de Postagens para Usuário Comum (Caminho Feliz)
  it("CT-09: deve chamar getPostagensAprovadas e renderizar a lista para usuário comum ou visitante", async () => {
    (service.getPostagensAprovadas as jest.Mock).mockResolvedValueOnce(
      mockPostagensList
    );

    const { getByText } = render(
      <AuthContext.Provider value={{ userToken: null, setUserToken: jest.fn() }}>
        <Postagens />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(service.getPostagensAprovadas).toHaveBeenCalledTimes(1);
      expect(getByText("Gabriel Santos")).toBeTruthy();
    });
  });

  // CT-10: Renderização de Todas as Postagens para Perfil ADMIN
  it("CT-10: deve chamar getTodasPostagens quando o usuário logado possuir role ADMIN", async () => {
    (service.getTodasPostagens as jest.Mock).mockResolvedValueOnce(
      mockPostagensList
    );

    const adminUser = {
      id: "admin-1",
      username: "admin",
      email: "admin@cra.com",
      roles: [{ name: "ADMIN", description: "Administrador" }],
    };

    const { getByText } = render(
      <AuthContext.Provider
        value={{ userToken: adminUser, setUserToken: jest.fn() }}
      >
        <Postagens />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(service.getTodasPostagens).toHaveBeenCalledTimes(1);
      expect(getByText("Gabriel Santos")).toBeTruthy();
    });
  });

  // CT-11: Estado Vazio e Interação com Botão Recarregar (Erro / Fallback)
  it("CT-11: deve exibir mensagem de lista vazia quando a API falhar e permitir recarregar", async () => {
    (service.getPostagensAprovadas as jest.Mock)
      .mockRejectedValueOnce(new Error("Erro de rede"))
      .mockResolvedValueOnce(mockPostagensList);

    const { getByText } = render(
      <AuthContext.Provider value={{ userToken: null, setUserToken: jest.fn() }}>
        <Postagens />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(getByText("Nenhuma postagem ativa")).toBeTruthy();
    });

    const botaoRecarregar = getByText("Recarregar");
    fireEvent.press(botaoRecarregar);

    await waitFor(() => {
      expect(service.getPostagensAprovadas).toHaveBeenCalledTimes(2);
      expect(getByText("Gabriel Santos")).toBeTruthy();
    });
  });
});

