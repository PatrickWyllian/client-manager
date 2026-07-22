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

function toast(msg, isError=false){
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(()=> t.className = 'toast', 2500);
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
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if(btn.dataset.tab === 'dashboard') loadDashboard();
    if(btn.dataset.tab === 'clientes') loadClients();
    if(btn.dataset.tab === 'servidores') loadServers();
    if(btn.dataset.tab === 'planos') loadPlans();
    if(btn.dataset.tab === 'financeiro') loadFinanceiro();
  });
});

// ---------- DASHBOARD ----------
async function loadDashboard(){
  try{
    const d = await api('/dashboard');

    document.getElementById('stat-active').textContent = d.totalActive;
    document.getElementById('stat-expiring').textContent = d.expiringSoonCount;
    document.getElementById('stat-overdue').textContent = d.expiredCount;

    // Vencimentos por período
    const periodEl = document.getElementById('projection-period-list');
    periodEl.innerHTML = d.projectionByPeriod.map(p => `
      <div class="period-item">
        <div class="period-info">
          <span class="period-label">${p.label}</span>
          <span class="period-count">${p.clientCount} cliente${p.clientCount !== 1 ? 's' : ''}</span>
        </div>
        <span class="period-value">${money(p.totalValue)}</span>
      </div>`).join('');

    // Clientes vencidos
    document.getElementById('stat-expired-count').textContent = d.expiredCount;
    document.getElementById('stat-expired-revenue').textContent = money(d.expiredRevenue) + '/mês';
    const expiredEl = document.getElementById('expired-list');
    expiredEl.innerHTML = d.expiredClients.length ? d.expiredClients.map(c=>{
      const [y,m,day] = c.due_date.split('-');
      return `
        <div class="expired-item">
          <div>
            <div class="e-name">${c.name}</div>
            <div class="e-details">${c.server_name || '—'} · ${c.plan || '—'} · venceu ${day}/${m}/${y} · ${c.username || '—'}</div>
          </div>
          <div class="e-actions">
            <span class="e-days">${c.days_expired}d vencido</span>
            <button class="btn-recovery" onclick="sendRecovery(${c.id}, '${c.name.replace(/'/g, "\\'")}')">Enviar recuperação</button>
          </div>
        </div>`;
    }).join('') : '<p class="empty-msg">Nenhum cliente vencido.</p>';

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
            <div class="u-name">${c.name}</div>
            <div class="u-server">${c.server_name || '—'} · ${c.plan || '—'} · ${money(mrrClient)}/mês</div>
          </div>
          <div class="u-actions">
            <span class="u-days ${cls}">${label}</span>
            <button class="btn-renew" onclick="renewClient(${c.id}, '${c.name.replace(/'/g, "\\'")}')">Renovar</button>
          </div>
        </div>`;
    }).join('') : '<p class="empty-msg">Nenhum vencimento próximo.</p>';
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
  const options = serversCache.map(s=>`<option value="${s.id}" data-cost="${s.cost}">${s.name}${s.cost > 0 ? ' - ' + money(s.cost) : ''}</option>`).join('');
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
  const options = plansCache.map(p=>`<option value="${p.name}" data-price="${p.price}">${p.name} - ${money(p.price)}</option>`).join('');
  modalSel.innerHTML = '<option value="">Nenhum</option>' + options;
  filterSel.innerHTML = '<option value="">Todos os planos</option>' + plansCache.map(p=>`<option value="${p.name}">${p.name}</option>`).join('');
}

document.getElementById('client-plan').addEventListener('change', function(){
  const selected = this.options[this.selectedIndex];
  const price = selected.dataset.price;
  if(price) document.getElementById('client-price').value = price;
});

async function loadClients(){
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
    const clients = nameFilter ? clientsRaw.filter(c => c.name.toLowerCase().includes(nameFilter)) : clientsRaw;
    const tbody = document.getElementById('clients-tbody');
    tbody.innerHTML = clients.length ? clients.map(c=>{
      const [y,m,d] = c.due_date.split('-');
      const discount = c.discount || 0;
      const serverCost = c.server_cost || 0;
      const net = c.price - discount - serverCost;
      return `
      <tr>
        <td>${c.name}</td>
        <td>${c.phone}</td>
        <td>${c.server_name || '—'}</td>
        <td>${c.server_cost > 0 ? money(c.server_cost) : '—'}</td>
        <td>${c.plan || '—'}</td>
        <td>${money(c.price)}</td>
        <td>${discount > 0 ? '-' + money(discount) : '—'}</td>
        <td>${money(net)}</td>
        <td>${d}/${m}/${y}</td>
        <td>${c.username || '—'}</td>
        <td>${c.password || '—'}</td>
        <td><span class="badge ${c.status}">${c.status}</span></td>
        <td class="row-actions">
          <button onclick="editClient(${c.id})">Editar</button>
          <button class="btn-renew" onclick="renewClient(${c.id}, '${c.name.replace(/'/g, "\\'")}')">Renovar</button>
          <button onclick="deleteClient(${c.id})">Excluir</button>
        </td>
      </tr>`;
    }).join('') : '<tr><td colspan="13" class="empty-msg">Nenhum cliente cadastrado.</td></tr>';
  }catch(err){ toast(err.message, true); }
}

document.getElementById('filter-server').addEventListener('change', loadClients);
document.getElementById('filter-plan').addEventListener('change', loadClients);
document.getElementById('filter-status').addEventListener('change', loadClients);
document.getElementById('filter-name').addEventListener('input', loadClients);

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
  if(!confirm('Excluir este cliente?')) return;
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

// ---------- RENOVAÇÃO ----------
window.renewClient = (id, name) => {
  document.getElementById('renew-client-id').value = id;
  document.getElementById('renew-client-name').textContent = `Cliente: ${name}`;
  document.getElementById('renew-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('renew-hint').textContent = '';
  document.getElementById('renew-modal').classList.add('active');
};

document.getElementById('renew-cancel').addEventListener('click', () => {
  document.getElementById('renew-modal').classList.remove('active');
});

document.getElementById('renew-date').addEventListener('change', function () {
  const id = document.getElementById('renew-client-id').value;
  const renewalDate = this.value;
  if (!renewalDate) return;
  const plan = plansCache.find(p => {
    const client = upcomingCache.find(c => c.id === parseInt(id));
    return client && client.plan === p.name;
  });
  if (!plan) return;
  const base = new Date(renewalDate + 'T00:00:00');
  base.setMonth(base.getMonth() + plan.duration_months);
  const preview = base.toISOString().slice(0, 10).split('-');
  document.getElementById('renew-hint').textContent =
    `Vencimento previsto: ${preview[2]}/${preview[1]}/${preview[0]} (${plan.duration_months} meses)`;
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
  try{
    const servers = await api('/servers');
    serversCache = servers;
    const tbody = document.getElementById('servers-tbody');
    tbody.innerHTML = servers.length ? servers.map(s=>`
      <tr>
        <td>${s.name}</td>
        <td>${s.provider || '—'}</td>
        <td>${money(s.cost)}</td>
        <td>${s.active_clients}</td>
        <td><span class="badge ${s.status === 'ativo' ? 'ativo' : 'cancelado'}">${s.status}</span></td>
        <td class="row-actions">
          <button onclick="editServer(${s.id})">Editar</button>
          <button onclick="deleteServer(${s.id})">Excluir</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty-msg">Nenhum servidor cadastrado.</td></tr>';
  }catch(err){ toast(err.message, true); }
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
  if(!confirm('Excluir este servidor?')) return;
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
  try{
    const plans = await api('/plans');
    plansCache = plans;
    const tbody = document.getElementById('plans-tbody');
    const durationLabel = (m) => m === 1 ? '1 mês' : m < 12 ? m + ' meses' : (m/12) + ' ano' + (m > 12 ? 's' : '');
    tbody.innerHTML = plans.length ? plans.map(p=>`
      <tr>
        <td>${p.name}</td><td>${money(p.price)}</td><td>${durationLabel(p.duration_months)}</td>
        <td>${p.screens || 1}</td><td>${p.active_clients}</td>
        <td class="row-actions">
          <button onclick="editPlan(${p.id})">Editar</button>
          <button onclick="deletePlan(${p.id})">Excluir</button>
        </td>
      </tr>
    `).join('') : '<tr><td colspan="6" class="empty-msg">Nenhum plano cadastrado.</td></tr>';
  }catch(err){ toast(err.message, true); }
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
  if(!confirm('Excluir este plano?')) return;
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
// ---------- FINANCEIRO ----------
async function loadFinanceiro(){
  try{
    const monthInput = document.getElementById('financeiro-month');
    const month = monthInput.value || new Date().toISOString().slice(0, 7);
    const [d, dash] = await Promise.all([
      api('/sales?month=' + month),
      api('/dashboard')
    ]);

    // KPIs Principais
    document.getElementById('fin-mrr').textContent = money(dash.mrr);
    document.getElementById('fin-net-profit').textContent = money(dash.netProfit);
    document.getElementById('fin-margin').textContent = dash.profitMargin + '% margem';
    document.getElementById('fin-active').textContent = dash.totalActive;
    document.getElementById('fin-ticket').textContent = money(dash.avgTicket);

    // Métricas de Assinatura
    document.getElementById('fin-new').textContent = dash.newClientsMonth;
    document.getElementById('fin-renewals').textContent = dash.renewalsMonth;
    document.getElementById('fin-churn').textContent = dash.churnRate + '%';
    document.getElementById('fin-server-cost').textContent = money(dash.monthlyServerCost);

    // Alertas
    document.getElementById('fin-expiring').textContent = dash.expiringSoonCount;
    document.getElementById('fin-risk').textContent = money(dash.revenueAtRisk);
    document.getElementById('fin-expired').textContent = dash.expiredCount;

    // Projeção 6 meses
    const container = document.getElementById('fin-projection-chart');
    const projection = dash.projection6Months;
    if(projection && projection.length){
      const maxVal = Math.max(1, ...projection.map(p => p.safeRevenue + p.atRiskRevenue));
      const maxH = 170;
      const costVal = projection[0].serverCost;
      const costY = maxH - ((costVal / maxVal) * maxH);
      let html = `<div class="proj-cost-line" style="bottom:${costY + 30}px"></div>`;
      html += `<div class="proj-cost-label" style="bottom:${costY + 30}px">Custo: ${money(costVal)}</div>`;
      for(const p of projection){
        const safeH = (p.safeRevenue / maxVal) * maxH;
        const riskH = (p.atRiskRevenue / maxVal) * maxH;
        const totalH = safeH + riskH;
        html += `
          <div class="proj-bar-group">
            <div class="proj-bar-value">${money(p.safeRevenue + p.atRiskRevenue)}</div>
            <div class="proj-bar-stack" style="height:${Math.max(totalH, 4)}px">
              <div class="proj-bar-safe" style="height:${safeH}px"></div>
              <div class="proj-bar-risk" style="height:${riskH}px"></div>
            </div>
            <div class="proj-bar-label">${p.label}</div>
            ${p.expiringCount > 0 ? `<div class="proj-bar-sub">${p.expiringCount} venc.</div>` : ''}
          </div>`;
      }
      container.innerHTML = html;
    } else {
      container.innerHTML = '<p class="empty-msg">Sem dados de projeção.</p>';
    }

    // Gráfico de servidores
    const chartEl = document.getElementById('fin-server-chart');
    const maxCount = Math.max(1, ...dash.serverRanking.map(s=>s.client_count));
    chartEl.innerHTML = dash.serverRanking.length ? dash.serverRanking.map(s=>`
      <div class="chart-row">
        <span class="chart-label" title="${s.name}">${s.name}</span>
        <span class="chart-bar-track"><span class="chart-bar-fill" style="width:${(s.client_count/maxCount*100)}%"></span></span>
        <span class="chart-count">${s.client_count} · ${money(s.mrr)}/mês</span>
      </div>
    `).join('') : '<p class="empty-msg">Nenhum servidor cadastrado.</p>';

    // Gráfico de planos
    const planEl = document.getElementById('fin-plan-chart');
    const maxPlan = Math.max(1, ...dash.planDistribution.map(p=>p.count));
    planEl.innerHTML = dash.planDistribution.length ? dash.planDistribution.map(p=>`
      <div class="chart-row">
        <span class="chart-label" title="${p.plan_name}">${p.plan_name}</span>
        <span class="chart-bar-track"><span class="chart-bar-fill" style="width:${(p.count/maxPlan*100)}%"></span></span>
        <span class="chart-count">${p.count} · ${money(p.mrr)}/mês</span>
      </div>
    `).join('') : '<p class="empty-msg">Nenhum plano associado.</p>';

    // Lista de vendas
    const tbody = document.getElementById('fin-sales-tbody');
    tbody.innerHTML = d.sales.length ? d.sales.map(s => {
      const [y,m,day] = s.sale_date.split('-');
      const typeLabel = s.type === 'novo'
        ? '<span class="badge ativo">Novo</span>'
        : '<span class="badge" style="background:#1a2a3a;color:#5b9bd5">Renovação</span>';
      return `
        <tr>
          <td>${day}/${m}/${y}</td>
          <td>${s.client_name || '—'}</td>
          <td>${s.phone || '—'}</td>
          <td>${s.plan || '—'}</td>
          <td>${typeLabel}</td>
          <td>${money(s.value)}</td>
          <td><button class="btn-undo" onclick="undoSale(${s.id}, '${s.client_name || ''}')">Desfazer</button></td>
        </tr>`;
    }).join('') : '<tr><td colspan="7" class="empty-msg">Nenhuma venda neste mês.</td></tr>';
  }catch(err){ toast(err.message, true); }
}

