// ---------- MOBILE MENU ----------
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener('click', () => {
    mobileMenuToggle.classList.toggle('active');
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  });

  sidebarOverlay.addEventListener('click', () => {
    mobileMenuToggle.classList.remove('active');
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        mobileMenuToggle.classList.remove('active');
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
      }
    });
  });
}

// Verificar autenticação
(async () => {
  try {
    const res = await fetch("/api/auth/check");
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = "/login.html";
      return;
    }
  } catch {
    window.location.href = "/login.html";
    return;
  }
})();

const socket = io();

// ---------- MICRO-ANIMATIONS HELPERS ----------
function animateValue(el, start, end, duration = 600) {
  if (start === end) { el.textContent = end; return; }
  const startTime = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = Math.round(start + (end - start) * easeOut(progress));
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function animateMoneyValue(el, end, duration = 600) {
  const startTime = performance.now();
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const current = end * easeOut(progress);
    el.textContent = money(current);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function staggerItems(container, selector, delay = 60) {
  const items = container.querySelectorAll(selector);
  items.forEach((item, i) => {
    item.style.opacity = '0';
    item.style.transform = 'translateY(8px)';
    item.style.transition = `opacity 0.35s cubic-bezier(0.16,1,0.3,1) ${i * delay}ms, transform 0.35s cubic-bezier(0.16,1,0.3,1) ${i * delay}ms`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      });
    });
  });
}

// ---------- TOAST ----------
function toast(msg, isError=false){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(()=> t.className = 'toast', 3000);
}

async function api(path, options={}){
  const res = await fetch('/api' + path, {
    headers: {'Content-Type':'application/json'},
    ...options
  });
  if(!res.ok){
    const body = await res.json().catch(()=>({error:'Erro desconhecido'}));
    throw new Error(body.error || 'Erro na requisição');
  }
  if(res.status === 204) return null;
  return res.json();
}

function money(v){
  return (v||0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
}

// ---------- MODAIS GLOBAIS (ESC + clique fora) ----------
function closeTopModal() {
  const active = document.querySelectorAll('.modal-overlay.active');
  const modal = active[active.length - 1];
  if (!modal) return;
  modal.classList.remove('active');
  if (typeof modal._resolve === 'function') modal._resolve(false);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeTopModal();
});

document.addEventListener('click', (e) => {
  const target = e.target;
  if (target.classList && target.classList.contains('modal-overlay') && target.classList.contains('active')) {
    closeTopModal();
  }
});

// ---------- CONFIRMAÇÃO ESTILIZADA ----------
function confirmDialog(message, opts = {}) {
  const modal = document.getElementById('confirm-modal');
  const noBtn = document.getElementById('confirm-no');
  const yesBtn = document.getElementById('confirm-yes');
  document.getElementById('confirm-title').textContent = opts.title || 'Confirmar ação';
  document.getElementById('confirm-message').textContent = message;
  yesBtn.className = 'btn-primary' + (opts.danger === false ? '' : ' danger');
  modal.classList.add('active');
  return new Promise(resolve => {
    modal._resolve = (val) => {
      modal.classList.remove('active');
      modal._resolve = null;
      noBtn.onclick = null;
      yesBtn.onclick = null;
      resolve(val);
    };
    noBtn.onclick = () => modal._resolve(false);
    yesBtn.onclick = () => modal._resolve(true);
  });
}

// ---------- ÍCONES (SVG inline) ----------
const ICONS = {
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>',
  renew: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14"/></svg>',
  recovery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>'
};

