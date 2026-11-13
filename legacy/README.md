# Protótipos anteriores

Esta pasta preserva as duas interfaces usadas como referência na evolução do projeto. O portal atual é [frontend/](../frontend/README.md).

| Pasta | Conteúdo | Uso |
| --- | --- | --- |
| [web/](web/) | Aplicação estática anterior, com service worker e conteúdo AgroSponge | Consulta histórica; contém a proposta antiga do saco de gel. |
| [dashboard/](dashboard/README.md) | Primeiro dashboard React com dados fictícios | Referência de interface e simulação. |

O frontend atual não importa arquivos destas pastas. Novas telas e integrações devem ser desenvolvidas em `frontend/`.

Para consultar a aplicação estática, na raiz do repositório:

```bash
python3 -m http.server 8080 --bind 127.0.0.1 --directory legacy/web
```

Abra http://localhost:8080. Os caminhos internos do site foram preservados. Configurações antigas de hospedagem permanecem para referência; a reorganização local não altera publicações existentes.

O bot em `bot/` ainda contém mensagens e links da proposta anterior. Sua adaptação ao contrato atual é tarefa do Dev 2, descrita no [aceite do backend](../backend/ENTREGA-FINAL-BACKEND.md).
