/* =========================================================
   ACTUALIZAR — lee el Google Sheet y genera data/videos.js
   Lo corre GitHub Actions cada hora (ver .github/workflows).
   A mano: node scripts/actualizar.mjs

   Columnas del Sheet:
     A Módulo · B Categoría · C Publico/Interno · D Tipo · E Nombre · F Descripción · G Enlace
   Solo pasan a la página las filas con "Publico" en la columna C.
   ========================================================= */
import { readFile, writeFile } from "node:fs/promises";

const SHEET_ID = process.env.SHEET_ID || "1n-oMTI5QD1wbrYgVEK1POdfuec34eNW21QbOQvh1r3Y";
const URL_CSV = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;
const DESTINO = new URL("../data/videos.js", import.meta.url);

// ---------- Lectura del CSV (respeta comillas y saltos de línea dentro de celdas) ----------
function parsearCSV(texto) {
  const filas = [];
  let fila = [], celda = "", enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { celda += '"'; i++; }
      else if (c === '"') enComillas = false;
      else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(celda); celda = ""; }
    else if (c === "\n") { fila.push(celda); filas.push(fila); fila = []; celda = ""; }
    else if (c !== "\r") celda += c;
  }
  if (celda || fila.length) { fila.push(celda); filas.push(fila); }
  return filas;
}

// ---------- Limpieza de textos ----------
const sinAcentos = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpiar = (s = "") => s.replace(/\s+/g, " ").trim();
// Saca emojis y símbolos del principio ("📊 Reportes" -> "Reportes")
const sinEmoji = (s) => limpiar(s.replace(/^[^\p{L}\p{N}]+/u, ""));

// ---------- Enlace para mostrar adentro de la página ----------
function enlaceEmbebido(url) {
  let m;
  if ((m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([0-9a-f]+))?/i))) {
    const hash = m[2] || new URL(url).searchParams.get("h");
    return `https://player.vimeo.com/video/${m[1]}${hash ? `?h=${hash}` : ""}`;
  }
  if ((m = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/)))
    return `https://drive.google.com/file/d/${m[1]}/preview`;
  if ((m = url.match(/drive\.google\.com\/open\?id=([\w-]+)/)))
    return `https://drive.google.com/file/d/${m[1]}/preview`;
  if ((m = url.match(/docs\.google\.com\/(document|presentation|spreadsheets)\/d\/([\w-]+)/)))
    return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  return null; // otro sitio: se abre en una pestaña nueva
}

function fuente(url) {
  if (/vimeo\.com/.test(url)) return "vimeo";
  if (/docs\.google\.com/.test(url)) return "docs";
  if (/drive\.google\.com/.test(url)) return "drive";
  return "web";
}

// Identificador estable para compartir el enlace directo (#ver=...)
function identificador(url) {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/) || url.match(/\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : Buffer.from(url).toString("base64url").slice(-16);
}

// ---------- Proceso ----------
const respuesta = await fetch(URL_CSV, { redirect: "follow" });
if (!respuesta.ok) throw new Error(`No se pudo leer el Sheet (HTTP ${respuesta.status}). ¿Sigue compartido como "cualquiera con el enlace"?`);
const texto = await respuesta.text();
if (texto.trimStart().startsWith("<")) throw new Error("Google devolvió una página en vez del CSV: revisá que el Sheet siga compartido con enlace.");

const [, ...filas] = parsearCSV(texto); // la primera fila son los títulos
const vistos = new Set();
const items = [];

for (const f of filas) {
  const [modulo, categoria, visibilidad, tipo, nombre, descripcion, enlace] = f.map((c) => limpiar(c));
  if (sinAcentos(visibilidad || "").toLowerCase() !== "publico") continue;
  if (!nombre || !/^https?:\/\//i.test(enlace || "")) continue;
  if (vistos.has(enlace)) continue; // mismo enlace cargado dos veces
  vistos.add(enlace);

  const tipoNorm = sinAcentos(tipo || "").toLowerCase();
  items.push({
    id: identificador(enlace),
    nombre,
    descripcion: descripcion || "",
    modulo: modulo || "General",
    categoria: sinEmoji(categoria || "") || "Otros",
    tipo: tipoNorm.includes("pdf") || tipoNorm.includes("guia") || tipoNorm.includes("doc") ? "guia" : "video",
    anterior: tipoNorm.includes("viejo"), // "Video Viejo": se muestra como versión anterior
    url: enlace,
    embed: enlaceEmbebido(enlace),
    fuente: fuente(enlace),
  });
}

if (!items.length) throw new Error("El Sheet no tiene filas públicas: no se actualiza la página para no dejarla vacía.");

// ---------- Miniatura, duración y permiso para mostrarlo en la página ----------
// Vimeo: su oEmbed da miniatura y duración, y responde 403 si el video es privado o no deja insertarse.
// Google: si el archivo no está compartido "con cualquiera con el enlace", pide iniciar sesión (401/403).
async function completar(item) {
  try {
    if (item.fuente === "vimeo") {
      const r = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(item.url)}`);
      if (r.status === 403 || r.status === 404) { item.embed = null; item.restringido = true; return; }
      if (!r.ok) return;
      const o = await r.json();
      item.miniatura = o.thumbnail_url?.replace(/_\d+x\d+/, "_640x360") || null;
      item.duracion = o.duration || null;
    } else if (item.fuente === "drive" || item.fuente === "docs") {
      const r = await fetch(item.embed, { redirect: "manual" });
      if (r.status === 401 || r.status === 403 || r.status === 404) { item.restringido = true; return; }
      item.miniatura = `https://drive.google.com/thumbnail?id=${item.id}&sz=w640`;
    }
  } catch { /* sin conexión con el servicio: se publica igual, sin miniatura */ }
}

const cola = [...items];
await Promise.all(Array.from({ length: 8 }, async () => { while (cola.length) await completar(cola.shift()); }));

const restringidos = items.filter((i) => i.restringido);
if (restringidos.length) {
  console.log(`\n${restringidos.length} publicados no se pueden ver dentro de la página (privados o sin compartir):`);
  for (const i of restringidos) console.log(`  - ${i.nombre} → ${i.url}`);
  console.log("");
}

// Solo se reescribe el archivo si cambió la lista (así no hay commits vacíos todos los días)
let anterior = null;
try {
  const actual = await readFile(DESTINO, "utf8");
  anterior = JSON.parse(actual.slice(actual.indexOf("{"), actual.lastIndexOf("}") + 1));
} catch { /* primera vez */ }

if (anterior && JSON.stringify(anterior.items) === JSON.stringify(items)) {
  console.log(`Sin cambios (${items.length} publicados).`);
} else {
  const datos = { actualizado: new Date().toISOString(), total: items.length, items };
  const archivo = "/* Archivo generado por scripts/actualizar.mjs — no editar a mano: los cambios se hacen en el Google Sheet */\n"
    + `window.GUIAS = ${JSON.stringify(datos, null, 2)};\n`;
  await writeFile(DESTINO, archivo);
  console.log(`Actualizado: ${items.length} publicados (antes ${anterior ? anterior.items.length : 0}).`);
}
