# Documentação Técnica: Conecta Sistemas

## Arquitetura
O projeto utiliza uma adaptação do **Clean Architecture** para garantir alta manutenibilidade e baixo acoplamento:
- `/src/app`: Camada de Apresentação (Telas) baseada em Expo Router.
- `/src/components`: Componentes visuais reutilizáveis (UI Layer).
- `/src/domain`: Regras de negócio, entidades e casos de uso isolados.
- `/src/services`: Camada de integração (APIs, banco de dados local, etc).
- `/src/ui/themes`: Definição de tokens de design e variáveis CSS/temas.

## Tecnologias
- **Framework:** Expo (React Native) + Expo Router.
- **Linguagem:** TypeScript para tipagem forte.
- **Estilização:** NativeWind (Tailwind CSS) e suporte a design systems como Gluestack.
- **Ícones:** Lucide React Native.

## Restrições e Padrões de Código
- **Tamanho de Arquivo:** Nenhum arquivo deve ultrapassar 300 linhas.
- **Responsabilidade Única:** Cada componente ou função deve ter apenas um propósito.
- **Animações:** Utilizar `react-native-reanimated` para garantir fluidez (estilo iOS).
