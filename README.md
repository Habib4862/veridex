# VERIDEX — Legal AI PWA

## 🚀 Deploy en Railway

### Opción 1 — Auto-deploy (Recomendado)

1. Ve a https://railway.app/new
2. Selecciona **"GitHub Repo"**
3. Conecta `Habib4862/veridex`
4. Railway detectará automáticamente `railway.toml` y desplegará desde la carpeta `railway/`
5. Añade variables de entorno en **Project Settings → Variables**:
   - `ANTHROPIC_API_KEY` → tu API key
   - `STRIPE_SECRET_KEY` → tu Stripe secret
   - `ADMIN_CODE` → tu código admin

### Opción 2 — CLI (avanzado)

```bash
npm install -g @railway/cli
railway login
railway link  # selecciona tu proyecto
railway up    # despliega
```

## 📋 Variables de entorno requeridas

```
ANTHROPIC_API_KEY    = sk-ant-...
STRIPE_SECRET_KEY    = sk_test_... o sk_live_...
ADMIN_CODE           = tu-código-secreto
NODE_ENV             = production (por defecto)
PORT                 = 3000 (por defecto)
```

## 🔗 URLs de la API

Cuando Railway despliegue, obtendrás una URL como:
```
https://veridex-api.up.railway.app
```

Actualiza en Netlify Environment Variables:
```
RAILWAY_URL = https://veridex-api.up.railway.app
```

## 📊 Stack

- **Frontend:** HTML/CSS/JS en Netlify (estático)
- **Backend:** Node.js Express en Railway (sin límites de tiempo)
- **IA:** Claude Sonnet 4.6 (max_tokens 8000, sin límites de texto)
- **Pago:** Stripe PaymentIntents

## 🔒 Seguridad

- API keys en variables de entorno (nunca en código)
- CORS configurado
- Admin bypass server-side
- JSON parsing robusto
