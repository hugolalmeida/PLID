# Lembrete - Melhorias de E-mail

Objetivo: melhorar qualidade e confiabilidade dos e-mails de notificacao antes de abrir producao para todo o time.

## Melhorias recomendadas
1. Template HTML responsivo (hoje esta em texto simples).
2. Assunto mais contextual:
   - Nome da atividade
   - Data de vencimento
   - Organizacao
3. Link direto para a tarefa no sistema (quando houver URL publica).
4. Separar tipo de e-mail por prioridade:
   - lembrete 2 dias
   - vencida ha 2 dias
5. Adicionar identificador de mensagem no payload para evitar reenvio duplicado.
6. Criar rotina de retentativa para status `failed` (ex.: 1x apos 30 min).
7. Criar visao de observabilidade:
   - taxa de envio (`sent`)
   - falhas por motivo (`dispatch_error`)
   - tempo medio entre `queued` e `sent`

## Status atual
- Envio real via Gmail API esta funcionando.
- Fila manual em `/notifications` e job automatico em `/api/jobs/notifications`.
