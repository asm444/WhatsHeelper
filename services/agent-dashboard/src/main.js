// ===================================================================
// Amaral AllSuport - Painel do Atendente
// Main JavaScript (Vanilla)
// ===================================================================

// --- Configuration ---
const CONFIG = {
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3003',
  apiUrl: import.meta.env.VITE_DASHBOARD_API_URL || 'http://localhost:3003',
  refreshInterval: 30000,    // Auto-refresh every 30s
  reconnectDelay: 3000,      // WS reconnect delay
  maxReconnectDelay: 30000,  // Max reconnect delay (backoff)
  slaUpdateInterval: 1000,   // SLA countdown every 1s
  toastDuration: 5000,       // Toast visible for 5s
};

// --- State ---
const state = {
  tickets: [],
  selectedTicketId: null,
  selectedTicketMessages: [],
  ws: null,
  reconnectAttempts: 0,
  refreshTimer: null,
  slaTimer: null,
  newTicketCount: 0,
  filters: {
    status: '',
    priority: '',
  },
};

// --- Priority / Status maps (PT-BR) ---
const PRIORITY_LABELS = {
  critical: 'Critico',
  high: 'Alto',
  medium: 'Medio',
  low: 'Baixo',
};

const PRIORITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const STATUS_LABELS = {
  open: 'Aberto',
  assigned: 'Atribuído',
  in_progress: 'Em andamento',
  resolved: 'Resolvido',
  closed: 'Fechado',
};

const SENDER_LABELS = {
  customer: 'Cliente',
  bot: 'Bot',
  agent: 'Atendente',
};

const CATEGORY_LABELS = {
  hardware: 'Hardware',
  software: 'Software',
  rede: 'Rede',
  conta: 'Conta',
  faturamento: 'Faturamento',
};

// --- DOM References ---
const dom = {};

function cacheDom() {
  dom.connectionStatus = document.getElementById('connectionStatus');
  dom.notificationBadge = document.getElementById('notificationBadge');
  dom.notificationBell = document.getElementById('notificationBell');
  dom.ticketCount = document.getElementById('ticketCount');
  dom.ticketList = document.getElementById('ticketList');
  dom.emptyState = document.getElementById('emptyState');
  dom.filterStatus = document.getElementById('filterStatus');
  dom.filterPriority = document.getElementById('filterPriority');

  dom.noTicketSelected = document.getElementById('noTicketSelected');
  dom.ticketDetail = document.getElementById('ticketDetail');
  dom.detailTicketId = document.getElementById('detailTicketId');
  dom.detailCategory = document.getElementById('detailCategory');
  dom.detailPriority = document.getElementById('detailPriority');
  dom.detailStatus = document.getElementById('detailStatus');
  dom.detailCustomer = document.getElementById('detailCustomer');
  dom.detailCreatedAt = document.getElementById('detailCreatedAt');
  dom.detailSLA = document.getElementById('detailSLA');
  dom.detailReason = document.getElementById('detailReason');
  dom.detailSummaryText = document.getElementById('detailSummaryText');
  dom.detailKeyPoints = document.getElementById('detailKeyPoints');
  dom.detailSeverityReason = document.getElementById('detailSeverityReason');
  dom.detailRiskFactors = document.getElementById('detailRiskFactors');
  dom.detailRiskFactorsEmpty = document.getElementById('detailRiskFactorsEmpty');
  dom.detailEscalationContext = document.getElementById('detailEscalationContext');
  dom.messageList = document.getElementById('messageList');
  dom.statusSelect = document.getElementById('statusSelect');
  dom.btnUpdateStatus = document.getElementById('btnUpdateStatus');

  dom.composerDisabled = document.getElementById('composerDisabled');
  dom.composer = document.getElementById('composer');
  dom.messageInput = document.getElementById('messageInput');
  dom.charCount = document.getElementById('charCount');
  dom.btnSend = document.getElementById('btnSend');
  dom.btnClear = document.getElementById('btnClear');
  dom.quickResponseList = document.getElementById('quickResponseList');

  dom.toastContainer = document.getElementById('toastContainer');
  dom.mobileToggle = document.getElementById('mobileToggle');
  dom.panelLeft = document.getElementById('panelLeft');
  dom.panelRight = document.getElementById('panelRight');
}

