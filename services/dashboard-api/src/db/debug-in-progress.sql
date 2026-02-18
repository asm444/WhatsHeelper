-- 🔍 Script de Debug: Análise de Tickets em in_progress
-- Use este script para investigar o bug de transição de status

-- 1️⃣ HIPÓTESE 2: Tickets Presos em in_progress
-- ====================================================
SELECT
  'Tickets em in_progress' as categoria,
  COUNT(*) as total,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60)::numeric, 2) as media_minutos_sem_atualizacao
FROM tickets
WHERE status = 'in_progress';

-- Mostrar detalhes dos tickets presos
SELECT
  id,
  assigned_to,
  status,
  updated_at,
  NOW() - updated_at as tempo_inativo,
  (
    SELECT COUNT(*) FROM messages
    WHERE ticket_id = tickets.id
      AND created_at > NOW() - INTERVAL '5 minutes'
  ) as mensagens_ultimos_5min
FROM tickets
WHERE status = 'in_progress'
ORDER BY updated_at ASC;

-- 2️⃣ HIPÓTESE 3: Tickets que Falharam na Transição
-- ====================================================
-- Procurar por padrões anormais: status 'assigned' com múltiplas mensagens de agente
SELECT
  t.id,
  t.status,
  t.assigned_to,
  COUNT(m.id) as total_mensagens,
  SUM(CASE WHEN m.sender = 'agent' THEN 1 ELSE 0 END) as mensagens_agente,
  SUM(CASE WHEN m.sender = 'customer' THEN 1 ELSE 0 END) as mensagens_cliente,
  MAX(m.created_at) as ultima_mensagem
FROM tickets t
LEFT JOIN messages m ON t.id = m.ticket_id
WHERE t.status = 'assigned'
  AND t.assigned_to IS NOT NULL
GROUP BY t.id, t.status, t.assigned_to
HAVING SUM(CASE WHEN m.sender = 'agent' THEN 1 ELSE 0 END) > 0
ORDER BY ultima_mensagem DESC;

-- 3️⃣ HIPÓTESE 4: Tickets com updated_at Congelado
-- ====================================================
-- Tickets onde última mensagem é mais recente que updated_at (anomalia!)
SELECT
  t.id,
  t.status,
  t.updated_at,
  MAX(m.created_at) as ultima_mensagem,
  MAX(m.created_at) - t.updated_at as diferenca_suspeita,
  MAX(CASE WHEN m.sender = 'agent' THEN m.created_at END) as ultima_msg_agente
FROM tickets t
LEFT JOIN messages m ON t.id = m.ticket_id
GROUP BY t.id, t.status, t.updated_at
HAVING MAX(m.created_at) > t.updated_at + INTERVAL '1 minute'
ORDER BY diferenca_suspeita DESC;

-- 4️⃣ ANÁLISE GERAL: Distribuição de Status
-- ====================================================
SELECT
  status,
  COUNT(*) as quantidade,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentual,
  ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600)::numeric, 2) as idade_media_horas
FROM tickets
GROUP BY status
ORDER BY quantidade DESC;

-- 5️⃣ PIOR CENÁRIO: Tickets Antigos em in_progress
-- ====================================================
-- Estes são candidatos para escalação automática
SELECT
  id,
  assigned_to,
  updated_at,
  NOW() - updated_at as tempo_inativo,
  CASE
    WHEN NOW() - updated_at > INTERVAL '30 minutes' THEN 'CRÍTICO - Escalar imediatamente'
    WHEN NOW() - updated_at > INTERVAL '15 minutes' THEN 'AVISO - Verificar em breve'
    ELSE 'OK'
  END as acao_recomendada
FROM tickets
WHERE status = 'in_progress'
  AND NOW() - updated_at > INTERVAL '10 minutes'
ORDER BY updated_at ASC;

-- 6️⃣ VERIFICAÇÃO: Conta de Mudanças de Status
-- ====================================================
-- Se a lógica estiver funcionando, deve haver mais 'in_progress' que 'assigned'
WITH status_counts AS (
  SELECT status, COUNT(*) as count FROM tickets GROUP BY status
)
SELECT
  'Tickets assigned devem ser menor que in_progress' as check_name,
  CASE
    WHEN (SELECT count FROM status_counts WHERE status = 'assigned') > 0
      AND (SELECT count FROM status_counts WHERE status = 'in_progress') > 0
    THEN '✅ Distribuição normal'
    WHEN (SELECT count FROM status_counts WHERE status = 'assigned') = 0
      AND (SELECT count FROM status_counts WHERE status = 'in_progress') > 0
    THEN '✅ Transição funcionando'
    ELSE '❌ Anomalia detectada'
  END as resultado;

-- 7️⃣ DEBUG: Simulação do Comportamento da Classificação
-- ====================================================
-- Este query é executado em classify.ts
-- Deve IGNORAR tickets em in_progress
SELECT
  'Tickets que serão ignorados em in_progress' as categoria,
  COUNT(*) as ignorados
FROM tickets
WHERE status IN ('in_progress')
  AND assigned_to IS NOT NULL;

SELECT
  'Tickets que ainda podem ser reclassificados' as categoria,
  COUNT(*) as reclassificaveis
FROM tickets
WHERE status NOT IN ('closed', 'resolved', 'in_progress')
  AND assigned_to IS NOT NULL;
