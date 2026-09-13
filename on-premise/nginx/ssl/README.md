# SSL/TLS Configuration for On-Premise

To enable HTTPS on the central Nginx reverse proxy:

1. **Option A: Self-Signed Certificate (Local / Intranet / Development)**
   Run:
   ```bash
   bash generate-self-signed.sh <your-server-hostname-or-ip>
   ```
   This generates `server.crt` and `server.key` in this directory.

2. **Option B: Enterprise CA or Let's Encrypt**
   Copy your trusted certificates here:
   - Certificate / Chain: `server.crt`
   - Private Key: `server.key`

3. **Enable SSL in `nginx.conf`**
   Add the SSL server block:
   ```nginx
   server {
       listen 443 ssl http2;
       server_name _;

       ssl_certificate /etc/nginx/ssl/server.crt;
       ssl_certificate_key /etc/nginx/ssl/server.key;
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers HIGH:!aNULL:!MD5;

       # ... proxy locations as defined in HTTP block
   }
   ```
   And set `CSRF_COOKIE_SECURE=True` in your `.env`.