// ===================================================================
// WebSocket Connection
// ===================================================================

function connectWebSocket() {
  updateConnectionStatus('connecting');

  try {
    state.ws = new WebSocket(CONFIG.wsUrl);
  } catch (err) {
    console.error('Erro ao criar WebSocket:', err);
    updateConnectionStatus('disconnected');
    scheduleReconnect();
    return;
  }

  state.ws.onopen = () => {
    console.log('WebSocket conectado');
    state.reconnectAttempts = 0;
    updateConnectionStatus('connected');
    showNotification('Conectado ao servidor em tempo real.', 'success');
  };

  state.ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      handleWebSocketMessage(data);
    } catch (err) {
      console.warn('Mensagem WS inválida:', err);
    }
  };

  state.ws.onclose = (event) => {
    console.log('WebSocket desconectado:', event.code, event.reason);
    updateConnectionStatus('disconnected');
    scheduleReconnect();
  };

  state.ws.onerror = (err) => {
    console.error('Erro no WebSocket:', err);
    updateConnectionStatus('disconnected');
  };
}

function scheduleReconnect() {
  state.reconnectAttempts++;
  const delay = Math.min(
    CONFIG.reconnectDelay * Math.pow(1.5, state.reconnectAttempts - 1),
    CONFIG.maxReconnectDelay
  );
  console.log(`Reconectando em ${Math.round(delay / 1000)}s (tentativa ${state.reconnectAttempts})`);
  setTimeout(connectWebSocket, delay);
}

function updateConnectionStatus(status) {
  const dot = dom.connectionStatus.querySelector('.status-dot');
  const text = dom.connectionStatus.querySelector('.status-text');

  dot.className = 'status-dot ' + status;

  const labels = {
    connected: 'Conectado',
    disconnected: 'Desconectado',
    connecting: 'Conectando...',
  };
  text.textContent = labels[status] || 'Desconhecido';
}

function handleWebSocketMessage(data) {
  const { event, ticket, message: wsMessage } = data;

  switch (event) {
    case 'ticket.created': {
      if (ticket) {
        const existingIndex = state.tickets.findIndex((t) => t.id === ticket.id);
        if (existingIndex === -1) {
          state.tickets.unshift(ticket);
          state.newTicketCount++;
          updateNotificationBadge();
          showNotification(`Novo ticket: ${truncate(ticket.summary || ticket.category, 60)}`, 'info');
        }
        renderTicketList(getFilteredTickets());
      }
      break;
    }
    case 'ticket.updated': {
      if (ticket) {
        const idx = state.tickets.findIndex((t) => t.id === ticket.id);
        if (idx !== -1) {
          state.tickets[idx] = { ...state.tickets[idx], ...ticket };
        }
        renderTicketList(getFilteredTickets());
        if (state.selectedTicketId === ticket.id) {
          renderTicketDetail(state.tickets.find((t) => t.id === ticket.id), state.selectedTicketMessages);
        }
      }
      break;
    }
    case 'message.new': {
      if (wsMessage && state.selectedTicketId === wsMessage.ticketId) {
        state.selectedTicketMessages.push(wsMessage);
        renderMessages(state.selectedTicketMessages);
      }
      break;
    }
    default:
      console.log('Evento WS desconhecido:', event, data);
  }
}

// ===================================================================
// REST API
// ===================================================================

async function apiFetch(path, options = {}) {
  const url = `${CONFIG.apiUrl}${path}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const res = await fetch(url, {
    ...options,
    headers: { ...defaultHeaders, ...options.headers },
  });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${errorBody}`);
  }
  return res.json();
}

