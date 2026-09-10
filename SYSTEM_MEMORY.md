# 📖 LIBRO DE MEMORIAS Y MANUAL DE ARQUITECTURA DEL SISTEMA COB

> **IMPORTANTE PARA DESARROLLADORES Y ASISTENTES DE IA:**  
> Este documento contiene el registro histórico de lecciones aprendidas, errores resueltos, convenciones inviolables y arquitectura definitiva del sistema. **Cualquier cambio futuro debe respetar obligatoriamente las pautas aquí descritas.**

---

## 🏛️ 1. Arquitectura General del Sistema

El sistema fue diseñado con una arquitectura **desacoplada (Serverless Frontend + Local WhatsApp Bridge)**:

1. **Frontend (Dashboard Web):**
   - **Tecnología:** React + Vite + Lucide Icons.
   - **Hosting:** Vercel (Producción: `https://frontend-lovat-five-bbcuj2lohv.vercel.app`).
   - **Repositorio:** GitHub (`https://github.com/RamiStein/cobelgrano`).
   - **Comunicación:** Se comunica **única y exclusivamente** con Google Firebase (Firestore + Storage). No realiza llamadas HTTP directas a la máquina local.

2. **Backend (Motor Local de WhatsApp):**
   - **Tecnología:** Node.js con `whatsapp-web.js` y `LocalAuth`.
   - **Ubicación:** Computadora física del consultorio (`C:\Users\Rami\Desktop\CONSULTORIO COB\whatsapp-dashboard\backend`).
   - **Función:** Actúa como un puente "ciego":
     - Escucha mensajes entrantes de WhatsApp y los sincroniza a Firestore (`messages` y `contacts`).
     - Sube notas de voz y audios a Firebase Storage (`audios/`).
     - Escucha en tiempo real la colección `outbox` de Firestore: cuando el Frontend crea un documento allí, el backend lo envía por WhatsApp (`client.sendMessage`) y elimina el documento de `outbox`.
   - **Inicio Automático:** Se ejecuta en segundo plano al arrancar Windows mediante un script VBS silencioso en la carpeta de Inicio (`Startup`): `motor-whatsapp.vbs`.

3. **Base de Datos (Google Firebase):**
   - **Proyecto:** `cobelgrano-36019`
   - **Colecciones Principales:**
     - `system/status`: Contiene `{ qr, isReady }`.
     - `contacts`: Directorio de pacientes/contactos con `{ name, pushname, number, lastActivity, tag }`.
     - `messages`: Mensajes individuales con `{ id, fromMe, author, contactName, senderName, body, timestamp, isAudio, mediaUrl }`.
     - `outbox`: Cola de mensajes salientes enviados desde la web.
     - `sessions`: Registro de tiempos de lectura de chat `{ chatId, duration, timestamp }` para métricas.
     - `web_leads`: Consultas provenientes del sitio web oficial.

---

## ⚠️ 2. Lecciones Críticas Aprendidas y Reglas Inviolables

### 🟡 Lección 1: El dilema LID vs C.US en WhatsApp Web
- **Problema:** En las versiones modernas de WhatsApp Multi-dispositivo, los mensajes entrantes y salientes suelen identificarse con un ID de dispositivo vinculado (`@lid`, ej. `111747113451533@lid`), mientras que la libreta de contactos registra el número telefónico (`@c.us`, ej. `5491127452476@c.us`).
- **Error que ocurrió:** Si el frontend busca mensajes con `where('author', '==', chat.author)`, la consulta devuelve 0 mensajes y la pantalla queda completamente vacía.
- **Regla Inviolable:** En `ChatView.jsx`, la consulta de mensajes DEBE buscar siempre todas las identidades posibles mediante el operador `in`:
  ```javascript
  const candidates = [
    chat.author,
    chat.contactId,
    chat.number ? `${chat.number}@lid` : null,
    chat.number ? `${chat.number}@c.us` : null,
    // ...
  ].filter(Boolean);
  const q = query(collection(db, 'messages'), where('author', 'in', uniqueAuthors));
  ```

### 🟡 Lección 2: Ordenamiento en memoria para evitar Índices Compuestos
- **Problema:** En Firestore, combinar `where('author', 'in', ...)` con `orderBy('timestamp', 'asc')` arroja un error `failed-precondition` exigiendo crear un índice compuesto manualmente en la consola de Firebase. Si falla, el chat se cuelga en "Cargando mensajes...".
- **Solución y Regla:** No agregar `orderBy` en la consulta de Firestore para los mensajes de un chat individual. En su lugar, obtener el arreglo y ordenar en JavaScript:
  ```javascript
  msgs.sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
  ```
  Esto es instantáneo (toma menos de 1ms) y elimina para siempre el riesgo de caídas por índices faltantes.