// ---------- COPIAR CREDENCIAIS DO CLIENTE ----------
window.copyCredentials = async (id) => {
  try {
    const c = await api('/clients/' + id);
    const text = `Usuário: ${c.username || '—'}\nSenha: ${c.password || '—'}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    toast('Credenciais copiadas.');
  } catch (err) { toast(err.message, true); }
};

// ---------- LOGOUT ----------
document.getElementById('btn-logout').addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST' });
    window.location.href = '/login.html';
  } catch(err) {
    window.location.href = '/login.html';
  }
});

// ---------- NAVEGAÇÃO ----------
document.querySelectorAll('.nav-item').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    panel.classList.add('active');
    // Re-trigger panel animation
    panel.style.animation = 'none';
    panel.offsetHeight; // force reflow
    panel.style.animation = '';
    
    if(btn.dataset.tab === 'dashboard') loadDashboard();
    if(btn.dataset.tab === 'clientes') loadClients();
    if(btn.dataset.tab === 'servidores') loadServers();
    if(btn.dataset.tab === 'planos') loadPlans();
    if(btn.dataset.tab === 'financeiro') loadFinanceiro();
    if(btn.dataset.tab === 'revendedores') loadResellers();
  });
});

// ---------- DASHBOARD ----------
async function loadDashboard(){
  try{
    const d = await api('/dashboard');

    // Animate KPI values
    const activeEl = document.getElementById('stat-active');
    const expiringEl = document.getElementById('stat-expiring');
    const overdueEl = document.getElementById('stat-overdue');
    
    animateValue(activeEl, 0, d.totalActive);
    animateValue(expiringEl, 0, d.expiringSoonCount);
    animateValue(overdueEl, 0, d.expiredCount);

    // Vencimentos por período
    const periodEl = document.getElementById('projection-period-list');
    periodEl.innerHTML = d.projectionByPeriod.map(p => `
      <div class="period-item">
        <div class="period-info">
          <span class="period-label">${escapeHtml(p.label)}</span>
          <span class="period-count">${p.clientCount} cliente${p.clientCount !== 1 ? 's' : ''}</span>
        </div>
        <span class="period-value">${money(p.totalValue)}</span>
      </div>`).join('');
    staggerItems(periodEl, '.period-item');

    // Clientes vencidos
    document.getElementById('stat-expired-count').textContent = d.expiredCount;
    document.getElementById('stat-expired-revenue').textContent = money(d.expiredRevenue) + '/mês';
    const expiredEl = document.getElementById('expired-list');
    expiredEl.innerHTML = d.expiredClients.length ? d.expiredClients.map(c=>{
      const [y,m,day] = c.due_date.split('-');
      return `
        <div class="expired-item">
          <div>
            <div class="e-name">${escapeHtml(c.name)}</div>
            <div class="e-details">${escapeHtml(c.server_name || '—')} · ${escapeHtml(c.plan || '—')} · venceu ${day}/${m}/${y} · ${escapeHtml(c.username || '—')}</div>
          </div>
          <div class="e-actions">
            <span class="e-days">${c.days_expired}d vencido</span>
            <button class="btn-recovery" data-id="${c.id}" data-name="${escapeHtml(c.name)}" onclick="sendRecovery(${c.id}, this.dataset.name)">Enviar recuperação</button>
          </div>
        </div>`;
    }).join('') : '<p class="empty-msg">Nenhum cliente vencido.</p>';
    if (d.expiredClients.length) staggerItems(expiredEl, '.expired-item');

    // Lista de vencimentos
    upcomingCache = d.upcoming;
    const listEl = document.getElementById('upcoming-list');
    listEl.innerHTML = d.upcoming.length ? d.upcoming.map(c=>{
      const overdue = c.days_until_due < 0;
      const soon = !overdue && c.days_until_due <= 7;
      const cls = overdue ? 'overdue' : (soon ? 'soon' : '');
      const label = overdue ? `${Math.abs(c.days_until_due)}d atrasado` : `${c.days_until_due}d`;
      const mrrClient = c.mrr_per_client || ((c.price - (c.discount || 0)) / (c.duration_months || 1));
      return `
        <div class="upcoming-item">
          <div>
            <div class="u-name">${escapeHtml(c.name)}</div>
            <div class="u-server">${escapeHtml(c.server_name || '—')} · ${escapeHtml(c.plan || '—')} · ${money(mrrClient)}/mês</div>
          </div>
          <div class="u-actions">
            <span class="u-days ${cls}">${label}</span>
            <button class="btn-renew" data-id="${c.id}" data-name="${escapeHtml(c.name)}" onclick="renewClient(${c.id}, this.dataset.name)">Renovar</button>
          </div>
        </div>`;
    }).join('') : '<p class="empty-msg">Nenhum vencimento próximo.</p>';
    if (d.upcoming.length) staggerItems(listEl, '.upcoming-item');
  }catch(err){ toast(err.message, true); }
}

// ---------- CLIENTES ----------
let serversCache = [];
let plansCache = [];
let upcomingCache = [];

async function loadServersCache(){
  serversCache = await api('/servers');
  const filterSel = document.getElementById('filter-server');
  const modalSel = document.getElementById('client-server');
  const options = serversCache.map(s=>`<option value="${s.id}" data-cost="${s.cost}">${escapeHtml(s.name)}${s.cost > 0 ? ' - ' + money(s.cost) : ''}</option>`).join('');
  filterSel.innerHTML = '<option value="">Todos os servidores</option>' + options;
  modalSel.innerHTML = '<option value="">Nenhum</option>' + options;
}

document.getElementById('client-server').addEventListener('change', function(){
  const selected = this.options[this.selectedIndex];
  const cost = selected.dataset.cost;
  document.getElementById('server-cost-display').textContent = cost > 0 ? 'Custo mensal: ' + money(parseFloat(cost)) : '';
});

async function loadPlansCache(){
  plansCache = await api('/plans');
  const modalSel = document.getElementById('client-plan');
  const filterSel = document.getElementById('filter-plan');
  const options = plansCache.map(p=>`<option value="${escapeHtml(p.name)}" data-price="${p.price}">${escapeHtml(p.name)} - ${money(p.price)}</option>`).join('');
  modalSel.innerHTML = '<option value="">Nenhum</option>' + options;
  filterSel.innerHTML = '<option value="">Todos os planos</option>' + plansCache.map(p=>`<option value="${escapeHtml(p.name)}">${escapeHtml(p.name)}</option>`).join('');
}

document.getElementById('client-plan').addEventListener('change', function(){
  const selected = this.options[this.selectedIndex];
  const price = selected.dataset.price;
  if(price) document.getElementById('client-price').value = price;
});

// ---------- LISTAGEM DE CLIENTES (segurança + paginação) ----------
let clientsAll = [];
let clientsPage = 1;
const CLIENTS_PER_PAGE = 50;

async function loadClients(){
  const tbody = document.getElementById('clients-tbody');
  tbody.innerHTML = '<tr class="row-loading"><td colspan="13">Carregando clientes…</td></tr>';
  try{
    if(!serversCache.length) await loadServersCache();
    if(!plansCache.length) await loadPlansCache();
    const serverId = document.getElementById('filter-server').value;
    const planFilter = document.getElementById('filter-plan').value;
    const status = document.getElementById('filter-status').value;
    const params = new URLSearchParams();
    if(serverId) params.set('server_id', serverId);
    if(planFilter) params.set('plan', planFilter);
    if(status) params.set('status', status);
    const clientsRaw = await api('/clients?' + params.toString());
    const nameFilter = document.getElementById('filter-name').value.trim().toLowerCase();
    clientsAll = nameFilter ? clientsRaw.filter(c => c.name.toLowerCase().includes(nameFilter)) : clientsRaw;
    renderClientsTable();
  }catch(err){ tbody.innerHTML = ''; toast(err.message, true); }
}

function renderClientsTable(){
  const tbody = document.getElementById('clients-tbody');
  const total = clientsAll.length;
  const totalPages = Math.max(1, Math.ceil(total / CLIENTS_PER_PAGE));
  if (clientsPage > totalPages) clientsPage = totalPages;
  const start = (clientsPage - 1) * CLIENTS_PER_PAGE;
  const pageRows = clientsAll.slice(start, start + CLIENTS_PER_PAGE);

  tbody.innerHTML = pageRows.length
    ? pageRows.map(renderClientRow).join('')
    : '<tr><td colspan="13" class="empty-msg">Nenhum cliente cadastrado.</td></tr>';
  staggerItems(tbody, 'tr', 30);

  const pagEl = document.getElementById('clients-pagination');
  pagEl.innerHTML = `
    <button ${clientsPage <= 1 ? 'disabled' : ''} onclick="goClientsPage(${clientsPage - 1})">‹ Anterior</button>
    <span class="page-info">${total ? `${start + 1}–${Math.min(clientsPage * CLIENTS_PER_PAGE, total)} de ${total}` : '0 resultados'}</span>
    <button ${clientsPage >= totalPages ? 'disabled' : ''} onclick="goClientsPage(${clientsPage + 1})">Próxima ›</button>`;
  document.getElementById('clients-count').textContent = total
    ? `${total} cliente${total !== 1 ? 's' : ''}`
    : 'Nenhum cliente encontrado';
}

window.goClientsPage = (p) => { clientsPage = p; renderClientsTable(); };

function renderClientRow(c){
  const discount = c.discount || 0;
  const serverCost = c.server_cost || 0;
  const net = c.price - discount - serverCost;
  const due = c.due_date ? c.due_date.split('-').reverse().join('/') : '—';
  return `
  <tr>
    <td>${escapeHtml(c.name || '—')}</td>
    <td>${escapeHtml(c.phone || '—')}</td>
    <td>${escapeHtml(c.server_name || '—')}</td>
    <td>${c.server_cost > 0 ? money(c.server_cost) : '—'}</td>
    <td>${escapeHtml(c.plan || '—')}</td>
    <td>${money(c.price)}</td>
    <td>${discount > 0 ? '-' + money(discount) : '—'}</td>
    <td>${money(net)}</td>
    <td>${due}</td>
    <td>${escapeHtml(c.username || '—')}</td>
    <td>${c.has_password
      ? `<button class="btn-icon btn-copy" data-id="${c.id}" onclick="copyCredentials(this.dataset.id)" title="Copiar credenciais" aria-label="Copiar credenciais">${ICONS.copy}</button>`
      : '<span class="table-count">—</span>'}</td>
    <td><span class="badge ${escapeHtml(c.status)}">${escapeHtml(c.status)}</span></td>
    <td class="row-actions">
      <button class="btn-icon" data-id="${c.id}" onclick="editClient(this.dataset.id)" title="Editar" aria-label="Editar">${ICONS.edit}</button>
      <button class="btn-icon" data-id="${c.id}" data-name="${escapeHtml(c.name)}" onclick="renewClient(${c.id}, this.dataset.name)" title="Renovar" aria-label="Renovar">${ICONS.renew}</button>
      ${c.status === 'expirado' ? `<button class="btn-icon" data-id="${c.id}" data-name="${escapeHtml(c.name)}" onclick="sendRecovery(${c.id}, this.dataset.name)" title="Enviar recuperação" aria-label="Enviar recuperação">${ICONS.recovery}</button>` : ''}
      <button class="btn-icon btn-icon-danger" data-id="${c.id}" onclick="deleteClient(this.dataset.id)" title="Excluir" aria-label="Excluir">${ICONS.trash}</button>
    </td>
  </tr>`;
}

document.getElementById('filter-server').addEventListener('change', () => { clientsPage = 1; loadClients(); });
document.getElementById('filter-plan').addEventListener('change', () => { clientsPage = 1; loadClients(); });
document.getElementById('filter-status').addEventListener('change', () => { clientsPage = 1; loadClients(); });
let filterDebounce;
document.getElementById('filter-name').addEventListener('input', () => {
  clearTimeout(filterDebounce);
  filterDebounce = setTimeout(() => { clientsPage = 1; loadClients(); }, 300);
});

document.getElementById('btn-new-client').addEventListener('click', async ()=>{
  if(!serversCache.length) await loadServersCache();
  if(!plansCache.length) await loadPlansCache();
  document.getElementById('client-modal-title').textContent = 'Novo cliente';
  document.getElementById('client-id').value = '';
  document.getElementById('client-name').value = '';
  document.getElementById('client-phone').value = '';
  document.getElementById('client-server').value = '';
  document.getElementById('server-cost-display').textContent = '';
  document.getElementById('client-plan').value = '';
  document.getElementById('client-price').value = '';
  document.getElementById('client-discount').value = '';
  document.getElementById('client-due').value = '';
  document.getElementById('client-username').value = '';
  document.getElementById('client-password').value = '';
  document.getElementById('client-status').value = 'ativo';
  document.getElementById('client-modal').classList.add('active');
});

window.editClient = async (id) => {
  if(!serversCache.length) await loadServersCache();
  if(!plansCache.length) await loadPlansCache();
  const c = await api('/clients/' + id);
  document.getElementById('client-modal-title').textContent = 'Editar cliente';
  document.getElementById('client-id').value = c.id;
  document.getElementById('client-name').value = c.name;
  document.getElementById('client-phone').value = c.phone;
  document.getElementById('client-server').value = c.server_id || '';
  const serverCost = c.server_cost || 0;
  document.getElementById('server-cost-display').textContent = serverCost > 0 ? 'Custo mensal: ' + money(serverCost) : '';
  document.getElementById('client-plan').value = c.plan || '';
  document.getElementById('client-price').value = c.price || '';
  document.getElementById('client-discount').value = c.discount || '';
  document.getElementById('client-due').value = c.due_date;
  document.getElementById('client-username').value = c.username || '';
  document.getElementById('client-password').value = c.password || '';
  document.getElementById('client-status').value = c.status;
  document.getElementById('client-modal').classList.add('active');
};

window.deleteClient = async (id) => {
  if(!await confirmDialog('Excluir este cliente? Esta ação não pode ser desfeita.')) return;
  try{
    await api('/clients/' + id, {method:'DELETE'});
    toast('Cliente excluído.');
    loadClients();
  }catch(err){ toast(err.message, true); }
};

document.getElementById('client-cancel').addEventListener('click', ()=>{
  document.getElementById('client-modal').classList.remove('active');
});

document.getElementById('client-save').addEventListener('click', async ()=>{
  const id = document.getElementById('client-id').value;
  const payload = {
    name: document.getElementById('client-name').value.trim(),
    phone: document.getElementById('client-phone').value.trim(),
    server_id: document.getElementById('client-server').value || null,
    plan: document.getElementById('client-plan').value.trim(),
    price: parseFloat(document.getElementById('client-price').value) || 0,
    discount: parseFloat(document.getElementById('client-discount').value) || 0,
    due_date: document.getElementById('client-due').value,
    status: document.getElementById('client-status').value,
    username: document.getElementById('client-username').value.trim(),
    password: document.getElementById('client-password').value.trim()
  };
  if(!payload.name || !payload.phone || !payload.due_date){
    toast('Preencha nome, telefone e data de vencimento.', true);
    return;
  }
  try{
    if(id) await api('/clients/' + id, {method:'PUT', body:JSON.stringify(payload)});
    else await api('/clients', {method:'POST', body:JSON.stringify(payload)});
    document.getElementById('client-modal').classList.remove('active');
    toast('Cliente salvo.');
    loadClients();
  }catch(err){ toast(err.message, true); }
});

let renewClientCache = null;

// ---------- RENOVAÇÃO ----------
window.renewClient = async (id, name) => {
  document.getElementById('renew-client-id').value = id;
  document.getElementById('renew-client-name').textContent = `Cliente: ${name}`;
  document.getElementById('renew-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('renew-hint').textContent = '';
  renewClientCache = null;
  try {
    renewClientCache = await api(`/clients/${id}`);
  } catch (err) {
    console.error('[renew] Falha ao buscar cliente:', err.message);
  }
  document.getElementById('renew-modal').classList.add('active');
  // Dispara o preview com a data de hoje
  document.getElementById('renew-date').dispatchEvent(new Event('change'));
};

document.getElementById('renew-cancel').addEventListener('click', () => {
  document.getElementById('renew-modal').classList.remove('active');
});

document.getElementById('renew-date').addEventListener('change', function () {
  const id = document.getElementById('renew-client-id').value;
  const renewalDate = this.value;
  if (!renewalDate) return;
  const client = renewClientCache || upcomingCache.find(c => c.id === parseInt(id));
  if (!client) return;
  const plan = plansCache.find(p => p.name === client.plan);
  const months = plan ? plan.duration_months : 1;
  const renewal = new Date(renewalDate + 'T00:00:00');
  const currentDue = client.due_date ? new Date(client.due_date + 'T00:00:00') : null;
  // Regra: preserva dias restantes — usa a maior entre due_date e renewal_date
  const base = (currentDue && currentDue > renewal)
    ? new Date(currentDue.getTime())
    : new Date(renewal.getTime());
  base.setMonth(base.getMonth() + months);
  const preview = base.toISOString().slice(0, 10).split('-');
  document.getElementById('renew-hint').textContent =
    `Vencimento previsto: ${preview[2]}/${preview[1]}/${preview[0]} (${months} meses)`;
});

document.getElementById('renew-confirm').addEventListener('click', async () => {
  const id = document.getElementById('renew-client-id').value;
  const renewalDate = document.getElementById('renew-date').value;
  if (!renewalDate) { toast('Informe a data da renovação.', true); return; }
  try {
    const result = await api(`/clients/${id}/renew`, {
      method: 'POST', body: JSON.stringify({ renewal_date: renewalDate })
    });
    const newDate = result.due_date.split('-');
    toast(`Cliente renovado! Novo vencimento: ${newDate[2]}/${newDate[1]}/${newDate[0]}`);
    document.getElementById('renew-modal').classList.remove('active');
    loadDashboard();
  } catch(err) { toast(err.message, true); }
});

// ---------- SERVIDORES ----------
async function loadServers(){
  const tbody = document.getElementById('servers-tbody');
  tbody.innerHTML = '<tr class="row-loading"><td colspan="6">Carregando servidores…</td></tr>';
  try{
    const servers = await api('/servers');
    serversCache = servers;
    tbody.innerHTML = servers.length ? servers.map(s=>`
      <tr>
        <td>${escapeHtml(s.name)}</td>
        <td>${escapeHtml(s.provider || '—')}</td>
        <td>${money(s.cost)}</td>
        <td>${s.active_clients}</td>
        <td><span class="badge ${s.status === 'ativo' ? 'ativo' : 'cancelado'}">${escapeHtml(s.status)}</span></td>
        <td class="row-actions">
          <button class="btn-icon" data-id="${s.id}" onclick="editServer(${s.id})" title="Editar" aria-label="Editar">${ICONS.edit}</button>
          <button class="btn-icon btn-icon-danger" data-id="${s.id}" onclick="deleteServer(${s.id})" title="Excluir" aria-label="Excluir">${ICONS.trash}</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty-msg">Nenhum servidor cadastrado.</td></tr>';
    staggerItems(tbody, 'tr', 40);
  }catch(err){ tbody.innerHTML = ''; toast(err.message, true); }
}

