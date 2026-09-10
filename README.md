# 🏥 Consultorio COB - WhatsApp Dashboard & Management System

Panel de control en la nube y sincronizador en tiempo real para la atención de WhatsApp del Consultorio COB.

🌐 **Panel Web Oficial (Vercel):** [https://frontend-lovat-five-bbcuj2lohv.vercel.app](https://frontend-lovat-five-bbcuj2lohv.vercel.app)  
📦 **Repositorio GitHub:** [https://github.com/RamiStein/cobelgrano](https://github.com/RamiStein/cobelgrano)  
☁️ **Base de Datos:** Google Firebase Firestore & Storage (`cobelgrano-36019`)

---

## 📚 Documentación de Memoria y Arquitectura
- Para entender en profundidad las decisiones técnicas, lecciones aprendidas y reglas de oro del sistema, consulta el [Libro de Memorias (SYSTEM_MEMORY.md)](./SYSTEM_MEMORY.md).
- Para revisar el historial de versiones y mejoras, consulta el [Registro de Cambios (CHANGELOG.md)](./CHANGELOG.md).

---

## ⚡ Estructura del Proyecto

- `/frontend`: Aplicación React + Vite alojada en Vercel. Consulta y actualiza los datos en Firebase Firestore en tiempo real.
- `/backend`: Motor ligero de Node.js que corre en la computadora física del consultorio para interactuar con la sesión de WhatsApp.
- `SYSTEM_MEMORY.md`: Registro permanente de memoria para desarrolladores y asistentes de IA.
- `CHANGELOG.md`: Historial de versiones y correcciones críticas.

---

## 🚀 Puesta en Marcha Rápida (Local)

El motor de WhatsApp de la computadora local se inicia automáticamente con Windows. Si alguna vez necesitas correrlo manualmente:

```bash
cd backend
node index.js
```
