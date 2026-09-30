/* =========================================================
   GUÍAS THINKION — buscador, filtros y reproductor
   Los datos vienen de data/videos.js (se genera desde el Google Sheet).
   ========================================================= */
(() => {
  const DATOS = window.GUIAS || { items: [] };
  const ITEMS = DATOS.items;

  // Orden de las pestañas de módulo; los que no estén acá van al final
  const ORDEN_MODULOS = ["Administrador", "PDV", "App Externa", "General"];
  // Módulos que no se muestran como pestaña ni como etiqueta (sus videos siguen en "Todos")
  const MODULOS_OCULTOS = ["SIN USO"];
  const moduloVisible = (m) => !MODULOS_OCULTOS.includes(m);

  const $ = (id) => document.getElementById(id);
  const el = {
    buscar: $("buscar"), modulos: $("modulos"), categorias: $("categorias"),
    resumen: $("resumen"), limpiar: $("limpiar"), resultados: $("resultados"),
    visor: $("visor"), visorRuta: $("visor-ruta"), visorTitulo: $("visor-titulo"),
    visorMarco: $("visor-marco"), visorDescripcion: $("visor-descripcion"), visorExterno: $("visor-externo"),
    visorCopiar: $("visor-copiar"), visorCerrar: $("visor-cerrar"),
  };

  const estado = { modulo: null, categoria: null, texto: "" };

  // ---------- Utilidades ----------
  const normalizar = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const escapar = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const contar = (lista, clave) => lista.reduce((m, i) => m.set(i[clave], (m.get(i[clave]) || 0) + 1), new Map());
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  const duracion = (seg) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;
  const NOMBRE_FUENTE = { vimeo: "Vimeo", drive: "Google Drive", docs: "Google Docs", web: "el sitio original" };

  // Resalta lo buscado sin romper el escapado del texto
  function resaltar(texto, busqueda) {
    const seguro = escapar(texto);
    if (!busqueda) return seguro;
    const base = normalizar(texto);
    const q = normalizar(busqueda);
    const partes = [];
    let desde = 0, i;
    while (q && (i = base.indexOf(q, desde)) !== -1) {
      partes.push(escapar(texto.slice(desde, i)), `<mark>${escapar(texto.slice(i, i + q.length))}</mark>`);
      desde = i + q.length;
    }
    partes.push(escapar(texto.slice(desde)));
    return partes.join("");
  }

  const ICONO_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z"/></svg>';
  const ICONO_GUIA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>';

  // ---------- Filtros ----------
  function coincide(item, { usarCategoria = true } = {}) {
    if (estado.modulo && item.modulo !== estado.modulo) return false;
    if (usarCategoria && estado.categoria && item.categoria !== estado.categoria) return false;
    if (estado.texto) {
      const q = normalizar(estado.texto);
      return normalizar(`${item.nombre} ${item.descripcion || ""} ${item.categoria} ${item.modulo}`).includes(q);
    }
    return true;
  }

  function dibujarModulos() {
    const cuentas = contar(ITEMS, "modulo");
    const modulos = [...cuentas.keys()].filter(moduloVisible).sort((a, b) => {
      const ia = ORDEN_MODULOS.indexOf(a), ib = ORDEN_MODULOS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
    el.modulos.innerHTML = [null, ...modulos].map((m) =>
      `<button type="button" role="tab" data-modulo="${m ? escapar(m) : ""}" aria-selected="${m === estado.modulo}">${m ? escapar(m) : "Todos"}</button>`
    ).join("");
  }

  function dibujarCategorias() {
    // Las categorías que se muestran dependen del módulo y de la búsqueda
    const visibles = ITEMS.filter((i) => coincide(i, { usarCategoria: false }));
    const cuentas = contar(visibles, "categoria");
    if (estado.categoria && !cuentas.has(estado.categoria)) estado.categoria = null;
    const categorias = [...cuentas.keys()].sort((a, b) => cuentas.get(b) - cuentas.get(a) || a.localeCompare(b, "es"));
    el.categorias.innerHTML = categorias.length < 2 ? "" : [null, ...categorias].map((c) =>
      `<button type="button" data-categoria="${c ? escapar(c) : ""}" aria-pressed="${c === estado.categoria}">${c ? escapar(c) : "Todas"} <small>${c ? cuentas.get(c) : visibles.length}</small></button>`
    ).join("");
  }

  function tarjeta(item) {
    const esGuia = item.tipo === "guia";
    const externo = !item.embed || item.restringido;
    const chips = [
      esGuia ? '<span class="chip chip--guia">Guía</span>' : '<span class="chip">Video</span>',
      moduloVisible(item.modulo) ? `<span class="chip">${escapar(item.modulo)}</span>` : "",
    ].join("");
    const imagen = item.miniatura ? `<img src="${escapar(item.miniatura)}" alt="" loading="lazy" onerror="this.remove()">` : "";
    const contenido = `
      <span class="tarjeta__imagen">
        ${imagen}
        <span class="tarjeta__icono${esGuia ? " tarjeta__icono--guia" : ""}">${esGuia ? ICONO_GUIA : ICONO_PLAY}</span>
        ${item.duracion ? `<span class="tarjeta__duracion">${duracion(item.duracion)}</span>` : ""}
      </span>
      <span class="tarjeta__cuerpo">
        <span class="tarjeta__nombre">${resaltar(item.nombre, estado.texto)}</span>
        ${item.descripcion ? `<span class="tarjeta__descripcion">${resaltar(item.descripcion, estado.texto)}</span>` : ""}
        <span class="tarjeta__datos">${chips}</span>
      </span>`;
    // Si no se puede mostrar adentro (privado o sin compartir), la tarjeta es un enlace al original
    return externo
      ? `<a class="tarjeta" href="${escapar(item.url)}" target="_blank" rel="noopener">${contenido}</a>`
      : `<button class="tarjeta" type="button" data-id="${escapar(item.id)}">${contenido}</button>`;
  }

  function dibujarResultados() {
    const lista = ITEMS.filter((i) => coincide(i));
    const filtrando = Boolean(estado.modulo || estado.categoria || estado.texto);
    el.limpiar.hidden = !filtrando;

    if (!lista.length) {
      el.resumen.textContent = "Sin resultados";
      el.resultados.innerHTML = '<div class="vacio"><strong>No encontramos nada con esa búsqueda</strong>Probá con otra palabra o limpiá los filtros.</div>';
      return;
    }

    const videos = lista.filter((i) => i.tipo === "video").length;
    const guias = lista.length - videos;
    el.resumen.textContent = [videos && plural(videos, "video", "videos"), guias && plural(guias, "guía", "guías")].filter(Boolean).join(" y ");

    // Agrupado por categoría, las más grandes primero
    const grupos = new Map();
    for (const i of lista) grupos.set(i.categoria, [...(grupos.get(i.categoria) || []), i]);
    el.resultados.innerHTML = [...grupos].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], "es")).map(([cat, items]) => `
      <section class="grupo">
        <h2 class="grupo__titulo">${escapar(cat)} <span class="grupo__cantidad">${items.length}</span></h2>
        <div class="grilla">${items.map(tarjeta).join("")}</div>
      </section>`).join("");
  }

  function actualizar() {
    dibujarModulos();
    dibujarCategorias();
    dibujarResultados();
  }

  // ---------- Visor ----------
  function abrir(id, { desdeEnlace = false } = {}) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item || !item.embed || item.restringido) return;
    const esGuia = item.tipo === "guia";
    el.visorRuta.textContent = moduloVisible(item.modulo) ? `${item.modulo} · ${item.categoria}` : item.categoria;
    el.visorTitulo.textContent = item.nombre;
    el.visorDescripcion.textContent = item.descripcion || "";
    el.visorDescripcion.hidden = !item.descripcion;
    el.visorMarco.className = `visor__marco visor__marco--${esGuia ? "guia" : "video"}`;
    const iframe = document.createElement("iframe");
    iframe.src = item.embed + (item.fuente === "vimeo" ? `${item.embed.includes("?") ? "&" : "?"}autoplay=1&dnt=1` : "");
    iframe.title = item.nombre;
    iframe.allow = "autoplay; fullscreen; picture-in-picture; clipboard-write";
    iframe.allowFullscreen = true;
    el.visorMarco.replaceChildren(iframe);
    el.visorExterno.href = item.url;
    el.visorExterno.textContent = `Abrir en ${NOMBRE_FUENTE[item.fuente]} ↗`;
    el.visorCopiar.textContent = "Copiar enlace";
    if (!desdeEnlace) history.replaceState(null, "", `#ver=${encodeURIComponent(id)}`);
    if (!el.visor.open) el.visor.showModal();
  }

  function cerrar() {
    el.visorMarco.replaceChildren(); // corta la reproducción
    if (el.visor.open) el.visor.close();
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
  }

  // ---------- Eventos ----------
  el.modulos.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    estado.modulo = b.dataset.modulo || null;
    estado.categoria = null;
    actualizar();
  });

  el.categorias.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    estado.categoria = b.dataset.categoria || null;
    dibujarCategorias();
    dibujarResultados();
  });

  let espera;
  el.buscar.addEventListener("input", () => {
    clearTimeout(espera);
    espera = setTimeout(() => { estado.texto = el.buscar.value.trim(); dibujarCategorias(); dibujarResultados(); }, 120);
  });

  el.limpiar.addEventListener("click", () => {
    Object.assign(estado, { modulo: null, categoria: null, texto: "" });
    el.buscar.value = "";
    actualizar();
  });

  el.resultados.addEventListener("click", (e) => {
    const b = e.target.closest("button.tarjeta");
    if (b) abrir(b.dataset.id);
  });

  el.visorCerrar.addEventListener("click", cerrar);
  el.visor.addEventListener("close", cerrar);
  el.visor.addEventListener("click", (e) => { if (e.target === el.visor) cerrar(); }); // clic fuera de la caja

  el.visorCopiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      el.visorCopiar.textContent = "¡Copiado!";
    } catch {
      el.visorCopiar.textContent = "No se pudo copiar";
    }
  });

  // Enlace directo a un video: .../#ver=1182132943
  function abrirDesdeEnlace() {
    const m = location.hash.match(/^#ver=(.+)$/);
    if (m) abrir(decodeURIComponent(m[1]), { desdeEnlace: true });
  }
  window.addEventListener("hashchange", abrirDesdeEnlace);

  // ---------- Inicio ----------
  if (DATOS.actualizado) {
    const fecha = new Date(DATOS.actualizado).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
    $("actualizado").textContent = `Biblioteca actualizada el ${fecha}`;
  }
  $("anio").textContent = new Date().getFullYear();
  actualizar();
  abrirDesdeEnlace();
})();
