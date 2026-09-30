# Guías Thinkion

Página pública con los videos y guías de Thinkion. Se alimenta sola desde el Google Sheet:
cada hora GitHub lee el Sheet y, si hay algo nuevo o cambiado, actualiza la página.

## Cómo se carga contenido

Todo se maneja desde el **Google Sheet**. No hay que tocar código.

| Columna | Qué va | Ejemplo |
|---|---|---|
| A | Módulo (pestañas de arriba) | Administrador, PDV, App Externa |
| B | Categoría (agrupa las tarjetas) | Caja, Productos, Reportes y Auditoría |
| C | **Publico** o **Interno**: solo "Publico" aparece en la página | Publico |
| D | Tipo | Video, Video Viejo, PDF |
| E | Nombre que se muestra | Apertura y cierre de caja |
| F | Descripción (opcional): se ve en la tarjeta y debajo del video | Cómo abrir la caja al empezar el turno y cerrarla al final |
| G | Enlace | https://vimeo.com/… · Google Drive · Google Docs |

- El módulo **SIN USO** no aparece como pestaña: sus videos se ven solo en "Todos".
- **PDF** se muestra como "Guía" (sirve para Google Docs o PDF en Drive).
- Si la fila no tiene nombre o enlace, se ignora. Si un enlace está repetido, se muestra una sola vez.

### Para que se vea dentro de la página

- **Vimeo:** el video tiene que permitir insertarse en otros sitios
  (en Vimeo: *Configuración del video → Privacidad → Dónde se puede insertar → Cualquier lugar*).
- **Google Drive / Docs:** el archivo tiene que estar compartido como *Cualquier persona con el enlace → Lector*.

Si no cumple eso, la tarjeta igual aparece, pero al tocarla abre el original en otra pestaña.
Cada vez que corre la actualización, el registro de GitHub lista cuáles están en esa situación.

## Subirlo a GitHub (una sola vez)

1. **Crear el repositorio.** Con GitHub Desktop: *File → Add local repository* → elegir la carpeta
   `Guias_thinkion` → *create a repository* → *Publish repository*.
   Destildar **"Keep this code private"**: GitHub Pages es gratis solo con repositorios públicos
   (en el repo solo hay contenido público, así que no hay problema).
2. **Activar la página.** En github.com, dentro del repositorio: *Settings → Pages* →
   *Source: Deploy from a branch* → *Branch: `main`* y carpeta */ (root)* → *Save*.
   En 1 o 2 minutos aparece arriba la dirección: `https://<usuario>.github.io/Guias_thinkion/`.
3. **Permitir que la actualización guarde cambios.** *Settings → Actions → General* →
   *Workflow permissions* → **Read and write permissions** → *Save*.
4. **Probarla.** Pestaña *Actions* → *Actualizar guías* → *Run workflow*.
   Si termina en verde, está todo listo.

A partir de ahí corre sola **todos los días a las 6:00 (hora de Argentina)**.

## Actualizar en el momento

Si cargaste un video y no querés esperar al día siguiente:
pestaña *Actions* → *Actualizar guías* → *Run workflow*. En un par de minutos está en la página.

## Cosas a saber

- GitHub puede demorar unos minutos el horario programado; es normal.
- Si el repositorio pasa **60 días sin ningún cambio**, GitHub pausa la tarea automática y avisa por mail.
  Se reactiva desde *Actions → Actualizar guías → Enable workflow*.
- Si el Sheet deja de estar compartido con enlace, la actualización falla y **la página queda como estaba**
  (no se vacía). GitHub avisa por mail que falló.
- Si alguna vez se cambia el Sheet por otro, se reemplaza el ID en `scripts/actualizar.mjs` (constante `SHEET_ID`).
- Dirección propia (ej. `guias.thinkion.com.ar`): se configura en *Settings → Pages → Custom domain*
  y agregando un registro CNAME en el DNS del dominio.

## Ver la página en la computadora

Abrir `index.html` con doble clic. Para traer los últimos datos del Sheet antes:

```
node scripts/actualizar.mjs
```

##  Estructura

```
index.html                     La página
assets/estilos.css             Estilos (misma estética que la web de Thinkion)
assets/app.js                  Buscador, filtros y reproductor
assets/img/                    Logos y fondos
data/videos.js                 Lista generada desde el Sheet (no editar a mano)
scripts/actualizar.mjs         Lee el Sheet y genera data/videos.js
.github/workflows/actualizar.yml   Tarea diaria de GitHub
```
