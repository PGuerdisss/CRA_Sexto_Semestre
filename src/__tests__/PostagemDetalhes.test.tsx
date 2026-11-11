import React from "react";
import { Alert } from "react-native";
import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { PostagemDetalhes } from "../app/PostagemDetalhes";
import { AuthContext } from "../contexts/AuthContext";
import { service } from "../services/api";

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockPostagemInicial = {
  id: "post-99",
  nome: "Beatriz Souza",
  idade: 8,
  ultimaLocalidade: "Pinheiros, São Paulo - SP",
  cep: "05422-000",
  fotoPerfil: "https://exemplo.com/beatriz.jpg",
  informacoesAdicionais: "Usava mochila rosa",
  data: "2026-11-02T12:00:00Z",
  status: "Aprovada",
  usuarioPostagem: { id: "u2", nome: "Fernanda Souza", email: "fe@cra.com" },
};

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({
    params: {
      id: "post-99",
      postagem: mockPostagemInicial,
    },
  }),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

jest.mock("expo-font", () => ({
  useFonts: () => [true],
}));

jest.mock("react-native-gesture-handler", () => {
  const { ScrollView } = require("react-native");
  return { ScrollView };
});

jest.mock("react-native-safe-area-context", () => {
  const { View } = require("react-native");
  return { SafeAreaView: View };
});

jest.mock("../components/Header", () => {
  const { Text } = require("react-native");
  return { Header: () => <Text>CRA Header</Text> };
});

jest.mock("@expo/vector-icons", () => {
  const { Text } = require("react-native");
  return {
    Ionicons: ({ name }: { name: string }) => <Text>{name}</Text>,
    MaterialIcons: ({ name }: { name: string }) => <Text>{name}</Text>,
  };
});

jest.mock("../services/api", () => ({
  service: {
    getPostagensById: jest.fn(),
    getComentariosByPostagemId: jest.fn(),
    criarComentario: jest.fn(),
    moderarComentario: jest.fn(),
    mudarStatusPostagem: jest.fn(),
  },
}));

describe("Tela <PostagemDetalhes />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
    (service.getPostagensById as jest.Mock).mockResolvedValue(
      mockPostagemInicial
    );
    (service.getComentariosByPostagemId as jest.Mock).mockResolvedValue([
      {
        id: "c-aprovado",
        postagemId: "post-99",
        texto: "Avistada perto da praça às 15h",
        autor: "Marcos",
        status: "Aprovada",
        data: "2026-11-03T15:00:00Z",
      },
      {
        id: "c-pendente",
        postagemId: "post-99",
        texto: "Possível pista aguardando moderação",
        autor: "Julia",
        status: "Pendente",
        data: "2026-11-03T16:00:00Z",
      },
    ]);
  });

  // CT-16: Renderização de Detalhes e Filtro de Comentários para Visitante
  it("CT-16: deve exibir os dados do caso, ocultar comentários pendentes para visitantes e mostrar aviso de login", async () => {
    const { getByText, queryByText } = render(
      <AuthContext.Provider value={{ userToken: null, setUserToken: jest.fn() }}>
        <PostagemDetalhes />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(getByText("Beatriz Souza")).toBeTruthy();
      expect(getByText("8 anos")).toBeTruthy();
      expect(getByText("Usava mochila rosa")).toBeTruthy();
      expect(getByText("Faça login para comentar")).toBeTruthy();
      expect(getByText("Avistada perto da praça às 15h")).toBeTruthy();
      expect(queryByText("Possível pista aguardando moderação")).toBeNull();
    });
  });

  // CT-17: Envio de Comentário por Usuário Autenticado (Caminho Feliz)
  it("CT-17: deve permitir que um usuário logado envie uma nova pista para moderação", async () => {
    (service.criarComentario as jest.Mock).mockResolvedValueOnce(undefined);

    const loggedUser = {
      id: "u-10",
      username: "PedroQA",
      email: "pedro@cra.com",
      roles: [{ name: "USER", description: "Usuário" }],
    };

    const { getByPlaceholderText, getByText } = render(
      <AuthContext.Provider
        value={{ userToken: loggedUser, setUserToken: jest.fn() }}
      >
        <PostagemDetalhes />
      </AuthContext.Provider>
    );

    const inputComentario = await waitFor(() =>
      getByPlaceholderText(
        "Você viu essa pessoa ou tem alguma informação? Escreva aqui..."
      )
    );

    fireEvent.changeText(inputComentario, "Vi na estação Pinheiros agora");
    fireEvent.press(getByText("Enviar"));

    await waitFor(() => {
      expect(service.criarComentario).toHaveBeenCalledWith(
        "post-99",
        "Vi na estação Pinheiros agora",
        "PedroQA"
      );
      expect(Alert.alert).toHaveBeenCalledWith(
        "Comentário Enviado!",
        expect.stringContaining("enviado para moderação")
      );
    });
  });

  // CT-18: Painel de Moderação Exclusivo do Administrador
  it("CT-18: deve exibir painel de gerenciamento de alerta e permitir aprovar comentários pendentes quando for ADMIN", async () => {
    const adminUser = {
      id: "admin-1",
      username: "AdminCRA",
      email: "admin@cra.com",
      roles: [{ name: "ADMIN", description: "Administrador" }],
    };

    const { getByText } = render(
      <AuthContext.Provider
        value={{ userToken: adminUser, setUserToken: jest.fn() }}
      >
        <PostagemDetalhes />
      </AuthContext.Provider>
    );

    await waitFor(() => {
      expect(getByText("GERENCIAMENTO DO ALERTA (ADMIN)")).toBeTruthy();
      expect(getByText("Possível pista aguardando moderação")).toBeTruthy();
      expect(getByText("Liberar Comentário")).toBeTruthy();
    });

    fireEvent.press(getByText("Liberar Comentário"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Moderação de Comentário",
      "Deseja realmente liberar este comentário?",
      expect.any(Array)
    );
  });
});

