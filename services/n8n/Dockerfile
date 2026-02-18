FROM n8nio/n8n:latest

USER root

# Patch para registrar webhooks ao ativar workflows via API (n8n v2.7.4 bug fix)
RUN sed -i "s/\['init', 'leadershipChange'\]\.includes/['init', 'leadershipChange', 'activate'].includes/g" /usr/local/lib/node_modules/n8n/dist/active-workflow-manager.js || echo "⚠ Patch pattern not found (n8n version may have changed)"

RUN echo "✓ N8N webhook registration patch attempted"

USER node
