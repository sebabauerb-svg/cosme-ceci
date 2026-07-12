# MercadoPago — Paso a paso para Ceci 🇺🇾

Esto es para que el sitio web pueda **cobrar las reservas** y que la plata **te llegue a tu cuenta**.
Son dos partes: (1) que tu cuenta pueda recibir pagos, y (2) generar las "credenciales"
que necesita Sebas para conectar la web.

> Los nombres de los botones pueden cambiar un poco según la versión de la app/web.
> Si algo no aparece igual, usá el buscador interno de MercadoPago.

---

## Parte 1 — Que tu cuenta pueda RECIBIR pagos

### 1.1 Verificar tu identidad
1. Abrí la **app de MercadoPago** e iniciá sesión.
2. Si te aparece un aviso de **"Validá/Verificá tu identidad"**, seguilo.
   (Si no aparece, andá a tu **perfil** → **Datos de tu cuenta**.)
3. Te va a pedir una **foto de tu cédula** y una **selfie**. Completalo.
4. Esperá la confirmación (suele ser rápida). Sin la identidad verificada, MercadoPago
   no deja recibir ni retirar dinero.

### 1.2 Asociar tu cuenta bancaria (para sacar la plata)
1. En la app, entrá a **"Tu dinero"** (o tocá tu saldo en el inicio).
2. Tocá **"Retirar"** → **"A una cuenta bancaria"**.
3. La primera vez: **"Agregar cuenta bancaria"**.
4. Cargá **banco, tipo de cuenta y número de cuenta**. La cuenta tiene que estar
   **a tu nombre** (mismo titular que tu MercadoPago).
5. Confirmá. Queda asociada para siempre; después retirás cuando quieras.

✅ Con la Parte 1 ya podés cobrar y pasar la plata a tu banco.

---

## Parte 2 — Generar las CREDENCIALES (lo que necesita Sebas)

Esto es lo que conecta tu MercadoPago con la web. Se hace **una sola vez**.

### 2.1 Entrar al panel de desarrolladores
1. En la computadora, entrá a **https://www.mercadopago.com.uy/developers**
2. Tocá **"Ingresar"** (arriba a la derecha) y entrá con **tu misma cuenta** de MercadoPago.

### 2.2 Crear una aplicación
1. Entrá a **"Tus integraciones"** (o "Tus aplicaciones").
2. Tocá **"Crear aplicación"**.
3. Completá:
   - **Nombre:** algo simple, ej. `Web Cecilia Gutiérrez`.
   - **¿Qué producto vas a integrar?** → elegí **"Pagos online" / "Checkout Pro"**.
   - Si pregunta **¿Usás una plataforma de e-commerce?** → **No**.
4. Tocá **"Crear"**.

### 2.3 Copiar las credenciales
Ya dentro de la aplicación, buscá la sección **"Credenciales"**. Vas a ver **dos juegos**:

- **Credenciales de PRUEBA** (para testear sin mover plata real) — empiezan con `TEST-...`
- **Credenciales de PRODUCCIÓN** (las reales) — empiezan con `APP_USR-...`

De **cada** juego hay dos valores:
- **Access Token**
- **Public Key**

👉 **Primero copiá las de PRUEBA** (Access Token + Public Key que empiezan con `TEST-`)
y pasáselas a Sebas. Con esas armamos y probamos todo sin cobrar de verdad.
Cuando esté probado, te pedimos las de **PRODUCCIÓN**.

---

## 🔒 Importante (seguridad)

- El **Access Token** es como una **llave de tu cuenta**. **No lo pegues en ningún lado
  público** (ni redes, ni mails a desconocidos, ni grupos).
- Pasáselo **solo a Sebas**, por un medio privado (ej. mensaje directo).
- Sebas lo carga en un lugar seguro del sitio; **nunca queda a la vista**.

---

## ✅ Resumen de lo que tenés que pasarle a Sebas

1. **(Prueba)** Access Token que empieza con `TEST-...`
2. **(Prueba)** Public Key que empieza con `TEST-...`
3. Más adelante, cuando esté todo probado: las de **producción** (`APP_USR-...`).

Y avisar cuando tengas la **Parte 1** lista (identidad verificada + cuenta bancaria asociada).

---

## Notas

- MercadoPago cobra una **comisión** por cada cobro (un % + IVA). No cobra por crear la
  cuenta ni las credenciales; solo cuando efectivamente cobrás. Tenelo en cuenta en el precio.
- Cualquier duda con un paso, sacá una captura de la pantalla donde te trabaste y mandala.
