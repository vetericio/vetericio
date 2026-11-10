# Organograma da equipe ORICSE

```mermaid
flowchart TD
    A[Direção do ORICSE<br/>Proprietário] --> B[Henrique<br/>Orquestrador e Produto]

    B --> C[João<br/>Design e UX/UI]
    B --> D[Lucas<br/>Engenharia de Software]
    B --> E[Rafael<br/>Segurança e Privacidade]
    B --> F[André<br/>Arquitetura de Dados]
    B --> G[Pedro<br/>Qualidade e QA]
    B --> H[Gabriel<br/>Infraestrutura e DevOps]
    B --> I[Marina<br/>Financeiro e Pagamentos]
    B --> J[Dra. Camila<br/>Processos Veterinários]
    B --> K[Bianca<br/>Marketing e Crescimento]
    B --> L[Sofia<br/>Suporte e Documentação]

    C -. especificações visuais .-> D
    J -. validação de fluxos .-> D
    D -. código para testes .-> G
    D -. revisão de segurança .-> E
    D -. dependências de dados .-> F
    I -. regras financeiras .-> D
    G -. gate de qualidade .-> H
    E -. gate de segurança .-> H
    H -. release e rollback .-> B
    H -. interface publicada .-> L
    L -. feedback e documentação .-> B
    K -. métricas e demandas .-> B
```

## Hierarquia

1. **Direção do ORICSE** — define estratégia, prioridades e aprovações de alto risco.
2. **Henrique** — transforma objetivos em tarefas, coordena especialistas, resolve dependências e consolida releases.
3. **Especialistas** — executam suas áreas com autonomia dentro das permissões e limites definidos.

## Núcleos de trabalho

| Núcleo | Agentes | Resultado principal |
|---|---|---|
| Produto e experiência | Henrique, João, Dra. Camila, Sofia | Requisitos, interface, fluxos e documentação |
| Engenharia e dados | Lucas, André | Código, APIs, banco e integrações |
| Confiabilidade | Rafael, Pedro, Gabriel | Segurança, testes, deploy e recuperação |
| Negócio e crescimento | Marina, Bianca | Pagamentos, receita, marketing e aquisição |

## Fluxo padrão

Direção solicita → Henrique distribui → especialistas executam → Pedro testa → Rafael verifica segurança → Gabriel publica ou reverte → Henrique reporta o resultado.

Henrique pode interromper tarefas conflitantes. Rafael pode bloquear uma entrega insegura. Operações irreversíveis, financeiras críticas, clínicas ou de exposição de dados exigem aprovação da Direção.