async function fetchTickets(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.priority) params.set('priority', filters.priority);
  const query = params.toString() ? `?${params.toString()}` : '';

  try {
    const data = await apiFetch(`/tickets${query}`);
    return Array.isArray(data) ? data : data.tickets || [];
  } catch (err) {
    console.error('Erro ao buscar tickets:', err);
    return [];
  }
}

async function fetchTicketDetail(id) {
  try {
    const [ticket, messagesData] = await Promise.all([
      apiFetch(`/tickets/${id}`),
      apiFetch(`/tickets/${id}/messages`).catch(() => []),
    ]);
    const messages = Array.isArray(messagesData) ? messagesData : messagesData.messages || [];
    return { ticket: ticket.ticket || ticket, messages };
  } catch (err) {
    console.error('Erro ao buscar detalhes do ticket:', err);
    showNotification('Erro ao carregar detalhes do ticket.', 'error');
    return null;
  }
}

async function sendAgentMessage(ticketId, text) {
  try {
    const data = await apiFetch(`/tickets/${ticketId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: text, sender: 'agent' }),
    });
    return data;
  } catch (err) {
    console.error('Erro ao enviar mensagem:', err);
    showNotification('Erro ao enviar mensagem. Tente novamente.', 'error');
    throw err;
  }
}

async function updateTicketStatus(ticketId, newStatus) {
  try {
    const data = await apiFetch(`/tickets/${ticketId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: newStatus }),
    });
    showNotification(`Status atualizado para: ${STATUS_LABELS[newStatus] || newStatus}`, 'success');
    return data;
  } catch (err) {
    console.error('Erro ao atualizar status:', err);
    showNotification('Erro ao atualizar status do ticket.', 'error');
    throw err;
  }
}

// ===================================================================
// Rendering: Ticket List
// ===================================================================

function getFilteredTickets() {
  let filtered = [...state.tickets];

  if (state.filters.status) {
    filtered = filtered.filter((t) => t.status === state.filters.status);
  }
  if (state.filters.priority) {
    filtered = filtered.filter((t) => t.priority === state.filters.priority);
  }

  // Sort by priority (critical first), then by creation date (newest first)
  filtered.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9;
    const pb = PRIORITY_ORDER[b.priority] ?? 9;
    if (pa !== pb) return pa - pb;
    return new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0);
  });

  return filtered;
}

function renderTicketList(tickets) {
  dom.ticketCount.textContent = tickets.length;

  if (tickets.length === 0) {
    dom.ticketList.innerHTML = '';
    dom.ticketList.appendChild(createEmptyState());
    return;
  }

  // Build all cards
  const fragment = document.createDocumentFragment();
  tickets.forEach((ticket) => {
    fragment.appendChild(createTicketCard(ticket));
  });

  dom.ticketList.innerHTML = '';
  dom.ticketList.appendChild(fragment);
}

function createEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.innerHTML = `
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/>
      <rect x="9" y="3" width="6" height="4" rx="2"/>
    </svg>
    <p>Nenhum ticket encontrado</p>
    <span class="empty-hint">Ajuste os filtros ou aguarde novos tickets</span>
  `;
  return div;
}