document.getElementById('btn-new-server').addEventListener('click', ()=>{
  document.getElementById('server-modal-title').textContent = 'Novo servidor';
  document.getElementById('server-id').value = '';
  document.getElementById('server-name').value = '';
  document.getElementById('server-provider').value = '';
  document.getElementById('server-cost').value = '';
  document.getElementById('server-status').value = 'ativo';
  document.getElementById('server-notes').value = '';
  document.getElementById('server-modal').classList.add('active');
});

window.editServer = async (id) => {
  const s = serversCache.find(x=>x.id === id) || await api('/servers/' + id).catch(()=>null);
  if(!s) return;
  document.getElementById('server-modal-title').textContent = 'Editar servidor';
  document.getElementById('server-id').value = s.id;
  document.getElementById('server-name').value = s.name;
  document.getElementById('server-provider').value = s.provider || '';
  document.getElementById('server-cost').value = s.cost || '';
  document.getElementById('server-status').value = s.status;
  document.getElementById('server-notes').value = s.notes || '';
  document.getElementById('server-modal').classList.add('active');
};

window.deleteServer = async (id) => {
  if(!await confirmDialog('Excluir este servidor?')) return;
  try{ await api('/servers/' + id, {method:'DELETE'}); toast('Servidor excluído.'); loadServers(); }
  catch(err){ toast(err.message, true); }
};