### 🟡 Lección 3: Integridad de Estilos e Interfaces (`index.css`)
- **Problema:** En iteraciones anteriores, se cambiaron clases base del HTML (como usar `.app-layout` y `.main-nav` en lugar de `.app-container` y `.sidebar`), lo que provocó que los íconos se desparramaran gigantes arriba a la izquierda.
- **Regla Inviolable:**
  - El layout principal SIEMPRE debe estructurarse con:
    ```jsx
    <div className="app-container fade-in">
      <div className="sidebar" style={{ width: '80px', ... }}> ... </div>
      {activeTab === 'chats' && <ChatList ... />}
      <div className="main-area"> ... </div>
    </div>
    ```
  - Todos los estilos globales viven en `index.css`.
  - La barra de escribir mensajes usa `.chat-input-container`, `.chat-input-form`, `.chat-input`, y `.send-button`.

### 🟡 Lección 4: Guardado de Etiquetas con `merge: true`
- **Problema:** Al usar `updateDoc`, si el documento no existía exactamente con ese ID, Firebase lanzaba una excepción no controlada impidiendo guardar la etiqueta.
- **Regla Inviolable:** Usar siempre `setDoc(doc(db, 'contacts', id), { tag }, { merge: true })` tanto en `chat.author` como en `chat.contactId`.

### 🟡 Lección 5: Escaneo de Código QR Nítido
- **Problema:** Renderizar el código QR en pantalla web a veces provoca que cámaras de teléfonos rechacen el escaneo si los márgenes blancos o el tamaño no son óptimos.
- **Solución:** Existe un generador nativo en backend (`qrcode.toFile`) que puede exportar `QR.png` a 600px en el Escritorio con borde blanco nítido para un escaneo infalible si hiciera falta revincular.

### 🟡 Lección 6: Sincronización Inmediata de Notas de Voz (Audios)
- **Problema:** `downloadMedia()` requiere unos segundos de demora para que WhatsApp termine de desencriptar el archivo internamente antes de entregarlo. Además, si Firebase Cloud Storage no tiene el bucket habilitado (error 404), la subida tradicional falla y el frontend queda trabado en "Descargando audio...". También `message_create` (audios salientes) debe descargar y sincronizar la nota de voz.
- **Regla Inviolable:**
  - Toda nota de voz se procesa con reintentos progresivos (`uploadMediaWithRetry`).
  - Al descargarse el base64 de WhatsApp, se construye un `data:audio/ogg;codecs=opus;base64,...` y se guarda directo en el campo `mediaUrl` del documento de Firestore.
  - Esto garantiza reproducción inmediata en el navegador sin depender de buckets externos ni configuraciones de permisos en la consola de Firebase.

---

## 🛠️ 3. Rutina de Mantenimiento y Despliegue

Cada vez que se realicen mejoras en el sistema:

1. **Compilar y verificar en local:**
   ```bash
   cd frontend
   npm run build
   ```
2. **Subir a GitHub:**
   ```bash
   git add .
   git commit -m "Descripción clara de la mejora"
   git push origin main
   ```
3. **Publicar a Vercel:**
   ```bash
   npx vercel --prod --token <VERCEL_TOKEN> --yes
   ```

---

## 📌 4. Estado Actual del Sistema (Septiembre 2026)
- [x] Motor WhatsApp corriendo y autenticado con soporte completo de notas de voz.
- [x] Sincronización bidireccional en tiempo real con Firebase.
- [x] Soporte para identidades `@lid` y `@c.us`.
- [x] Interfaz de usuario original restaurada y responsiva.
- [x] Portal de Autenticación (`Login.jsx`) con Firebase Auth y Acceso Rápido del Equipo.
- [x] Módulo Marketing & Publicidad (`Marketing.jsx`) con Generador de Enlaces Inteligentes de WhatsApp (Click-to-WhatsApp).
- [x] Atribución automática de campañas de Meta Ads (Instagram/Facebook) y Google Ads en mensajes entrantes.
- [x] Captura de parámetros publicitarios (`utm_source`, `utm_campaign`, `gclid`, `fbclid`) en el formulario de la web oficial (`cobelgrano.com`).
- [x] Acceso directo al CRM desde el pie de página de la web oficial.
- [x] Guardado y conteo de etiquetas (Tags).
- [x] Métricas de "Tiempo en la App" enlazadas con colección `sessions`.
- [x] Módulo WebLeads integrado con alertas de badges rojos.
- [x] Script de inicio automático de Windows (`motor-whatsapp.vbs`) activo.
- [x] Integración de **Zernio API** (`https://zernio.com/api/v1`) para mensajería oficial en la nube mediante Meta Cloud API.
- [x] Módulo **Canales & Integraciones** (`Channels.jsx`) en el CRM con gestión de API Key, creación de perfil y vinculación oficial de WhatsApp vía Meta Embedded Signup en modo coexistencia (`onboarding=business_app`).
- [x] Despachador dual en backend (`zernioService.js`) conectado a la colección `outbox` de Firestore.