function createTicketCard(ticket) {
  const card = document.createElement('div');
  const priority = ticket.priority || 'medium';
  const status = ticket.status || 'open';
  const isActive = ticket.id === state.selectedTicketId;

  card.className = `ticket-card priority-${priority}${isActive ? ' active' : ''}`;
  card.dataset.ticketId = ticket.id;

  const createdAt = ticket.createdAt || ticket.created_at;
  const timeStr = createdAt ? formatTimeAgo(createdAt) : '-';
  const slaStr = ticket.slaDeadline || ticket.sla_deadline;
  const slaInfo = slaStr ? getSLAInfo(slaStr) : { text: '-', class: '' };
  const shortId = ticket.id ? `#${ticket.id.substring(0, 8)}` : '#---';
  const summary = ticket.summary || `Ticket - ${ticket.category || 'sem categoria'}`;
  const customer = ticket.phone || ticket.customer?.phone || '-';
  const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category || '-';

  card.innerHTML = `
    <div class="ticket-card-header">
      <span class="ticket-card-id">${shortId}</span>
      <span class="ticket-card-time">${timeStr}</span>
    </div>
    <div class="ticket-card-summary">${escapeHtml(summary)}</div>
    <div class="ticket-card-footer">
      <div class="ticket-card-badges">
        <span class="badge badge-priority-${priority}">${PRIORITY_LABELS[priority] || priority}</span>
        <span class="badge badge-status-${status}">${STATUS_LABELS[status] || status}</span>
      </div>
    </div>
    <div class="ticket-card-footer" style="margin-top: 6px">
      <span class="ticket-card-customer">${escapeHtml(customer)} &middot; ${escapeHtml(categoryLabel)}</span>
      <span class="ticket-card-sla ${slaInfo.class}">${slaInfo.text}</span>
    </div>
  `;

  card.addEventListener('click', () => onTicketClick(ticket.id));

  return card;
}

// ===================================================================
// Rendering: Ticket Detail
// ===================================================================

function renderTicketDetail(ticket, messages) {
  if (!ticket) {
    dom.noTicketSelected.classList.remove('hidden');
    dom.ticketDetail.classList.add('hidden');
    dom.composerDisabled.classList.remove('hidden');
    dom.composer.classList.add('hidden');
    return;
  }

  dom.noTicketSelected.classList.add('hidden');
  dom.ticketDetail.classList.remove('hidden');
  dom.composerDisabled.classList.add('hidden');
  dom.composer.classList.remove('hidden');

  const priority = ticket.priority || 'medium';
  const status = ticket.status || 'open';
  const shortId = ticket.id ? `#${ticket.id.substring(0, 8)}` : '#---';
  const category = ticket.category || '-';
  const customer = ticket.phone || ticket.customer?.phone || '-';
  const createdAt = ticket.createdAt || ticket.created_at;
  const slaStr = ticket.slaDeadline || ticket.sla_deadline;
  const reason = ticket.escalation_reason || ticket.escalationReason || ticket.reason || '-';
  const summary = ticket.summary || '-';
  const keyPoints = ticket.keyPoints || ticket.key_points || [];

  dom.detailTicketId.textContent = shortId;

  dom.detailCategory.textContent = CATEGORY_LABELS[category] || category;
  dom.detailCategory.className = 'detail-category badge badge-category';

  dom.detailPriority.textContent = PRIORITY_LABELS[priority] || priority;
  dom.detailPriority.className = `detail-priority badge badge-priority-${priority}`;

  dom.detailStatus.textContent = STATUS_LABELS[status] || status;
  dom.detailStatus.className = `detail-status badge badge-status-${status}`;

  dom.detailCustomer.textContent = customer;
  dom.detailCreatedAt.textContent = createdAt ? formatDate(createdAt) : '-';

  if (slaStr) {
    const slaInfo = getSLAInfo(slaStr);
    dom.detailSLA.textContent = slaInfo.text;
    dom.detailSLA.className = `meta-value sla-countdown ${slaInfo.class}`;
  } else {
    dom.detailSLA.textContent = '-';
    dom.detailSLA.className = 'meta-value sla-countdown';
  }

  dom.detailReason.textContent = reason;
  dom.detailSummaryText.textContent = summary;

  // Key points
  dom.detailKeyPoints.innerHTML = '';
  if (Array.isArray(keyPoints) && keyPoints.length > 0) {
    keyPoints.forEach((point) => {
      const span = document.createElement('span');
      span.className = 'key-point';
      span.textContent = point;
      dom.detailKeyPoints.appendChild(span);
    });
  }

  // Severity reason
  const severityReason = ticket.severityReason || ticket.severity_reason;
  dom.detailSeverityReason.textContent = severityReason || '-';

  // Risk factors
  const riskFactors = ticket.riskFactors || ticket.risk_factors || [];
  dom.detailRiskFactors.innerHTML = '';
  if (Array.isArray(riskFactors) && riskFactors.length > 0) {
    riskFactors.forEach((factor) => {
      const li = document.createElement('li');
      li.textContent = factor;
      dom.detailRiskFactors.appendChild(li);
    });
    dom.detailRiskFactors.style.display = 'block';
    dom.detailRiskFactorsEmpty.style.display = 'none';
  } else {
    dom.detailRiskFactors.style.display = 'none';
    dom.detailRiskFactorsEmpty.style.display = 'inline';
  }

  // Escalation context
  const escalationContext = ticket.escalationContext || ticket.escalation_context;
  dom.detailEscalationContext.textContent = escalationContext || '-';

  // Status selector
  dom.statusSelect.value = status;

  // Render messages
  renderMessages(messages);
}

