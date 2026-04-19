# Seed Visual - Dashboard (Metas + Reunioes + Atividades)

Use este script para popular dados de demonstracao e visualizar melhor o dashboard.

Pre-requisito:

- Ja existir ao menos `1` organizacao e `1` pessoa no banco.

```sql
do $$
declare
  v_org_id uuid;
  v_person_id uuid;
  v_meeting_1 uuid;
  v_meeting_2 uuid;
begin
  select id into v_org_id
  from public.organizations
  order by created_at
  limit 1;

  select id into v_person_id
  from public.people
  where active = true
  order by created_at
  limit 1;

  if v_org_id is null then
    raise exception 'Nao ha organizacoes. Crie ao menos 1 em /organizations.';
  end if;

  if v_person_id is null then
    raise exception 'Nao ha pessoas ativas. Crie ao menos 1 em /people.';
  end if;

  delete from public.tasks where title like '[VISUAL] %';
  delete from public.meetings where title like '[VISUAL] %';
  delete from public.goals where title like '[VISUAL] %';

  insert into public.meetings (title, date, notes)
  values ('[VISUAL] Reuniao de acompanhamento semanal', current_date + 2, 'Pauta de acompanhamento')
  returning id into v_meeting_1;

  insert into public.meetings (title, date, notes)
  values ('[VISUAL] Reuniao de alinhamento de lideres', current_date + 6, 'Planejamento do mes')
  returning id into v_meeting_2;

  insert into public.tasks (
    title, description, owner_person_id, organization_id, status, due_date, due_time, meeting_id
  )
  values
    ('[VISUAL] Confirmar escala da equipe', 'Consolidar nomes e confirmar disponibilidade', v_person_id, v_org_id, 'in_progress', current_date + 1, '19:30', v_meeting_1),
    ('[VISUAL] Preparar materiais da reuniao', 'Slides, pauta e acompanhamento de pendencias', v_person_id, v_org_id, 'todo', current_date + 4, '18:00', v_meeting_2),
    ('[VISUAL] Fechar relatorio mensal', 'Resumo de indicadores e proximas acoes', v_person_id, v_org_id, 'todo', current_date + 7, '20:00', null);

  insert into public.goals (
    title, description, organization_id, owner_person_id, period_start, period_end, target_value, current_value, status
  )
  values
    ('[VISUAL] Engajamento de equipe', 'Aumentar participacao nas reunioes semanais', v_org_id, v_person_id, current_date - 15, current_date + 45, 100, 58, 'active'),
    ('[VISUAL] Capacitar novos voluntarios', 'Concluir trilha de onboarding', v_org_id, v_person_id, current_date - 10, current_date + 20, 30, 9, 'at_risk');
end $$;
```

## Conferencia rapida

1. Abra `/dashboard`.
2. Verifique os blocos:
   - Proximas reunioes
   - Proximas atividades
   - Metas em foco
   - Trecho do organograma
