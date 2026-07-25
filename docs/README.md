# Documentación de DoctorData

Esta carpeta contiene el resumen técnico final y los diagramas utilizados para documentar la situación actual del MVP y su evolución propuesta.

## Documento final

- [Resumen técnico de DoctorData (PDF)](Resumen_tecnico_DoctorData_final.pdf)

El PDF presenta el problema, objetivo, alcance, arquitectura, flujo de protección de datos y conclusiones del proyecto. Para la entrega en GitHub se publica únicamente la versión PDF.

## Diagramas

- [Arquitectura AS-IS](arquitectura/arquitectura-as-is.png): infraestructura actual del MVP con React, Go, PostgreSQL, Cloudflare y VPS Vultr.
- [Arquitectura TO-BE](arquitectura/arquitectura-to-be.png): evolución propuesta hacia Azure AKS, PostgreSQL administrado, Blob Storage, Firebase y CI/CD.
- [Casos de uso por rol](diagramas/casos-de-uso-por-rol.png): funciones del paciente, doctor, administrador y superadministrador.
- [Flujo de datos, cifrado y sincronización](diagramas/flujo-datos-cifrado-sincronizacion.png): protección AES-256-GCM, persistencia y sincronización móvil prevista.

## Consideración de alcance

La arquitectura AS-IS representa el MVP vigente. La arquitectura TO-BE representa una propuesta de evolución y no un despliegue ya realizado.

## Rutas del código fuente

El código del proyecto se encuentra organizado en tres aplicaciones:

- [Backend API en Go](../doctordata-backend-go/): API REST, reglas de negocio, seguridad y acceso a PostgreSQL.
- [Frontend web React + Vite](../doctordata-frontend-react-vite/): plataforma web principal presentada en el MVP.
- [Aplicación móvil React Native](../doctordata-frontend-react-native/): cliente móvil y almacenamiento local.

### Backend Go

- [Punto de entrada de la API](../doctordata-backend-go/cmd/api/main.go)
- [Registro de rutas REST](../doctordata-backend-go/internal/server/routes.go)
- [Middleware de autenticación](../doctordata-backend-go/internal/middleware/auth.go)
- [Cifrado AES-256-GCM](../doctordata-backend-go/internal/crypto/cipher.go)
- [Tipos cifrados para GORM](../doctordata-backend-go/internal/crypto/types.go)
- [Conexión a PostgreSQL](../doctordata-backend-go/internal/database/database.go)
- [Modelos de datos](../doctordata-backend-go/internal/models/)
- [Handlers de la API](../doctordata-backend-go/internal/handlers/)
- [Configuración local con Docker Compose](../doctordata-backend-go/docker-compose.yml)
- [Despliegue QA](../doctordata-backend-go/deploy/qa/docker-compose.qa.yml)
- [Despliegue de producción](../doctordata-backend-go/deploy/prod/docker-compose.prod.yml)

### Frontend web

- [Componente principal y rutas](../doctordata-frontend-react-vite/src/App.jsx)
- [Cliente para consumir la API](../doctordata-frontend-react-vite/src/services/api.js)
- [Páginas del aplicativo](../doctordata-frontend-react-vite/src/pages/)
- [Componentes reutilizables](../doctordata-frontend-react-vite/src/components/)
- [Dependencias y comandos](../doctordata-frontend-react-vite/package.json)
- [Configuración QA](../doctordata-frontend-react-vite/deploy/qa/Caddyfile)
- [Configuración de producción](../doctordata-frontend-react-vite/deploy/prod/Caddyfile)

### Aplicación móvil

- [Componente principal](../doctordata-frontend-react-native/App.jsx)
- [Cliente para consumir la API](../doctordata-frontend-react-native/src/services/api.js)
- [Navegación](../doctordata-frontend-react-native/src/navigation/AppNavigator.jsx)
- [Pantallas](../doctordata-frontend-react-native/src/screens/)
- [Base de datos local](../doctordata-frontend-react-native/src/database/)
- [Dependencias y comandos](../doctordata-frontend-react-native/package.json)

> La evidencia principal del MVP corresponde al frontend web y al backend Go. Los directorios `deploy/qa` y `deploy/prod` contienen configuraciones separadas; disponer de una configuración de producción no significa que ese entorno se encuentre actualmente desplegado.