function renderMessages(messages) {
  dom.messageList.innerHTML = '';

  if (!messages || messages.length === 0) {
    dom.messageList.innerHTML = `
      <div class="empty-messages">
        <p>Nenhuma mensagem no histórico.</p>
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();
  messages.forEach((msg) => {
    fragment.appendChild(createMessageBubble(msg));
  });

  dom.messageList.appendChild(fragment);

  // Scroll to bottom
  const panel = document.getElementById('panelCenter');
  if (panel) {
    panel.scrollTop = panel.scrollHeight;
  }
}

function createMessageBubble(msg) {
  const sender = msg.sender || 'customer';
  const content = msg.content || msg.text || '';
  const time = msg.createdAt || msg.created_at || msg.timestamp;

  const div = document.createElement('div');
  div.className = `message sender-${sender}`;

  div.innerHTML = `
    <span class="message-sender-label">${SENDER_LABELS[sender] || sender}</span>
    <div class="message-bubble">${escapeHtml(content)}</div>
    <span class="message-time">${time ? formatDate(time) : ''}</span>
  `;

  return div;
}

// ===================================================================
// Event Handlers
// ===================================================================

async function onTicketClick(ticketId) {
  if (state.selectedTicketId === ticketId) return;

  state.selectedTicketId = ticketId;

  // Highlight active card
  document.querySelectorAll('.ticket-card').forEach((card) => {
    card.classList.toggle('active', card.dataset.ticketId === ticketId);
  });

  // Show loading state
  dom.noTicketSelected.classList.add('hidden');
  dom.ticketDetail.classList.remove('hidden');
  dom.detailSummaryText.textContent = 'Carregando...';
  dom.messageList.innerHTML = '<div class="empty-messages"><p>Carregando mensagens...</p></div>';

  const result = await fetchTicketDetail(ticketId);
  if (result) {
    // Update local ticket data
    const idx = state.tickets.findIndex((t) => t.id === ticketId);
    if (idx !== -1) {
      state.tickets[idx] = { ...state.tickets[idx], ...result.ticket };
    }
    state.selectedTicketMessages = result.messages;
    renderTicketDetail(result.ticket, result.messages);
  }

  // On mobile, show the right panel
  if (window.innerWidth <= 992) {
    dom.panelRight.classList.add('mobile-show');
  }
}

function onFilterChange() {
  state.filters.status = dom.filterStatus.value;
  state.filters.priority = dom.filterPriority.value;
  renderTicketList(getFilteredTickets());
}

async function onSendMessage() {
  if (!state.selectedTicketId) return;

  const text = dom.messageInput.value.trim();
  if (!text) {
    showNotification('Digite uma mensagem antes de enviar.', 'warning');
    return;
  }

  dom.btnSend.disabled = true;
  dom.btnSend.textContent = 'Enviando...';

  try {
    const result = await sendAgentMessage(state.selectedTicketId, text);

    // Add message locally for instant feedback
    const newMsg = result?.message || {
      sender: 'agent',
      content: text,
      createdAt: new Date().toISOString(),
    };
    state.selectedTicketMessages.push(newMsg);
    renderMessages(state.selectedTicketMessages);

    dom.messageInput.value = '';
    updateCharCount();
    showNotification('Mensagem enviada com sucesso.', 'success');
  } catch {
    // Error already shown by sendAgentMessage
  } finally {
    dom.btnSend.disabled = false;
    dom.btnSend.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Enviar
    `;
  }
}