document.getElementById('server-cancel').addEventListener('click', ()=> document.getElementById('server-modal').classList.remove('active'));

document.getElementById('server-save').addEventListener('click', async ()=>{
  const id = document.getElementById('server-id').value;
  const payload = {
    name: document.getElementById('server-name').value.trim(),
    provider: document.getElementById('server-provider').value.trim(),
    cost: parseFloat(document.getElementById('server-cost').value) || 0,
    status: document.getElementById('server-status').value,
    notes: document.getElementById('server-notes').value.trim()
  };
  if(!payload.name){ toast('Informe o nome do servidor.', true); return; }
  try{
    if(id) await api('/servers/' + id, {method:'PUT', body:JSON.stringify(payload)});
    else await api('/servers', {method:'POST', body:JSON.stringify(payload)});
    document.getElementById('server-modal').classList.remove('active');
    toast('Servidor salvo.'); loadServers(); serversCache = [];
  }catch(err){ toast(err.message, true); }
});

// ---------- PLANOS ----------
async function loadPlans(){
  const tbody = document.getElementById('plans-tbody');
  tbody.innerHTML = '<tr class="row-loading"><td colspan="6">Carregando planos…</td></tr>';
  try{
    const plans = await api('/plans');
    plansCache = plans;
    const durationLabel = (m) => m === 1 ? '1 mês' : m < 12 ? m + ' meses' : (m/12) + ' ano' + (m > 12 ? 's' : '');
    tbody.innerHTML = plans.length ? plans.map(p=>`
      <tr>
        <td>${escapeHtml(p.name)}</td><td>${money(p.price)}</td><td>${durationLabel(p.duration_months)}</td>
        <td>${p.screens || 1}</td><td>${p.active_clients}</td>
        <td class="row-actions">
          <button class="btn-icon" data-id="${p.id}" onclick="editPlan(${p.id})" title="Editar" aria-label="Editar">${ICONS.edit}</button>
          <button class="btn-icon btn-icon-danger" data-id="${p.id}" onclick="deletePlan(${p.id})" title="Excluir" aria-label="Excluir">${ICONS.trash}</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty-msg">Nenhum plano cadastrado.</td></tr>';
    staggerItems(tbody, 'tr', 40);
  }catch(err){ tbody.innerHTML = ''; toast(err.message, true); }
}

document.getElementById('btn-new-plan').addEventListener('click', ()=>{
  document.getElementById('plan-modal-title').textContent = 'Novo plano';
  document.getElementById('plan-id').value = '';
  document.getElementById('plan-name').value = '';
  document.getElementById('plan-price').value = '';
  document.getElementById('plan-duration').value = '1';
  document.getElementById('plan-screens').value = '1';
  document.getElementById('plan-modal').classList.add('active');
});

window.editPlan = async (id) => {
  const p = plansCache.find(x=>x.id === id) || await api('/plans/' + id).catch(()=>null);
  if(!p) return;
  document.getElementById('plan-modal-title').textContent = 'Editar plano';
  document.getElementById('plan-id').value = p.id;
  document.getElementById('plan-name').value = p.name;
  document.getElementById('plan-price').value = p.price || '';
  document.getElementById('plan-duration').value = p.duration_months;
  document.getElementById('plan-screens').value = p.screens || 1;
  document.getElementById('plan-modal').classList.add('active');
};

window.deletePlan = async (id) => {
  if(!await confirmDialog('Excluir este plano?')) return;
  try{ await api('/plans/' + id, {method:'DELETE'}); toast('Plano excluído.'); loadPlans(); plansCache = []; }
  catch(err){ toast(err.message, true); }
};

document.getElementById('plan-cancel').addEventListener('click', ()=> document.getElementById('plan-modal').classList.remove('active'));

document.getElementById('plan-save').addEventListener('click', async ()=>{
  const id = document.getElementById('plan-id').value;
  const payload = {
    name: document.getElementById('plan-name').value.trim(),
    price: parseFloat(document.getElementById('plan-price').value) || 0,
    duration_months: parseInt(document.getElementById('plan-duration').value) || 1,
    screens: parseInt(document.getElementById('plan-screens').value) || 1
  };
  if(!payload.name){ toast('Informe o nome do plano.', true); return; }
  try{
    if(id) await api('/plans/' + id, {method:'PUT', body:JSON.stringify(payload)});
    else await api('/plans', {method:'POST', body:JSON.stringify(payload)});
    document.getElementById('plan-modal').classList.remove('active');
    toast('Plano salvo.'); loadPlans(); plansCache = [];
  }catch(err){ toast(err.message, true); }
});

// ---------- FINANCEIRO ----------
async function loadFinanceiro(){
  try{
    const monthInput = document.getElementById('financeiro-month');
    const month = monthInput.value || new Date().toISOString().slice(0, 7);
    const [d, dash] = await Promise.all([
      api('/sales?month=' + month),
      api('/dashboard?month=' + month)
    ]);

    const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    const fmtMonthLabel = (m) => {
      const parts = MONTH_LABELS[parseInt(m.split('-')[1],10)-1];
      return `${parts} ${m.split('-')[0]}`;
    };
    const isCur = dash.isCurrentMonth;

    // KPIs Principais — dados REALIZADOS do mês selecionado
    document.getElementById('fin-revenue-label').textContent = isCur ? 'Receita do Mês' : 'Receita do mês';
    document.getElementById('fin-active-label').textContent = isCur ? 'Assinaturas Ativas' : 'Clientes Ativos no Mês';
    animateMoneyValue(document.getElementById('fin-mrr'), dash.monthlyRevenue);
    animateMoneyValue(document.getElementById('fin-net-profit'), dash.netProfit);
    document.getElementById('fin-margin').textContent = dash.profitMargin + '% margem';
    animateValue(document.getElementById('fin-active'), 0, dash.totalActive);
    animateMoneyValue(document.getElementById('fin-ticket'), dash.avgTicket);

    // Metricas de Assinatura
    document.getElementById('fin-new').textContent = dash.newClientsMonth;
    const renewalsPill = document.getElementById('fin-renewals');
    renewalsPill.textContent = `${dash.renewalsCount} · ${money(dash.renewalsRevenue)}`;
    renewalsPill.title = `${dash.renewalsCount} renovacoes neste mes — Lucro: ${money(dash.renewalsRevenue)}`;
    document.getElementById('fin-renewals-revenue').textContent = money(dash.renewalsRevenue);
    document.getElementById('fin-churn').textContent = isCur ? dash.churnRate + '%' : '—';
    document.getElementById('fin-server-cost').textContent = money(dash.monthlyServerCost);

    // Alertas (só fazem sentido no mês vigente)
    document.getElementById('fin-expiring').textContent = isCur ? dash.expiringSoonCount : '—';
    document.getElementById('fin-risk').textContent = isCur ? money(dash.revenueAtRisk) : '—';
    document.getElementById('fin-expired').textContent = isCur ? dash.expiredCount : '—';

    // Grafico de lucro liquido por mes (historico — comparacao entre meses)
    const container = document.getElementById('fin-projection-chart');
    const history = dash.profitHistory;
    const histTitle = document.getElementById('fin-projection-title');
    if (histTitle) histTitle.textContent = 'Lucro Líquido por Mês';
    if (history && history.length){
      const maxAbs = Math.max(1, ...history.map(h => Math.abs(h.netProfit)));
      const maxH = 170;
      let html = '';
      for(const h of history){
        const isSel = h.month === dash.selectedMonth;
        const isNeg = h.netProfit < 0;
        const barH = Math.max((Math.abs(h.netProfit) / maxAbs) * maxH, 4);
        html += `
          <div class="proj-bar-group${isSel ? ' selected' : ''}">
            <div class="proj-bar-value">${money(h.netProfit)}</div>
            <div class="proj-bar-stack ${isNeg ? 'negative' : ''}" style="height:${barH}px">
              <div class="proj-bar-${isNeg ? 'risk' : 'safe'}" style="height:100%"></div>
            </div>
            <div class="proj-bar-label">${fmtMonthLabel(h.month)}</div>
            <div class="proj-bar-sub">${h.countRenewals} renov. · ${money(h.totalSales)}</div>
          </div>`;
      }
      container.innerHTML = html;
      staggerItems(container, '.proj-bar-group', 80);
    } else {
      container.innerHTML = '<p class="empty-msg">Sem historico de lucro.</p>';
    }

    // Grafico de servidores
    const chartEl = document.getElementById('fin-server-chart');
    const maxCount = Math.max(1, ...dash.serverRanking.map(s=>s.client_count));
    chartEl.innerHTML = dash.serverRanking.length ? dash.serverRanking.map(s=>`
      <div class="chart-row">
        <span class="chart-label" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        <span class="chart-bar-track"><span class="chart-bar-fill" style="width:${(s.client_count/maxCount*100)}%"></span></span>
        <span class="chart-count">${s.client_count} · ${money(s.mrr)}/mês</span>
      </div>
    `).join('') : '<p class="empty-msg">Nenhum servidor cadastrado.</p>';
    staggerItems(chartEl, '.chart-row', 60);

    // Grafico de planos
    const planEl = document.getElementById('fin-plan-chart');
    const maxPlan = Math.max(1, ...dash.planDistribution.map(p=>p.count));
    planEl.innerHTML = dash.planDistribution.length ? dash.planDistribution.map(p=>`
      <div class="chart-row">
        <span class="chart-label" title="${escapeHtml(p.plan_name)}">${escapeHtml(p.plan_name)}</span>
        <span class="chart-bar-track"><span class="chart-bar-fill" style="width:${(p.count/maxPlan*100)}%"></span></span>
        <span class="chart-count">${p.count} · ${money(p.mrr)}/mês</span>
      </div>
    `).join('') : '<p class="empty-msg">Nenhum plano associado.</p>';
    staggerItems(planEl, '.chart-row', 60);

    // Lista de vendas
    const tbody = document.getElementById('fin-sales-tbody');
    tbody.innerHTML = d.sales.length ? d.sales.map(s => {
      const [y,m,day] = s.sale_date.split('-');
      const typeLabel = s.type === 'novo'
        ? '<span class="badge ativo">Novo</span>'
        : '<span class="badge" style="background:rgba(168,85,247,0.12);color:#a855f7;border:1px solid rgba(168,85,247,0.2)">Renovação</span>';
      return `
        <tr>
          <td>${day}/${m}/${y}</td>
          <td>${escapeHtml(s.client_name || '—')}</td>
          <td>${escapeHtml(s.phone || '—')}</td>
          <td>${escapeHtml(s.plan || '—')}</td>
          <td>${typeLabel}</td>
          <td>${money(s.value)}</td>
          <td><button class="btn-undo" data-id="${s.id}" data-name="${escapeHtml(s.client_name || '')}" onclick="undoSale(${s.id}, this.dataset.name)">Desfazer</button></td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty-msg">Nenhuma venda neste mês.</td></tr>';
    staggerItems(tbody, 'tr', 30);
  }catch(err){ toast(err.message, true); }
}

window.undoSale = async (id, clientName) => {
  if (!await confirmDialog(`Desfazer venda de ${clientName}? O registro será removido do financeiro.`)) return;
  try {
    await api('/sales/' + id, { method: 'DELETE' });
    toast('Venda desfeita com sucesso.');
    loadFinanceiro();
  } catch(err) { toast(err.message, true); }
};

document.getElementById('financeiro-month').addEventListener('change', loadFinanceiro);
document.getElementById('financeiro-month').value = new Date().toISOString().slice(0, 7);

// ---------- WHATSAPP ----------
function renderWaStatus(data){
  const { status, qr, phoneNumber } = data;
  const dotMap = { connected:'connected', connecting:'connecting', qr:'connecting', disconnected:'disconnected' };
  const textMap = { connected:'Conectado', connecting:'Conectando…', qr:'Aguardando leitura do QR code', disconnected:'Desconectado' };
  document.querySelectorAll('#wa-big-dot, #sidebar-wa-status .signal-dot').forEach(el=>{
    el.className = 'signal-dot ' + (dotMap[status] || 'disconnected');
  });
  document.getElementById('wa-status-text').textContent = textMap[status] || status;
  document.querySelector('#sidebar-wa-status .signal-text').textContent = textMap[status] || status;
  document.getElementById('wa-nav-dot').className = 'nav-dot' + (status === 'connected' ? ' on' : '');
  document.getElementById('wa-phone').textContent = phoneNumber ? `+${phoneNumber}` : '';
  const qrImg = document.getElementById('wa-qr-img');
  const placeholder = document.getElementById('wa-placeholder');
  if(qr){ qrImg.src = qr; qrImg.style.display = 'block'; placeholder.style.display = 'none'; }
  else { qrImg.style.display = 'none'; placeholder.style.display = 'flex'; placeholder.querySelector('p').textContent = status === 'connected' ? 'WhatsApp conectado com sucesso.' : 'Clique em "Conectar" para gerar o QR code.'; }
  document.getElementById('btn-wa-connect').style.display = status === 'connected' ? 'none' : 'inline-block';
  document.getElementById('btn-wa-disconnect').style.display = status === 'connected' ? 'inline-block' : 'none';
}

socket.on('wa:status', renderWaStatus);
// Toasts de envio real (confirmado pela fila após entrega ao WhatsApp)
socket.on('wa:message-sent', (data) => {
  const typeLabel = { reminder: 'Lembrete', recovery: 'Recuperação', post_expiry: 'Pós-vencimento', renewal: 'Renovação', welcome: 'Boas-vindas', manual: 'Mensagem' };
  toast(`✓ ${typeLabel[data.type] || 'Mensagem'} enviada para ${data.clientName}.`);
});
socket.on('wa:message-error', (data) => {
  toast(`✗ Falha ao enviar para ${data.clientName}: ${data.error}`, true);
});

document.getElementById('btn-wa-connect').addEventListener('click', async ()=>{
  try{ await api('/whatsapp/connect', {method:'POST'}); } catch(err){ toast(err.message, true); }
});
document.getElementById('btn-wa-disconnect').addEventListener('click', async ()=>{
  try{ await api('/whatsapp/disconnect', {method:'POST'}); toast('WhatsApp desconectado.'); } catch(err){ toast(err.message, true); }
});

// ---------- RECUPERAÇÃO ----------
window.sendRecovery = async (id, name) => {
  if (!await confirmDialog(`Enviar mensagem de recuperação para ${name}?`, { title: 'Enviar recuperação' })) return;
  try {
    const result = await api('/whatsapp/send-recovery', { method: 'POST', body: JSON.stringify({ client_id: id }) });
    const label = result.type === 'recovery' ? 'recuperação' : 'pós-vencimento';
    toast(`Mensagem de ${label} enfileirada para ${result.client} (${result.days_expired}d vencido).`);
    // Recarrega a aba ativa (dashboard ou clientes)
    if (typeof loadDashboard === 'function' && document.getElementById('tab-dashboard')?.classList.contains('active')) loadDashboard();
    if (typeof loadClients === 'function' && document.getElementById('tab-clientes')?.classList.contains('active')) loadClients();
  } catch(err) { toast(err.message, true); }
};

// ---------- FILA DE MENSAGENS ----------
async function loadQueue() {
  try {
    const [status, pending, history] = await Promise.all([
      api('/whatsapp/queue/status'),
      api('/whatsapp/queue'),
      api('/whatsapp/queue/history')
    ]);

    document.getElementById('queue-pending-count').textContent = status.pending || 0;
    document.getElementById('queue-sent-count').textContent = status.stats?.sent || 0;
    document.getElementById('queue-error-count').textContent = status.stats?.error || 0;

    document.getElementById('queue-pending-label').textContent = pending.length;

    const currentSection = document.getElementById('queue-current-section');
    const currentItem = document.getElementById('queue-current-item');

    if (status.current) {
      currentSection.style.display = 'block';
      currentItem.innerHTML = `
        <div class="queue-item-info">
          <div class="queue-item-phone">${escapeHtml(status.current.phone)}</div>
          <div class="queue-item-message">${escapeHtml(status.current.message)}</div>
        </div>
        <div class="queue-item-meta">
          <span class="queue-item-type ${status.current.type}">${escapeHtml(status.current.type)}</span>
          <span class="queue-item-time">enviando...</span>
        </div>
      `;
    } else {
      currentSection.style.display = 'none';
    }

    const pendingList = document.getElementById('queue-pending-list');
    if (pending.length === 0) {
      pendingList.innerHTML = '<div class="empty-queue">Nenhuma mensagem na fila</div>';
    } else {
      pendingList.innerHTML = pending.map(item => `
        <div class="queue-item" id="queue-item-${item.id}">
          <div class="queue-item-info">
            <div class="queue-item-phone">${escapeHtml(item.phone)} ${item.client_name ? '(' + escapeHtml(item.client_name) + ')' : ''}</div>
            <div class="queue-item-message">${escapeHtml(item.message)}</div>
          </div>
          <div class="queue-item-meta">
            <span class="queue-item-type ${item.type}">${escapeHtml(item.type)}</span>
            <span class="queue-item-time">${formatTime(item.created_at)}</span>
            <button class="queue-item-cancel" onclick="cancelQueueItem(${item.id})">Cancelar</button>
          </div>
        </div>
      `).join('');
      staggerItems(pendingList, '.queue-item', 40);
    }

    const historyList = document.getElementById('queue-history-list');
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-queue">Nenhum histórico de mensagens</div>';
    } else {
      historyList.innerHTML = history.map(item => `
        <div class="queue-item">
          <div class="queue-item-info">
            <div class="queue-item-phone">${escapeHtml(item.phone)} ${item.client_name ? '(' + escapeHtml(item.client_name) + ')' : ''}</div>
            <div class="queue-item-message">${escapeHtml(item.message)}</div>
          </div>
          <div class="queue-item-meta">
            <span class="queue-item-type ${item.type}">${escapeHtml(item.type)}</span>
            <span class="queue-item-status ${item.status}">${item.status === 'sent' ? 'Enviado' : item.status === 'error' ? 'Erro' : 'Cancelado'}</span>
            <span class="queue-item-time">${item.sent_at ? formatTime(item.sent_at) : ''}</span>
            ${item.error ? `<span class="queue-item-message" style="color:var(--danger);max-width:150px">${escapeHtml(item.error)}</span>` : ''}
          </div>
        </div>
      `).join('');
    }
  } catch(err) {
    console.error('Erro ao carregar fila:', err);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'Z');
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

window.cancelQueueItem = async (id) => {
  try {
    await api(`/whatsapp/queue/${id}/cancel`, { method: 'POST' });
    toast('Mensagem cancelada.');
    loadQueue();
  } catch(err) { toast(err.message, true); }
};

document.getElementById('btn-queue-refresh').addEventListener('click', loadQueue);

document.getElementById('btn-queue-cancel-all').addEventListener('click', async () => {
  if (!await confirmDialog('Cancelar todas as mensagens pendentes na fila?')) return;
  try {
    await api('/whatsapp/queue/cancel-all', { method: 'POST' });
    toast('Todas as mensagens pendentes foram canceladas.');
    loadQueue();
  } catch(err) { toast(err.message, true); }
});

document.getElementById('btn-queue-clear').addEventListener('click', async () => {
  if (!await confirmDialog('Limpar todo o histórico de mensagens?')) return;
  try {
    await api('/whatsapp/queue/clear-history', { method: 'POST' });
    toast('Histórico limpo.');
    loadQueue();
  } catch(err) { toast(err.message, true); }
});

// Atualizar fila via socket
socket.on('wa:queue-update', () => loadQueue());

// Carregar fila quando aba WhatsApp é aberta
const originalNavClick = document.querySelectorAll('.nav-item');
originalNavClick.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === 'whatsapp') {
      setTimeout(loadQueue, 100);
    }
  });
});