window.undoSale = async (id, clientName) => {
  if (!confirm(`Desfazer venda de ${clientName}? O registro será removido do financeiro.`)) return;
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
socket.on('reminder:sent', (data)=> toast(`Aviso enviado para ${data.client}`));
socket.on('recovery:sent', (data)=> toast(`Recuperação enviada para ${data.client}`));

document.getElementById('btn-wa-connect').addEventListener('click', async ()=>{
  try{ await api('/whatsapp/connect', {method:'POST'}); } catch(err){ toast(err.message, true); }
});
document.getElementById('btn-wa-disconnect').addEventListener('click', async ()=>{
  try{ await api('/whatsapp/disconnect', {method:'POST'}); toast('WhatsApp desconectado.'); } catch(err){ toast(err.message, true); }
});

// ---------- RECUPERAÇÃO ----------
window.sendRecovery = async (id, name) => {
  if (!confirm(`Enviar mensagem de recuperação para ${name}?`)) return;
  try {
    const result = await api('/whatsapp/send-recovery', { method: 'POST', body: JSON.stringify({ client_id: id }) });
    toast(`Mensagem de recuperação enfileirada para ${result.client}.`);
    loadDashboard();
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
          <div class="queue-item-phone">${status.current.phone}</div>
          <div class="queue-item-message">${escapeHtml(status.current.message)}</div>
        </div>
        <div class="queue-item-meta">
          <span class="queue-item-type ${status.current.type}">${status.current.type}</span>
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
            <div class="queue-item-phone">${item.phone} ${item.client_name ? '(' + escapeHtml(item.client_name) + ')' : ''}</div>
            <div class="queue-item-message">${escapeHtml(item.message)}</div>
          </div>
          <div class="queue-item-meta">
            <span class="queue-item-type ${item.type}">${item.type}</span>
            <span class="queue-item-time">${formatTime(item.created_at)}</span>
            <button class="queue-item-cancel" onclick="cancelQueueItem(${item.id})">Cancelar</button>
          </div>
        </div>
      `).join('');
    }

    const historyList = document.getElementById('queue-history-list');
    if (history.length === 0) {
      historyList.innerHTML = '<div class="empty-queue">Nenhum histórico de mensagens</div>';
    } else {
      historyList.innerHTML = history.map(item => `
        <div class="queue-item">
          <div class="queue-item-info">
            <div class="queue-item-phone">${item.phone} ${item.client_name ? '(' + escapeHtml(item.client_name) + ')' : ''}</div>
            <div class="queue-item-message">${escapeHtml(item.message)}</div>
          </div>
          <div class="queue-item-meta">
            <span class="queue-item-type ${item.type}">${item.type}</span>
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

window.cancelQueueItem = async (id) => {
  try {
    await api(`/whatsapp/queue/${id}/cancel`, { method: 'POST' });
    toast('Mensagem cancelada.');
    loadQueue();
  } catch(err) { toast(err.message, true); }
};

document.getElementById('btn-queue-refresh').addEventListener('click', loadQueue);

document.getElementById('btn-queue-cancel-all').addEventListener('click', async () => {
  if (!confirm('Cancelar todas as mensagens pendentes na fila?')) return;
  try {
    await api('/whatsapp/queue/cancel-all', { method: 'POST' });
    toast('Todas as mensagens pendentes foram canceladas.');
    loadQueue();
  } catch(err) { toast(err.message, true); }
});

document.getElementById('btn-queue-clear').addEventListener('click', async () => {
  if (!confirm('Limpar todo o histórico de mensagens?')) return;
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
  }catch(err){ toast(err.message, true); }
}

document.getElementById('btn-save-settings').addEventListener('click', async ()=>{
  try{
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
      post_expiry_message_template: document.getElementById('post-expiry-template').value
    })});
    toast('Configurações salvas.');
  }catch(err){ toast(err.message, true); }
});

// ---------- INICIALIZAÇÃO ----------
async function init() {
  await Promise.all([loadPlansCache(), loadServersCache()]);
  loadDashboard();
  loadSettings();
}
init();
