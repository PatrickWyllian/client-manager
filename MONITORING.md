# Client Manager - Monitoring Stack

## Overview

This monitoring stack provides comprehensive observability for the Client Manager application using Prometheus, Grafana, and Alertmanager.

## Components

- **Prometheus** (port 9090): Metrics collection and storage
- **Grafana** (port 3000): Visualization and dashboards
- **Alertmanager** (port 9093): Alert routing and notification
- **Client Manager** (port 3400): Application exposing `/metrics` endpoint

## Quick Start

```bash
# Start the monitoring stack
docker-compose -f docker-compose.monitoring.yml up -d

# Check status
docker-compose -f docker-compose.monitoring.yml ps

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f
```

## Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Grafana | http://localhost:3000 | admin / ${GRAFANA_ADMIN_PASSWORD} |
| Prometheus | http://localhost:9090 | - |
| Alertmanager | http://localhost:9093 | - |

## Environment Variables

Create a `.env` file with:

```env
# Grafana
GRAFANA_ADMIN_PASSWORD=your_secure_password

# Alertmanager email
ALERTMANAGER_SMTP_USER=your_email@gmail.com
ALERTMANAGER_SMTP_PASSWORD=your_app_password
ALERT_EMAIL_TO=alerts@yourdomain.com

# Slack webhooks (optional)
SLACK_WEBHOOK_CRITICAL=https://hooks.slack.com/services/xxx/yyy/zzz
SLACK_WEBHOOK_WARNING=https://hooks.slack.com/services/aaa/bbb/ccc

# Alert email recipient
ALERT_EMAIL_TO=alerts@yourdomain.com
```

## Dashboards

The stack includes a pre-configured "Client Manager - System Monitoring" dashboard with panels for:

- WhatsApp connection status
- WhatsApp disconnect count
- Pending WhatsApp ACKs
- Message queue status (pending, sending, error, sent)
- Queue errors
- Message queue history
- Client status (active/expired)
- Uptime
- Memory usage (RSS, heap used, heap total)
- Heap usage percentage

## Alerting Rules

The following alerts are configured in `prometheus-alerts.yml`:

### Critical Alerts
- **WhatsAppDisconnected**: WhatsApp disconnected for >2 minutes
- **HighQueueErrors**: >10 messages in error state
- **HighQueueErrorsRate**: Error rate > 0.5/sec
- **NoActiveClients**: Zero active clients

### Warning Alerts
- **WhatsAppHighDisconnectCount**: >5 disconnects
- **WhatsAppHighPendingAcks**: >50 pending ACKs
- **HighQueuePending**: >100 pending messages
- **QueueStuckSending**: >20 messages stuck sending
- **HighExpiredClients**: >20 expired clients
- **HighHeapUsage**: Heap usage >85%
- **HighRSSMemory**: RSS > 500MB
- **HighQueueErrorsRate**: Error rate > 0.5/sec

### Info Alerts
- **ProcessRestarted**: Container restarted

## Metrics Exposed

The `/metrics` endpoint exposes:

| Metric | Type | Description |
|--------|------|-------------|
| `client_manager_clients_active` | gauge | Active clients count |
| `client_manager_clients_expired` | gauge | Expired clients count |
| `client_manager_queue_pending` | gauge | Pending messages |
| `client_manager_queue_sending` | gauge | Currently sending |
| `client_manager_queue_error` | gauge | Error messages |
| `client_manager_queue_sent` | gauge | Successfully sent |
| `client_manager_queue_legacy_sent` | gauge | Legacy sent (no ack) |
| `client_manager_whatsapp_status` | gauge | 1=connected, 0=disconnected |
| `client_manager_whatsapp_disconnect_count` | counter | Disconnection count |
| `client_manager_whatsapp_pending_acks` | gauge | Pending ACKs |
| `client_manager_uptime_seconds` | counter | Process uptime |
| `client_manager_memory_usage_bytes` | gauge | Memory usage by type |

## Prometheus Queries

### Useful Queries

```promql
# WhatsApp connection status (1=connected, 0=disconnected)
client_manager_whatsapp_status

# Queue health
client_manager_queue_pending / (client_manager_queue_pending + client_manager_queue_sent) * 100

# Error rate
rate(client_manager_queue_error[5m])

# Memory usage %
client_manager_memory_usage_bytes{type="heapUsed"} / client_manager_memory_usage_bytes{type="heapTotal"} * 100

# WhatsApp disconnects per hour
rate(client_manager_whatsapp_disconnect_count[1h])
```

## Alerting

Alerts are configured in `prometheus-alerts.yml` and routed through Alertmanager to email and Slack.

### Testing Alerts

```bash
# Test alert firing
curl -X POST http://alertmanager:9093/api/v1/alerts -H "Content-Type: application/json" -d '[{"labels":{"alertname":"TestAlert","severity":"critical"},"annotations":{"summary":"Test alert"}}]'
```

## Troubleshooting

### Prometheus not scraping metrics
```bash
# Check target status
curl http://localhost:9090/api/v1/targets

# Check metrics endpoint directly
curl http://client-manager:3400/metrics
```

### Grafana not showing data
1. Check Prometheus datasource configuration
2. Verify Prometheus is scraping the client-manager target
3. Check Grafana logs: `docker logs grafana`

### Alerts not firing
1. Check Prometheus rules: `curl http://localhost:9090/api/v1/rules`
2. Check Alertmanager: `curl http://localhost:9093/api/v1/alerts`
3. Verify alert rules syntax: `promtool check rules prometheus-alerts.yml`

## Backup & Restore

```bash
# Backup Prometheus data
docker run --rm -v prometheus-data:/data -v $(pwd):/backup alpine tar czf /backup/prometheus-$(date +%Y%m%d).tar.gz -C /data .

# Backup Grafana data
docker run --rm -v grafana-data:/data -v $(pwd):/backup alpine tar czf /backup/grafana-$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm -v prometheus-data:/data -v $(pwd):/backup alpine tar xzf /backup/prometheus-20240115.tar.gz -C /data
```