async function onUpdateStatus() {
  if (!state.selectedTicketId) return;

  const newStatus = dom.statusSelect.value;

  dom.btnUpdateStatus.disabled = true;
  dom.btnUpdateStatus.textContent = 'Atualizando...';

  try {
    const result = await updateTicketStatus(state.selectedTicketId, newStatus);

    // Update local state
    const idx = state.tickets.findIndex((t) => t.id === state.selectedTicketId);
    if (idx !== -1) {
      state.tickets[idx].status = newStatus;
      renderTicketList(getFilteredTickets());

      const ticket = state.tickets[idx];
      renderTicketDetail(ticket, state.selectedTicketMessages);
    }
  } catch {
    // Error already shown
  } finally {
    dom.btnUpdateStatus.disabled = false;
    dom.btnUpdateStatus.textContent = 'Atualizar Status';
  }
}

function onQuickResponse(e) {
  const btn = e.target.closest('.quick-response-btn');
  if (!btn) return;

  const text = btn.dataset.text;
  if (text) {
    dom.messageInput.value = text;
    dom.messageInput.focus();
    updateCharCount();
  }
}

function onClearMessage() {
  dom.messageInput.value = '';
  updateCharCount();
  dom.messageInput.focus();
}

function updateCharCount() {
  const count = dom.messageInput.value.length;
  dom.charCount.textContent = `${count} caractere${count !== 1 ? 's' : ''}`;
}

function onKeyDown(e) {
  // Ctrl+Enter or Cmd+Enter to send
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    onSendMessage();
  }
}

function onMobileToggle() {
  dom.panelLeft.classList.toggle('mobile-show');
}

function onNotificationBellClick() {
  state.newTicketCount = 0;
  updateNotificationBadge();
}

// ===================================================================
// Notification Badge
// ===================================================================

function updateNotificationBadge() {
  if (state.newTicketCount > 0) {
    dom.notificationBadge.textContent = state.newTicketCount > 99 ? '99+' : state.newTicketCount;
    dom.notificationBadge.classList.remove('hidden');
  } else {
    dom.notificationBadge.classList.add('hidden');
  }
}

// ===================================================================
// Toast Notifications
// ===================================================================

function showNotification(text, type = 'info') {
  const icons = {
    info: 'i',
    success: '\u2713',
    warning: '!',
    error: '\u2717',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'i'}</div>
    <div class="toast-content">${escapeHtml(text)}</div>
    <button class="toast-close" aria-label="Fechar">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => removeToast(toast));

  dom.toastContainer.appendChild(toast);

  setTimeout(() => removeToast(toast), CONFIG.toastDuration);
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove());
}

// ===================================================================
// SLA Countdown
// ===================================================================

function getSLAInfo(slaDeadline) {
  const now = new Date();
  const deadline = new Date(slaDeadline);
  const diffMs = deadline - now;

  if (diffMs <= 0) {
    const overdue = formatDuration(Math.abs(diffMs));
    return { text: `Expirado (${overdue})`, class: 'sla-expired' };
  }

  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  let text;
  if (hours > 0) {
    text = `${hours}h ${minutes}min restantes`;
  } else {
    text = `${minutes}min restantes`;
  }

  // Determine urgency
  if (totalMinutes <= 15) {
    return { text, class: 'sla-critical' };
  } else if (totalMinutes <= 60) {
    return { text, class: 'sla-warning' };
  }

  return { text, class: 'sla-ok' };
}

