# Cloudflare Paid Tunnel Setup

## Step 1: Create Cloudflare Account & Get Domain
1. Go to https://dash.cloudflare.com/sign-up
2. Sign up for Zero Trust ($7/month)
3. You'll get a subdomain like `yourname.cloudflareaccess.com`
4. Or connect your own domain

## Step 2: Install & Login Cloudflared
```bash
# Login to your account
cloudflared tunnel login

# Create a named tunnel
cloudflared tunnel create cam-interface

# This creates a tunnel UUID - save it!
```

## Step 3: Create Config File
Create `~/.cloudflared/config.yml`:
```yaml
tunnel: YOUR_TUNNEL_UUID_HERE
credentials-file: ~/.cloudflared/YOUR_TUNNEL_UUID_HERE.json

ingress:
  - hostname: cameras.yourname.cloudflareaccess.com
    service: http://localhost:3100
  - service: http_status:404
```

## Step 4: Route DNS
```bash
# Point your domain to the tunnel
cloudflared tunnel route dns YOUR_TUNNEL_UUID cameras.yourname.cloudflareaccess.com
```

## Step 5: Start Tunnel
```bash
# Start the tunnel (same URL every time!)
cloudflared tunnel run YOUR_TUNNEL_UUID
```

## Your Fixed URLs
- **Frontend**: `https://cameras.yourname.cloudflareaccess.com`
- **Never changes!**

## Vercel Environment Variables
```
MEDIAMTX_HTTP=https://cameras.yourname.cloudflareaccess.com
MEDIAMTX_WHEP=https://cameras.yourname.cloudflareaccess.com
```

Set these once and forget them!

