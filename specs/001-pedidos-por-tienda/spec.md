# Spec 001 — Listado de pedidos por tienda con exportación CSV

> Estado: **Implementada y verificada** (`npm run verificar` en verde, ver `tasks.md`) · Metodología: SDD (Spec → Plan → Tasks → Implementación → Verificación)
>
> Este documento describe **qué** se construye y **cómo se comprueba**. El **cómo se construye** está en [`plan.md`](./plan.md) y el orden de trabajo en [`tasks.md`](./tasks.md).

## 1. Contexto

Varias tiendas comparten una misma base de datos Postgres (Supabase). Cada usuario pertenece a una sola tienda y necesita consultar y descargar los pedidos de **su** tienda.

## 2. Historias de usuario

- **HU-1** — Como usuario de una tienda, quiero ver los pedidos de mi tienda de 50 en 50 para recorrerlos sin que la página se vuelva lenta.
- **HU-2** — Como usuario, quiero filtrar por estado y que el filtro quede en la URL para poder recargar, volver atrás o compartir el enlace sin perderlo.
- **HU-3** — Como usuario, quiero descargar en CSV **todos** los pedidos que cumplen el filtro (no solo la página visible) y abrir el archivo en un Excel configurado en español sin tener que ajustar nada.
- **HU-4** — Como responsable de la plataforma, quiero que sea la base de datos la que impida que un usuario vea pedidos de otra tienda, aunque la pantalla o la API se usen de forma indebida.

## 3. Requisitos funcionales

| ID | Requisito |
|----|-----------|
| RF-01 | La base guarda tiendas, la pertenencia usuario → tienda (una tienda por usuario) y pedidos asociados a una tienda. |
| RF-02 | El listado muestra los pedidos ordenados del más reciente al más antiguo, en páginas de **50**. |
| RF-03 | El listado permite filtrar por un estado (`pendiente`, `pagado`, `enviado`, `entregado`, `cancelado`) o ver todos. |
| RF-04 | El filtro y la página viajan en la URL: `/pedidos?estado=<estado>&pagina=<n>`. Un estado o página inválidos se ignoran (se trata como "todos" / página 1). Cambiar el filtro vuelve a la página 1. |
| RF-05 | La descarga CSV (`/pedidos/exportar?estado=<estado>`) contiene **todas** las filas que cumplen el filtro, sin importar cuántas sean ni la página que se estaba viendo. |
| RF-06 | El CSV se abre correctamente en Excel con configuración regional en español (ver §5). |
| RF-07 | Un usuario solo puede leer pedidos de su tienda. La restricción la aplica Postgres mediante Row Level Security; la aplicación no filtra por tienda. |
| RF-08 | Ningún usuario de la aplicación puede crear, modificar ni borrar pedidos desde la API. |
| RF-09 | Las pantallas de pedidos requieren sesión iniciada; sin sesión se redirige a `/login` (el listado) o se responde 401 (la descarga). |
| RF-10 | Los datos de prueba se generan con un script del proyecto, de forma determinista. |

## 4. Criterios de aceptación

Cada criterio tiene al menos un test que lo comprueba (ver la matriz en `plan.md` §7).

**Aislamiento por tienda (la base lo garantiza)**
- **CA-01** — Dado un usuario de la tienda A, cuando consulta `orders` sin ningún filtro, entonces solo recibe filas con `store_id` de A y la cantidad coincide con el total real de A.
- **CA-02** — Dado un usuario de la tienda A, cuando consulta explícitamente `store_id = B`, entonces recibe 0 filas.
- **CA-03** — Dado un usuario sin tienda asignada, cuando consulta `orders`, entonces recibe 0 filas.
- **CA-04** — Dado un visitante anónimo (sin sesión), cuando consulta `orders`, entonces no obtiene filas.
- **CA-05** — Dado un usuario de la tienda A, cuando intenta insertar, actualizar o borrar un pedido (propio o ajeno), entonces la base lo rechaza o no afecta ninguna fila.
- **CA-06** — Dado un usuario de la tienda A, cuando intenta cambiarse a la tienda B modificando `store_members`, entonces la base lo rechaza.

**Listado y filtro**
- **CA-07** — Dada una tienda con más de 50 pedidos, la página 1 muestra exactamente 50 y la última muestra el resto.
- **CA-08** — Dado el filtro `estado=pagado`, todas las filas mostradas tienen estado `pagado` y el total coincide con la cantidad real de pedidos pagados de la tienda.
- **CA-09** — Dada la URL `?estado=xyz&pagina=-3`, se interpreta como "todos" y página 1.
- **CA-10** — Los enlaces de paginación conservan el estado filtrado; el formulario de filtro no conserva la página.

**Exportación CSV**
- **CA-11** — Dado un filtro que abarca más de 1000 pedidos (más que el máximo de filas por respuesta de la API), el CSV contiene todas las filas filtradas, sin duplicados.
- **CA-12** — El archivo empieza con BOM UTF-8, usa `;` como separador, `CRLF` como fin de línea, coma decimal en importes y fechas `dd/mm/aaaa hh:mm` en hora de Argentina.
- **CA-13** — Los textos con `;`, comillas o saltos de línea se escapan entre comillas dobles, duplicando las comillas internas; los acentos y la ñ se conservan.
- **CA-14** — Sin sesión, `/pedidos/exportar` responde 401.

## 5. Formato del CSV (contrato)

| Aspecto | Valor | Motivo |
|---|---|---|
| Codificación | UTF-8 con BOM (`EF BB BF`) | Sin BOM, Excel asume ANSI y rompe acentos y ñ. |
| Separador | `;` | En configuración regional española la coma es el separador decimal, así que Excel espera `;` como separador de lista. |
| Fin de línea | `CRLF` | El estándar RFC 4180 y lo que Excel espera. |
| Importe | `1234,50` (coma decimal, sin separador de miles) | Excel en español lo reconoce como número. |
| Fecha | `dd/mm/aaaa hh:mm`, zona `America/Argentina/Buenos_Aires` | Excel en español lo reconoce como fecha. |
| Columnas | `Número;Fecha;Cliente;Estado;Total` | |
| Nombre | `pedidos-<estado|todos>-<aaaa-mm-dd>.csv` | |

## 6. Fuera de alcance

Alta, edición o borrado de pedidos; gestión de usuarios y tiendas desde la app; más de una tienda por usuario; búsqueda por texto; ordenamiento configurable; despliegue a un Supabase remoto.