// ---------- SETTINGS ----------
async function loadSettings(){
  try{
    const s = await api('/settings');
    document.getElementById('reminder-days').value = s.reminder_days_before || 3;
    document.getElementById('reminder-template').value = s.reminder_message_template || '';
    document.getElementById('welcome-template').value = s.welcome_message_template || '';
    document.getElementById('recovery-template').value = s.recovery_message_template || '';
    document.getElementById('renewal-template').value = s.renewal_message_template || '';
    document.getElementById('recovery-days').value = s.recovery_days_after_expiry || 15;
    document.getElementById('recovery-batch').value = s.recovery_batch_size || 5;
    document.getElementById('recovery-interval').value = s.recovery_interval_minutes || 5;
    document.getElementById('post-expiry-days').value = s.post_expiry_days || 3;
    document.getElementById('post-expiry-template').value = s.post_expiry_message_template || '';

    // Schedule settings
    const reminderHour = s.reminder_schedule_hour || '11';
    const reminderMinute = s.reminder_schedule_minute || '30';
    document.getElementById('reminder-schedule-time').value = `${reminderHour.padStart(2, '0')}:${reminderMinute.padStart(2, '0')}`;
    document.getElementById('reminder-schedule-enabled').checked = s.reminder_schedule_enabled !== '0';

    const postExpiryHour = s.post_expiry_schedule_hour || '11';
    const postExpiryMinute = s.post_expiry_schedule_minute || '35';
    document.getElementById('post-expiry-schedule-time').value = `${postExpiryHour.padStart(2, '0')}:${postExpiryMinute.padStart(2, '0')}`;
    document.getElementById('post-expiry-schedule-enabled').checked = s.post_expiry_schedule_enabled !== '0';

    const recoveryHour = s.recovery_schedule_hour || '11';
    const recoveryMinute = s.recovery_schedule_minute || '40';
    document.getElementById('recovery-schedule-time').value = `${recoveryHour.padStart(2, '0')}:${recoveryMinute.padStart(2, '0')}`;
    document.getElementById('recovery-schedule-enabled').checked = s.recovery_schedule_enabled !== '0';
  }catch(err){ toast(err.message, true); }
}

