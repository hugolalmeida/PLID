# Seed de Exemplo - Organograma

Nao e obrigatorio ter dados para abrir `/organograma`, mas este seed ajuda a validar a tela completa.

```sql
with presidencia as (
  insert into public.organizations (name, type)
  values ('Presidencia Geral', 'presidencia')
  returning id
),
ministerio_jovens as (
  insert into public.organizations (name, type, parent_id)
  select 'Ministerio de Jovens', 'ministerio', id
  from presidencia
  returning id
),
cargo_presidente as (
  insert into public.roles (name, organization_id, responsibilities)
  select 'Presidente', id, 'Coordenacao geral da lideranca'
  from presidencia
  returning id
),
cargo_lider_jovens as (
  insert into public.roles (name, organization_id, responsibilities)
  select 'Lider de Jovens', id, 'Planejar reunioes e acompanhar equipe'
  from ministerio_jovens
  returning id
),
pessoa_ana as (
  insert into public.people (name, email, phone, active)
  values ('Ana Souza', 'ana@igreja.org', '(11) 99999-1000', true)
  returning id
),
pessoa_bruno as (
  insert into public.people (name, email, phone, active)
  values ('Bruno Lima', 'bruno@igreja.org', '(11) 99999-2000', true)
  returning id
)
insert into public.person_roles (person_id, role_id, start_date)
select pessoa_ana.id, cargo_presidente.id, current_date - interval '120 day'
from pessoa_ana, cargo_presidente
union all
select pessoa_bruno.id, cargo_lider_jovens.id, current_date - interval '90 day'
from pessoa_bruno, cargo_lider_jovens;
```

