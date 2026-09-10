# 📜 REGISTRO DE CAMBIOS Y MEJORAS (CHANGELOG)

Todos los cambios notables realizados en el sistema COB WhatsApp Dashboard quedan documentados en este archivo para referencia futura.

---

## [Versión 2.2.0] - 2026-09-10 (Integración Zernio API & Meta Cloud WhatsApp)

### 🚀 Nuevas Funcionalidades
- **Zernio API Client (`backend/zernioService.js`):** Integración oficial con `https://zernio.com/api/v1` para conectar WhatsApp vía Meta Cloud API.
- **Módulo de Canales & Integraciones (`frontend/src/components/Channels.jsx`):**
  - Panel administrativo para gestionar la API Key de Zernio.
  - Creación automatizada de perfil oficial de COB en Zernio.
  - Flujo de vinculación oficial con **Meta Embedded Signup** en modo coexistencia (`onboarding=business_app`), permitiendo usar el celular y la web simultáneamente.
  - Detección automática del callback de Meta en la URL para registrar el número vinculado en Firestore.
- **Despacho Dual de Mensajería (`backend/index.js`):** Enrutamiento inteligente de mensajes salientes (`outbox`) a través de Zernio Cloud API con fallback a WhatsApp Web local.
- **Tolerancia a Fallos:** Captura de excepciones globales de Puppeteer y SQLite journal para evitar interrupciones de servicio.

---

## [Versión 2.0.0] - 2026-09-10 (Migración a Firebase + Vercel + GitHub)

### 🚀 Nuevas Funcionalidades
- **Arquitectura Serverless Cloud:** Desacoplamiento total del Frontend y Backend. El Frontend ahora lee y escribe exclusivamente contra Google Firebase Firestore.
- **Despliegue Global en Vercel:** Aplicación accesible desde cualquier dispositivo mediante `https://frontend-lovat-five-bbcuj2lohv.vercel.app`.
- **Cola de Mensajes Salientes (`outbox`):** El frontend deposita mensajes en Firestore y el motor local los despacha a WhatsApp de forma instantánea.
- **Almacenamiento de Audios en la Nube:** Las notas de voz se suben a Firebase Storage (`audios/`) permitiendo reproducirlas en la nube sin exponer el disco de la computadora física.
- **Inicio Automático en Windows:** Script VBS silencioso (`motor-whatsapp.vbs`) alojado en la carpeta de inicio (`Startup`) de Windows para arranque automático tras reinicios.
- **Sección Web Leads:** Integración de formulario y alertas de consultas web con contador de badges en tiempo real.
- **Métricas de Sesión:** Medición del tiempo real de permanencia en cada chat, sincronizado a la colección `sessions` de Firestore y totalizado en el Panel de Control.

### 🐛 Correcciones Críticas (Bug Fixes)
- **Resolución de Identidades `@lid` vs `@c.us`:** WhatsApp Web asignaba identificadores de dispositivo vinculado (`@lid`) a los mensajes, mientras que la lista de contactos guardaba el número `@c.us`. Se adaptó `ChatView.jsx` para buscar en todas las variantes posibles, permitiendo que todos los mensajes antiguos y nuevos se visualicen correctamente.
- **Eliminación de dependencias de Índices Compuestos:** Se removió la ordenación `orderBy` en la consulta de Firestore para evitar errores de precondición (`failed-precondition`), realizando el ordenamiento cronológico en memoria de forma instantánea.
- **Restauración del Diseño Original:** Se reincorporaron las clases y dimensiones canónicas (`app-container`, `sidebar` 80px, `main-area`, `.message-time`), corrigiendo la deformación visual de íconos.
- **Estilizado de Barra de Entrada:** Implementación de estilos oscuros y redondeados para el campo de texto y botón de envío idénticos a WhatsApp Web.
- **Fusión Segura de Etiquetas (Tags):** Migración de `updateDoc` a `setDoc(..., { merge: true })` para garantizar que las etiquetas se creen o actualicen sin fallos.
- **Limpieza de Tareas Huérfanas:** Eliminación de procesos de Node residuales y de desarrollo local tras completar la migración a la nube.

---

## [Versión 1.0.0] - Versión Inicial Local
- Servidor Express monolítico con base de datos SQLite local (`messages.db`).
- Conexión inicial mediante `whatsapp-web.js` y `LocalAuth`.
- Reproducción y transcripción de audios con Whisper local y FFmpeg.
- Etiquetado de conversaciones y panel básico de control.
