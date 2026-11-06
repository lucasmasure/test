// ─── ÉDITEUR DU SITE 327TH — MOTEUR (chargé sur toutes les pages) ──
//
// Les modifications faites par le Gérant depuis « 🛠 Pannel »
// sont enregistrées DIRECTEMENT DANS LE DÉPÔT GITHUB du site :
//   - code d'une page, fichiers du site, nouvelles pages → les vrais
//     fichiers (.html, .js, .css) sont modifiés / créés par un commit ;
//   - modifications visuelles, thème, polices, images Imgur, menu,
//     CSS/JS globaux → fichier « site-editor-data.json », appliqué
//     ici pour tous les visiteurs.
//
// GitHub Pages met environ une minute à publier un commit. Pendant ce
// temps, le navigateur du Gérant qui a fait la modification l'affiche
// déjà (aperçu local, « 327th_se_pending »).
//
// Mode secours : ajouter ?se-safe=1 à l'adresse d'une page pour
// l'afficher SANS site-editor-data.json ni aperçu local. Le bouton de
// l'éditeur reste disponible.
//
// Le panneau d'édition est dans site-editor-panel.js : il n'est
// téléchargé que lorsqu'un Gérant l'ouvre.
(function () {
  'use strict';

  if (window.SiteEditor && window.SiteEditor.__phase2) return;

  var DATA_FILE = 'site-editor-data.json';
  var CACHE_KEY = '327th_se_cache_v2';
  var PENDING_KEY = '327th_se_pending';
  var PENDING_TTL = 20 * 60 * 1000; // aperçu local gardé 20 min au plus

  var params = new URLSearchParams(location.search);
  var SAFE = params.has('se-safe');
  var FILE = (function () {
    var f = location.pathname.split('/').pop() || 'index.html';
    try { f = decodeURIComponent(f); } catch (e) { /* garde tel quel */ }
    return f;
  })();
  var KEY = FILE;

  function hasKeys(o) { return !!o && typeof o === 'object' && Object.keys(o).length > 0; }

  // ── Stockage local ──────────────────────────────────────────────
  function readJson(key) {
    try {
      var v = JSON.parse(localStorage.getItem(key));
      if (v && typeof v === 'object') return v;
    } catch (e) { /* ignore */ }
    return {};
  }
  function writeJson(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch (e) { return false; }
  }
  var cache = readJson(CACHE_KEY);      // { data, fontCss }
  var pending = readJson(PENDING_KEY);  // { files: {chemin: {content, ts}}, data: {json, ts} }
  pending.files = pending.files || {};
  (function prunePending() {
    var now = Date.now(), changed = false;
    Object.keys(pending.files).forEach(function (p) {
      if (!pending.files[p] || now - pending.files[p].ts > PENDING_TTL) { delete pending.files[p]; changed = true; }
    });
    if (pending.data && now - pending.data.ts > PENDING_TTL) { delete pending.data; changed = true; }
    if (changed) writeJson(PENDING_KEY, pending);
  })();
  function savePending() {
    if (!writeJson(PENDING_KEY, pending)) {
      // Trop gros : on ne garde que la page en cours
      var keep = {};
      if (pending.files[FILE]) keep[FILE] = pending.files[FILE];
      pending.files = keep;
      writeJson(PENDING_KEY, pending);
    }
  }
  function pendingFiles() {
    var out = {};
    if (SAFE) return out;
    Object.keys(pending.files).forEach(function (p) {
      if (pending.files[p] && typeof pending.files[p].content === 'string') out[p] = pending.files[p].content;
    });
    return out;
  }

  // ── Rendu d'un document complet (aperçu d'un code pas encore en ligne)
  function escapeScript(code) { return String(code).replace(/<\/script/gi, '<\\/script'); }
  function escapeStyle(code) { return String(code).replace(/<\/style/gi, '<\\/style'); }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function rewriteFiles(html, files) {
    Object.keys(files).forEach(function (name) {
      var content = files[name];
      var n = escRe(name);
      if (/\.js$/i.test(name)) {
        var reS = new RegExp('<script([^>]*?)\\ssrc=["\']?(?:\\./)?' + n + '(?:\\?[^"\'\\s>]*)?["\']?([^>]*)>\\s*</script>', 'gi');
        html = html.replace(reS, function () {
          return '<script data-se-file="' + name + '">' + escapeScript(content) + '\n</script>';
        });
      } else if (/\.css$/i.test(name)) {
        var reL = new RegExp('<link([^>]*?)href=["\']?(?:\\./)?' + n + '(?:\\?[^"\'\\s>]*)?["\']?([^>]*)>', 'gi');
        html = html.replace(reL, function (m) {
          if (!/stylesheet/i.test(m)) return m;
          return '<style data-se-file="' + name + '">' + escapeStyle(content) + '</style>';
        });
      }
    });
    return html;
  }
  function markDoc(html) {
    if (/<html[\s>]/i.test(html)) return html.replace(/<html(\s|>)/i, '<html data-se-doc$1');
    return '<!DOCTYPE html><html data-se-doc><head><meta charset="UTF-8"></head><body>' + html + '</body></html>';
  }
  // Arrête l'affichage de la page d'origine : tout ce qui suit ce script
  // devient du texte invisible (aucun script ne s'exécute).
  function haltOriginal() {
    if (document.readyState === 'loading') document.write('<plaintext style="display:none!important">');
  }
  function renderDocument(html, files) {
    html = markDoc(rewriteFiles(html, files));
    window.__SE_RENDERING = true;
    function go() {
      setTimeout(function () {
        document.open();
        document.write(html);
        document.close();
      }, 0);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
    else go();
  }

  // ── PHASE 1 : aperçu local d'un fichier pas encore publié ───────
  var isRenderedDoc = document.documentElement.hasAttribute('data-se-doc');
  if (!isRenderedDoc && !window.__SE_RENDERING && !SAFE) {
    var pf = pendingFiles();
    var others = {};
    Object.keys(pf).forEach(function (p) { if (/\.(js|css)$/i.test(p)) others[p] = pf[p]; });
    if (pf[FILE]) {
      haltOriginal();
      renderDocument(pf[FILE], others);
      return;
    }
    if (hasKeys(others)) {
      haltOriginal();
      fetch(location.href.split('#')[0], { cache: 'force-cache' })
        .then(function (r) { return r.text(); })
        .then(function (h) { renderDocument(h, others); })
        .catch(function () { location.replace(location.pathname + '?se-safe=1'); });
      return;
    }
  }

  // ── PHASE 2 : appliquer les modifications sur ce document ───────
  function pickData(live) {
    // L'aperçu local gagne s'il est plus récent que la version en ligne
    if (!SAFE && pending.data && pending.data.json && (+pending.data.json.rev || 0) > (+(live && live.rev) || 0)) return pending.data.json;
    return live || {};
  }
  var state = { data: {}, global: {}, page: {}, fontCss: cache.fontCss || {} };
  function setState(d) {
    state.data = d || {};
    state.global = state.data.global || {};
    state.page = (state.data.pages || {})[KEY] || {};
  }
  setState(SAFE ? {} : pickData(cache.data));

  var applied = [];          // { el, restore() } pour pouvoir annuler
  var origPaths = new WeakMap();
  var snapshotDone = false;
  var pendingObserver = null;

  // Chemin d'un élément : « body>div:2>p:0 » ou « #id>span:1 ».
  // On ne compte pas les blocs ajoutés par l'éditeur ni son interface.
  function skipNode(c) {
    return c.hasAttribute('data-se-added') || c.hasAttribute('data-se-ui');
  }
  function stableId(id) { return id && !/^se-/.test(id) && id.indexOf('>') === -1; }
  function livePath(el) {
    var segs = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      var added = el.getAttribute('data-se-added');
      if (added) { segs.unshift('@' + added); return segs.join('>'); }
      if (stableId(el.id) && document.getElementById(el.id) === el) {
        segs.unshift('#' + el.id);
        return segs.join('>');
      }
      var p = el.parentElement;
      if (!p) break;
      var n = 0;
      for (var c = p.firstElementChild; c && c !== el; c = c.nextElementSibling) {
        if (c.tagName === el.tagName && !skipNode(c)) n++;
      }
      segs.unshift(el.tagName.toLowerCase() + ':' + n);
      el = p;
    }
    segs.unshift('body');
    return segs.join('>');
  }
  function pathOf(el) { return origPaths.get(el) || livePath(el); }
  function resolve(path) {
    if (!path) return null;
    var segs = path.split('>');
    var first = segs.shift();
    var cur = null;
    if (first === 'body') cur = document.body;
    else if (first[0] === '#') cur = document.getElementById(first.slice(1));
    else if (first[0] === '@') cur = document.querySelector('[data-se-added="' + first.slice(1).replace(/"/g, '') + '"]');
    for (var i = 0; cur && i < segs.length; i++) {
      var m = /^([a-z0-9-]+):(\d+)$/i.exec(segs[i]);
      if (!m) return null;
      var tag = m[1].toUpperCase(), idx = +m[2], n = 0, found = null;
      for (var c = cur.firstElementChild; c; c = c.nextElementSibling) {
        if (c.tagName !== tag || skipNode(c)) continue;
        if (n === idx) { found = c; break; }
        n++;
      }
      cur = found;
    }
    return cur;
  }
  function snapshot() {
    if (snapshotDone || !document.body) return;
    snapshotDone = true;
    var all = document.body.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      if (!all[i].closest('[data-se-ui],[data-se-added]')) origPaths.set(all[i], livePath(all[i]));
    }
  }

  function kebab(p) { return p.indexOf('-') !== -1 ? p : p.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }); }

  function runScripts(container) {
    container.querySelectorAll('script').forEach(function (old) {
      var s = document.createElement('script');
      Array.prototype.forEach.call(old.attributes, function (a) { s.setAttribute(a.name, a.value); });
      s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
    });
  }

  function sortedEdits(edits) {
    return Object.keys(edits || {}).map(function (id) {
      var e = edits[id];
      return e && typeof e === 'object' ? Object.assign({ id: id }, e) : null;
    }).filter(Boolean).sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
  }

  function applySet(el, e) {
    var before = {
      html: e.html != null ? el.innerHTML : null,
      style: el.getAttribute('style'),
      attrs: {}
    };
    var attrNames = ['src', 'srcset', 'alt', 'href', 'target', 'class', 'title'];
    if (e.attrs) attrNames = attrNames.concat(Object.keys(e.attrs));
    attrNames.forEach(function (a) { before.attrs[a] = el.getAttribute(a); });
    applied.push({
      el: el,
      restore: function () {
        if (before.html != null) el.innerHTML = before.html;
        if (before.style == null) el.removeAttribute('style'); else el.setAttribute('style', before.style);
        Object.keys(before.attrs).forEach(function (a) {
          if (before.attrs[a] == null) el.removeAttribute(a); else el.setAttribute(a, before.attrs[a]);
        });
      }
    });
    if (e.html != null) { el.innerHTML = e.html; runScripts(el); }
    if (e.src) { el.setAttribute('src', e.src); el.removeAttribute('srcset'); }
    if (e.alt != null) el.setAttribute('alt', e.alt);
    if (e.href != null) el.setAttribute('href', e.href);
    if (e.target != null) { if (e.target) el.setAttribute('target', e.target); else el.removeAttribute('target'); }
    if (e.className != null) el.setAttribute('class', e.className);
    if (e.title != null) el.setAttribute('title', e.title);
    if (e.attrs) Object.keys(e.attrs).forEach(function (a) {
      try {
        if (e.attrs[a] === null || e.attrs[a] === false) el.removeAttribute(a);
        else el.setAttribute(a, e.attrs[a]);
      } catch (err) { /* nom d'attribut invalide */ }
    });
    if (e.css) el.setAttribute('style', (el.getAttribute('style') || '') + ';' + e.css);
    if (e.style) Object.keys(e.style).forEach(function (p) {
      var v = e.style[p];
      if (v !== '' && v != null) el.style.setProperty(kebab(p), v, 'important');
    });
    if (e.bg) el.style.setProperty('background-image', 'url("' + String(e.bg).replace(/"/g, '%22') + '")', 'important');
    if (e.hidden) el.style.setProperty('display', 'none', 'important');
  }

  function insertBlock(e, anchor) {
    var wrap = document.createElement('div');
    wrap.setAttribute('data-se-added', e.id);
    wrap.style.display = 'contents';
    wrap.innerHTML = e.html || '';
    var pos = e.pos || 'after';
    if (pos === 'before') anchor.parentNode.insertBefore(wrap, anchor);
    else if (pos === 'prepend') anchor.insertBefore(wrap, anchor.firstChild);
    else if (pos === 'append') anchor.appendChild(wrap);
    else anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    runScripts(wrap);
    applied.push({ el: wrap, restore: function () { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); } });
  }

  function moveEl(el, anchor, pos) {
    var parent = el.parentNode, next = el.nextSibling;
    if (pos === 'before') anchor.parentNode.insertBefore(el, anchor);
    else if (pos === 'append') anchor.appendChild(el);
    else if (pos === 'prepend') anchor.insertBefore(el, anchor.firstChild);
    else anchor.parentNode.insertBefore(el, anchor.nextSibling);
    applied.push({ el: el, restore: function () { if (parent) parent.insertBefore(el, next && next.parentNode === parent ? next : null); } });
  }

  var unresolved = [];
  function resetEdits() {
    for (var i = applied.length - 1; i >= 0; i--) {
      try { applied[i].restore(); } catch (e) { /* ignore */ }
    }
    applied = [];
  }

  function applyEdits(edits) {
    snapshot();
    resetEdits();
    var list = sortedEdits(edits);
    unresolved = [];
    // 1. On trouve tous les éléments d'origine AVANT toute modification
    var targets = {}, anchors = {};
    list.forEach(function (e) {
      if (e.type === 'set' || e.type === 'move') targets[e.id] = resolve(e.path);
      if (e.type === 'move' && e.anchor && e.anchor[0] !== '@') anchors[e.id] = resolve(e.anchor);
    });
    // 2. Modifications d'éléments
    list.forEach(function (e) {
      if (e.type !== 'set') return;
      if (targets[e.id]) applySet(targets[e.id], e); else unresolved.push(e);
    });
    // 3. Blocs ajoutés (un bloc peut s'ancrer à un autre bloc ajouté)
    list.forEach(function (e) {
      if (e.type !== 'add') return;
      var anchor = resolve(e.anchor);
      if (anchor && (anchor.parentNode || e.pos === 'append' || e.pos === 'prepend')) insertBlock(e, anchor);
      else unresolved.push(e);
    });
    // 4. Déplacements
    list.forEach(function (e) {
      if (e.type !== 'move') return;
      var el = targets[e.id], anchor = anchors[e.id] || resolve(e.anchor);
      if (el && anchor && anchor !== el && !el.contains(anchor)) moveEl(el, anchor, e.pos);
    });
    watchUnresolved();
    document.dispatchEvent(new CustomEvent('327th-site-editor-applied'));
  }

  // Contenu affiché plus tard par les scripts de la page (données
  // Firebase, etc.) : on réessaie pendant 20 secondes.
  function watchUnresolved() {
    if (pendingObserver) { pendingObserver.disconnect(); pendingObserver = null; }
    if (!unresolved.length || !window.MutationObserver) return;
    var timer = null;
    pendingObserver = new MutationObserver(function () {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        var still = [];
        unresolved.forEach(function (e) {
          if (e.type === 'set') {
            var el = resolve(e.path);
            if (el) applySet(el, e); else still.push(e);
          } else if (e.type === 'add') {
            var a = resolve(e.anchor);
            if (a) insertBlock(e, a); else still.push(e);
          }
        });
        unresolved = still;
        if (!still.length && pendingObserver) { pendingObserver.disconnect(); pendingObserver = null; }
      }, 120);
    });
    pendingObserver.observe(document.body, { childList: true, subtree: true });
    setTimeout(function () { if (pendingObserver) { pendingObserver.disconnect(); pendingObserver = null; } }, 20000);
  }

  // ── Styles : thème, polices, CSS global et CSS de page ──────────
  function styleEl(id) {
    var s = document.getElementById(id);
    if (!s) {
      s = document.createElement('style');
      s.id = id;
      s.setAttribute('data-se-ui', '');
      (document.head || document.documentElement).appendChild(s);
    } else if (s.parentNode && s.parentNode.lastElementChild !== s) {
      s.parentNode.appendChild(s); // toujours après les styles de la page
    }
    return s;
  }

  function themeCss(g) {
    var t = g.theme || {};
    var css = '';
    var vars = t.vars || {};
    var decl = Object.keys(vars).filter(function (k) { return vars[k]; }).map(function (k) {
      return k + ':' + vars[k] + ' !important;';
    }).join('');
    if (decl) css += ':root{' + decl + '}\n';
    if (t.baseSize && +t.baseSize !== 100) css += 'html{font-size:' + (+t.baseSize) + '% !important;}\n';
    if (t.bgImage) {
      css += 'body{background-image:url("' + String(t.bgImage).replace(/"/g, '%22') + '") !important;background-size:cover !important;background-position:center !important;background-attachment:fixed !important;}\n';
    }
    if (t.bgColor) css += 'body{background-color:' + t.bgColor + ' !important;}\n';
    if (t.textColor) css += 'body{color:' + t.textColor + ' !important;}\n';
    return css;
  }

  // Remplacer une police du site (Orbitron / Exo 2) par une police
  // Google Fonts : on charge la nouvelle police SOUS LE NOM de
  // l'ancienne, donc tout le site suit sans toucher au code.
  var FONT_SLOTS = { fontTitle: 'Orbitron', fontBody: 'Exo 2' };
  function fontUrl(name, variant) {
    return 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + variant + '&display=swap';
  }
  function loadReplacementFont(name, asName) {
    var key = name + '→' + asName;
    if (state.fontCss[key]) return Promise.resolve(state.fontCss[key]);
    var variants = [':ital,wght@0,300;0,400;0,600;0,700;0,900;1,300;1,400', ':wght@300;400;600;700;900', ':wght@400;700', ''];
    var i = 0;
    function next() {
      if (i >= variants.length) return Promise.resolve('');
      return fetch(fontUrl(name, variants[i++])).then(function (r) {
        if (!r.ok) return next();
        return r.text().then(function (css) {
          var out = css.replace(/font-family:\s*['"][^'"]+['"]/g, "font-family: '" + asName + "'");
          state.fontCss[key] = out;
          cache.fontCss = state.fontCss;
          writeJson(CACHE_KEY, cache);
          return out;
        });
      }).catch(function () { return next(); });
    }
    return next();
  }
  function fontsCss(g) {
    var t = g.theme || {};
    var parts = [];
    var jobs = [];
    Object.keys(FONT_SLOTS).forEach(function (slot) {
      var name = (t[slot] || '').trim();
      if (!name || name === FONT_SLOTS[slot]) return;
      var key = name + '→' + FONT_SLOTS[slot];
      if (state.fontCss[key]) parts.push(state.fontCss[key]);
      else jobs.push(loadReplacementFont(name, FONT_SLOTS[slot]));
    });
    if (jobs.length) Promise.all(jobs).then(function () { applyStyles(); });
    return parts.join('\n');
  }
  function extraFontLinks(g, page) {
    var names = {};
    var t = g.theme || {};
    String(t.extraFonts || '').split(/[,\n]/).forEach(function (n) { n = n.trim(); if (n) names[n] = 1; });
    sortedEdits(page.edits).forEach(function (e) {
      var f = e.style && (e.style.fontFamily || e.style['font-family']);
      if (f) names[String(f).split(',')[0].replace(/['"]/g, '').trim()] = 1;
    });
    var SYSTEM = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|arial|helvetica|georgia|times new roman|verdana|tahoma|trebuchet ms|courier new|impact|orbitron|exo 2|inherit)$/i;
    Object.keys(names).forEach(function (n) {
      if (SYSTEM.test(n)) return;
      var id = 'se-font-' + n.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      if (document.getElementById(id)) return;
      var l = document.createElement('link');
      l.id = id; l.rel = 'stylesheet'; l.setAttribute('data-se-ui', '');
      l.href = fontUrl(n, ':ital,wght@0,400;0,700;1,400');
      l.onerror = function () { l.href = fontUrl(n, ''); l.onerror = null; };
      (document.head || document.documentElement).appendChild(l);
    });
  }

  function applyStyles() {
    var g = state.global || {}, p = state.page || {};
    styleEl('se-style-global').textContent = SAFE ? '' : fontsCss(g) + '\n' + themeCss(g) + '\n' + (g.css || '');
    styleEl('se-style-page').textContent = SAFE ? '' : (p.css || '');
    if (!SAFE) extraFontLinks(g, p);
  }

  var headInjected = false;
  function injectHead() {
    var g = state.global || {};
    if (headInjected || SAFE || !g.head) return;
    headInjected = true;
    var tpl = document.createElement('div');
    tpl.innerHTML = g.head;
    Array.prototype.slice.call(tpl.childNodes).forEach(function (n) {
      if (n.nodeType !== 1) return;
      n.setAttribute('data-se-ui', '');
      if (n.tagName === 'SCRIPT') {
        var s = document.createElement('script');
        Array.prototype.forEach.call(n.attributes, function (a) { s.setAttribute(a.name, a.value); });
        s.textContent = n.textContent;
        n = s;
      }
      document.head.appendChild(n);
    });
  }

  // ── Images remplacées (par nom de fichier) ──────────────────────
  var reverseImg = null;
  function originalName(img) {
    var src = img.getAttribute('data-se-orig') || img.getAttribute('src') || '';
    if (!reverseImg) {
      reverseImg = {};
      try {
        /* global IMG_OVERRIDES */
        if (typeof IMG_OVERRIDES !== 'undefined') {
          Object.keys(IMG_OVERRIDES).forEach(function (k) { reverseImg[IMG_OVERRIDES[k]] = k; });
        }
      } catch (e) { /* ignore */ }
    }
    if (reverseImg[src]) return reverseImg[src];
    var f = src.split('?')[0].split('#')[0].split('/').pop();
    try { f = decodeURIComponent(f); } catch (e) { /* ignore */ }
    return f;
  }
  function imageMap() {
    var imgs = (state.global && state.global.images) || {};
    var m = {};
    Object.keys(imgs).forEach(function (k) { if (typeof imgs[k] === 'string' && imgs[k]) m[k] = imgs[k]; });
    return m;
  }
  function applyImages(root) {
    if (SAFE) return;
    var m = imageMap();
    if (!hasKeys(m)) return;
    var list = root.tagName === 'IMG' ? [root] : root.querySelectorAll('img');
    Array.prototype.forEach.call(list, function (img) {
      if (img.closest('[data-se-ui]')) return;
      var name = originalName(img);
      if (m[name] && img.getAttribute('src') !== m[name]) {
        if (!img.hasAttribute('data-se-orig')) img.setAttribute('data-se-orig', img.getAttribute('src') || '');
        img.setAttribute('src', m[name]);
        img.removeAttribute('srcset');
      }
    });
  }
  var imgObserver = null;
  function watchImages() {
    if (imgObserver || !window.MutationObserver || SAFE) return;
    imgObserver = new MutationObserver(function (muts) {
      if (!hasKeys(imageMap())) return;
      muts.forEach(function (mu) {
        mu.addedNodes.forEach(function (n) { if (n.nodeType === 1) applyImages(n); });
      });
    });
    imgObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── Menu de navigation (toutes les pages) ───────────────────────
  function navText(el) { return (el.textContent || '').replace(/[⌄\s\u200B]+/g, ' ').trim(); }
  function applyNav() {
    var nav = document.querySelector('nav');
    if (!nav || SAFE) return;
    var links = nav.querySelector('.nav-links') || nav;
    nav.querySelectorAll('[data-se-nav]').forEach(function (n) { n.parentNode.removeChild(n); });
    var g = state.global || {};

    // Liens existants renommés / masqués
    var navEdits = g.navEdits || {};
    var byText = {};
    Object.keys(navEdits).forEach(function (k) { var ne = navEdits[k]; if (ne && ne.match) byText[ne.match] = ne; });
    nav.querySelectorAll('a, .dropbtn').forEach(function (a) {
      if (a.closest('[data-se-nav]')) return;
      if (!a.hasAttribute('data-se-navorig')) a.setAttribute('data-se-navorig', navText(a));
      var ne = byText[a.getAttribute('data-se-navorig')];
      var item = a.classList.contains('dropbtn') ? a.closest('.dropdown') || a : a;
      if (!ne) return;
      if (ne.hidden) item.style.setProperty('display', 'none', 'important');
      if (ne.label) a.textContent = ne.label + (a.classList.contains('dropbtn') && ne.label.indexOf('⌄') === -1 ? ' ⌄' : '');
      if (ne.href && a.tagName === 'A') a.setAttribute('href', ne.href);
    });

    // Liens ajoutés
    var added = g.nav || {};
    Object.keys(added).map(function (k) { return Object.assign({ id: k }, added[k]); })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0); })
      .forEach(function (l) {
        if (!l.label) return;
        var a = document.createElement('a');
        a.href = l.href || '#';
        a.textContent = l.label;
        if (l.newTab) { a.target = '_blank'; a.rel = 'noopener'; }
        if (l.href && (l.href === FILE || decodeURIComponent(l.href) === FILE)) a.className = 'active';
        if (l.parent) {
          var dd = null;
          links.querySelectorAll('.dropdown').forEach(function (d) {
            var b = d.querySelector(':scope > .dropbtn');
            if (b && !dd && (b.getAttribute('data-se-navorig') || navText(b)) === l.parent) dd = d;
          });
          if (!dd) {
            // Nouveau menu déroulant
            dd = links.querySelector('.dropdown[data-se-nav-group="' + l.parent.replace(/"/g, '') + '"]');
            if (!dd) {
              dd = document.createElement('div');
              dd.className = 'dropdown';
              dd.setAttribute('data-se-nav', '');
              dd.setAttribute('data-se-nav-group', l.parent);
              var btn = document.createElement('button');
              btn.className = 'dropbtn';
              btn.type = 'button';
              btn.textContent = l.parent + ' ⌄';
              var content = document.createElement('div');
              content.className = 'dropdown-content';
              dd.appendChild(btn); dd.appendChild(content);
              links.appendChild(dd);
            }
          }
          var dc = dd.querySelector(':scope > .dropdown-content');
          a.setAttribute('data-se-nav', '');
          (dc || dd).appendChild(a);
        } else {
          a.setAttribute('data-se-nav', '');
          links.appendChild(a);
        }
      });
  }

  // ── JS global et JS de page ─────────────────────────────────────
  var jsRan = false;
  function runJs() {
    if (jsRan || SAFE) return;
    jsRan = true;
    [['global', (state.global || {}).js], ['page', (state.page || {}).js]].forEach(function (pair) {
      if (!pair[1]) return;
      var s = document.createElement('script');
      s.setAttribute('data-se-ui', '');
      s.setAttribute('data-se-js', pair[0]);
      s.textContent = pair[1] + '\n//# sourceURL=site-editor-' + pair[0] + '.js';
      document.body.appendChild(s);
    });
  }

  // ── Bouton « Pannel » (au-dessus de Menu, Gérant seulement)
  function isGerant() {
    try {
      if (window.site327 && window.site327.getCurrentRole) return window.site327.getCurrentRole() === 'Gérant';
      var s = JSON.parse(localStorage.getItem('327th_session'));
      return !!(s && s.role === 'Gérant');
    } catch (e) { return false; }
  }
  var editorBtn = null;
  function ensureButton() {
    if (!document.body) return;
    var show = isGerant();
    if (!editorBtn) {
      editorBtn = document.createElement('button');
      editorBtn.type = 'button';
      editorBtn.id = 'siteEditorBtn';
      editorBtn.className = 'menu-btn se-editor-btn';
      editorBtn.setAttribute('data-se-ui', '');
      editorBtn.textContent = '🛠 Pannel';
      editorBtn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
      var st = document.createElement('style');
      st.setAttribute('data-se-ui', '');
      st.textContent = '.se-editor-btn{display:none;color:#7fe0a0 !important;border-color:rgba(127,224,160,.45) !important}'
        + '.se-editor-btn.show{display:block}'
        + '.se-editor-btn:hover{background:#7fe0a0 !important;color:#06060D !important;border-color:#7fe0a0 !important}'
        + '.se-editor-btn.se-floating{position:fixed;right:24px;bottom:84px;z-index:501;font-family:Orbitron,sans-serif;font-size:.66rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;background:rgba(13,13,26,.92);border:1px solid;border-radius:999px;padding:9px 18px;cursor:pointer}';
      document.head.appendChild(st);
    }
    var widget = document.querySelector('.auth-widget');
    var menuBtn = document.getElementById('menuBtn');
    if (widget && editorBtn.parentNode !== widget) {
      editorBtn.classList.remove('se-floating');
      widget.insertBefore(editorBtn, menuBtn || widget.firstChild);
    } else if (!widget && !editorBtn.parentNode) {
      editorBtn.classList.add('se-floating');
      document.body.appendChild(editorBtn);
    }
    editorBtn.classList.toggle('show', show);
  }

  // ── Ouverture du panneau (chargé à la demande) ──────────────────
  var panelLoading = null;
  function loadPanel() {
    if (window.SiteEditorPanel) return Promise.resolve(window.SiteEditorPanel);
    if (panelLoading) return panelLoading;
    panelLoading = new Promise(function (resolveP, reject) {
      var s = document.createElement('script');
      s.src = 'site-editor-panel.js?v=' + Date.now();
      s.setAttribute('data-se-ui', '');
      s.onload = function () { resolveP(window.SiteEditorPanel); };
      s.onerror = function () { panelLoading = null; reject(new Error('site-editor-panel.js introuvable')); };
      document.head.appendChild(s);
    });
    return panelLoading;
  }
  function open(tab) {
    if (!isGerant()) { alert('Le Pannel est réservé au rôle Gérant.'); return; }
    loadPanel().then(function (P) { P.open(tab); }).catch(function (e) { alert(e.message); });
  }

  // ── Données publiées (site-editor-data.json) ────────────────────
  function sameJson(a, b) { return JSON.stringify(a || null) === JSON.stringify(b || null); }
  function panelBusy() {
    return !!(window.SiteEditorPanel && window.SiteEditorPanel.isVisualEditing && window.SiteEditorPanel.isVisualEditing());
  }
  function applyData(d, opts) {
    opts = opts || {};
    var oldG = state.global, oldP = state.page;
    setState(d);
    var g = state.global, p = state.page;
    if (opts.force || !sameJson(g.theme, oldG.theme) || g.css !== oldG.css || p.css !== oldP.css) applyStyles();
    if (opts.force || !sameJson(g.nav, oldG.nav) || !sameJson(g.navEdits, oldG.navEdits)) applyNav();
    if (opts.force || !sameJson(g.images, oldG.images)) applyImages(document.body);
    if ((opts.force || !sameJson(p.edits, oldP.edits)) && !panelBusy()) applyEdits(p.edits);
  }

  // Vérifie si les fichiers en aperçu local sont maintenant en ligne
  function checkPendingFiles() {
    var paths = Object.keys(pending.files);
    if (!paths.length) return Promise.resolve();
    return Promise.all(paths.map(function (p) {
      return fetch(encodeURI(p) + '?se-check=' + Date.now(), { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) return;
          return r.text().then(function (txt) {
            var a = txt.replace(/\r\n/g, '\n').trim(), b = String(pending.files[p].content).replace(/\r\n/g, '\n').trim();
            if (a === b) delete pending.files[p];
          });
        }).catch(function () { /* ignore */ });
    })).then(savePending);
  }

  function refresh() {
    if (SAFE) return Promise.resolve();
    return fetch(DATA_FILE + '?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (r.status === 404) return {};
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (live) {
      live = live || {};
      cache.data = live;
      writeJson(CACHE_KEY, cache);
      if (pending.data && (+(live.rev) || 0) >= (+pending.data.json.rev || 0)) {
        delete pending.data; savePending(); // la version en ligne a rattrapé l'aperçu
      }
      var d = pickData(live);
      if (!sameJson(d, state.data)) applyData(d);
      if (!jsRan) runJs();
      document.dispatchEvent(new CustomEvent('327th-site-editor-data'));
    }).then(checkPendingFiles);
  }

  // ── API exposée au panneau ──────────────────────────────────────
  window.SiteEditor = {
    __phase2: true,
    DATA_FILE: DATA_FILE, KEY: KEY, FILE: FILE, SAFE: SAFE,
    state: state,
    pathOf: pathOf, livePath: livePath, resolve: resolve,
    applyEdits: function (edits) { state.page.edits = edits; applyEdits(edits); },
    resetEdits: resetEdits,
    applyStyles: applyStyles, applyNav: applyNav, applyImages: function () { applyImages(document.body); },
    // Données qui viennent d'être publiées : aperçu local immédiat
    setPublishedData: function (d) {
      pending.data = { json: d, ts: Date.now() };
      savePending();
      applyData(d, { force: false });
    },
    // Fichier qui vient d'être publié : aperçu local jusqu'à sa mise en ligne
    setPendingFile: function (path, content) {
      if (content == null) delete pending.files[path];
      else pending.files[path] = { content: content, ts: Date.now() };
      savePending();
    },
    pendingFile: function (path) { return pending.files[path] ? pending.files[path].content : null; },
    hasPending: function () { return hasKeys(pending.files) || !!pending.data; },
    clearPending: function () { pending = { files: {} }; savePending(); },
    originalImageName: originalName,
    refresh: refresh,
    open: open,
    loadPanel: loadPanel,
    isGerant: isGerant
  };

  // ── Démarrage ───────────────────────────────────────────────────
  applyStyles();
  function onReady() {
    injectHead();
    applyStyles();
    if (!SAFE) {
      applyNav();
      applyImages(document.body);
      watchImages();
      applyEdits(state.page.edits);
      if (hasKeys(state.data)) runJs();
    } else {
      snapshot();
    }
    ensureButton();
    document.addEventListener('327th-session-change', function () { setTimeout(ensureButton, 0); });
    var menuBtn = document.getElementById('menuBtn');
    if (menuBtn && window.MutationObserver) {
      new MutationObserver(ensureButton).observe(menuBtn, { attributes: true, attributeFilter: ['class'] });
    }
    setTimeout(ensureButton, 1500);
    // « Carte + fenêtre » ajoutées avec le Pannel : Échap ferme la fenêtre ouverte
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      Array.prototype.forEach.call(document.querySelectorAll('.se-cp-modal'), function (m) { m.style.display = 'none'; });
    });
    if (SAFE) {
      var bar = document.createElement('div');
      bar.setAttribute('data-se-ui', '');
      bar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#7a1010;color:#fff;font:600 13px "Exo 2",sans-serif;text-align:center;padding:6px';
      bar.innerHTML = 'Mode secours : page affichée SANS les modifications de l\'éditeur (site-editor-data.json). <a style="color:#ffd" href="' + location.pathname + '">Quitter</a>';
      document.body.appendChild(bar);
    }
    refresh().catch(function () { /* hors ligne */ }).then(function () {
      var want = params.get('se-open');
      if (want && isGerant()) open(want);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();
})();