document.getElementById('btn-save-settings').addEventListener('click', async ()=>{
  try{
    const reminderTime = document.getElementById('reminder-schedule-time').value.split(':');
    const postExpiryTime = document.getElementById('post-expiry-schedule-time').value.split(':');
    const recoveryTime = document.getElementById('recovery-schedule-time').value.split(':');

    await api('/settings', {method:'PUT', body: JSON.stringify({
      reminder_days_before: parseInt(document.getElementById('reminder-days').value, 10) || 3,
      reminder_message_template: document.getElementById('reminder-template').value,
      welcome_message_template: document.getElementById('welcome-template').value,
      recovery_message_template: document.getElementById('recovery-template').value,
      renewal_message_template: document.getElementById('renewal-template').value,
      recovery_days_after_expiry: parseInt(document.getElementById('recovery-days').value, 10) || 15,
      recovery_batch_size: parseInt(document.getElementById('recovery-batch').value, 10) || 5,
      recovery_interval_minutes: parseInt(document.getElementById('recovery-interval').value, 10) || 5,
      post_expiry_days: parseInt(document.getElementById('post-expiry-days').value, 10) || 3,
      post_expiry_message_template: document.getElementById('post-expiry-template').value,
      reminder_schedule_hour: parseInt(reminderTime[0], 10),
      reminder_schedule_minute: parseInt(reminderTime[1], 10),
      reminder_schedule_enabled: document.getElementById('reminder-schedule-enabled').checked ? '1' : '0',
      post_expiry_schedule_hour: parseInt(postExpiryTime[0], 10),
      post_expiry_schedule_minute: parseInt(postExpiryTime[1], 10),
      post_expiry_schedule_enabled: document.getElementById('post-expiry-schedule-enabled').checked ? '1' : '0',
      recovery_schedule_hour: parseInt(recoveryTime[0], 10),
      recovery_schedule_minute: parseInt(recoveryTime[1], 10),
      recovery_schedule_enabled: document.getElementById('recovery-schedule-enabled').checked ? '1' : '0'
    })});
    toast('Configurações salvas. Horários atualizados!');
  }catch(err){ toast(err.message, true); }
});

