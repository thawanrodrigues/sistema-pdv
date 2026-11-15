# Regras do Projeto: Conecta Sistemas

## Princípios de Desenvolvimento
- **Clean Code:** Seguir rigorosamente os princípios de Robert C. Martin.
- **Clean Architecture:** Manter a separação clara de responsabilidades entre as camadas (Presentation, Domain, Service, UI).
- **Single Responsibility:** Cada componente ou função deve ter apenas uma responsabilidade.

## Restrições Técnicas
- **Limite de Linhas:** Nenhum arquivo deve ultrapassar **300 linhas**. Se ultrapassar, deve ser refatorado em arquivos menores.
- **TypeScript:** Uso obrigatório de TypeScript com tipagem estrita sempre que possível.
- **Expo Router:** Todas as rotas devem ser gerenciadas pelo Expo Router na pasta `/src/app`.
- **Estilização:** Uso de NativeWind (Tailwind CSS) e Gluestack UI para componentes visuais.
- **Temas:** Cores e estilos globais devem ser gerenciados pelo sistema de tema em `/src/ui/themes`.

## UX/UI
- **Animações:** Uso de `react-native-reanimated` para transições fluidas e micro-interações estilo iOS.
- **Identidade:** Nome do sistema é **CONECTA SISTEMAS** com letras brancas no dashboard principal.