function formatDuration(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes}min`;
}

function updateSLADisplays() {
  // Update ticket cards SLA
  document.querySelectorAll('.ticket-card').forEach((card) => {
    const ticketId = card.dataset.ticketId;
    const ticket = state.tickets.find((t) => t.id === ticketId);
    if (!ticket) return;

    const slaStr = ticket.slaDeadline || ticket.sla_deadline;
    if (!slaStr) return;

    const slaEl = card.querySelector('.ticket-card-sla');
    if (slaEl) {
      const slaInfo = getSLAInfo(slaStr);
      slaEl.textContent = slaInfo.text;
      slaEl.className = `ticket-card-sla ${slaInfo.class}`;
    }
  });

  // Update detail panel SLA
  if (state.selectedTicketId) {
    const ticket = state.tickets.find((t) => t.id === state.selectedTicketId);
    if (ticket) {
      const slaStr = ticket.slaDeadline || ticket.sla_deadline;
      if (slaStr) {
        const slaInfo = getSLAInfo(slaStr);
        dom.detailSLA.textContent = slaInfo.text;
        dom.detailSLA.className = `meta-value sla-countdown ${slaInfo.class}`;
      }
    }
  }
}

// ===================================================================
// Date / Utility
// ===================================================================

function formatDate(iso) {
  try {
    const date = new Date(iso);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso || '-';
  }
}

function formatTimeAgo(iso) {
  try {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'agora';
    if (diffMinutes < 60) return `${diffMinutes}min`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  } catch {
    return '-';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

// ===================================================================
// Auto-refresh
// ===================================================================

async function refreshTickets() {
  try {
    const tickets = await fetchTickets(state.filters);
    state.tickets = tickets;
    renderTicketList(getFilteredTickets());

    // If currently viewing a ticket, refresh it too
    if (state.selectedTicketId) {
      const ticket = state.tickets.find((t) => t.id === state.selectedTicketId);
      if (ticket) {
        renderTicketDetail(ticket, state.selectedTicketMessages);
      }
    }
  } catch (err) {
    console.error('Erro no auto-refresh:', err);
  }
}

function startAutoRefresh() {
  if (state.refreshTimer) clearInterval(state.refreshTimer);
  state.refreshTimer = setInterval(refreshTickets, CONFIG.refreshInterval);
}

function startSLATimer() {
  if (state.slaTimer) clearInterval(state.slaTimer);
  state.slaTimer = setInterval(updateSLADisplays, CONFIG.slaUpdateInterval);
}

// ===================================================================
// Initialization
// ===================================================================

function bindEvents() {
  dom.filterStatus.addEventListener('change', onFilterChange);
  dom.filterPriority.addEventListener('change', onFilterChange);

  dom.btnSend.addEventListener('click', onSendMessage);
  dom.btnClear.addEventListener('click', onClearMessage);
  dom.btnUpdateStatus.addEventListener('click', onUpdateStatus);

  dom.messageInput.addEventListener('input', updateCharCount);
  dom.messageInput.addEventListener('keydown', onKeyDown);

  dom.quickResponseList.addEventListener('click', onQuickResponse);

  dom.mobileToggle.addEventListener('click', onMobileToggle);
  dom.notificationBell.addEventListener('click', onNotificationBellClick);

  // Close mobile panels when clicking center
  document.getElementById('panelCenter').addEventListener('click', () => {
    dom.panelLeft.classList.remove('mobile-show');
    dom.panelRight.classList.remove('mobile-show');
  });
}

async function init() {
  cacheDom();
  bindEvents();

  // Initial data load
  showNotification('Carregando tickets...', 'info');
  const tickets = await fetchTickets();
  state.tickets = tickets;
  renderTicketList(getFilteredTickets());

  if (tickets.length > 0) {
    showNotification(`${tickets.length} ticket(s) carregado(s).`, 'success');
  }

  // Start services
  connectWebSocket();
  startAutoRefresh();
  startSLATimer();
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