// ---------- REVENDEDORES ----------
let resellersCache = [];

const MONTH_LABELS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
function fmtRevMonthLabel(m) {
  const parts = m.split('-');
  return MONTH_LABELS[parseInt(parts[1],10)-1] + ' ' + parts[0];
}

async function loadResellers() {
  try {
    const resellers = await api('/resellers');
    resellersCache = resellers;
    renderResellers(resellers);
    renderResellerKPIs(resellers);
    await loadPurchases();
    populateResellerSelects();
    await loadResellerReport();
  } catch (err) { toast(err.message, true); }
}

async function loadResellerReport() {
  try {
    const monthInput = document.getElementById('revendedores-month');
    const month = monthInput.value || new Date().toISOString().slice(0, 7);

    const [summary, history] = await Promise.all([
      api('/resellers/report/summary?month=' + month),
      api('/resellers/report/history')
    ]);

    renderResellerMonthlyKPIs(summary.kpis);
    renderResellerHistoryChart(history, month);
    renderResellerBreakdown(summary.byReseller, month);
  } catch (err) { toast(err.message, true); }
}

function renderResellerMonthlyKPIs(kpis) {
  animateValue(document.getElementById('rev-month-purchases'), 0, kpis.total_purchases);
  animateValue(document.getElementById('rev-month-credits'), 0, kpis.total_credits);
  animateMoneyValue(document.getElementById('rev-month-revenue'), kpis.total_revenue);
  animateMoneyValue(document.getElementById('rev-month-cost'), kpis.total_cost);
  const profitEl = document.getElementById('rev-month-profit');
  animateMoneyValue(profitEl, kpis.net_profit);
  profitEl.style.color = kpis.net_profit >= 0 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';
}

function renderResellerHistoryChart(history, selectedMonth) {
  const container = document.getElementById('rev-history-chart');
  if (!history || !history.length) {
    container.innerHTML = '<p class="empty-msg">Sem histórico de compras.</p>';
    return;
  }

  const maxVal = Math.max(1, ...history.map(h => Math.max(h.total_revenue, h.total_cost)));
  const maxH = 170;
  let html = '';

  for (const h of history) {
    const isSel = h.month === selectedMonth;
    const revenueH = Math.max((h.total_revenue / maxVal) * maxH, 2);
    const costH = Math.max((h.total_cost / maxVal) * maxH, 2);
    html += `
      <div class="proj-bar-group${isSel ? ' selected' : ''}">
        <div class="proj-bar-value">${money(h.total_revenue)}</div>
        <div class="proj-bar-stack" style="height:${revenueH}px">
          <div class="proj-bar-safe" style="height:100%"></div>
        </div>
        <div class="proj-bar-stack" style="height:${costH}px;margin-top:2px">
          <div class="proj-bar-risk" style="height:100%"></div>
        </div>
        <div class="proj-bar-label">${fmtRevMonthLabel(h.month)}</div>
        <div class="proj-bar-sub">${h.purchase_count} compra${h.purchase_count !== 1 ? 's' : ''} · ${h.total_credits} créd.</div>
      </div>`;
  }

  container.innerHTML = html;
  staggerItems(container, '.proj-bar-group', 80);
}

function renderResellerBreakdown(byReseller, month) {
  const labelEl = document.getElementById('rev-breakdown-month-label');
  labelEl.textContent = fmtRevMonthLabel(month);

  const tbody = document.getElementById('rev-breakdown-tbody');
  const active = byReseller.filter(r => r.purchases > 0 || r.status === 'ativo');

  tbody.innerHTML = active.length ? active.map(r => {
    const profitClass = (r.net_profit || 0) >= 0 ? 'rev-profit-pos' : 'rev-profit-neg';
    return `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.phone || '—')}</td>
      <td><span class="status-badge ${r.status === 'ativo' ? 'badge-active' : 'badge-inactive'}">${r.status}</span></td>
      <td>${r.purchases || 0}</td>
      <td>${r.credits || 0}</td>
      <td>R$ ${(r.revenue || 0).toFixed(2)}</td>
      <td>R$ ${(r.cost || 0).toFixed(2)}</td>
      <td class="${profitClass}">R$ ${(r.net_profit || 0).toFixed(2)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty-msg">Nenhum revendedor com compras neste mês.</td></tr>';

  staggerItems(tbody, 'tr', 30);
}

function renderResellerKPIs(list) {
  const active = list.filter(r => r.status === 'ativo');
  const totalCredits = list.reduce((s, r) => s + (r.total_credits || 0), 0);
  const totalRevenue = list.reduce((s, r) => s + (r.total_revenue || 0), 0);
  const totalProfit = list.reduce((s, r) => s + (r.net_profit || 0), 0);
  document.getElementById('rev-active-count').textContent = active.length;
  document.getElementById('rev-total-credits').textContent = totalCredits;
  document.getElementById('rev-total-revenue').textContent = 'R$ ' + totalRevenue.toFixed(2);
  const profitEl = document.getElementById('rev-total-profit');
  profitEl.textContent = 'R$ ' + totalProfit.toFixed(2);
  profitEl.style.color = totalProfit >= 0 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';
}

function renderResellers(list) {
  const tbody = document.getElementById('resellers-tbody');
  tbody.innerHTML = list.length ? list.map(r => {
    const profitClass = (r.net_profit || 0) >= 0 ? 'rev-profit-pos' : 'rev-profit-neg';
    return `<tr>
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.phone || '—')}</td>
      <td>${escapeHtml(r.email || '—')}</td>
      <td><span class="status-badge ${r.status === 'ativo' ? 'badge-active' : 'badge-inactive'}">${escapeHtml(r.status)}</span></td>
      <td>${r.total_purchases || 0}</td>
      <td>${r.total_credits || 0}</td>
      <td>R$ ${(r.total_revenue || 0).toFixed(2)}</td>
      <td class="${profitClass}">R$ ${(r.net_profit || 0).toFixed(2)}</td>
      <td>
        <button class="btn-icon" onclick="editReseller(${r.id})" title="Editar" aria-label="Editar">${ICONS.edit}</button>
        <button class="btn-icon btn-icon-danger" onclick="deleteReseller(${r.id})" title="Excluir" aria-label="Excluir">${ICONS.trash}</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="9" class="empty-msg">Nenhum revendedor cadastrado.</td></tr>';
}

async function loadPurchases() {
  try {
    const monthInput = document.getElementById('revendedores-month');
    const month = monthInput.value || new Date().toISOString().slice(0, 7);
    const purchases = await api('/resellers/purchases/all?month=' + month);
    renderPurchases(purchases);
  } catch (err) { toast(err.message, true); }
}

