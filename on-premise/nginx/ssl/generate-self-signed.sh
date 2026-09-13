#!/usr/bin/env bash
# =============================================================================
# Generate a self-signed SSL certificate for on-premise local testing or intranet
# =============================================================================
set -euo pipefail

SSL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="${1:-localhost}"

echo "Generating self-signed certificate for: ${DOMAIN}"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "${SSL_DIR}/server.key" \
  -out "${SSL_DIR}/server.crt" \
  -subj "/C=IN/ST=Maharashtra/L=Mumbai/O=PDE/OU=IT/CN=${DOMAIN}"

chmod 600 "${SSL_DIR}/server.key"
chmod 644 "${SSL_DIR}/server.crt"

echo "SSL Certificate generated successfully:"
echo "  - Certificate: ${SSL_DIR}/server.crt"
echo "  - Private Key: ${SSL_DIR}/server.key"