function renderPurchases(list) {
  const tbody = document.getElementById('purchases-tbody');
  tbody.innerHTML = list.length ? list.map(p => {
    const profit = p.net_profit || 0;
    const profitClass = profit >= 0 ? 'rev-profit-pos' : 'rev-profit-neg';
    return `<tr>
      <td>${formatDate(p.purchase_date)}</td>
      <td>${escapeHtml(p.reseller_name || '—')}</td>
      <td>${escapeHtml(p.server_name || '—')}</td>
      <td>${p.credits_qty}</td>
      <td>R$ ${(p.amount_paid || 0).toFixed(2)}</td>
      <td>R$ ${(p.cost_per_credit || 0).toFixed(2)}</td>
      <td class="${profitClass}">R$ ${profit.toFixed(2)}</td>
      <td>
        <button class="btn-icon" onclick="editPurchase(${p.id})" title="Editar" aria-label="Editar">${ICONS.edit}</button>
        <button class="btn-icon btn-icon-danger" onclick="deletePurchase(${p.id})" title="Excluir" aria-label="Excluir">${ICONS.trash}</button>
      </td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="empty-msg">Nenhuma compra neste mês.</td></tr>';
}

function populateResellerSelects() {
  const resellerSelect = document.getElementById('purchase-reseller');
  resellerSelect.innerHTML = '<option value="">Selecione...</option>' +
    resellersCache.map(r => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
  const serverSelect = document.getElementById('purchase-server');
  serverSelect.innerHTML = '<option value="">Nenhum</option>' +
    serversCache.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
}

// Filtro de mês revendedores
document.getElementById('revendedores-month').addEventListener('change', () => {
  loadResellerReport();
  loadPurchases();
});
document.getElementById('revendedores-month').value = new Date().toISOString().slice(0, 7);

// Modal Revendedor
document.getElementById('btn-new-reseller').addEventListener('click', () => openResellerModal());
window.editReseller = async function(id) {
  const r = await api('/resellers/' + id);
  openResellerModal(r);
};
function openResellerModal(r = {}) {
  document.getElementById('reseller-modal-title').textContent = r.id ? 'Editar revendedor' : 'Novo revendedor';
  document.getElementById('reseller-id').value = r.id || '';
  document.getElementById('reseller-name').value = r.name || '';
  document.getElementById('reseller-phone').value = r.phone || '';
  document.getElementById('reseller-email').value = r.email || '';
  document.getElementById('reseller-status').value = r.status || 'ativo';
  document.getElementById('reseller-notes').value = r.notes || '';
  document.getElementById('reseller-modal').classList.add('active');
}
document.getElementById('reseller-cancel').addEventListener('click', () => {
  document.getElementById('reseller-modal').classList.remove('active');
});
document.getElementById('reseller-save').addEventListener('click', async () => {
  const id = document.getElementById('reseller-id').value;
  const data = {
    name: document.getElementById('reseller-name').value,
    phone: document.getElementById('reseller-phone').value,
    email: document.getElementById('reseller-email').value,
    status: document.getElementById('reseller-status').value,
    notes: document.getElementById('reseller-notes').value
  };
  try {
    if (id) { await api('/resellers/' + id, { method: 'PUT', body: JSON.stringify(data) }); toast('Revendedor atualizado!'); }
    else { await api('/resellers', { method: 'POST', body: JSON.stringify(data) }); toast('Revendedor criado!'); }
    document.getElementById('reseller-modal').classList.remove('active');
    loadResellers();
  } catch (err) { toast(err.message, true); }
});
window.deleteReseller = async function(id) {
  if (!await confirmDialog('Excluir este revendedor?')) return;
  try { await api('/resellers/' + id, { method: 'DELETE' }); toast('Revendedor excluído.'); loadResellers(); }
  catch (err) { toast(err.message, true); }
};

// Modal Compra
document.getElementById('btn-new-purchase').addEventListener('click', () => openPurchaseModal());
window.editPurchase = async function(id) {
  const purchases = await api('/resellers/purchases/all');
  const p = purchases.find(x => x.id === id);
  if (p) openPurchaseModal(p);
};
function openPurchaseModal(p = {}) {
  document.getElementById('purchase-modal-title').textContent = p.id ? 'Editar compra' : 'Nova compra de créditos';
  document.getElementById('purchase-id').value = p.id || '';
  document.getElementById('purchase-reseller').value = p.reseller_id || '';
  document.getElementById('purchase-server').value = p.server_id || '';
  document.getElementById('purchase-qty').value = p.credits_qty || 1;
  document.getElementById('purchase-amount').value = p.amount_paid || 0;
  document.getElementById('purchase-cost').value = p.cost_per_credit || 0;
  document.getElementById('purchase-date').value = p.purchase_date || new Date().toISOString().slice(0, 10);
  document.getElementById('purchase-notes').value = p.notes || '';
  updatePurchaseProfitPreview();
  document.getElementById('purchase-modal').classList.add('active');
}
function updatePurchaseProfitPreview() {
  const qty = parseFloat(document.getElementById('purchase-qty').value) || 0;
  const amount = parseFloat(document.getElementById('purchase-amount').value) || 0;
  const cost = parseFloat(document.getElementById('purchase-cost').value) || 0;
  const profit = amount - (cost * qty);
  const el = document.getElementById('purchase-profit-preview');
  el.textContent = 'Lucro: R$ ' + profit.toFixed(2);
  el.style.color = profit >= 0 ? 'var(--success, #10b981)' : 'var(--danger, #ef4444)';
}
['purchase-qty', 'purchase-amount', 'purchase-cost'].forEach(id => {
  document.getElementById(id).addEventListener('input', updatePurchaseProfitPreview);
});
document.getElementById('purchase-cancel').addEventListener('click', () => {
  document.getElementById('purchase-modal').classList.remove('active');
});
document.getElementById('purchase-save').addEventListener('click', async () => {
  const id = document.getElementById('purchase-id').value;
  const data = {
    reseller_id: parseInt(document.getElementById('purchase-reseller').value),
    server_id: document.getElementById('purchase-server').value || null,
    credits_qty: parseInt(document.getElementById('purchase-qty').value),
    amount_paid: parseFloat(document.getElementById('purchase-amount').value),
    cost_per_credit: parseFloat(document.getElementById('purchase-cost').value),
    purchase_date: document.getElementById('purchase-date').value,
    notes: document.getElementById('purchase-notes').value
  };
  try {
    if (id) { await api('/resellers/purchases/' + id, { method: 'PUT', body: JSON.stringify(data) }); toast('Compra atualizada!'); }
    else { await api('/resellers/purchases', { method: 'POST', body: JSON.stringify(data) }); toast('Compra registrada!'); }
    document.getElementById('purchase-modal').classList.remove('active');
    loadResellers();
  } catch (err) { toast(err.message, true); }
});
window.deletePurchase = async function(id) {
  if (!await confirmDialog('Excluir esta compra?')) return;
  try { await api('/resellers/purchases/' + id, { method: 'DELETE' }); toast('Compra excluída.'); loadResellers(); }
  catch (err) { toast(err.message, true); }
};

// ---------- TESTE DE ENVIO (WHATSAPP) ----------
document.getElementById('btn-wa-test').addEventListener('click', async () => {
  const phone = document.getElementById('wa-test-phone').value.trim();
  const which = document.getElementById('wa-test-template').value;
  if (!phone) { toast('Informe o telefone de teste.', true); return; }
  const templates = {
    reminder: 'reminder-template',
    welcome: 'welcome-template',
    recovery: 'recovery-template',
    'post-expiry': 'post-expiry-template',
    renewal: 'renewal-template'
  };
  const message = document.getElementById(templates[which]).value;
  if (!message) { toast('O modelo selecionado está vazio.', true); return; }
  const btn = document.getElementById('btn-wa-test');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    const res = await api('/whatsapp/test-message', { method: 'POST', body: JSON.stringify({ phone, message }) });
    toast(res.queueId ? `Mensagem de teste enfileirada (id ${res.queueId}).` : 'Mensagem de teste enfileirada.');
  } catch (err) { toast(err.message, true); }
  finally {
    btn.disabled = false;
    btn.textContent = 'Enviar teste';
  }
});

// ---------- INICIALIZAÇÃO ----------
async function init() {
  await Promise.all([loadPlansCache(), loadServersCache()]);
  loadDashboard();
  loadSettings();
}
init();
