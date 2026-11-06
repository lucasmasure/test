// ─── ÉDITEUR DU SITE 327TH — PANNEAU DU GÉRANT ─────────────────────
//
// Chargé à la demande par site-editor.js quand un Gérant clique sur
// « 🛠 Pannel ». Toutes les modifications sont enregistrées
// directement dans le dépôt GitHub du site (API GitHub, un commit par
// enregistrement) avec le jeton GitHub du Gérant, gardé dans son
// navigateur uniquement. GitHub Pages publie ensuite le site.
(function () {
  'use strict';

  var SE = window.SiteEditor;
  if (!SE || window.SiteEditorPanel) return;

  var CM = 'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16/';
  var SITE_FILES = [
    { name: 'auth.js', note: 'Connexion, rôles, menu Gérant/Officier. ⚠ Une erreur ici peut faire disparaître le bouton de connexion : rechargez alors une ancienne version depuis l’historique (ou annulez le commit sur GitHub).' },
    { name: 'responsive.css', note: 'Styles communs mobile / tablette.' },
    { name: 'responsive.js', note: 'Menu hamburger mobile et tableaux défilants.' },
    { name: 'img-overrides.js', note: 'Liste historique des images Imgur (préférez l’onglet Images).' },
    { name: 'rapport-effectif.js', note: 'Script des rapports d’effectif.' },
    { name: 'effectif-snapshot.js', note: 'Données de secours de l’effectif.' }
  ];
  var FONTS = ['Orbitron', 'Exo 2', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Oswald', 'Raleway', 'Inter',
    'Nunito', 'Playfair Display', 'Merriweather', 'Bebas Neue', 'Rajdhani', 'Audiowide', 'Russo One', 'Michroma', 'Teko',
    'Titillium Web', 'Share Tech Mono', 'Source Sans 3', 'Ubuntu', 'Quicksand', 'Barlow', 'Kanit', 'Saira', 'Chakra Petch',
    'Oxanium', 'Electrolize', 'Press Start 2P', 'Cinzel', 'Lobster', 'Pacifico', 'Dancing Script', 'Permanent Marker',
    'Anton', 'Archivo Black', 'Space Grotesk', 'JetBrains Mono', 'Fira Code', 'Arial', 'Georgia', 'Verdana', 'Times New Roman'];
  var THEME_VARS = [
    ['--gold', 'Or principal (titres, boutons)'], ['--gold-dim', 'Or foncé'], ['--gold-deep', 'Or profond'],
    ['--cyan', 'Cyan (accent)'], ['--bg', 'Fond de page'], ['--bg-mid', 'Fond secondaire (cartes, menu)'],
    ['--text', 'Texte'], ['--text-dim', 'Texte atténué']
  ];

  // ── Petits utilitaires ──────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o || {})); }
  function hash(s) {
    var h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }
  function uid(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function slugify(s) {
    return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'page';
  }
  function fileUrl(name) { return encodeURIComponent(name) + '?nocache=' + Date.now(); }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  // Lien Imgur « page » → lien direct d'image
  function imgurDirect(u) {
    u = String(u || '').trim();
    var m = /^https?:\/\/(?:www\.|m\.)?imgur\.com\/([a-zA-Z0-9]{5,10})(\.[a-z0-9]+)?(?:[?#].*)?$/.exec(u);
    if (m) return 'https://i.imgur.com/' + m[1] + (m[2] || '.png');
    return u;
  }
  function imgurWarning(u) {
    if (/imgur\.com\/(a|gallery)\//i.test(u)) return "C'est un lien d'album Imgur : ouvrez l'image, clic droit → « Copier l'adresse de l'image ».";
    if (u && !isImgur(imgurDirect(u))) return 'Seuls les liens Imgur sont acceptés (https://i.imgur.com/…). Mettez d’abord votre image sur imgur.com.';
    return '';
  }
  // Lien direct d'image Imgur (obligatoire pour toute nouvelle image)
  function isImgur(u) { return /^https:\/\/i\.imgur\.com\/[a-zA-Z0-9]{5,10}\.(png|jpe?g|gif|webp|gifv|mp4)(\?.*)?$/i.test(String(u || '').trim()); }
  // Renvoie le lien Imgur direct, ou lance une erreur expliquant pourquoi il est refusé
  function requireImgur(u) {
    var v = imgurDirect(u);
    if (!v) throw new Error('Collez le lien Imgur de l’image.');
    var w = imgurWarning(v);
    if (w) throw new Error(w);
    return v;
  }

  var toastTimer = null;
  function toast(msg, kind) {
    var t = $('#se-toast');
    if (!t) {
      t = el('<div id="se-toast" data-se-ui></div>');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, kind === 'error' ? 6000 : 2600);
  }
  function fail(e) { toast(e && e.message ? e.message : String(e), 'error'); }

  // ── CodeMirror (éditeur de code avec coloration) ───────────────
  var cmLoading = null;
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src; s.setAttribute('data-se-ui', '');
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }
  function loadCss(href) {
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-se-ui', '');
    document.head.appendChild(l);
  }
  function loadCodeMirror() {
    if (window.CodeMirror) return Promise.resolve(window.CodeMirror);
    if (cmLoading) return cmLoading;
    loadCss(CM + 'codemirror.min.css');
    loadCss(CM + 'theme/material-darker.min.css');
    loadCss(CM + 'addon/dialog/dialog.min.css');
    cmLoading = loadScript(CM + 'codemirror.min.js').then(function () {
      return Promise.all([
        loadScript(CM + 'mode/xml/xml.min.js'),
        loadScript(CM + 'mode/javascript/javascript.min.js'),
        loadScript(CM + 'mode/css/css.min.js'),
        loadScript(CM + 'addon/dialog/dialog.min.js'),
        loadScript(CM + 'addon/search/searchcursor.min.js'),
        loadScript(CM + 'addon/edit/closetag.min.js'),
        loadScript(CM + 'addon/edit/matchbrackets.min.js')
      ]);
    }).then(function () {
      return Promise.all([
        loadScript(CM + 'mode/htmlmixed/htmlmixed.min.js'),
        loadScript(CM + 'addon/search/search.min.js')
      ]);
    }).then(function () { return window.CodeMirror; }).catch(function () { return null; });
    return cmLoading;
  }
  // Crée un éditeur de code dans `host`. Retourne { get, set, refresh }.
  function codeEditor(host, mode, value, height) {
    var ta = document.createElement('textarea');
    ta.className = 'se-code-fallback';
    ta.value = value || '';
    ta.spellcheck = false;
    ta.style.height = (height || 300) + 'px';
    host.appendChild(ta);
    var api = {
      cm: null,
      get: function () { return api.cm ? api.cm.getValue() : ta.value; },
      set: function (v) { if (api.cm) api.cm.setValue(v || ''); else ta.value = v || ''; },
      refresh: function () { if (api.cm) api.cm.refresh(); }
    };
    loadCodeMirror().then(function (CodeMirror) {
      if (!CodeMirror || !ta.parentNode) return;
      var modes = { html: 'htmlmixed', css: 'css', js: 'javascript' };
      api.cm = CodeMirror.fromTextArea(ta, {
        mode: modes[mode] || mode, theme: 'material-darker', lineNumbers: true, lineWrapping: true,
        autoCloseTags: true, matchBrackets: true, indentUnit: 2, tabSize: 2,
        extraKeys: { 'Ctrl-F': 'findPersistent', 'Cmd-F': 'findPersistent' }
      });
      api.cm.setSize(null, height || 300);
      setTimeout(function () { api.cm.refresh(); }, 50);
    });
    return api;
  }

  // ── Styles du panneau ───────────────────────────────────────────
  var CSS = [
    '#se-panel{position:fixed;inset:0;z-index:20020;background:rgba(3,3,8,.78);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;font-family:"Exo 2",system-ui,sans-serif;color:#E8DCC8}',
    '#se-panel.open{display:flex}',
    '#se-panel *{box-sizing:border-box}',
    '#se-panel [hidden],#se-inspector [hidden]{display:none !important}',
    '.se-box{width:min(1280px,96vw);height:min(900px,94vh);background:#0b0b16;border:1px solid rgba(240,180,41,.35);border-radius:10px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.7)}',
    '.se-head{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid rgba(240,180,41,.2);background:#0f0f1f}',
    '.se-head h2{font-family:Orbitron,sans-serif;font-size:.95rem;letter-spacing:.12em;color:#F0B429;margin:0;flex:1;text-transform:uppercase}',
    '.se-head .se-where{font-size:.75rem;color:#8A7A62}',
    '.se-body{flex:1;display:flex;min-height:0}',
    '.se-tabs{width:210px;flex-shrink:0;border-right:1px solid rgba(240,180,41,.15);padding:10px 8px;overflow-y:auto;background:#0d0d1a}',
    '.se-tab{display:block;width:100%;text-align:left;background:none;border:1px solid transparent;color:#cdbf9f;font:500 .82rem "Exo 2",sans-serif;padding:9px 12px;border-radius:6px;cursor:pointer;margin-bottom:3px}',
    '.se-tab:hover{background:rgba(240,180,41,.08)}',
    '.se-tab.active{background:rgba(240,180,41,.14);border-color:rgba(240,180,41,.4);color:#F0B429}',
    '.se-content{flex:1;overflow-y:auto;padding:18px 22px 40px;min-width:0}',
    '.se-content h3{font-family:Orbitron,sans-serif;font-size:.8rem;letter-spacing:.1em;color:#F0B429;text-transform:uppercase;margin:22px 0 10px;padding-top:14px;border-top:1px solid rgba(240,180,41,.15)}',
    '.se-content h3:first-child{margin-top:0;padding-top:0;border-top:none}',
    '.se-hint{font-size:.78rem;color:#8A7A62;line-height:1.55;margin:4px 0 12px}',
    '.se-warn{font-size:.78rem;color:#ffcf7a;background:rgba(255,170,0,.08);border:1px solid rgba(255,170,0,.25);padding:8px 12px;border-radius:6px;margin:8px 0 12px;line-height:1.5}',
    '.se-btn{display:inline-flex;align-items:center;gap:6px;font:600 .74rem "Exo 2",sans-serif;letter-spacing:.04em;color:#F0B429;background:rgba(240,180,41,.08);border:1px solid rgba(240,180,41,.4);border-radius:5px;padding:7px 12px;cursor:pointer;margin:2px 4px 2px 0;text-decoration:none;white-space:nowrap}',
    '.se-btn:hover{background:rgba(240,180,41,.2)}',
    '.se-btn.primary{background:#F0B429;color:#06060D;border-color:#F0B429}',
    '.se-btn.primary:hover{background:#ffc94a}',
    '.se-btn.danger{color:#ff8a8a;border-color:rgba(255,100,100,.45);background:rgba(255,80,80,.07)}',
    '.se-btn.danger:hover{background:rgba(255,80,80,.18)}',
    '.se-btn.big{font-size:.85rem;padding:12px 18px}',
    '.se-btn:disabled{opacity:.5;cursor:wait}',
    '.se-close{background:none;border:1px solid rgba(240,180,41,.3);color:#F0B429;border-radius:6px;width:34px;height:34px;cursor:pointer;font-size:1rem}',
    '.se-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:6px 0}',
    '.se-field{display:flex;flex-direction:column;gap:4px;margin:8px 0;min-width:0}',
    '.se-field>label,.se-lbl{font-size:.7rem;letter-spacing:.06em;text-transform:uppercase;color:#a99878}',
    '#se-panel input[type=text],#se-panel input[type=url],#se-panel input[type=number],#se-panel select,#se-panel textarea,#se-inspector input[type=text],#se-inspector input[type=number],#se-inspector select,#se-inspector textarea{background:#06060d;border:1px solid rgba(240,180,41,.25);color:#E8DCC8;border-radius:5px;padding:7px 9px;font:400 .82rem "Exo 2",sans-serif;width:100%;min-width:0}',
    '#se-panel textarea,#se-inspector textarea{font-family:Consolas,"JetBrains Mono",monospace;font-size:.78rem;resize:vertical}',
    '#se-panel input:focus,#se-panel select:focus,#se-panel textarea:focus,#se-inspector input:focus,#se-inspector select:focus,#se-inspector textarea:focus{outline:none;border-color:#F0B429}',
    '#se-panel input[type=color],#se-inspector input[type=color]{width:38px;height:32px;padding:0;border:1px solid rgba(240,180,41,.3);background:none;border-radius:5px;cursor:pointer;flex-shrink:0}',
    '.se-grid2{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}',
    '.se-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:0 12px}',
    '.se-card{background:#0f0f1f;border:1px solid rgba(240,180,41,.15);border-radius:8px;padding:12px 14px;margin:8px 0}',
    '.se-list{display:flex;flex-direction:column;gap:6px}',
    '.se-item{display:flex;align-items:center;gap:10px;background:#0f0f1f;border:1px solid rgba(240,180,41,.12);border-radius:6px;padding:8px 10px;font-size:.8rem;flex-wrap:wrap}',
    '.se-item .grow{flex:1;min-width:140px;overflow:hidden;text-overflow:ellipsis}',
    '.se-tag{font:600 .62rem Orbitron,sans-serif;letter-spacing:.06em;padding:2px 7px;border-radius:999px;background:rgba(240,180,41,.15);color:#F0B429;text-transform:uppercase}',
    '.se-tag.green{background:rgba(127,224,160,.15);color:#7fe0a0}',
    '.se-tag.blue{background:rgba(0,200,255,.15);color:#7fd0ff}',
    '.se-tag.red{background:rgba(255,100,100,.15);color:#ff8a8a}',
    '.se-mono{font-family:Consolas,monospace;font-size:.72rem;color:#8A7A62;word-break:break-all}',
    '.se-thumb{width:54px;height:54px;object-fit:contain;background:#000;border-radius:4px;border:1px solid rgba(240,180,41,.15);flex-shrink:0}',
    '.se-code-fallback{width:100%;background:#06060d;color:#E8DCC8;border:1px solid rgba(240,180,41,.25);font:12px Consolas,monospace;padding:8px}',
    '#se-panel .CodeMirror,#se-inspector .CodeMirror{border:1px solid rgba(240,180,41,.25);border-radius:5px;font-size:12.5px}',
    '#se-toast{position:fixed;left:50%;bottom:30px;transform:translateX(-50%) translateY(20px);z-index:30000;background:#0f0f1f;border:1px solid #F0B429;color:#E8DCC8;padding:11px 18px;border-radius:6px;font:500 .84rem "Exo 2",sans-serif;opacity:0;pointer-events:none;transition:.25s;max-width:90vw;text-align:center}',
    '#se-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}',
    '#se-toast.error{border-color:#ff6b6b;color:#ffb3b3}',
    '#se-toast.ok{border-color:#7fe0a0}',
    // Édition visuelle
    'body.se-ve-on{cursor:crosshair}',
    'body.se-ve-on [data-se-ui], body.se-ve-on [data-se-ui] *{cursor:auto}',
    '#se-ve-bar{position:fixed;top:0;left:0;right:0;z-index:20010;display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:7px 12px;background:rgba(10,10,22,.97);border-bottom:2px solid #7fe0a0;font-family:"Exo 2",sans-serif;color:#E8DCC8;font-size:.8rem;box-shadow:0 4px 18px rgba(0,0,0,.6)}',
    '#se-ve-bar .t{font:700 .72rem Orbitron,sans-serif;letter-spacing:.1em;color:#7fe0a0;margin-right:8px}',
    '#se-ve-bar .n{color:#ffcf7a;margin:0 8px}',
    '#se-ve-bar .sp{flex:1}',
    '#se-ve-bar .pg{color:#cdbf9f;margin-right:10px;font-weight:600}',
    '#se-ve-bar .se-goto{max-width:220px;background:#06060d;color:#E8DCC8;border:1px solid rgba(240,180,41,.35);border-radius:5px;padding:5px 6px;font:500 .8rem "Exo 2",sans-serif;margin-right:6px;cursor:pointer}',
    '.se-more{position:relative}',
    '.se-more-menu{display:none;position:absolute;right:0;top:calc(100% + 6px);min-width:280px;background:#0f0f1f;border:1px solid rgba(240,180,41,.4);border-radius:8px;padding:6px;box-shadow:0 10px 30px rgba(0,0,0,.6);z-index:20015}',
    '.se-more-menu.open{display:block}',
    '.se-more-menu button{display:block;width:100%;text-align:left;background:none;border:none;color:#E8DCC8;font:500 .85rem "Exo 2",sans-serif;padding:10px 12px;border-radius:5px;cursor:pointer}',
    '.se-more-menu button:hover{background:rgba(240,180,41,.14);color:#F0B429}',
    '.se-help p{font-size:.88rem;line-height:1.6;color:#cdbf9f;margin:0 0 14px}',
    '#se-inspector textarea.se-big{font-family:"Exo 2",sans-serif !important;font-size:.92rem !important}',
    '.se-btns .se-btn{flex:1;justify-content:center}',
    '.se-btn.ghost{border-color:transparent;background:none;cursor:default;color:#cdbf9f}',
    '.se-add-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}',
    '.se-add{display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(240,180,41,.06);border:1px solid rgba(240,180,41,.25);border-radius:6px;color:#E8DCC8;font:500 .72rem "Exo 2",sans-serif;padding:9px 4px;cursor:pointer}',
    '.se-add span{font-size:1.1rem;color:#F0B429}',
    '.se-add:hover{background:rgba(240,180,41,.18)}',
    '.se-swatches{display:flex;flex-wrap:wrap;gap:6px;align-items:center}',
    '.se-sw{width:26px;height:26px;border-radius:50%;border:2px solid rgba(255,255,255,.25);cursor:pointer;padding:0}',
    '.se-sw:hover{transform:scale(1.15)}',
    '.se-dlg{position:fixed;inset:0;z-index:30010;background:rgba(3,3,8,.8);display:flex;align-items:center;justify-content:center;padding:16px;font-family:"Exo 2",sans-serif;color:#E8DCC8}',
    '.se-dlg *{box-sizing:border-box}',
    '.se-dlg-box{width:min(520px,100%);max-height:92vh;overflow-y:auto;background:#0b0b16;border:1px solid rgba(240,180,41,.4);border-radius:10px;padding:20px 22px;box-shadow:0 20px 60px rgba(0,0,0,.7)}',
    '.se-dlg-title{font:700 .95rem Orbitron,sans-serif;letter-spacing:.08em;color:#F0B429;margin-bottom:10px}',
    '.se-dlg input,.se-dlg select,.se-dlg textarea{background:#06060d;border:1px solid rgba(240,180,41,.25);color:#E8DCC8;border-radius:5px;padding:9px 10px;font:400 .88rem "Exo 2",sans-serif;width:100%}',
    '.se-dlg input:focus,.se-dlg select:focus,.se-dlg textarea:focus{outline:none;border-color:#F0B429}',
    '.se-dlg-err{color:#ff8a8a;font-size:.82rem;min-height:1em;margin-top:6px}',
    '.se-dlg .se-hint a{color:#F0B429}',
    // Un seul cadre fin à la fois : survol (pointillé léger) OU sélection (trait doré)
    '#se-hover,#se-selbox{position:fixed;pointer-events:none;z-index:20005;display:none;border-radius:3px;box-sizing:border-box}',
    '#se-hover{border:1px dashed rgba(127,224,160,.7)}',
    '#se-selbox{border:2px solid #F0B429}',
    '#se-selbox span{position:absolute;top:-17px;left:-2px;background:#F0B429;color:#06060D;font:700 9px "Exo 2",sans-serif;letter-spacing:.04em;padding:1px 6px;border-radius:3px 3px 0 0;white-space:nowrap;opacity:.9}',
    '#se-selbox.editing{border-color:#7fe0a0}',
    '.se-h{position:fixed;z-index:20008;display:none;width:16px;height:16px;box-sizing:border-box;background:#F0B429;border:2px solid #06060D;border-radius:4px;touch-action:none;box-shadow:0 1px 4px rgba(0,0,0,.6)}',
    '.se-h-e{cursor:ew-resize;height:24px;margin-top:-4px;width:12px;margin-left:2px}',
    '.se-h-s{cursor:ns-resize;width:24px;margin-left:-4px;height:12px;margin-top:2px}',
    '.se-h-se{cursor:nwse-resize;border-radius:50%}',
    '.se-imgbar{position:fixed;z-index:20009;display:none;gap:4px;background:rgba(10,10,22,.96);border:1px solid rgba(240,180,41,.5);border-radius:7px;padding:3px;box-shadow:0 4px 14px rgba(0,0,0,.6)}',
    '.se-imgbar button{background:none;border:1px solid transparent;color:#E8DCC8;font:600 .74rem "Exo 2",sans-serif;padding:5px 9px;border-radius:5px;cursor:pointer;white-space:nowrap}',
    '.se-imgbar button:hover{background:rgba(240,180,41,.15);color:#F0B429}',
    '.se-imgbar button.ok{background:#F0B429;color:#06060D}',
    '.se-cropbar{display:flex}',
    '.se-cropbox{position:fixed;z-index:20006;box-sizing:border-box;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.6);cursor:move;touch-action:none;background-image:linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)),linear-gradient(rgba(255,255,255,.35),rgba(255,255,255,.35)),linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.35)),linear-gradient(90deg,rgba(255,255,255,.35),rgba(255,255,255,.35));background-size:100% 1px,100% 1px,1px 100%,1px 100%;background-position:0 33.3%,0 66.6%,33.3% 0,66.6% 0;background-repeat:no-repeat}',
    '.se-cropbox .ch{position:absolute;width:14px;height:14px;box-sizing:border-box;background:#fff;border:2px solid #06060D;border-radius:3px;touch-action:none}',
    '.ch-n{top:-8px;left:calc(50% - 7px);cursor:ns-resize}.ch-s{bottom:-8px;left:calc(50% - 7px);cursor:ns-resize}',
    '.ch-e{right:-8px;top:calc(50% - 7px);cursor:ew-resize}.ch-w{left:-8px;top:calc(50% - 7px);cursor:ew-resize}',
    '.ch-ne{top:-8px;right:-8px;cursor:nesw-resize}.ch-sw{bottom:-8px;left:-8px;cursor:nesw-resize}',
    '.ch-nw{top:-8px;left:-8px;cursor:nwse-resize}.ch-se{bottom:-8px;right:-8px;cursor:nwse-resize}',
    '.se-multibox{position:fixed;pointer-events:none;z-index:20004;border:2px solid rgba(240,180,41,.55);border-radius:3px;box-sizing:border-box}',
    '#se-selbox.editing span{background:#7fe0a0}',
    '#se-inspector{position:fixed;top:46px;right:0;bottom:0;width:380px;z-index:20008;background:rgba(11,11,22,.98);border-left:1px solid rgba(240,180,41,.35);overflow-y:auto;padding:12px 14px 60px;font-family:"Exo 2",sans-serif;color:#E8DCC8;box-shadow:-8px 0 24px rgba(0,0,0,.5)}',
    '#se-inspector.min{width:46px;padding:12px 4px;overflow:hidden}',
    '#se-inspector.min > :not(.se-ins-top){display:none}',
    '#se-inspector.min .se-ins-top > :not(.se-ins-toggle){display:none}',
    '#se-inspector h4{font:700 .68rem Orbitron,sans-serif;letter-spacing:.1em;color:#F0B429;text-transform:uppercase;margin:16px 0 6px;padding-top:10px;border-top:1px solid rgba(240,180,41,.15)}',
    '#se-inspector .se-field{margin:5px 0}',
    '.se-ins-top{display:flex;gap:6px;align-items:center;margin-bottom:6px}',
    '.se-ins-top .grow{flex:1;font:600 .78rem Consolas,monospace;color:#F0B429;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.se-color{display:flex;gap:6px;align-items:center}',
    '[contenteditable=true].se-editing{outline:none !important;cursor:text !important}',
    'body.se-ve-on{padding-top:46px !important}',
    'body.se-ve-on img:not([data-se-ui] img){cursor:move !important;touch-action:none;-webkit-user-drag:none;user-select:none}',
    'body.se-dragging,body.se-dragging *{cursor:grabbing !important;user-select:none !important}',
    'body.se-ve-on [data-se-added] > *:not(.se-editing){cursor:move;touch-action:none}',
    'body.se-ve-on [data-se-added] iframe{pointer-events:none}',
    'body.se-ve-on > nav{top:46px !important}',
    '@media (max-width:760px){.se-body{flex-direction:column}.se-tabs{width:auto;display:flex;overflow-x:auto;border-right:none;border-bottom:1px solid rgba(240,180,41,.15);padding:6px}.se-tab{white-space:nowrap;width:auto;margin:0 3px 0 0}.se-grid2,.se-grid3{grid-template-columns:1fr}.se-content{padding:14px}#se-inspector{top:auto;height:52vh;width:100%;border-left:none;border-top:1px solid rgba(240,180,41,.35)}#se-inspector.min{height:44px;width:100%}}'
  ].join('\n');

  // ── Accès au dépôt GitHub ───────────────────────────────────────
  // Les Gérants n'ont PAS besoin de compte GitHub ni de code : avoir le
  // rôle Gérant suffit. La personne qui gère le GitHub du site relie le
  // Pannel une seule fois (onglet Réglages) : le jeton GitHub est rangé
  // dans Firebase (« panelGithub ») et chargé automatiquement pour les
  // Gérants.
  var GH_API = 'https://api.github.com';
  var ADV_KEY = '327th_pannel_avance';
  var CFG = null;      // { owner, repo, branch, tok }
  var TOKEN = null;    // jeton, gardé en mémoire seulement
  function ADV() { try { return localStorage.getItem(ADV_KEY) === '1'; } catch (e) { return false; } }
  function setAdv(on) { try { localStorage.setItem(ADV_KEY, on ? '1' : '0'); } catch (e) { /* ignore */ } }
  function ghConf() {
    return { owner: (CFG && CFG.owner) || '327thcorpsstellaire', repo: (CFG && CFG.repo) || 'site327', branch: (CFG && CFG.branch) || '', token: TOKEN };
  }

  // Le jeton est simplement masqué (pas chiffré) dans Firebase.
  function packToken(t) { return btoa(unescape(encodeURIComponent(t))).split('').reverse().join(''); }
  function unpackToken(s) { try { return decodeURIComponent(escape(atob(String(s).split('').reverse().join('')))); } catch (e) { return ''; } }
  function fb() {
    if (!window.site327 || !window.site327.firebaseGet) throw new Error('Connexion au site indisponible (auth.js).');
    return window.site327;
  }
  function isGerantNow() {
    try { return !!(window.SiteEditor && window.SiteEditor.isGerant && window.SiteEditor.isGerant()); } catch (e) { return false; }
  }
  function loadCfg() {
    return fb().firebaseGet('panelGithub').then(function (c) { CFG = c && c.tok ? c : null; return CFG; });
  }

  // Vérifie que le Pannel peut publier : rôle Gérant uniquement.
  function ensureAccess() {
    if (!isGerantNow()) { toast('Le Pannel est réservé au rôle Gérant.', 'err'); return Promise.resolve(false); }
    if (TOKEN) return Promise.resolve(true);
    return loadCfg().then(function (cfg) {
      if (!cfg) return setupDialog(true);
      TOKEN = unpackToken(cfg.tok) || null;
      return TOKEN ? true : setupDialog(true);
    });
  }

  // Configuration (une seule fois, par la personne qui gère le GitHub)
  function setupDialog(first) {
    var c = ghConf();
    return dialog({
      title: first ? '⚙ Première configuration du Pannel' : '⚙ Configuration du Pannel',
      text: (first ? 'Le Pannel n’est pas encore relié au site. Cette étape est à faire <b>une seule fois</b>, par la personne qui gère le GitHub du site. Ensuite, tous les Gérants y auront accès directement.<br><br>' : '')
        + '<b>Jeton GitHub</b> : sur <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener" style="color:#F0B429">github.com/settings/personal-access-tokens/new</a> → accès au seul dépôt <b>' + esc(c.repo) + '</b> → permission <b>Contents : Read and write</b> → copier le jeton.'
        + ' (Si le dépôt n’apparaît pas : <a href="https://github.com/settings/tokens/new?scopes=repo&description=Pannel%20327th" target="_blank" rel="noopener" style="color:#F0B429">jeton classique</a> avec la case « repo ».)',
      fields: [
        { key: 'owner', label: 'Propriétaire du dépôt GitHub', value: c.owner },
        { key: 'repo', label: 'Nom du dépôt', value: c.repo },
        { key: 'token', label: 'Jeton GitHub', type: 'password', placeholder: 'github_pat_…' }
      ],
      ok: 'Enregistrer la configuration',
      submit: function (v) {
        if (!v.owner || !v.repo || !v.token) throw new Error('Remplissez le dépôt et le jeton.');
        CFG = { owner: v.owner.trim(), repo: v.repo.trim(), branch: '' };
        TOKEN = v.token.trim();
        return gh.repo().then(function (r) {
          if (!r.permissions || !r.permissions.push) throw new Error('Ce jeton peut lire ' + r.full_name + ' mais pas le modifier (« Contents : Read and write »).');
          CFG.branch = r.default_branch;
        }, function (e) {
          TOKEN = null;
          throw new Error(e.status === 404 ? 'Dépôt introuvable, ou le jeton n’y a pas accès.' : e.message);
        }).then(function () {
          var stored = { owner: CFG.owner, repo: CFG.repo, branch: CFG.branch, updated: Date.now(), tok: packToken(TOKEN) };
          return fb().firebasePut('panelGithub', stored).then(function () {
            CFG = stored;
          }, function () {
            throw new Error('Firebase refuse l’enregistrement : publiez la règle « panelGithub » (voir firebase-rules-update.json).');
          });
        });
      }
    }).then(function (v) { if (v) toast('✅ Pannel configuré. Tous les Gérants y ont maintenant accès.', 'ok'); return !!v; });
  }

  // Petite fenêtre de saisie (remplace prompt())
  function dialog(o) {
    return new Promise(function (resolveD) {
      var box = el('<div class="se-dlg" data-se-ui><div class="se-dlg-box">'
        + '<div class="se-dlg-title">' + esc(o.title || '') + '</div>'
        + (o.text ? '<div class="se-hint" style="font-size:.84rem;color:#cdbf9f">' + o.text + '</div>' : '')
        + '<form novalidate></form>'
        + '<div class="se-dlg-err"></div>'
        + '<div class="se-row" style="justify-content:flex-end;margin-top:12px"><button type="button" class="se-btn" data-c>Annuler</button><button type="button" class="se-btn primary" data-o>' + esc(o.ok || 'Valider') + '</button></div>'
        + '</div></div>');
      var form = $('form', box);
      (o.fields || []).forEach(function (f) {
        var w = el('<div class="se-field"><label>' + esc(f.label) + '</label></div>');
        var inp;
        if (f.type === 'select') {
          inp = document.createElement('select');
          f.options.forEach(function (op) { var e = document.createElement('option'); e.value = op[0]; e.textContent = op[1]; inp.appendChild(e); });
        } else if (f.type === 'textarea') { inp = document.createElement('textarea'); inp.rows = f.rows || 4; }
        else { inp = document.createElement('input'); inp.type = f.type === 'password' ? 'password' : 'text'; if (f.type === 'password') inp.autocomplete = 'off'; }
        inp.name = f.key;
        if (f.placeholder) inp.placeholder = f.placeholder;
        if (f.value != null) inp.value = f.value;
        if (f.showIf) {
          var check = function () {
            var vals = {}; $$('[name]', form).forEach(function (i) { vals[i.name] = i.value; });
            w.style.display = f.showIf(vals) ? '' : 'none';
          };
          setTimeout(check, 0);
          form.addEventListener('change', check);
        }
        w.appendChild(inp);
        form.appendChild(w);
      });
      document.body.appendChild(box);
      var first = $('input,select,textarea', form);
      if (first) setTimeout(function () { first.focus(); }, 30);
      function finish(v) { box.remove(); resolveD(v); }
      function submit() {
        var vals = {};
        $$('[name]', form).forEach(function (i) { vals[i.name] = i.value; });
        var btn = $('[data-o]', box);
        btn.disabled = true;
        $('.se-dlg-err', box).textContent = '';
        Promise.resolve().then(function () { return o.submit ? o.submit(vals) : null; }).then(function () { finish(vals); }, function (e) {
          btn.disabled = false;
          $('.se-dlg-err', box).textContent = e && e.message ? e.message : String(e);
        });
      }
      $('[data-c]', box).addEventListener('click', function () { finish(null); });
      $('[data-o]', box).addEventListener('click', submit);
      form.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); } });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); finish(null); } });
    });
  }

  function encPath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
  function repoPath() { var c = ghConf(); return '/repos/' + encodeURIComponent(c.owner) + '/' + encodeURIComponent(c.repo); }
  function ghFetch(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, opts.headers || {});
    if (TOKEN) headers.Authorization = 'Bearer ' + TOKEN;
    if (opts.body) headers['Content-Type'] = 'application/json';
    return fetch(GH_API + path, {
      method: opts.method || 'GET', headers: headers, cache: 'no-store',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (opts.raw && r.ok) return r.text();
      if (r.status === 404 && opts.allow404) return null;
      return r.text().then(function (t) {
        var j = null;
        try { j = t ? JSON.parse(t) : null; } catch (e) { /* ignore */ }
        if (!r.ok) {
          var m = (j && j.message) || ('HTTP ' + r.status);
          if (r.status === 401) m = 'Le Pannel n’a plus accès au site (jeton GitHub expiré ou supprimé). La personne qui gère le GitHub doit refaire la configuration (☰ Plus → Réglages).';
          else if (opts.write && (r.status === 403 || r.status === 404)) m = 'Le Pannel n’a pas le droit de modifier le site (' + m + ').';
          var err = new Error(m); err.status = r.status;
          throw err;
        }
        return j;
      });
    });
  }
  var gh = {
    repo: function () { return ghFetch(repoPath()); },
    branch: function () {
      var c = ghConf();
      if (c.branch) return Promise.resolve(c.branch);
      return gh.repo().then(function (r) { if (CFG) CFG.branch = r.default_branch; return r.default_branch; });
    },
    read: function (path, ref) {
      return (ref ? Promise.resolve(ref) : gh.branch()).then(function (b) {
        return ghFetch(repoPath() + '/contents/' + encPath(path) + '?ref=' + encodeURIComponent(b),
          { raw: true, allow404: true, headers: { Accept: 'application/vnd.github.raw' } });
      });
    },
    tree: function () {
      return gh.branch().then(function (b) {
        return ghFetch(repoPath() + '/git/trees/' + encodeURIComponent(b) + '?recursive=1');
      }).then(function (t) {
        return (t.tree || []).filter(function (x) { return x.type === 'blob'; }).map(function (x) { return x.path; });
      });
    },
    history: function (path) {
      return gh.branch().then(function (b) {
        return ghFetch(repoPath() + '/commits?path=' + encodeURIComponent(path) + '&sha=' + encodeURIComponent(b) + '&per_page=15');
      });
    },
    // Un seul commit pour plusieurs fichiers : [{path, content} | {path, delete:true}]
    commit: function (changes, message) {
      return gh.branch().then(function (b) {
        function attempt(n) {
          var head;
          return ghFetch(repoPath() + '/git/ref/heads/' + encodeURIComponent(b)).then(function (ref) {
            head = ref.object.sha;
            return ghFetch(repoPath() + '/git/commits/' + head);
          }).then(function (cm) {
            var tree = changes.map(function (ch) {
              return ch.delete
                ? { path: ch.path, mode: '100644', type: 'blob', sha: null }
                : { path: ch.path, mode: '100644', type: 'blob', content: ch.content };
            });
            return ghFetch(repoPath() + '/git/trees', { method: 'POST', write: true, body: { base_tree: cm.tree.sha, tree: tree } });
          }).then(function (t) {
            return ghFetch(repoPath() + '/git/commits', { method: 'POST', write: true, body: { message: message, tree: t.sha, parents: [head] } });
          }).then(function (nc) {
            return ghFetch(repoPath() + '/git/refs/heads/' + encodeURIComponent(b), { method: 'PATCH', write: true, body: { sha: nc.sha } })
              .then(function () { return nc; });
          }).catch(function (e) {
            if (n < 2 && e.status === 422) return attempt(n + 1); // publication simultanée : on recommence
            throw e;
          });
        }
        return attempt(0);
      });
    }
  };
  function who() {
    try { var s = JSON.parse(localStorage.getItem('327th_session')); if (s && s.pseudo) return s.pseudo; } catch (e) { /* ignore */ }
    return 'Gérant';
  }
  function msg(text) { return 'Pannel : ' + text + ' (par ' + who() + ')'; }
  function githubUrl(path) {
    var c = ghConf();
    return 'https://github.com/' + c.owner + '/' + c.repo + (path ? '/commits/' + (c.branch || 'main') + '/' + encPath(path) : '/commits');
  }

  // ── Données du Pannel (site-editor-data.json dans le dépôt) ─────
  var DATA = { json: {} };
  var REPO_FILES = [];
  function norm(d) {
    d = d && typeof d === 'object' ? d : {};
    d.global = d.global || {}; d.pages = d.pages || {}; d.customPages = d.customPages || {};
    return d;
  }
  function D() { return norm(DATA.json); }
  function pageData() { return D().pages[SE.KEY] || {}; }
  function loadRepoData() {
    return gh.read(SE.DATA_FILE).then(function (t) {
      var d = {};
      if (t) {
        try { d = JSON.parse(t); } catch (e) { throw new Error('site-editor-data.json est invalide : ' + e.message); }
      }
      DATA.json = norm(d);
      return DATA.json;
    });
  }
  function published() {
    toast('✅ Publié ! Visible par tout le monde d’ici environ 1 minute.', 'ok');
  }
  // Relit la dernière version dans le dépôt, la modifie, et publie
  // (avec d'éventuels autres fichiers) en un seul commit.
  function publishData(mutate, message, extra) {
    return loadRepoData().then(function (d) {
      d = norm(clone(d));
      var r = mutate(d);
      if (r) d = norm(r);
      Object.keys(d.pages).forEach(function (k) {
        var p = d.pages[k] || {};
        Object.keys(p).forEach(function (f) {
          if (p[f] == null || p[f] === '' || (typeof p[f] === 'object' && !Object.keys(p[f]).length)) delete p[f];
        });
        if (!Object.keys(p).length) delete d.pages[k];
      });
      d.rev = Date.now();
      var changes = [{ path: SE.DATA_FILE, content: JSON.stringify(d, null, 2) + '\n' }].concat(extra || []);
      return gh.commit(changes, message).then(function (c) {
        DATA.json = d;
        SE.setPublishedData(d);
        (extra || []).forEach(function (ch) { SE.setPendingFile(ch.path, ch.delete ? null : ch.content); });
        published(c);
        return d;
      });
    });
  }
  function publishFiles(changes, message) {
    return gh.commit(changes, message).then(function (c) {
      changes.forEach(function (ch) { SE.setPendingFile(ch.path, ch.delete ? null : ch.content); });
      published(c);
      return c;
    });
  }
  function fileSource(path) {
    var p = SE.pendingFile(path);
    if (p != null) return Promise.resolve({ text: p, pending: true });
    return gh.read(path).then(function (t) { return { text: t == null ? '' : t, pending: false, missing: t == null }; });
  }
  function htmlPages() {
    return REPO_FILES.filter(function (p) { return /^[^/]+\.html$/i.test(p); }).sort(function (a, b) {
      return a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b);
    });
  }
  function codeFiles() {
    return REPO_FILES.filter(function (p) { return /\.(js|css|json|html|md|txt|xml|svg)$/i.test(p) && !/\.bak$/i.test(p); }).sort();
  }
  // Pages du site avec un nom lisible (pris dans le menu), pour les listes
  function pageOptions() {
    var seen = {}, out = [];
    function add(href, label) {
      if (!href || seen[href]) return;
      seen[href] = 1; out.push([href, label]);
    }
    $$('nav a[href]').forEach(function (a) {
      if (a.closest('[data-se-ui]')) return;
      var h = a.getAttribute('href');
      if (/^(https?:|#|mailto:)/i.test(h)) return;
      add(h, (a.textContent || '').replace(/[⌄​]/g, '').replace(/\s+/g, ' ').trim() || h);
    });
    var cp = D().customPages;
    Object.keys(cp).forEach(function (f) { add(f, cp[f].title || f); });
    htmlPages().forEach(function (f) { add(f, f.replace(/\.html$/, '')); });
    return out;
  }
  function pageTitle() {
    var cp = D().customPages[SE.FILE];
    if (cp) return cp.title;
    return (document.title || SE.FILE).replace(/^327th Corps Stellaire\s*[-–—]\s*/i, '');
  }

  // Attend qu'une nouvelle page soit en ligne (GitHub Pages) puis l'ouvre
  function waitOnline(file, label) {
    var ov = el('<div data-se-ui style="position:fixed;inset:0;z-index:30000;background:rgba(3,3,8,.9);display:flex;align-items:center;justify-content:center;font-family:\'Exo 2\',sans-serif;color:#E8DCC8;text-align:center;padding:20px">'
      + '<div style="max-width:440px"><div style="font:700 1rem Orbitron,sans-serif;color:#F0B429;letter-spacing:.1em;margin-bottom:12px">MISE EN LIGNE…</div>'
      + '<p>' + esc(label) + ' est créée. Elle sera en ligne dans environ 1 minute, elle s’ouvrira toute seule.</p>'
      + '<p class="se-hint" data-t>0 s</p><button class="se-btn" data-x>Fermer</button></div></div>');
    document.body.appendChild(ov);
    var start = Date.now(), stop = false;
    $('[data-x]', ov).addEventListener('click', function () { stop = true; ov.remove(); });
    (function poll() {
      if (stop) return;
      $('[data-t]', ov).textContent = Math.round((Date.now() - start) / 1000) + ' s';
      fetch(encodeURI(file) + '?t=' + Date.now(), { cache: 'no-store', method: 'HEAD' }).then(function (r) {
        if (r.ok) { stop = true; location.href = encodeURI(file); }
        else if (Date.now() - start < 6 * 60 * 1000) setTimeout(poll, 5000);
        else $('[data-t]', ov).textContent = 'Toujours pas en ligne. Réessayez dans quelques minutes.';
      }).catch(function () { setTimeout(poll, 5000); });
    })();
  }

  // Création d'une page (utilisée par l'onglet simple et l'onglet avancé)
  function createPage(t, file, tpl, navChoice) {
    if (REPO_FILES.indexOf(file) !== -1) return Promise.reject(new Error('Une page « ' + file + ' » existe déjà.'));
    var make = tpl === 'site' ? blankTemplate(t) : tpl === 'empty' ? emptyTemplate(t) : gh.read(tpl).then(function (h) {
      return (h || '').replace(/<title>[\s\S]*?<\/title>/i, '<title>327th Corps Stellaire - ' + esc(t) + '</title>');
    });
    return make.then(function (html) {
      return publishData(function (d) {
        d.customPages[file] = { title: t, created: Date.now() };
        if (navChoice) {
          d.global.nav = d.global.nav || {};
          d.global.nav[uid('n')] = { label: t, href: file, parent: navChoice === '__top' ? '' : navChoice, order: Date.now() };
        }
        if (tpl !== 'site' && tpl !== 'empty' && d.pages[tpl]) d.pages[file] = clone(d.pages[tpl]);
      }, msg('nouvelle page « ' + t + ' » (' + file + ')'), [{ path: file, content: html }]).then(function () {
        REPO_FILES.push(file);
        close();
        if (VE.active) stopVisual(true);
        waitOnline(file, 'La page « ' + t + ' »');
      });
    });
  }
  function deletePage(f) {
    return publishData(function (d) {
      delete d.customPages[f];
      delete d.pages[f];
      var nav = d.global.nav || {};
      Object.keys(nav).forEach(function (k) { if (nav[k].href === f || nav[k].href === encodeURI(f)) delete nav[k]; });
    }, msg('suppression de la page ' + f), [{ path: f, delete: true }]).then(function () {
      REPO_FILES = REPO_FILES.filter(function (x) { return x !== f; });
    });
  }

  // ── Fenêtre du Pannel (onglets) ─────────────────────────────────
  var TABS_SIMPLE = [
    ['newpage', '📄 Nouvelle page'],
    ['theme', '🎨 Couleurs & polices'],
    ['nav', '🧭 Menu du site'],
    ['settings', '⚙ Réglages']
  ];
  var TABS_ADV = [
    ['page', '🖱 Cette page'],
    ['code', '</> Code de la page'],
    ['pages', '📄 Pages du site'],
    ['nav', '🧭 Menu de navigation'],
    ['theme', '🎨 Thème & polices'],
    ['images', '🖼 Images (Imgur)'],
    ['global', '💻 CSS / JS globaux'],
    ['files', '📁 Fichiers du site'],
    ['backup', '💾 Historique'],
    ['settings', '⚙ Réglages']
  ];
  function TABS() { return ADV() ? TABS_ADV : TABS_SIMPLE; }
  var panel = null, content = null, currentTab = 'newpage';

  function build() {
    if (panel) return;
    var st = document.createElement('style');
    st.setAttribute('data-se-ui', '');
    st.textContent = CSS;
    document.head.appendChild(st);
    panel = el('<div id="se-panel" data-se-ui>'
      + '<div class="se-box">'
      + '<div class="se-head"><h2>🛠 Pannel</h2><span class="se-where"></span>'
      + '<button class="se-close" type="button" title="Fermer">✕</button></div>'
      + '<div class="se-body"><div class="se-tabs"></div><div class="se-content"></div></div>'
      + '</div></div>');
    document.body.appendChild(panel);
    content = $('.se-content', panel);
    $('.se-close', panel).addEventListener('click', close);
    panel.addEventListener('mousedown', function (e) { if (e.target === panel) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open') && !document.querySelector('.CodeMirror-dialog,.se-dlg')) close();
    });
  }
  function renderTabs() {
    var tabs = $('.se-tabs', panel);
    tabs.innerHTML = '';
    TABS().forEach(function (t) {
      var b = el('<button type="button" class="se-tab" data-tab="' + t[0] + '">' + esc(t[1]) + '</button>');
      b.addEventListener('click', function () { showTab(t[0]); });
      tabs.appendChild(b);
    });
    $('.se-where', panel).textContent = 'Page : ' + pageTitle();
  }
  function loadData() {
    return Promise.all([loadRepoData(), gh.tree()]).then(function (r) { REPO_FILES = r[1]; });
  }
  var dataLoaded = false;
  function ready() {
    return ensureAccess().then(function (ok) {
      if (!ok) return false;
      if (dataLoaded) return true;
      return loadData().then(function () { dataLoaded = true; return true; });
    });
  }

  // Ouvre le Pannel : sans onglet → modification de la page en cours
  function open(tab) {
    build();
    try {
      var u = new URL(location.href);
      if (u.searchParams.has('se-open')) { u.searchParams.delete('se-open'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    } catch (e) { /* ignore */ }
    toast('Ouverture du Pannel…');
    ready().then(function (ok) {
      if (!ok) return;
      $('#se-toast') && ($('#se-toast').className = '');
      if (!tab || tab === 'visual') { if (!VE.active) startVisual(); return; }
      openTab(tab);
    }).catch(fail);
  }
  function openTab(tab) {
    build();
    renderTabs();
    panel.classList.add('open');
    document.documentElement.style.overflow = 'hidden';
    var names = TABS().map(function (t) { return t[0]; });
    showTab(names.indexOf(tab) !== -1 ? tab : names[0]);
  }
  function close() {
    if (!panel) return;
    panel.classList.remove('open');
    document.documentElement.style.overflow = '';
  }
  function showTab(name) {
    currentTab = name;
    $$('.se-tab', panel).forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    content.innerHTML = '';
    content.scrollTop = 0;
    ({ page: tabPage, code: tabCode, pages: tabPages, nav: tabNav, theme: tabTheme, images: tabImages,
      global: tabGlobal, files: tabFiles, backup: tabBackup, settings: tabSettings, newpage: tabNewPage })[name](content);
  }
  function busy(btn, promise, okMsg) {
    btn.disabled = true;
    return promise.then(function (r) { if (okMsg) toast(okMsg, 'ok'); return r; })
      .catch(fail).then(function (r) { btn.disabled = false; return r; });
  }
  function on(root, sel, ev, fn) { var n = $(sel, root); if (n) n.addEventListener(ev, fn); return n; }

  // ── Onglet : Nouvelle page (simple) ─────────────────────────────
  function tabNewPage(c) {
    var dds = navDropdownNames();
    var cp = D().customPages;
    var mine = Object.keys(cp).filter(function (f) { return REPO_FILES.indexOf(f) !== -1; });
    c.innerHTML = '<h3>Créer une nouvelle page</h3>'
      + '<div class="se-field"><label>Titre de la page</label><input type="text" id="se-np-title" placeholder="Ex : Histoire du régiment"></div>'
      + '<div class="se-field"><label>À partir de</label><select id="se-np-tpl"><option value="site">Une page vierge au style du site</option><option value="' + esc(SE.FILE) + '">Une copie de la page actuelle (« ' + esc(pageTitle()) + ' »)</option></select></div>'
      + '<div class="se-field"><label>Où la mettre dans le menu du site ?</label><select id="se-np-nav"><option value="__top">Dans la barre du menu</option>'
      + dds.map(function (d) { return '<option value="' + esc(d) + '">Dans le menu « ' + esc(d) + ' »</option>'; }).join('')
      + '<option value="">Nulle part (page cachée)</option></select></div>'
      + '<div class="se-row"><button class="se-btn primary big" id="se-np-create">➕ Créer la page</button></div>'
      + '<div class="se-hint">La page s’ouvre automatiquement une fois en ligne (environ 1 minute). Vous pourrez ensuite la remplir en cliquant sur « 🛠 Pannel ».</div>'
      + '<h3>Pages créées avec le Pannel (' + mine.length + ')</h3><div class="se-list" id="se-mine"></div>'
      + (mine.length ? '' : '<div class="se-hint">Aucune pour l’instant.</div>');
    on(c, '#se-np-create', 'click', function (ev) {
      var t = $('#se-np-title', c).value.trim();
      if (!t) { toast('Donnez un titre à la page.', 'error'); return; }
      var file = slugify(t) + '.html', n = 2;
      while (REPO_FILES.indexOf(file) !== -1) file = slugify(t) + '-' + (n++) + '.html';
      busy(ev.target, createPage(t, file, $('#se-np-tpl', c).value, $('#se-np-nav', c).value));
    });
    var list = $('#se-mine', c);
    mine.forEach(function (f) {
      var row = el('<div class="se-item"><span class="grow"><b>' + esc(cp[f].title || f) + '</b></span>'
        + '<a class="se-btn" href="' + encodeURI(f) + '">Ouvrir</a><button class="se-btn danger" data-del>🗑 Supprimer</button></div>');
      $('[data-del]', row).addEventListener('click', function (ev) {
        if (!confirm('Supprimer la page « ' + (cp[f].title || f) + ' » ? Elle disparaîtra du site et du menu.')) return;
        busy(ev.target, deletePage(f).then(function () { if (f === SE.FILE) location.href = 'index.html'; else tabNewPage(c); }));
      });
      list.appendChild(row);
    });
  }

  // ── Onglet : Réglages ───────────────────────────────────────────
  function tabSettings(c) {
    var c0 = ghConf();
    c.innerHTML = '<h3>Accès au Pannel</h3>'
      + '<div class="se-hint">' + (TOKEN ? '<span style="color:#7fe0a0">✔ Le Pannel est relié au site.</span>' : 'Le Pannel n’est pas encore relié au site.') + '</div>'
      + '<h3>Mode avancé</h3>'
      + '<label class="se-lbl" style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:.85rem;letter-spacing:0"><input type="checkbox" id="se-adv"> Afficher les outils avancés (code HTML/CSS/JS, fichiers du site). Réservé à ceux qui savent coder.</label>'
      + '<h3>Configuration (personne qui gère le GitHub du site)</h3>'
      + '<div class="se-hint">Dépôt relié : <b>' + esc(c0.owner + '/' + c0.repo) + '</b>. À refaire seulement pour changer le jeton GitHub.</div>'
      + '<div class="se-row"><button class="se-btn" data-a="setup">⚙ Refaire la configuration</button></div>';
    var adv = $('#se-adv', c);
    adv.checked = ADV();
    adv.addEventListener('change', function () {
      setAdv(adv.checked);
      renderTabs();
      showTab('settings');
      if (VE.active) renderInspector();
    });
    on(c, '[data-a=setup]', 'click', function () { setupDialog(false).then(function () { tabSettings(c); }); });
  }

  // ── Onglet : Cette page ─────────────────────────────────────────
  function describeEdit(e) {
    if (e.type === 'add') {
      var txt = (e.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 70);
      return '<span class="se-tag green">Bloc ajouté</span> <span class="grow">' + esc(txt || '(bloc HTML)') + '</span>';
    }
    if (e.type === 'move') return '<span class="se-tag blue">Déplacé</span> <span class="grow se-mono">' + esc(e.path) + '</span>';
    var what = [];
    if (e.hidden) what.push('masqué');
    if (e.html != null) what.push('contenu');
    if (e.src) what.push('image');
    if (e.href != null) what.push('lien');
    if (e.style && Object.keys(e.style).length) what.push('style');
    if (e.css) what.push('CSS');
    if (e.bg) what.push('fond');
    if (e.className != null || e.attrs) what.push('attributs');
    return '<span class="se-tag ' + (e.hidden ? 'red' : '') + '">' + esc(what.join(', ') || 'modifié') + '</span> <span class="grow se-mono">' + esc(e.path) + '</span>';
  }
  function setPageField(field, value, message) {
    return publishData(function (d) {
      var p = d.pages[SE.KEY] = d.pages[SE.KEY] || {};
      if (value == null || value === '' || (typeof value === 'object' && !Object.keys(value).length)) delete p[field];
      else p[field] = value;
    }, message);
  }

  function tabPage(c) {
    var p = pageData();
    var edits = p.edits || {};
    var ids = Object.keys(edits).sort(function (a, b) { return (edits[a].order || 0) - (edits[b].order || 0); });
    var custom = D().customPages[SE.FILE];
    c.innerHTML = '<h3>Page actuelle</h3>'
      + '<div class="se-hint">Fichier : <b>' + esc(SE.FILE) + '</b>' + (custom ? ' — page créée avec l’éditeur (« ' + esc(custom.title) + ' »)' : '')
      + (SE.pendingFile(SE.FILE) != null ? ' — <span class="se-tag blue">nouvelle version en cours de mise en ligne</span>' : '') + '</div>'
      + '<div class="se-row">'
      + '<button class="se-btn primary big" data-a="visual">🖱 Modifier visuellement cette page</button>'
      + '<button class="se-btn big" data-a="code">&lt;/&gt; Modifier le code complet</button>'
      + '</div>'
      + '<div class="se-hint">L’édition visuelle permet de cliquer sur n’importe quel élément de la page (texte, titre, image, bouton, bloc…) pour changer son texte, sa police, sa taille, ses couleurs, son image Imgur, le masquer, le déplacer, le dupliquer ou insérer de nouveaux blocs. Les modifications visuelles sont enregistrées dans <b>site-editor-data.json</b> du dépôt ; le code complet modifie directement <b>' + esc(SE.FILE) + '</b>.</div>'
      + '<h3>Modifications visuelles enregistrées (' + ids.length + ')</h3>'
      + (ids.length ? '<div class="se-list" id="se-edit-list"></div><div class="se-row" style="margin-top:10px"><button class="se-btn danger" data-a="clear">🗑 Effacer toutes les modifications visuelles de cette page</button></div>'
        : '<div class="se-hint">Aucune modification visuelle sur cette page.</div>')
      + '<h3>CSS propre à cette page</h3><div class="se-hint">Appliqué seulement sur cette page, après ses propres styles.</div><div id="se-page-css"></div>'
      + '<div class="se-row"><button class="se-btn primary" data-a="savecss">💾 Publier le CSS</button><button class="se-btn" data-a="previewcss">👁 Aperçu</button></div>'
      + '<h3>JavaScript propre à cette page</h3><div class="se-hint">Exécuté à chaque chargement de cette page, après ses scripts.</div><div id="se-page-js"></div>'
      + '<div class="se-row"><button class="se-btn primary" data-a="savejs">💾 Publier le JS (recharge la page)</button></div>';
    var list = $('#se-edit-list', c);
    ids.forEach(function (id) {
      var row = el('<div class="se-item">' + describeEdit(edits[id]) + '<button class="se-btn" data-show>👁 Voir</button><button class="se-btn danger" data-del>Annuler</button></div>');
      $('[data-del]', row).addEventListener('click', function (ev) {
        busy(ev.target, publishData(function (d) {
          var pp = d.pages[SE.KEY] || {};
          if (pp.edits) delete pp.edits[id];
          d.pages[SE.KEY] = pp;
        }, msg('annulation d’une modification visuelle de ' + SE.FILE)).then(function () { tabPage(c); }));
      });
      $('[data-show]', row).addEventListener('click', function () {
        var e = edits[id];
        var target = SE.resolve(e.type === 'add' ? '@' + id : e.path);
        close();
        if (target) {
          var t = target.getAttribute && target.getAttribute('data-se-added') ? target.firstElementChild || target : target;
          t.scrollIntoView({ behavior: 'smooth', block: 'center' });
          flash(t);
        } else toast('Élément introuvable sur la page (contenu dynamique ou masqué).');
      });
      list.appendChild(row);
    });
    var cssEd = codeEditor($('#se-page-css', c), 'css', p.css || '', 220);
    var jsEd = codeEditor($('#se-page-js', c), 'js', p.js || '', 220);
    on(c, '[data-a=visual]', 'click', function () { close(); startVisual(); });
    on(c, '[data-a=code]', 'click', function () { showTab('code'); });
    on(c, '[data-a=clear]', 'click', function (ev) {
      if (!confirm('Effacer TOUTES les modifications visuelles de cette page ?')) return;
      busy(ev.target, setPageField('edits', null, msg('suppression des modifications visuelles de ' + SE.FILE)).then(function () { tabPage(c); }));
    });
    on(c, '[data-a=previewcss]', 'click', function () {
      SE.state.page = Object.assign({}, SE.state.page, { css: cssEd.get() }); SE.applyStyles(); toast('Aperçu appliqué (non publié)');
    });
    on(c, '[data-a=savecss]', 'click', function (ev) {
      busy(ev.target, setPageField('css', cssEd.get(), msg('CSS de ' + SE.FILE)));
    });
    on(c, '[data-a=savejs]', 'click', function (ev) {
      busy(ev.target, setPageField('js', jsEd.get(), msg('JS de ' + SE.FILE)).then(function () { location.reload(); }));
    });
  }

  function flash(t) {
    var r = t.getBoundingClientRect();
    var b = el('<div data-se-ui style="position:fixed;z-index:20050;pointer-events:none;border:3px solid #F0B429;border-radius:4px;box-shadow:0 0 0 9999px rgba(0,0,0,.35);transition:opacity .6s"></div>');
    document.body.appendChild(b);
    function place() { r = t.getBoundingClientRect(); b.style.left = r.left - 4 + 'px'; b.style.top = r.top - 4 + 'px'; b.style.width = r.width + 8 + 'px'; b.style.height = r.height + 8 + 'px'; }
    place();
    var iv = setInterval(place, 50);
    setTimeout(function () { b.style.opacity = '0'; }, 1600);
    setTimeout(function () { clearInterval(iv); b.remove(); }, 2300);
  }

  // ── Historique GitHub d'un fichier (restaurer une ancienne version)
  function historyBox(host, path, onLoadVersion) {
    host.innerHTML = '<span class="se-hint">Chargement de l’historique…</span>';
    gh.history(path).then(function (list) {
      host.innerHTML = '';
      if (!list || !list.length) { host.innerHTML = '<span class="se-hint">Aucun historique.</span>'; return; }
      list.forEach(function (cm) {
        var d = new Date(cm.commit.author.date);
        var row = el('<div class="se-item"><span class="se-mono">' + cm.sha.slice(0, 7) + '</span><span class="grow">' + esc(cm.commit.message.split('\n')[0])
          + ' <span class="se-hint">— ' + d.toLocaleString('fr-FR') + '</span></span><button class="se-btn">Charger cette version</button></div>');
        $('button', row).addEventListener('click', function (ev) {
          busy(ev.target, gh.read(path, cm.sha).then(function (t) {
            onLoadVersion(t || '');
            toast('Version ' + cm.sha.slice(0, 7) + ' chargée dans l’éditeur. Cliquez « Publier » pour la remettre en ligne.');
          }));
        });
        host.appendChild(row);
      });
    }).catch(function (e) { host.innerHTML = '<span class="se-hint">' + esc(e.message) + '</span>'; });
  }

  // ── Onglet : Code de la page ────────────────────────────────────
  function previewHtml(html) {
    var w = window.open('', '_blank');
    if (!w) { toast('Autorisez les fenêtres pop-up pour l’aperçu.', 'error'); return; }
    var base = location.href.replace(/[^/]*([?#].*)?$/, '');
    var withBase = /<head[^>]*>/i.test(html) ? html.replace(/<head([^>]*)>/i, '<head$1><base href="' + base + '">') : '<base href="' + base + '">' + html;
    withBase = withBase.replace(/<html(\s|>)/i, '<html data-se-doc$1');
    w.document.open(); w.document.write(withBase); w.document.close();
  }

  function tabCode(c) {
    c.innerHTML = '<h3>Code complet de la page</h3>'
      + '<div class="se-hint">Vous modifiez ici le fichier <b>' + esc(SE.FILE) + '</b> du dépôt GitHub (HTML, CSS et JS de la page). « Publier » crée un commit sur GitHub. Ctrl+F pour chercher dans le code.</div>'
      + '<div class="se-warn">Gardez la ligne <code>&lt;script src="site-editor.js"&gt;&lt;/script&gt;</code> dans le &lt;head&gt; et <code>auth.js</code> en bas de page, sinon l’éditeur et la connexion disparaissent de cette page. En cas d’erreur, l’historique ci-dessous permet de remettre une ancienne version.</div>'
      + '<div class="se-row" id="se-code-status"><span class="se-hint">Chargement du code depuis GitHub…</span></div>'
      + '<div id="se-code-host"></div>'
      + '<div class="se-row" style="margin-top:10px">'
      + '<button class="se-btn primary" data-a="save">💾 Publier sur GitHub</button>'
      + '<button class="se-btn" data-a="preview">👁 Aperçu dans un nouvel onglet</button>'
      + '<button class="se-btn" data-a="download">⬇ Télécharger le fichier</button>'
      + '<a class="se-btn" target="_blank" rel="noopener" href="' + esc(githubUrl(SE.FILE)) + '">↗ Voir sur GitHub</a>'
      + '</div>'
      + '<h3>Historique de ce fichier</h3><div class="se-list" id="se-code-hist"></div>';
    var ed = null;
    fileSource(SE.FILE).then(function (src) {
      $('#se-code-status', c).innerHTML = src.pending
        ? '<span class="se-tag blue">Version publiée il y a peu — en cours de mise en ligne</span>'
        : (src.missing ? '<span class="se-tag red">Fichier absent du dépôt</span>' : '<span class="se-tag green">Version actuelle du dépôt</span>');
      ed = codeEditor($('#se-code-host', c), 'html', src.text, Math.max(320, Math.round(window.innerHeight * 0.55)));
    }).catch(fail);
    historyBox($('#se-code-hist', c), SE.FILE, function (t) { if (ed) ed.set(t); });
    on(c, '[data-a=save]', 'click', function (ev) {
      if (!ed) return;
      var html = ed.get();
      if (!/site-editor\.js/.test(html) && !confirm('Le code ne contient plus site-editor.js : l’éditeur ne sera plus disponible sur cette page. Continuer ?')) return;
      busy(ev.target, publishFiles([{ path: SE.FILE, content: html }], msg('code de ' + SE.FILE)).then(function () {
        setTimeout(function () { location.reload(); }, 900);
      }));
    });
    on(c, '[data-a=preview]', 'click', function () { if (ed) previewHtml(ed.get()); });
    on(c, '[data-a=download]', 'click', function () { if (ed) download(SE.FILE, ed.get(), 'text/html'); });
  }

  // ── Onglet : Pages ──────────────────────────────────────────────
  function blankTemplate(title) {
    return gh.read('serment.html').then(function (h) {
      h = h || '';
      var body = '<div class="content">\n\n'
        + '    <div class="page-header">\n      <div class="page-icon">⭐</div>\n'
        + '      <h1 class="page-title">' + esc(title.toUpperCase()) + '</h1>\n'
        + '      <p class="page-subtitle">Sous-titre de la page</p>\n    </div>\n\n'
        + '    <div class="divider"></div>\n\n'
        + '    <div style="max-width:900px;margin:0 auto;padding:10px 24px 70px;line-height:1.8;font-size:1.02rem;">\n'
        + '      <p>Contenu de la page. Utilisez « 🖱 Modifier visuellement cette page » dans l’éditeur pour changer ce texte, ajouter des titres, des images Imgur, des boutons…</p>\n'
        + '    </div>\n\n  </div>\n\n  ';
      var start = h.indexOf('<div class="content">');
      var end = h.indexOf('<footer');
      if (start !== -1 && end > start) h = h.slice(0, start) + body + h.slice(end);
      h = h.replace(/<title>[\s\S]*?<\/title>/i, '<title>327th Corps Stellaire - ' + esc(title) + '</title>');
      h = h.replace(/ class="active"/g, '');
      return h;
    });
  }
  function emptyTemplate(title) {
    return Promise.resolve('<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <script src="site-editor.js"></script>\n'
      + '  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + esc(title) + '</title>\n'
      + '  <link rel="icon" type="image/png" href="Logo_327th.png">\n'
      + '  <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Exo+2:wght@300;400;600&display=swap" rel="stylesheet">\n'
      + '  <style>\n    :root { --gold:#F0B429; --gold-dim:#C8922A; --bg:#06060D; --bg-mid:#0D0D1A; --text:#E8DCC8; --text-dim:#8A7A62; }\n'
      + '    body { background: var(--bg); color: var(--text); font-family: "Exo 2", sans-serif; margin: 0; padding: 40px 20px; }\n'
      + '    h1 { font-family: Orbitron, sans-serif; color: var(--gold); text-align: center; letter-spacing: .1em; }\n  </style>\n'
      + '</head>\n<body>\n  <h1>' + esc(title) + '</h1>\n  <p style="text-align:center">Nouvelle page.</p>\n\n'
      + '  <script src="auth.js"></script>\n  <script src="responsive.js"></script>\n</body>\n</html>\n');
  }

  function tabPages(c) {
    var pages = htmlPages();
    var custom = D().customPages;
    var options = pages.map(function (f) { return '<option value="' + esc(f) + '">' + esc(f) + '</option>'; }).join('');
    var dropdowns = navDropdownNames();
    c.innerHTML = '<h3>Créer une nouvelle page</h3>'
      + '<div class="se-hint">La page est créée comme un vrai fichier <b>.html</b> dans le dépôt GitHub.</div>'
      + '<div class="se-grid2">'
      + '<div class="se-field"><label>Titre de la page</label><input type="text" id="se-np-title" placeholder="Ex : Histoire du régiment"></div>'
      + '<div class="se-field"><label>Nom du fichier</label><input type="text" id="se-np-slug" placeholder="histoire-du-regiment.html"></div>'
      + '<div class="se-field"><label>Modèle</label><select id="se-np-tpl"><option value="site">Page vierge au style du site (menu, étoiles, pied de page)</option><option value="empty">Page HTML minimale</option><optgroup label="Copie d’une page existante">' + options + '</optgroup></select></div>'
      + '<div class="se-field"><label>Ajouter au menu de navigation</label><select id="se-np-nav"><option value="">— Ne pas ajouter —</option><option value="__top">Lien principal du menu</option>'
      + dropdowns.map(function (d) { return '<option value="' + esc(d) + '">Dans « ' + esc(d) + ' »</option>'; }).join('') + '</select></div>'
      + '</div>'
      + '<div class="se-row"><button class="se-btn primary" id="se-np-create">➕ Créer la page</button></div>'
      + '<h3>Toutes les pages du dépôt (' + pages.length + ')</h3><div class="se-list" id="se-page-list"></div>';
    var title = $('#se-np-title', c), slug = $('#se-np-slug', c), slugTouched = false;
    title.addEventListener('input', function () { if (!slugTouched) slug.value = slugify(title.value) + '.html'; });
    slug.addEventListener('input', function () { slugTouched = true; });
    on(c, '#se-np-create', 'click', function (ev) {
      var t = title.value.trim();
      var file = slugify((slug.value || t).replace(/\.html?$/i, '')) + '.html';
      if (!t) { toast('Donnez un titre à la page.', 'error'); return; }
      if (REPO_FILES.indexOf(file) !== -1) { toast('Le fichier « ' + file + ' » existe déjà dans le dépôt.', 'error'); return; }
      var tpl = $('#se-np-tpl', c).value, navChoice = $('#se-np-nav', c).value;
      var make = tpl === 'site' ? blankTemplate(t) : tpl === 'empty' ? emptyTemplate(t) : gh.read(tpl).then(function (h) {
        return (h || '').replace(/<title>[\s\S]*?<\/title>/i, '<title>327th Corps Stellaire - ' + esc(t) + '</title>');
      });
      busy(ev.target, make.then(function (html) {
        return publishData(function (d) {
          d.customPages[file] = { title: t, created: Date.now() };
          if (navChoice) {
            d.global.nav = d.global.nav || {};
            d.global.nav[uid('n')] = { label: t, href: file, parent: navChoice === '__top' ? '' : navChoice, order: Date.now() };
          }
          // La copie d'une page reprend aussi ses modifications visuelles
          if (tpl !== 'site' && tpl !== 'empty' && d.pages[tpl]) d.pages[file] = clone(d.pages[tpl]);
        }, msg('nouvelle page ' + file), [{ path: file, content: html }]).then(function () {
          REPO_FILES.push(file);
          close();
          waitOnline(file, 'La page « ' + t + ' »');
        });
      }));
    });
    var list = $('#se-page-list', c);
    pages.forEach(function (f) {
      var meta = D().pages[f] || {};
      var n = Object.keys(meta.edits || {}).length;
      var row = el('<div class="se-item"><span class="grow"><b>' + esc(f) + '</b> '
        + (custom[f] ? '<span class="se-tag green">créée : ' + esc(custom[f].title) + '</span> ' : '')
        + (n ? '<span class="se-tag">' + n + ' modif. visuelle' + (n > 1 ? 's' : '') + '</span> ' : '')
        + (meta.css || meta.js ? '<span class="se-tag blue">CSS/JS</span>' : '') + '</span>'
        + '<a class="se-btn" href="' + encodeURI(f) + '">Ouvrir</a>'
        + '<a class="se-btn" href="' + encodeURI(f) + '?se-open=page">🖱 Éditer</a>'
        + '<a class="se-btn" href="' + encodeURI(f) + '?se-open=code">&lt;/&gt; Code</a>'
        + (f === 'index.html' ? '' : '<button class="se-btn danger" data-del>🗑</button>') + '</div>');
      var del = $('[data-del]', row);
      if (del) del.addEventListener('click', function (ev) {
        if (!confirm('Supprimer la page « ' + f + ' » du dépôt GitHub ?\nElle reste récupérable dans l’historique GitHub.')) return;
        if (!custom[f] && prompt('C’est une page d’origine du site. Tapez SUPPRIMER pour confirmer.') !== 'SUPPRIMER') return;
        busy(ev.target, publishData(function (d) {
          delete d.customPages[f];
          delete d.pages[f];
          var nav = d.global.nav || {};
          Object.keys(nav).forEach(function (k) { if (nav[k].href === f || nav[k].href === encodeURI(f)) delete nav[k]; });
        }, msg('suppression de la page ' + f), [{ path: f, delete: true }]).then(function () {
          REPO_FILES = REPO_FILES.filter(function (x) { return x !== f; });
          if (f === SE.FILE) location.href = 'index.html'; else tabPages(c);
        }));
      });
      list.appendChild(row);
    });
  }

  // ── Onglet : Menu de navigation ─────────────────────────────────
  function navText(n) { return (n.getAttribute('data-se-navorig') || n.textContent || '').replace(/[⌄\s​]+/g, ' ').trim(); }
  function navDropdownNames() {
    var names = [];
    $$('nav .dropdown > .dropbtn').forEach(function (b) {
      if (b.closest('[data-se-nav]')) return;
      var t = navText(b); if (t && names.indexOf(t) === -1) names.push(t);
    });
    var nav = D().global.nav || {};
    Object.keys(nav).forEach(function (k) { var p = nav[k].parent; if (p && names.indexOf(p) === -1) names.push(p); });
    return names;
  }

  function tabNav(c) {
    var nav = clone(D().global.nav);
    var navEdits = clone(D().global.navEdits);
    var dds = navDropdownNames();
    c.innerHTML = '<h3>Liens ajoutés au menu (toutes les pages)</h3>'
      + '<div class="se-hint">« Menu parent » : laissez vide pour un lien principal, choisissez un menu déroulant existant, ou tapez un nouveau nom pour créer un nouveau menu déroulant.</div>'
      + '<datalist id="se-dl-pages">' + pageOptions().map(function (p) { return '<option value="' + esc(p[0]) + '">' + esc(p[1]) + '</option>'; }).join('') + '</datalist>'
      + '<datalist id="se-dl-dd">' + dds.map(function (d) { return '<option value="' + esc(d) + '">'; }).join('') + '</datalist>'
      + '<div class="se-list" id="se-nav-list"></div>'
      + '<div class="se-row" style="margin-top:8px"><button class="se-btn" data-a="add">➕ Ajouter un lien</button><button class="se-btn primary" data-a="save">💾 Publier les liens</button></div>'
      + '<h3>Liens existants du menu (toutes les pages)</h3>'
      + '<div class="se-hint">Renommez, changez la destination ou masquez les liens d’origine du menu. S’applique sur toutes les pages qui ont le même lien.</div>'
      + '<div class="se-list" id="se-navedit-list"></div>'
      + '<div class="se-row" style="margin-top:8px"><button class="se-btn primary" data-a="save2">💾 Publier les liens existants</button></div>';
    var list = $('#se-nav-list', c);
    function renderAdded() {
      list.innerHTML = '';
      var ids = Object.keys(nav).sort(function (a, b) { return (nav[a].order || 0) - (nav[b].order || 0); });
      if (!ids.length) list.innerHTML = '<div class="se-hint">Aucun lien ajouté.</div>';
      ids.forEach(function (id, i) {
        var l = nav[id];
        var row = el('<div class="se-item" style="align-items:flex-end">'
          + '<div class="se-field" style="flex:1.2;min-width:140px"><label>Texte</label><input type="text" data-k="label"></div>'
          + '<div class="se-field" style="flex:1.4;min-width:160px"><label>Lien (page ou https://…)</label><input type="text" data-k="href" list="se-dl-pages"></div>'
          + '<div class="se-field" style="flex:1;min-width:130px"><label>Menu parent</label><input type="text" data-k="parent" list="se-dl-dd" placeholder="(lien principal)"></div>'
          + '<label class="se-lbl" style="display:flex;gap:5px;align-items:center;padding-bottom:10px"><input type="checkbox" data-k="newTab"> nouvel onglet</label>'
          + '<button class="se-btn" data-up title="Monter">▲</button><button class="se-btn" data-down title="Descendre">▼</button><button class="se-btn danger" data-del>✕</button></div>');
        $$('[data-k]', row).forEach(function (inp) {
          var k = inp.getAttribute('data-k');
          if (inp.type === 'checkbox') inp.checked = !!l[k]; else inp.value = l[k] || '';
          function upd() { l[k] = inp.type === 'checkbox' ? inp.checked : inp.value; }
          inp.addEventListener('input', upd); inp.addEventListener('change', upd);
        });
        $('[data-del]', row).addEventListener('click', function () { delete nav[id]; renderAdded(); });
        function swap(j) {
          if (j < 0 || j >= ids.length) return;
          var other = nav[ids[j]], o = l.order || i;
          l.order = other.order || j; other.order = o;
          if (l.order === other.order) l.order += (j > i ? 1 : -1);
          renderAdded();
        }
        $('[data-up]', row).addEventListener('click', function () { swap(i - 1); });
        $('[data-down]', row).addEventListener('click', function () { swap(i + 1); });
        list.appendChild(row);
      });
    }
    renderAdded();
    on(c, '[data-a=add]', 'click', function () {
      nav[uid('n')] = { label: 'Nouveau lien', href: '', parent: '', order: Date.now() };
      renderAdded();
    });
    on(c, '[data-a=save]', 'click', function (ev) {
      busy(ev.target, publishData(function (d) { d.global.nav = nav; }, msg('liens du menu')));
    });
    var el2list = $('#se-navedit-list', c);
    var seen = {};
    var byMatch = {};
    Object.keys(navEdits).forEach(function (k) { byMatch[navEdits[k].match] = k; });
    $$('nav a, nav .dropbtn').forEach(function (a) {
      if (a.closest('[data-se-nav]') || a.closest('.nav-logo') || a.closest('[data-se-ui]')) return;
      var t = navText(a);
      if (!t || seen[t]) return;
      seen[t] = 1;
      var k = byMatch[t] || ('e' + hash(t));
      var ne = navEdits[k] || { match: t };
      var isDrop = a.classList.contains('dropbtn');
      var row = el('<div class="se-item" style="align-items:flex-end">'
        + '<div class="grow" style="min-width:150px;padding-bottom:9px">' + (isDrop ? '<span class="se-tag blue">menu</span> ' : '') + esc(t) + '</div>'
        + '<div class="se-field" style="flex:1;min-width:140px"><label>Nouveau texte</label><input type="text" data-k="label"></div>'
        + (a.tagName === 'A' ? '<div class="se-field" style="flex:1;min-width:140px"><label>Nouveau lien</label><input type="text" data-k="href" list="se-dl-pages" placeholder="' + esc(a.getAttribute('href')) + '"></div>' : '')
        + '<label class="se-lbl" style="display:flex;gap:5px;align-items:center;padding-bottom:10px"><input type="checkbox" data-k="hidden"> masquer</label></div>');
      $$('[data-k]', row).forEach(function (inp) {
        var key = inp.getAttribute('data-k');
        if (inp.type === 'checkbox') inp.checked = !!ne[key]; else inp.value = ne[key] || '';
        function upd() {
          ne[key] = inp.type === 'checkbox' ? inp.checked : inp.value;
          if (ne.label || ne.href || ne.hidden) navEdits[k] = ne; else delete navEdits[k];
        }
        inp.addEventListener('input', upd); inp.addEventListener('change', upd);
      });
      el2list.appendChild(row);
    });
    on(c, '[data-a=save2]', 'click', function (ev) {
      busy(ev.target, publishData(function (d) { d.global.navEdits = navEdits; }, msg('liens existants du menu')).then(function () {
        setTimeout(function () { location.reload(); }, 900);
      }));
    });
  }

  // ── Onglet : Thème & polices ────────────────────────────────────
  function fontDatalist(id) {
    return '<datalist id="' + id + '">' + FONTS.map(function (f) { return '<option value="' + esc(f) + '">'; }).join('') + '</datalist>';
  }
  function toHex(v) {
    v = String(v || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(v)) return v;
    if (/^#[0-9a-f]{3}$/i.test(v)) return '#' + v.slice(1).split('').map(function (x) { return x + x; }).join('');
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v);
    if (m) return '#' + [m[1], m[2], m[3]].map(function (n) { return (+n).toString(16).padStart(2, '0'); }).join('');
    return '#000000';
  }
  function tabTheme(c) {
    var saved = clone(D().global.theme);
    var t = clone(saved);
    t.vars = t.vars || {};
    var rootStyle = getComputedStyle(document.documentElement);
    c.innerHTML = '<h3>Couleurs du site</h3><div class="se-hint">Les changements s’affichent en direct. Cliquez sur « Publier » pour les appliquer à tout le site.</div>'
      + '<div class="se-grid2" id="se-colors"></div>'
      + '<h3>Polices d’écriture</h3>'
      + '<div class="se-hint">Tapez le nom exact d’une police de <a href="https://fonts.google.com" target="_blank" rel="noopener" style="color:#F0B429">Google Fonts</a> (ex : Roboto, Rajdhani, Cinzel…). Elle remplacera la police d’origine sur tout le site.</div>'
      + fontDatalist('se-dl-fonts')
      + '<div class="se-grid2">'
      + '<div class="se-field"><label>Police des titres (à la place d’Orbitron)</label><input type="text" data-t="fontTitle" list="se-dl-fonts" placeholder="Orbitron"></div>'
      + '<div class="se-field"><label>Police du texte (à la place d’Exo 2)</label><input type="text" data-t="fontBody" list="se-dl-fonts" placeholder="Exo 2"></div>'
      + '</div>'
      + '<div class="se-card"><div style="font-family:Orbitron,sans-serif;color:var(--gold);font-size:1.3rem;letter-spacing:.1em;font-weight:700">327TH CORPS STELLAIRE</div><div style="font-family:\'Exo 2\',sans-serif;margin-top:6px">Par les étoiles, pour la République. Exemple de texte courant du site.</div></div>'
      + (ADV() ? '' : '<!--') + '<div class="se-field"><label>Polices supplémentaires à charger (séparées par des virgules) — utilisables dans l’édition visuelle et le CSS</label><input type="text" data-t="extraFonts" placeholder="Ex : Bebas Neue, Cinzel"></div>' + (ADV() ? '' : '-->')
      + '<h3>Taille du texte</h3>'
      + '<div class="se-row"><input type="range" min="70" max="150" step="1" data-t="baseSize" style="flex:1"><b id="se-size-val" style="width:60px;text-align:right"></b><button class="se-btn" data-a="size100">100 %</button></div>'
      + '<div class="se-hint">Agrandit ou réduit tout le texte du site exprimé en « rem » (la majorité du site).</div>'
      + '<h3>Image de fond</h3>'
      + '<div class="se-field"><label>Lien Imgur de l’image — laissez vide pour aucune</label><input type="text" data-t="bgImage" placeholder="https://i.imgur.com/xxxxxxx.png"></div>'
      + '<div class="se-row" style="margin-top:16px"><button class="se-btn primary" data-a="save">💾 Publier le thème</button><button class="se-btn" data-a="cancel">Annuler les changements non publiés</button><button class="se-btn danger" data-a="reset">↺ Thème d’origine</button></div>';
    var colors = $('#se-colors', c);
    THEME_VARS.forEach(function (pair) {
      var name = pair[0];
      var cur = t.vars[name] || rootStyle.getPropertyValue(name).trim();
      var row = el('<div class="se-field"><label>' + esc(pair[1]) + (ADV() ? ' <span class="se-mono">' + name + '</span>' : '') + '</label>'
        + '<div class="se-color"><input type="color"><input type="text"><button class="se-btn" title="Valeur d’origine">↺</button></div></div>');
      var col = $('input[type=color]', row), txt = $('input[type=text]', row);
      col.value = toHex(cur); txt.value = t.vars[name] || ''; txt.placeholder = cur;
      col.addEventListener('input', function () { txt.value = col.value; t.vars[name] = col.value; live(); });
      txt.addEventListener('input', function () { t.vars[name] = txt.value.trim(); if (txt.value) col.value = toHex(txt.value); live(); });
      $('button', row).addEventListener('click', function () { delete t.vars[name]; txt.value = ''; live(); col.value = toHex(getComputedStyle(document.documentElement).getPropertyValue(name)); });
      colors.appendChild(row);
    });
    $$('[data-t]', c).forEach(function (inp) {
      var k = inp.getAttribute('data-t');
      inp.value = k === 'baseSize' ? (t.baseSize || 100) : (t[k] || '');
      inp.addEventListener(k === 'baseSize' ? 'input' : 'change', function () {
        if (k === 'bgImage' && imgurWarning(imgurDirect(inp.value))) { toast(imgurWarning(imgurDirect(inp.value)), 'error'); inp.value = t[k] || ''; return; }
        t[k] = k === 'bgImage' ? imgurDirect(inp.value) : (k === 'baseSize' ? +inp.value : inp.value.trim());
        if (k === 'bgImage') inp.value = t[k];
        live();
      });
    });
    function sizeLabel() { $('#se-size-val', c).textContent = (t.baseSize || 100) + ' %'; }
    sizeLabel();
    function live() {
      SE.state.global = Object.assign({}, SE.state.global, { theme: t });
      SE.applyStyles();
      sizeLabel();
    }
    on(c, '[data-a=size100]', 'click', function () { t.baseSize = 100; $('[data-t=baseSize]', c).value = 100; live(); });
    on(c, '[data-a=save]', 'click', function (ev) {
      Object.keys(t.vars).forEach(function (k) { if (!t.vars[k]) delete t.vars[k]; });
      busy(ev.target, publishData(function (d) { d.global.theme = t; }, msg('thème du site')).then(function () { saved = clone(t); }));
    });
    on(c, '[data-a=cancel]', 'click', function () {
      SE.state.global = Object.assign({}, SE.state.global, { theme: saved }); SE.applyStyles(); tabTheme(c);
    });
    on(c, '[data-a=reset]', 'click', function (ev) {
      if (!confirm('Revenir aux couleurs, polices et tailles d’origine pour tout le site ?')) return;
      busy(ev.target, publishData(function (d) { delete d.global.theme; }, msg('thème d’origine')).then(function () { tabTheme(c); }));
    });
  }

  // ── Onglet : Images ─────────────────────────────────────────────
  function tabImages(c) {
    var map = clone(D().global.images); // nom de fichier → lien
    var base = {};
    try { /* global IMG_OVERRIDES */ if (typeof IMG_OVERRIDES !== 'undefined') base = IMG_OVERRIDES; } catch (e) { /* ignore */ }

    c.innerHTML = '<h3>Images de cette page</h3>'
      + '<div class="se-hint">Collez un lien Imgur pour remplacer une image <b>partout sur le site</b> (toutes les images qui utilisent ce même fichier). Pour changer une seule image à un seul endroit, utilisez l’édition visuelle. Les liens « imgur.com/xxxx » sont convertis automatiquement en lien direct.</div>'
      + '<div class="se-list" id="se-img-page"></div>'
      + '<h3>Toutes les images remplacées du site</h3>'
      + '<div class="se-row"><input type="text" id="se-img-filter" placeholder="🔍 Rechercher un nom de fichier…" style="max-width:320px"></div>'
      + '<div class="se-list" id="se-img-all"></div>'
      + '<h3>Ajouter un remplacement</h3>'
      + '<div class="se-grid2"><div class="se-field"><label>Nom du fichier d’origine (ex : mois1.png)</label><input type="text" id="se-img-new-name"></div>'
      + '<div class="se-field"><label>Lien Imgur</label><input type="text" id="se-img-new-url" placeholder="https://i.imgur.com/xxxxxxx.png"></div></div>'
      + '<div class="se-row"><button class="se-btn" id="se-img-add">➕ Ajouter</button></div>'
      + '<div class="se-row" style="margin-top:14px;position:sticky;bottom:0;background:#0b0b16;padding:8px 0"><button class="se-btn primary" data-a="save">💾 Publier les images</button><span class="se-hint" id="se-img-dirty"></span></div>';

    function setDirty() { $('#se-img-dirty', c).textContent = 'Modifications non publiées'; }
    function row(name, url) {
      var cur = map[name] || base[name] || '';
      var r = el('<div class="se-item"><img class="se-thumb" alt=""><div class="grow"><b>' + esc(name) + '</b>'
        + (map[name] ? ' <span class="se-tag green">remplacée</span>' : (base[name] ? ' <span class="se-tag">img-overrides.js</span>' : ''))
        + '<div class="se-field" style="margin:4px 0 0"><input type="text" placeholder="Coller un lien Imgur…"></div><div class="se-mono" data-w></div></div>'
        + (map[name] ? '<button class="se-btn danger" data-reset title="Retirer le remplacement">↺</button>' : '') + '</div>');
      var thumb = $('img', r), inp = $('input', r);
      thumb.src = map[name] || url || cur;
      inp.value = map[name] || '';
      inp.addEventListener('change', function () {
        var v = imgurDirect(inp.value);
        inp.value = v;
        var w = imgurWarning(v);
        $('[data-w]', r).textContent = w;
        if (w) { toast(w, 'error'); return; }
        if (v) { map[name] = v; thumb.src = v; } else delete map[name];
        setDirty();
      });
      var rb = $('[data-reset]', r);
      if (rb) rb.addEventListener('click', function () { delete map[name]; setDirty(); renderAll(); renderPage(); });
      return r;
    }
    function renderPage() {
      var host = $('#se-img-page', c);
      host.innerHTML = '';
      var seen = {};
      $$('img').forEach(function (img) {
        if (img.closest('[data-se-ui]')) return;
        var name = SE.originalImageName(img);
        if (!name || seen[name]) return;
        seen[name] = 1;
        host.appendChild(row(name, img.currentSrc || img.src));
      });
      if (!host.children.length) host.innerHTML = '<div class="se-hint">Aucune image sur cette page.</div>';
    }
    function renderAll() {
      var host = $('#se-img-all', c);
      var f = ($('#se-img-filter', c).value || '').toLowerCase();
      host.innerHTML = '';
      var names = Object.keys(Object.assign({}, base, map)).sort();
      names.filter(function (n) { return !f || n.toLowerCase().indexOf(f) !== -1; }).slice(0, 200).forEach(function (n) {
        host.appendChild(row(n, map[n] || base[n]));
      });
    }
    renderPage(); renderAll();
    $('#se-img-filter', c).addEventListener('input', renderAll);
    on(c, '#se-img-add', 'click', function () {
      var n = $('#se-img-new-name', c).value.trim(), u = imgurDirect($('#se-img-new-url', c).value);
      if (!n || !u) { toast('Indiquez le nom du fichier et le lien.', 'error'); return; }
      if (imgurWarning(u)) { toast(imgurWarning(u), 'error'); return; }
      map[n] = u; setDirty(); renderAll(); renderPage();
      $('#se-img-new-name', c).value = ''; $('#se-img-new-url', c).value = '';
    });
    on(c, '[data-a=save]', 'click', function (ev) {
      busy(ev.target, publishData(function (d) { d.global.images = map; }, msg('images du site')).then(function () {
        $('#se-img-dirty', c).textContent = '';
        renderPage(); renderAll();
      }));
    });
  }

  // ── Onglet : CSS / JS globaux ───────────────────────────────────
  function tabGlobal(c) {
    var g = D().global;
    c.innerHTML = '<h3>CSS global (toutes les pages)</h3>'
      + '<div class="se-hint">Ajouté après les styles de chaque page : vous pouvez tout redéfinir (ex : <code>.page-title { font-size: 4rem; }</code>, <code>nav { background: #000 !important; }</code>).</div>'
      + '<div id="se-g-css"></div><div class="se-row"><button class="se-btn primary" data-a="css">💾 Publier le CSS</button><button class="se-btn" data-a="cssprev">👁 Aperçu</button></div>'
      + '<h3>JavaScript global (toutes les pages)</h3>'
      + '<div class="se-hint">Exécuté sur chaque page après son chargement. <code>window.site327</code> (rôle, Firebase) et <code>window.SiteEditor</code> sont disponibles.</div>'
      + '<div id="se-g-js"></div><div class="se-row"><button class="se-btn primary" data-a="js">💾 Publier le JS (recharge la page)</button></div>'
      + '<h3>Code ajouté dans le &lt;head&gt; (toutes les pages)</h3>'
      + '<div class="se-hint">Balises meta, polices, scripts externes (ex : <code>&lt;link rel="stylesheet" href="…"&gt;</code>, <code>&lt;script src="https://…"&gt;&lt;/script&gt;</code>).</div>'
      + '<div id="se-g-head"></div><div class="se-row"><button class="se-btn primary" data-a="head">💾 Publier (recharge la page)</button></div>'
      + '<div class="se-hint" style="margin-top:14px">Pour modifier directement les fichiers partagés (auth.js, responsive.css…), utilisez l’onglet « 📁 Fichiers du site ».</div>';
    var css = codeEditor($('#se-g-css', c), 'css', g.css || '', 300);
    var js = codeEditor($('#se-g-js', c), 'js', g.js || '', 260);
    var head = codeEditor($('#se-g-head', c), 'html', g.head || '', 160);
    on(c, '[data-a=cssprev]', 'click', function () { SE.state.global = Object.assign({}, SE.state.global, { css: css.get() }); SE.applyStyles(); toast('Aperçu appliqué (non publié)'); });
    function save(btn, field, value, reload, label) {
      busy(btn, publishData(function (d) { if (value) d.global[field] = value; else delete d.global[field]; }, msg(label)).then(function () {
        if (reload) setTimeout(function () { location.reload(); }, 900);
      }));
    }
    on(c, '[data-a=css]', 'click', function (ev) { save(ev.target, 'css', css.get(), false, 'CSS global'); });
    on(c, '[data-a=js]', 'click', function (ev) { save(ev.target, 'js', js.get(), true, 'JS global'); });
    on(c, '[data-a=head]', 'click', function (ev) { save(ev.target, 'head', head.get(), true, 'code du <head>'); });
  }

  // ── Onglet : Fichiers du site ───────────────────────────────────
  function tabFiles(c) {
    var files = codeFiles();
    var notes = {};
    SITE_FILES.forEach(function (f) { notes[f.name] = f.note; });
    var first = files.indexOf('auth.js') !== -1 ? 'auth.js' : files[0];
    c.innerHTML = '<h3>Fichiers du dépôt GitHub</h3>'
      + '<div class="se-hint">Modifiez n’importe quel fichier de code du site. « Publier » crée un commit qui remplace le fichier dans le dépôt. Pour le code d’une page, l’onglet « Code de la page » fait la même chose.</div>'
      + '<div class="se-warn">Une erreur dans un fichier partagé (auth.js, responsive.js…) peut casser tout le site. L’historique sous l’éditeur permet de recharger une ancienne version et de la republier. Vous pouvez aussi annuler un commit directement sur GitHub.</div>'
      + '<div class="se-row"><select id="se-file-sel" style="max-width:360px">' + files.map(function (f) {
        return '<option value="' + esc(f) + '"' + (f === first ? ' selected' : '') + '>' + esc(f) + '</option>';
      }).join('') + '</select><span id="se-file-status"></span>'
      + '<button class="se-btn" data-a="new">➕ Nouveau fichier</button></div>'
      + '<div class="se-hint" id="se-file-note"></div>'
      + '<div id="se-file-host"></div>'
      + '<div class="se-row" style="margin-top:10px"><button class="se-btn primary" data-a="save">💾 Publier sur GitHub</button>'
      + '<button class="se-btn" data-a="dl">⬇ Télécharger</button>'
      + '<a class="se-btn" data-a="gh" target="_blank" rel="noopener">↗ Voir sur GitHub</a>'
      + '<button class="se-btn danger" data-a="del">🗑 Supprimer le fichier</button></div>'
      + '<h3>Historique de ce fichier</h3><div class="se-list" id="se-file-hist"></div>';
    var sel = $('#se-file-sel', c), ed = null, cur = null;
    function modeOf(p) { return /\.css$/i.test(p) ? 'css' : /\.(html|svg|xml)$/i.test(p) ? 'html' : 'js'; }
    function load() {
      cur = sel.value;
      if (!cur) return;
      $('#se-file-note', c).textContent = notes[cur] || (cur === SE.DATA_FILE ? 'Données de l’éditeur (modifications visuelles, thème, images, menu). Modifiez-le seulement si vous savez ce que vous faites.' : '');
      $('[data-a=gh]', c).href = githubUrl(cur);
      $('#se-file-host', c).innerHTML = '<p class="se-hint">Chargement…</p>';
      fileSource(cur).then(function (src) {
        $('#se-file-status', c).innerHTML = src.pending ? '<span class="se-tag blue">en cours de mise en ligne</span>' : '';
        $('#se-file-host', c).innerHTML = '';
        ed = codeEditor($('#se-file-host', c), modeOf(cur), src.text, Math.max(320, Math.round(window.innerHeight * 0.5)));
      }).catch(fail);
      historyBox($('#se-file-hist', c), cur, function (t) { if (ed) ed.set(t); });
    }
    sel.addEventListener('change', load);
    load();
    on(c, '[data-a=save]', 'click', function (ev) {
      if (!ed) return;
      var v = ed.get();
      if (cur === SE.DATA_FILE) { try { JSON.parse(v); } catch (e) { toast('JSON invalide : ' + e.message, 'error'); return; } }
      busy(ev.target, publishFiles([{ path: cur, content: v }], msg('fichier ' + cur)).then(function () {
        if (REPO_FILES.indexOf(cur) === -1) REPO_FILES.push(cur);
        if (/\.(js|css)$/i.test(cur) || cur === SE.FILE || cur === SE.DATA_FILE) setTimeout(function () { location.reload(); }, 900);
      }));
    });
    on(c, '[data-a=dl]', 'click', function () { if (ed) download(cur.split('/').pop(), ed.get()); });
    on(c, '[data-a=new]', 'click', function () {
      var name = (prompt('Nom du nouveau fichier (ex : scripts/mon-script.js, style-perso.css) :') || '').trim().replace(/^\/+/, '');
      if (!name) return;
      if (REPO_FILES.indexOf(name) !== -1) { toast('Ce fichier existe déjà.', 'error'); return; }
      var o = document.createElement('option'); o.value = name; o.textContent = name + ' (nouveau)';
      sel.appendChild(o); sel.value = name;
      cur = name;
      $('#se-file-host', c).innerHTML = '';
      $('#se-file-hist', c).innerHTML = '';
      ed = codeEditor($('#se-file-host', c), modeOf(name), '', 360);
    });
    on(c, '[data-a=del]', 'click', function (ev) {
      if (!cur || REPO_FILES.indexOf(cur) === -1) return;
      if (prompt('Supprimer « ' + cur + ' » du dépôt ? Tapez SUPPRIMER pour confirmer.') !== 'SUPPRIMER') return;
      busy(ev.target, publishFiles([{ path: cur, delete: true }], msg('suppression du fichier ' + cur)).then(function () {
        REPO_FILES = REPO_FILES.filter(function (x) { return x !== cur; });
        tabFiles(c);
      }));
    });
  }

  // ── Onglet : Historique & aide ──────────────────────────────────
  function tabBackup(c) {
    c.innerHTML = '<h3>Historique</h3>'
      + '<div class="se-hint">Chaque enregistrement de l’éditeur est un commit dans le dépôt GitHub : tout l’historique du site est conservé et chaque version peut être restaurée (onglets « Code de la page » et « Fichiers du site », ou directement sur GitHub).</div>'
      + '<div class="se-row"><a class="se-btn" target="_blank" rel="noopener" href="' + esc(githubUrl('')) + '">↗ Voir tous les commits sur GitHub</a></div>'
      + '<div class="se-list" id="se-all-hist"></div>'
      + '<h3>Données de l’éditeur (site-editor-data.json)</h3>'
      + '<div class="se-hint">Modifications visuelles, thème, images, menu et CSS/JS globaux.</div>'
      + '<div class="se-row"><button class="se-btn" data-a="export">⬇ Télécharger</button>'
      + '<label class="se-btn">⬆ Importer un fichier<input type="file" accept=".json,application/json" hidden id="se-import"></label>'
      + '<button class="se-btn danger" data-a="wipe">🗑 Effacer toutes ces données</button></div>'
      + '<h3>Aide</h3>'
      + '<div class="se-hint" style="font-size:.82rem;color:#cdbf9f">'
      + '<b>Publication</b> : chaque « Publier » envoie un commit sur GitHub. GitHub Pages met le site à jour en environ 1 minute. Pendant ce temps, vous voyez déjà la nouvelle version dans votre navigateur.<br><br>'
      + '<b>🖱 Édition visuelle</b> (onglet « Cette page ») : cliquez sur un élément de la page pour le modifier. Barre du haut : « Parent » sélectionne le bloc qui contient l’élément, « Annuler » revient en arrière, « Publier » envoie sur GitHub.<br><br>'
      + '<b>&lt;/&gt; Code de la page</b> : le fichier .html complet de la page.<br><br>'
      + '<b>📄 Pages</b> : créer une page (vrai fichier .html), l’ajouter au menu, supprimer une page.<br><br>'
      + '<b>🧭 Menu</b> : ajouter des liens / menus déroulants, renommer ou masquer les liens existants.<br><br>'
      + '<b>🎨 Thème</b> : couleurs, polices Google Fonts, taille du texte, image de fond, pour tout le site.<br><br>'
      + '<b>🖼 Images</b> : remplacer une image par un lien Imgur sur tout le site.<br><br>'
      + '<b>💻 CSS / JS globaux</b> et <b>📁 Fichiers du site</b> : pour refaire n’importe quel comportement ou style du site.<br><br>'
      + '<b>Mode secours</b> : ajoutez <code>?se-safe=1</code> à l’adresse d’une page pour l’afficher sans site-editor-data.json.<br><br>'
      + '<b>Images Imgur</b> : sur imgur.com, clic droit sur l’image → « Copier l’adresse de l’image » (lien qui commence par https://i.imgur.com/).'
      + '</div>';
    gh.branch().then(function (b) {
      return ghFetch(repoPath() + '/commits?sha=' + encodeURIComponent(b) + '&per_page=10');
    }).then(function (list) {
      var host = $('#se-all-hist', c);
      (list || []).forEach(function (cm) {
        host.appendChild(el('<div class="se-item"><span class="se-mono">' + cm.sha.slice(0, 7) + '</span><span class="grow">' + esc(cm.commit.message.split('\n')[0])
          + ' <span class="se-hint">— ' + esc(new Date(cm.commit.author.date).toLocaleString('fr-FR')) + '</span></span>'
          + '<a class="se-btn" target="_blank" rel="noopener" href="' + esc(cm.html_url) + '">Voir</a></div>'));
      });
    }).catch(function () { /* ignore */ });
    on(c, '[data-a=export]', 'click', function () {
      download('site-editor-data.json', JSON.stringify(D(), null, 2), 'application/json');
    });
    on(c, '#se-import', 'change', function (ev) {
      var f = ev.target.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var obj = JSON.parse(txt);
        if (!confirm('Remplacer toutes les données de l’éditeur par ce fichier ?')) return;
        return publishData(function () { return obj; }, msg('import des données de l’éditeur')).then(function () {
          setTimeout(function () { location.reload(); }, 900);
        });
      }).catch(fail);
    });
    on(c, '[data-a=wipe]', 'click', function (ev) {
      if (!confirm('Effacer toutes les modifications visuelles, le thème, les images et le menu ajoutés avec l’éditeur ?')) return;
      if (prompt('Tapez REINITIALISER pour confirmer') !== 'REINITIALISER') return;
      busy(ev.target, publishData(function (d) { return { customPages: d.customPages }; }, msg('réinitialisation des données de l’éditeur')).then(function () {
        setTimeout(function () { location.reload(); }, 900);
      }));
    });
  }

  // ════════════════════════════════════════════════════════════════
  //  MODIFICATION DE LA PAGE (cliquer sur un élément pour le modifier)
  // ════════════════════════════════════════════════════════════════
  var VE = { active: false, sel: null, edits: {}, saved: '{}', history: [], editing: null, multi: [] };
  var multiBoxes = [];
  var bar, hoverBox, selBox, inspector;

  // Champs de style détaillés (mode avancé uniquement)
  var STYLE_FIELDS = [
    ['font-family', 'Police', 'font'],
    ['font-size', 'Taille du texte', 'text', 'ex : 18px, 1.4rem'],
    ['font-weight', 'Graisse', 'select', ['', '300', '400', '600', '700', '900']],
    ['font-style', 'Style', 'select', ['', 'normal', 'italic']],
    ['color', 'Couleur du texte', 'color'],
    ['background-color', 'Couleur de fond', 'color'],
    ['text-align', 'Alignement', 'select', ['', 'left', 'center', 'right', 'justify']],
    ['text-transform', 'Casse', 'select', ['', 'none', 'uppercase', 'lowercase', 'capitalize']],
    ['letter-spacing', 'Espacement des lettres', 'text', 'ex : 0.1em'],
    ['line-height', 'Hauteur de ligne', 'text', 'ex : 1.6'],
    ['width', 'Largeur', 'text', 'ex : 100%, 300px'],
    ['max-width', 'Largeur max', 'text', 'ex : 800px'],
    ['height', 'Hauteur', 'text', 'ex : auto, 200px'],
    ['margin', 'Marge extérieure', 'text', 'ex : 20px auto'],
    ['padding', 'Marge intérieure', 'text', 'ex : 10px 20px'],
    ['border', 'Bordure', 'text', 'ex : 1px solid #F0B429'],
    ['border-radius', 'Arrondi', 'text', 'ex : 8px'],
    ['box-shadow', 'Ombre', 'text', 'ex : 0 0 20px rgba(0,0,0,.5)'],
    ['opacity', 'Opacité', 'text', '0 à 1'],
    ['display', 'Affichage', 'select', ['', 'block', 'inline-block', 'flex', 'grid', 'inline', 'none']]
  ];
  var SWATCHES = ['#F0B429', '#C8922A', '#E8DCC8', '#FFFFFF', '#8A7A62', '#00C8FF', '#7FE0A0', '#FF5A5A', '#000000'];

  function pageSelectField(label) {
    return [
      { key: 'page', label: label || 'Vers quelle page ?', type: 'select', options: pageOptions().map(function (p) { return [p[0], p[1]]; }).concat([['__other', 'Une autre adresse (lien internet)…']]) },
      { key: 'url', label: 'Adresse internet', placeholder: 'https://…', showIf: function (v) { return v.page === '__other'; } }
    ];
  }
  function hrefFrom(v) { return v.page === '__other' ? (v.url || '#').trim() : v.page; }

  // Blocs que l'on peut ajouter. Chaque fonction renvoie une promesse du HTML (ou null)
  var BLOCKS = {
    title: ['🔠', 'Titre', function () { return Promise.resolve('<h2 style="font-family:\'Orbitron\',sans-serif;color:var(--gold);letter-spacing:.1em;text-transform:uppercase;margin:28px 0 12px;font-size:1.4rem;text-align:center;">Nouveau titre</h2>'); }],
    text: ['¶', 'Texte', function () { return Promise.resolve('<p style="margin:12px auto;line-height:1.75;max-width:900px;">Nouveau texte : double-cliquez dessus pour l’écrire.</p>'); }],
    image: ['🖼', 'Image', function () {
      return dialog({ title: 'Ajouter une image', text: 'Sur imgur.com : clic droit sur l’image → « Copier l’adresse de l’image », puis collez-la ici.', fields: [{ key: 'u', label: 'Lien de l’image (Imgur)', placeholder: 'https://i.imgur.com/…' }], ok: 'Ajouter',
        submit: function (v) { requireImgur(v.u); } })
        .then(function (v) { return v ? '<img src="' + esc(imgurDirect(v.u)) + '" alt="" style="display:block;max-width:100%;height:auto;margin:18px auto;border-radius:6px;">' : null; });
    }],
    button: ['🔘', 'Bouton', function () {
      return dialog({ title: 'Ajouter un bouton', fields: [{ key: 'label', label: 'Texte du bouton', value: 'En savoir plus' }].concat(pageSelectField()), ok: 'Ajouter' })
        .then(function (v) {
          if (!v) return null;
          var ext = v.page === '__other';
          return '<div style="text-align:center;margin:18px 0;"><a href="' + esc(hrefFrom(v)) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + ' style="display:inline-block;font-family:\'Orbitron\',sans-serif;font-size:.75rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--bg);background:var(--gold);padding:12px 26px;border-radius:4px;text-decoration:none;">' + esc(v.label || 'Bouton') + '</a></div>';
        });
    }],
    toc: ['📑', 'Sommaire', function () {
      return dialog({
        title: '📑 Ajouter un sommaire',
        text: 'Le sommaire affiche un bouton par partie pour aller directement à cette partie de la page. Chaque partie est ajoutée en dessous avec un grand numéro (1, 2, 3…), son titre et une zone où écrire son contenu.',
        fields: [
          { key: 'h', label: 'Titre du sommaire', value: 'Sommaire' },
          { key: 't', label: 'Titres des parties (un par ligne)', type: 'textarea', rows: 6, value: 'Présentation\nRègles\nContact' }
        ],
        ok: 'Créer le sommaire',
        submit: function (v) { if (!tocLines(v.t).length) throw new Error('Écrivez au moins un titre de partie.'); }
      }).then(function (v) {
        if (!v) return null;
        var T = uid('toc'), titles = tocLines(v.t);
        return [tocHtml(T, v.h || 'Sommaire', titles)].concat(titles.map(function (t, i) { return tocPartHtml(T, i + 1, t); }));
      });
    }],
    divtext: ['✦', 'Séparateur avec texte', function () {
      return Promise.resolve('<div class="se-divtext" style="display:flex;align-items:center;gap:14px;max-width:700px;margin:30px auto;color:var(--gold);font-family:\'Orbitron\',sans-serif;letter-spacing:.15em;font-size:.8rem;text-transform:uppercase;">'
        + '<hr style="flex:1;border:none;height:1px;margin:0;background:linear-gradient(90deg,transparent,var(--gold));">'
        + '<span style="white-space:nowrap;">✦</span>'
        + '<hr style="flex:1;border:none;height:1px;margin:0;background:linear-gradient(90deg,var(--gold),transparent);"></div>');
    }],
    cardpop: ['🪟', 'Carte + fenêtre', function () {
      return dialog({
        title: 'Ajouter une carte qui ouvre une fenêtre',
        text: 'Comme sur la page Tenues : une case avec une image et un texte ; un clic dessus ouvre une petite fenêtre par-dessus la page, avec une croix ✕ pour la fermer. Tout reste modifiable ensuite.',
        fields: [
          { key: 'u', label: 'Lien Imgur de l’image', placeholder: 'https://i.imgur.com/…' },
          { key: 't', label: 'Titre', value: 'Titre de la carte' },
          { key: 's', label: 'Petit texte sous le titre (facultatif)', value: '' },
          { key: 'l', label: 'Contenu de la fenêtre : une ligne = un tiret', type: 'textarea', rows: 5, value: 'Première ligne\nDeuxième ligne\nTroisième ligne' }
        ],
        ok: 'Ajouter',
        submit: function (v) { requireImgur(v.u); }
      }).then(function (v) {
        if (!v) return null;
        var src = esc(imgurDirect(v.u)), title = esc(v.t || 'Titre');
        var lines = String(v.l || '').split('\n').map(function (x) { return x.replace(/^\s*[-–•]\s*/, '').trim(); }).filter(Boolean);
        var list = lines.length ? '<ul style="margin:10px 0 0;padding-left:22px;line-height:1.8;">' + lines.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
        return '<div class="se-card-pop" style="display:inline-block;width:260px;max-width:100%;margin:16px;vertical-align:top;">'
          + '<div class="se-cp-card" onclick="var m=this.parentNode.querySelector(\'.se-cp-modal\');if(m)m.style.display=\'flex\';" style="cursor:pointer;background:rgba(13,13,26,.85);border:1px solid rgba(240,180,41,.3);border-radius:8px;overflow:hidden;text-align:center;">'
          + '<img src="' + src + '" alt="" style="display:block;width:100%;height:auto;">'
          + '<div style="padding:12px 14px;"><strong style="display:block;font-family:\'Orbitron\',sans-serif;color:var(--gold);letter-spacing:.06em;font-size:.9rem;">' + title + '</strong>'
          + (v.s ? '<span style="display:block;margin-top:4px;font-size:.85rem;opacity:.8;">' + esc(v.s) + '</span>' : '') + '</div></div>'
          + '<div class="se-cp-modal" onclick="if(event.target===this)this.style.display=\'none\';" style="display:none;position:fixed;inset:0;z-index:500;background:rgba(0,0,0,.72);align-items:center;justify-content:center;padding:24px;box-sizing:border-box;">'
          + '<div class="se-cp-box" style="position:relative;width:100%;max-width:620px;max-height:90vh;overflow:auto;background:#0d0d1a;border:1px solid rgba(240,180,41,.4);border-radius:10px;padding:26px 24px 22px;box-sizing:border-box;text-align:left;">'
          + '<button type="button" class="se-cp-close" onclick="this.closest(\'.se-cp-modal\').style.display=\'none\';" style="position:absolute;top:10px;right:12px;width:34px;height:34px;border-radius:50%;border:1px solid rgba(240,180,41,.4);background:rgba(0,0,0,.4);color:var(--gold);font-size:1rem;cursor:pointer;line-height:1;">✕</button>'
          + '<img src="' + src + '" alt="" style="display:block;max-width:100%;height:auto;margin:0 auto 16px;border-radius:6px;">'
          + '<div><strong style="display:block;font-family:\'Orbitron\',sans-serif;color:var(--gold);letter-spacing:.06em;font-size:1rem;">' + title + '</strong>' + list + '</div>'
          + '</div></div></div>';
      });
    }],
    box: ['⬚', 'Bloc libre', function () { return Promise.resolve('<div style="width:320px;max-width:100%;min-height:120px;margin:20px auto;padding:16px 20px;background:rgba(13,13,26,.85);border:1px solid rgba(240,180,41,.35);border-radius:8px;box-sizing:border-box;"><p style="margin:0;line-height:1.7;">Nouveau bloc : cliquez dedans pour écrire, maintenez le clic pour le déplacer.</p></div>'); }],
    card: ['▭', 'Encadré', function () { return Promise.resolve('<div style="max-width:900px;margin:20px auto;padding:20px 24px;background:rgba(13,13,26,.85);border:1px solid rgba(240,180,41,.3);border-radius:8px;"><h3 style="font-family:\'Orbitron\',sans-serif;color:var(--gold);letter-spacing:.08em;margin:0 0 10px;font-size:1rem;">Titre de l’encadré</h3><p style="margin:0;line-height:1.7;">Contenu de l’encadré.</p></div>'); }],
    list: ['☰', 'Liste', function () { return Promise.resolve('<ul style="max-width:900px;margin:12px auto;padding-left:24px;line-height:1.8;"><li>Premier élément</li><li>Deuxième élément</li><li>Troisième élément</li></ul>'); }],
    gallery: ['▦', 'Galerie', function () {
      return dialog({ title: 'Ajouter une galerie d’images', text: 'Un lien Imgur par ligne (https://i.imgur.com/…).', fields: [{ key: 'u', label: 'Liens Imgur des images', type: 'textarea' }], ok: 'Ajouter',
        submit: function (v) {
          var list = String(v.u || '').split(/[\s,]+/).filter(Boolean);
          if (!list.length) throw new Error('Collez au moins un lien Imgur.');
          list.forEach(function (u, i) { try { requireImgur(u); } catch (e) { throw new Error('Ligne ' + (i + 1) + ' : ' + e.message); } });
        } })
        .then(function (v) {
          if (!v) return null;
          var urls = String(v.u || '').split(/[\s,]+/).filter(Boolean).map(imgurDirect);
          if (!urls.length) return null;
          return '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:14px;max-width:1100px;margin:20px auto;">'
            + urls.map(function (u) { return '<img src="' + esc(u) + '" alt="" style="width:100%;height:auto;border-radius:6px;border:1px solid rgba(240,180,41,.2);">'; }).join('') + '</div>';
        });
    }],
    video: ['▶', 'Vidéo YouTube', function () {
      return dialog({ title: 'Ajouter une vidéo YouTube', fields: [{ key: 'u', label: 'Lien de la vidéo YouTube', placeholder: 'https://www.youtube.com/watch?v=…' }], ok: 'Ajouter',
        submit: function (v) { if (!/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.test(v.u || '')) throw new Error('Lien YouTube non reconnu.'); } })
        .then(function (v) {
          if (!v) return null;
          var m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/.exec(v.u);
          return '<div style="max-width:900px;margin:20px auto;aspect-ratio:16/9;"><iframe src="https://www.youtube.com/embed/' + m[1] + '" style="width:100%;height:100%;border:0;border-radius:6px;" allowfullscreen></iframe></div>';
        });
    }],
    divider: ['—', 'Séparateur', function () { return Promise.resolve('<hr style="border:none;height:1px;background:linear-gradient(90deg,transparent,var(--gold),transparent);max-width:600px;margin:30px auto;">'); }],
    space: ['↕', 'Espace', function () { return Promise.resolve('<div style="height:40px;"></div>'); }],
    html: ['</>', 'HTML libre', function () {
      return dialog({ title: 'HTML libre', fields: [{ key: 'h', label: 'Code HTML', type: 'textarea', rows: 8 }], ok: 'Ajouter' }).then(function (v) { return v && v.h ? v.h : null; });
    }, true]
  };

  // ── Sommaire : boutons vers des parties numérotées ──────────────
  function tocLines(s) { return String(s || '').split('\n').map(function (x) { return x.replace(/^\s*(\d+[.)]|[-–•])\s*/, '').trim(); }).filter(Boolean); }
  var TOC_JUMP = 'var t=document.getElementById(this.getAttribute(\'href\').slice(1));if(t){event.preventDefault();t.scrollIntoView({behavior:\'smooth\',block:\'start\'});}';
  function tocBtnHtml(T, n, title) {
    return '<a class="se-toc-btn" href="#' + T + '-' + n + '" onclick="' + TOC_JUMP + '" style="display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border:1px solid rgba(240,180,41,.45);border-radius:999px;color:var(--gold);text-decoration:none;font-family:\'Exo 2\',sans-serif;font-size:.9rem;background:rgba(240,180,41,.06);">'
      + '<b style="font-family:\'Orbitron\',sans-serif;">' + n + '</b> ' + esc(title) + '</a>';
  }
  function tocHtml(T, heading, titles) {
    return '<div class="se-toc" data-toc="' + T + '" style="max-width:900px;margin:24px auto;padding:18px 20px;background:rgba(13,13,26,.85);border:1px solid rgba(240,180,41,.3);border-radius:10px;text-align:center;">'
      + '<div class="se-toc-title" style="font-family:\'Orbitron\',sans-serif;color:var(--gold);letter-spacing:.12em;text-transform:uppercase;font-size:.95rem;margin-bottom:12px;">' + esc(heading) + '</div>'
      + '<div class="se-toc-list" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">'
      + titles.map(function (t, i) { return tocBtnHtml(T, i + 1, t); }).join('') + '</div></div>';
  }
  function tocPartHtml(T, n, title) {
    return '<div class="se-toc-part" id="' + T + '-' + n + '" data-toc="' + T + '" style="max-width:900px;margin:34px auto 12px;scroll-margin-top:90px;">'
      + '<div class="se-toc-head" style="display:flex;align-items:center;gap:16px;padding-bottom:10px;border-bottom:1px solid rgba(240,180,41,.3);">'
      + '<span class="se-toc-num" style="flex:0 0 auto;width:56px;height:56px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:var(--gold);color:#06060D;font-family:\'Orbitron\',sans-serif;font-weight:900;font-size:1.6rem;">' + n + '</span>'
      + '<h2 class="se-toc-h" style="margin:0;font-family:\'Orbitron\',sans-serif;color:var(--gold);letter-spacing:.08em;font-size:1.4rem;">' + esc(title) + '</h2></div>'
      + '<div class="se-toc-body" style="padding:14px 4px;line-height:1.75;"><p style="margin:0;">Écrivez ici le contenu de cette partie…</p></div></div>';
  }
  function tocParts(T) { return $$('.se-toc-part[data-toc="' + T + '"]').filter(function (p) { return !isUi(p); }); }
  // Renumérote les parties (ordre de la page) et refait les boutons du sommaire avec leurs titres
  function rebuildToc(T) {
    var toc = document.querySelector('.se-toc[data-toc="' + T + '"]');
    var parts = tocParts(T);
    parts.forEach(function (p, i) {
      var n = i + 1;
      p.id = T + '-' + n;
      var num = p.querySelector('.se-toc-num');
      if (num) num.textContent = n;
      var w = addedWrap(p);
      if (w) commitAdded(w);
    });
    if (toc) {
      var listEl = toc.querySelector('.se-toc-list');
      if (listEl) listEl.innerHTML = parts.map(function (p, i) {
        var h = p.querySelector('.se-toc-h');
        return tocBtnHtml(T, i + 1, (h ? h.textContent : 'Partie ' + (i + 1)).trim());
      }).join('');
      var tw = addedWrap(toc);
      if (tw) commitAdded(tw);
    }
    updateBar();
  }
  function addTocPart(T) {
    return dialog({ title: 'Ajouter une partie au sommaire', fields: [{ key: 't', label: 'Titre de la nouvelle partie', value: 'Nouvelle partie' }], ok: 'Ajouter' }).then(function (v) {
      if (!v) return;
      var parts = tocParts(T);
      var lastEl = parts.length ? parts[parts.length - 1] : document.querySelector('.se-toc[data-toc="' + T + '"]');
      var lw = lastEl && addedWrap(lastEl);
      if (!lw) { toast('Sommaire introuvable sur la page.', 'error'); return; }
      pushHistory();
      var nid = uid('a');
      VE.edits[nid] = { type: 'add', anchor: '@' + lw.getAttribute('data-se-added'), pos: 'after', html: tocPartHtml(T, parts.length + 1, v.t || 'Nouvelle partie'), order: nextOrder() };
      reapply(true);
      rebuildToc(T);
      var w = document.querySelector('[data-se-added="' + nid + '"]');
      if (w && w.firstElementChild) { select(w.firstElementChild); w.firstElementChild.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    });
  }

  function nextOrder() {
    var m = 0;
    Object.keys(VE.edits).forEach(function (k) { m = Math.max(m, VE.edits[k].order || 0); });
    return m + 1;
  }
  function isUi(n) { return !n || !n.closest || !!n.closest('[data-se-ui]') || n === document.body || n === document.documentElement; }
  function addedWrap(n) { return n && n.closest ? n.closest('[data-se-added]') : null; }
  function cleanHtml(html) {
    return html.replace(/\s(contenteditable|spellcheck)="[^"]*"/gi, '').replace(/\sclass="se-editing"/g, '').replace(/\s?se-editing/g, '');
  }
  function pushHistory() {
    var s = JSON.stringify(VE.edits);
    if (VE.history[VE.history.length - 1] !== s) VE.history.push(s);
    if (VE.history.length > 80) VE.history.shift();
  }
  function setRec(el) {
    var path = SE.pathOf(el);
    var id = 's' + hash(path);
    if (!VE.edits[id]) VE.edits[id] = { type: 'set', path: path, order: nextOrder() };
    return VE.edits[id];
  }
  function getRec(el) {
    var id = 's' + hash(SE.pathOf(el));
    return VE.edits[id] || null;
  }
  function pruneRec(rec, id) {
    if (!rec || rec.type !== 'set') return;
    var keep = ['html', 'src', 'alt', 'href', 'target', 'className', 'title', 'attrs', 'css', 'bg', 'hidden'].some(function (k) { return rec[k] != null && rec[k] !== '' && rec[k] !== false; })
      || (rec.style && Object.keys(rec.style).length);
    if (!keep) delete VE.edits[id];
  }

  // Réapplique toutes les modifications puis retrouve l'élément sélectionné
  var reapplyRaf = null;
  function reapply(keepInspector) {
    var lp = VE.sel ? SE.livePath(VE.sel) : null, selEl = VE.sel;
    var multiLp = VE.multi.map(function (m) { return document.body.contains(m) ? SE.livePath(m) : null; });
    // Les fenêtres « Carte + fenêtre » ouvertes restent ouvertes après le redessin
    var openPops = $$('.se-cp-modal').filter(function (m) { return m.style.display === 'flex'; })
      .map(function (m) { var w = addedWrap(m); return w ? w.getAttribute('data-se-added') : null; }).filter(Boolean);
    SE.applyEdits(VE.edits);
    openPops.forEach(function (id) {
      var w = document.querySelector('[data-se-added="' + id + '"]');
      var m = w && w.querySelector('.se-cp-modal');
      if (m) m.style.display = 'flex';
    });
    if (selEl && !document.body.contains(selEl)) selEl = SE.resolve(lp);
    VE.sel = selEl;
    if (VE.multi.length) {
      VE.multi = VE.multi.map(function (m, i) { return document.body.contains(m) ? m : (multiLp[i] ? SE.resolve(multiLp[i]) : null); }).filter(Boolean);
      if (VE.multi.length < 2) VE.multi = [];
    }
    updateBar();
    positionBoxes();
    if (!keepInspector) renderInspector();
  }
  function reapplySoon() {
    if (reapplyRaf) cancelAnimationFrame(reapplyRaf);
    reapplyRaf = requestAnimationFrame(function () { reapplyRaf = null; reapply(true); });
  }
  function commitAdded(wrap) {
    var id = wrap.getAttribute('data-se-added');
    var rec = VE.edits[id];
    if (!rec) return;
    if (!wrap.innerHTML.trim()) { delete VE.edits[id]; return; }
    // Une fenêtre ouverte pendant la modification est enregistrée fermée
    var copy = wrap.cloneNode(true);
    Array.prototype.forEach.call(copy.querySelectorAll('.se-cp-modal'), function (m) { m.style.display = 'none'; });
    rec.html = cleanHtml(copy.innerHTML);
  }
  // Change une propriété de l'élément sélectionné
  function change(fn) {
    var el = VE.sel;
    if (!el) return;
    var wrap = addedWrap(el);
    if (wrap) {
      fn(null, el);
      commitAdded(wrap);
      updateBar();
      positionBoxes();
      return;
    }
    var rec = setRec(el);
    var id = 's' + hash(rec.path);
    fn(rec, el);
    pruneRec(rec, id);
    reapplySoon();
  }
  function setStyle(prop, v) {
    if (prop === 'font-family' && v) loadFont(v);
    var vv = v && prop === 'font-family' && !/[,'"]/.test(v) ? "'" + v + "', sans-serif" : v;
    change(function (r, e) {
      if (r) { r.style = r.style || {}; if (vv) r.style[prop] = vv; else delete r.style[prop]; if (!Object.keys(r.style).length) delete r.style; }
      else if (vv) e.style.setProperty(prop, vv); else e.style.removeProperty(prop);
    });
  }
  function curStyle(el, prop) {
    if (addedWrap(el)) return el.style.getPropertyValue(prop);
    var r = getRec(el);
    return (r && r.style && r.style[prop]) || '';
  }

  function startVisual() {
    if (VE.active) return;
    VE.active = true;
    VE.edits = clone(SE.state.page.edits);
    VE.saved = JSON.stringify(VE.edits);
    VE.history = [];
    VE.sel = null;
    build();
    document.body.classList.add('se-ve-on');
    bar = el('<div id="se-ve-bar" data-se-ui>'
      + '<span class="t">🛠 Pannel</span><span class="pg"></span>'
      + '<select class="se-goto" title="Aller sur une autre page en restant en modification (ou Ctrl+clic sur un lien / sur ce qui ouvre une fenêtre)"></select>'
      + '<button class="se-btn" data-a="undo" title="Annuler (Ctrl+Z)">↶ Annuler</button>'
      + '<span class="n"></span><span class="sp"></span>'
      + '<button class="se-btn" data-a="toc" title="Ajouter un sommaire avec des boutons vers des parties numérotées (1, 2, 3…)">📑 Sommaire</button>'
      + '<div class="se-more"><button class="se-btn" data-a="addmenu" title="Ajouter un nouveau bloc (là où vous regardez, ou après l’élément sélectionné)">➕ Ajouter</button><div class="se-more-menu" data-m="add"></div></div>'
      + '<div class="se-more"><button class="se-btn" data-a="more">☰ Plus</button><div class="se-more-menu" data-m="more"></div></div>'
      + '<button class="se-btn primary" data-a="save">💾 Publier</button>'
      + '<button class="se-btn danger" data-a="quit">✕ Fermer</button></div>');
    hoverBox = el('<div id="se-hover" data-se-ui></div>');
    selBox = el('<div id="se-selbox" data-se-ui><span></span></div>');
    inspector = el('<div id="se-inspector" data-se-ui></div>');
    [bar, hoverBox, selBox, inspector].forEach(function (n) { document.body.appendChild(n); });
    $('.pg', bar).textContent = 'Page : ' + pageTitle();
    fillGoto($('.se-goto', bar));
    renderInspector();
    updateBar();
    $('[data-a=undo]', bar).addEventListener('click', undo);
    $('[data-a=save]', bar).addEventListener('click', function (ev) { saveVisual(ev.target); });
    $('[data-a=quit]', bar).addEventListener('click', stopVisual);
    var menu = $('[data-m=more]', bar), addMenu = $('[data-m=add]', bar);
    $('[data-a=more]', bar).addEventListener('click', function (e) {
      e.stopPropagation();
      addMenu.classList.remove('open');
      renderMoreMenu(menu);
      menu.classList.toggle('open');
    });
    $('[data-a=toc]', bar).addEventListener('click', function (e) {
      e.stopPropagation();
      var sel = VE.sel && document.body.contains(VE.sel) ? VE.sel : null;
      var inToc = sel && sel.closest && (sel.closest('.se-toc') || sel.closest('.se-toc-part'));
      if (inToc && addedWrap(inToc)) { addTocPart(inToc.getAttribute('data-toc')); return; }
      insertBlock('toc', 'after', true);
    });
    $('[data-a=addmenu]', bar).addEventListener('click', function (e) {
      e.stopPropagation();
      menu.classList.remove('open');
      renderAddMenu(addMenu);
      addMenu.classList.toggle('open');
    });
    document.addEventListener('click', function closeMenu() { if (menu) menu.classList.remove('open'); if (addMenu) addMenu.classList.remove('open'); });
    window.addEventListener('mouseover', onOver, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('dblclick', onDbl, true);
    window.addEventListener('submit', onSubmit, true);
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    window.addEventListener('dragstart', onDragStart, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', positionBoxes, true);
    window.addEventListener('resize', positionBoxes);
    window.addEventListener('beforeunload', onUnload);
  }
  function renderAddMenu(menu) {
    menu.innerHTML = '';
    menu.appendChild(el('<div class="se-hint" style="padding:6px 12px;margin:0">' + (VE.sel && document.body.contains(VE.sel) ? 'Ajouté après l’élément sélectionné.' : 'Ajouté au milieu de l’écran.') + ' Glissez-le ensuite où vous voulez.</div>'));
    Object.keys(BLOCKS).forEach(function (k) {
      var b = BLOCKS[k];
      if (b[3] && !ADV()) return;
      var btn = el('<button type="button">' + esc(b[0] + '  ' + b[1]) + '</button>');
      btn.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.remove('open'); insertBlock(k, 'after', true); });
      menu.appendChild(btn);
    });
  }
  // Élément de la page au milieu de l'écran, pour y accrocher un nouveau bloc
  function anchorAtCenter() {
    var x = Math.round(window.innerWidth / 2), y = Math.round(window.innerHeight / 2);
    var els = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
    for (var i = 0; i < els.length; i++) {
      var n = els[i];
      if (!n || isUi(n)) continue;
      // On remonte jusqu'à un vrai bloc (pas un mot dans une phrase)
      while (n.parentElement && n.parentElement !== document.body && getComputedStyle(n).display.indexOf('inline') === 0) n = n.parentElement;
      // Dans une fenêtre ouverte (modale), on reste dedans ; sinon pas d'éléments fixes
      if (n === document.body || n === document.documentElement) continue;
      if (/^(HTML|BODY|NAV|HEADER)$/.test(n.tagName) || n.closest('nav')) continue;
      if (/^(LI|TD|TH|TR|OPTION)$/.test(n.tagName)) n = n.closest('ul,ol,table') || n;
      return n;
    }
    return document.querySelector('main') || $$('body > *').filter(function (n) { return !isUi(n) && !/^(SCRIPT|NAV|STYLE)$/.test(n.tagName); }).pop() || null;
  }
  function renderMoreMenu(menu) {
    var custom = !!D().customPages[SE.FILE];
    var items = [
      ['newpage', '📄 Créer une nouvelle page'],
      ['theme', '🎨 Couleurs & polices du site'],
      ['nav', '🧭 Menu du site'],
      ['reset', '↺ Remettre cette page comme à l’origine'],
      custom || (ADV() && SE.FILE !== 'index.html') ? ['delete', '🗑 Supprimer cette page'] : null,
      ['settings', '⚙ Réglages'],
      ADV() ? ['adv', '🧰 Outils avancés (code)'] : null
    ].filter(Boolean);
    menu.innerHTML = '';
    items.forEach(function (it) {
      var b = el('<button type="button">' + esc(it[1]) + '</button>');
      b.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.remove('open'); moreAction(it[0]); });
      menu.appendChild(b);
    });
  }
  function moreAction(a) {
    if (a === 'reset') {
      if (!confirm('Supprimer toutes les modifications faites sur cette page avec le Pannel ? La page redeviendra comme à l’origine pour tout le monde.')) return;
      pushHistory();
      VE.edits = {};
      reapply(false);
      saveVisual($('[data-a=save]', bar), true);
    } else if (a === 'delete') {
      if (!confirm('Supprimer définitivement la page « ' + pageTitle() + ' » du site ?')) return;
      deletePage(SE.FILE).then(function () { VE.saved = JSON.stringify(VE.edits); location.href = 'index.html'; }).catch(fail);
    } else if (a === 'adv') {
      openTab('page');
    } else {
      openTab(a);
    }
  }
  // ── Navigation entre les pages sans quitter le mode modification ──
  function sameFile(href) {
    try {
      var f = decodeURIComponent(new URL(href, location.href).pathname.split('/').pop() || 'index.html');
      return f === SE.FILE;
    } catch (e) { return false; }
  }
  function fillGoto(sel) {
    sel.innerHTML = '';
    var first = document.createElement('option');
    first.value = ''; first.textContent = '📄 Aller à la page…';
    sel.appendChild(first);
    pageOptions().forEach(function (p) {
      var o = document.createElement('option');
      o.value = p[0];
      o.textContent = (sameFile(p[0]) ? '● ' : '') + p[1];
      sel.appendChild(o);
    });
    sel.addEventListener('change', function () {
      var h = sel.value;
      sel.value = '';
      if (h) goToPage(h);
    });
  }
  function goToPage(href) {
    var u;
    try { u = new URL(href, location.href); } catch (e) { return; }
    if (u.origin !== location.origin) { window.open(u.href, '_blank', 'noopener'); return; }
    if (sameFile(u.href) && !u.hash) { toast('Vous êtes déjà sur cette page.'); return; }
    if (isDirty() && !confirm('Changer de page sans publier ? Les modifications non publiées de cette page seront perdues.')) return;
    stopInline(true);
    window.removeEventListener('beforeunload', onUnload);
    u.searchParams.set('se-open', 'visual');
    location.href = u.href;
  }

  function isDirty() { return JSON.stringify(VE.edits) !== VE.saved; }
  function onUnload(e) { if (VE.active && isDirty()) { e.preventDefault(); e.returnValue = ''; } }
  function stopVisual(force) {
    if (force !== true && isDirty() && !confirm('Fermer sans publier ? Les modifications non publiées seront perdues.')) return;
    stopInline(true);
    VE.active = false;
    VE.sel = null;
    VE.multi = [];
    if (CROP) endCrop(false);
    if (imgUi) { Object.keys(imgUi.h).forEach(function (k) { imgUi.h[k].remove(); }); imgUi.bar.remove(); imgUi = null; }
    multiBoxes.forEach(function (b) { b.remove(); });
    multiBoxes = [];
    document.body.classList.remove('se-ve-on');
    [bar, hoverBox, selBox, inspector].forEach(function (n) { if (n) n.remove(); });
    window.removeEventListener('mouseover', onOver, true);
    window.removeEventListener('click', onClick, true);
    window.removeEventListener('dblclick', onDbl, true);
    window.removeEventListener('submit', onSubmit, true);
    window.removeEventListener('pointerdown', onDown, true);
    window.removeEventListener('pointermove', onMove, true);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    window.removeEventListener('dragstart', onDragStart, true);
    DRAG = null;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('scroll', positionBoxes, true);
    window.removeEventListener('resize', positionBoxes);
    window.removeEventListener('beforeunload', onUnload);
    SE.applyEdits(JSON.parse(VE.saved));
  }
  function updateBar() {
    if (!bar) return;
    $('.n', bar).textContent = isDirty() ? '● Modifications pas encore publiées' : '';
  }
  function saveVisual(btn, force) {
    stopInline();
    Object.keys(VE.edits).forEach(function (id) { pruneRec(VE.edits[id], id); });
    if (!isDirty() && !force) { toast('Rien de nouveau à publier.'); return; }
    var edits = clone(VE.edits);
    busy(btn, publishData(function (d) {
      var p = d.pages[SE.KEY] = d.pages[SE.KEY] || {};
      if (Object.keys(edits).length) p.edits = edits; else delete p.edits;
    }, msg('modification de la page « ' + pageTitle() + ' » (' + SE.FILE + ')')).then(function () {
      VE.saved = JSON.stringify(edits);
      updateBar();
    }));
  }
  function undo() {
    stopInline();
    if (!VE.history.length) { toast('Rien à annuler'); return; }
    VE.edits = JSON.parse(VE.history.pop());
    reapply(false);
  }

  // ── Zones de texte ─────────────────────────────────────────────
  // Un clic sur un texte sélectionne toute la zone de texte qui le
  // contient (paragraphes, lignes, listes à tirets…) pour écrire dedans
  // d'un seul bloc. Alt+clic sélectionne l'élément précis.
  var ZONE_TAGS = /^(P|DIV|UL|OL|LI|BR|SPAN|B|I|STRONG|EM|U|S|SMALL|A|SUP|SUB|MARK|BLOCKQUOTE|FONT|CODE|DEL|INS|ABBR|Q|CITE|DL|DT|DD|WBR)$/;
  var ZONE_STOP = /^(BODY|HTML|MAIN|SECTION|ARTICLE|ASIDE|NAV|HEADER|FOOTER|FORM|TABLE|TBODY|THEAD|TFOOT|TR|TD|TH|BUTTON|LABEL)$/;
  function zoneOk(el) {
    if (!el || !ZONE_TAGS.test(el.tagName) || el.hasAttribute('data-se-ui')) return false;
    if (!(el.textContent || '').trim()) return false;
    var all = el.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      if (!ZONE_TAGS.test(all[i].tagName) || all[i].hasAttribute('data-se-ui')) return false;
    }
    // Un bloc qui contient d'autres blocs « div » est une mise en page, pas une zone de texte
    if (el.tagName === 'DIV' && Array.prototype.some.call(el.children, function (c) { return c.tagName === 'DIV'; })) return false;
    return true;
  }
  function textZone(t) {
    if (!t || isUi(t) || !t.closest || t.closest('nav, .dropdown, .dropdown-content')) return null;
    if (!zoneOk(t)) return null;
    var z = t, wrap = addedWrap(t);
    while (z !== wrap) {
      var p = z.parentElement;
      if (!p || ZONE_STOP.test(p.tagName) || isUi(p) || !zoneOk(p)) break;
      z = p;
    }
    // Un lien / bouton seul garde son comportement habituel
    if (z.tagName === 'A') return null;
    return z;
  }
  function pickTarget(t, exact) { return exact ? t : (textZone(t) || t); }

  function onOver(e) {
    if (!VE.active || VE.editing) return;
    var t = e.target;
    if (isUi(t)) { hoverBox.style.display = 'none'; return; }
    t = pickTarget(t, e.altKey);
    // Pas de second cadre sur ce qui est déjà sélectionné
    if (VE.sel && (VE.sel === t || VE.sel.contains(t))) { hoverBox.style.display = 'none'; return; }
    var r = t.getBoundingClientRect();
    Object.assign(hoverBox.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }
  function onClick(e) {
    if (!VE.active) return;
    var t = e.target;
    if (isUi(t)) return;
    if (CROP) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); return; } // recadrage en cours
    if (VE.justDragged) { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); VE.justDragged = false; return; }
    if (VE.editing && VE.editing.contains(t)) { // écriture du texte en cours
      if (t.closest('a') && !(e.ctrlKey || e.metaKey)) e.preventDefault(); // un lien dans la zone ne s'ouvre pas
      if (!(e.ctrlKey || e.metaKey)) return;
    }
    // Ctrl+clic (ou Cmd+clic) sur un lien : on suit le lien en restant en modification
    var link = (e.ctrlKey || e.metaKey) && t.closest ? t.closest('a[href]') : null;
    if (link && !/^(#|javascript:|mailto:|tel:)/i.test(link.getAttribute('href') || '')) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      goToPage(link.getAttribute('href'));
      return;
    }
    // Ctrl+clic ailleurs : action normale de la page (ouvrir une fenêtre qui
    // surplombe la page, comme sur Tenues, la refermer avec ✕, un onglet…)
    if (e.ctrlKey || e.metaKey) {
      if (VE.editing) stopInline();
      setTimeout(positionBoxes, 30);
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    // Maj+clic : sélection de plusieurs éléments (pour les aligner)
    if (e.shiftKey) {
      if (VE.editing) {
        stopInline();
        var u2 = document.elementFromPoint(e.clientX, e.clientY);
        if (u2 && !isUi(u2)) t = u2;
      }
      var pk = pickTarget(t, e.altKey);
      if (!VE.multi.length && VE.sel && document.body.contains(VE.sel) && VE.sel !== pk) VE.multi.push(VE.sel);
      var mi = VE.multi.indexOf(pk);
      if (mi >= 0) VE.multi.splice(mi, 1); else VE.multi.push(pk);
      VE.sel = VE.multi[VE.multi.length - 1] || null;
      if (VE.multi.length < 2) VE.multi = [];
      hoverBox.style.display = 'none';
      positionBoxes();
      renderInspector();
      return;
    }
    VE.multi = [];
    if (e.altKey) { if (VE.sel !== t) select(t); return; }
    // On termine l'écriture en cours (la page peut être redessinée), puis on
    // retrouve ce qui est sous la souris
    if (VE.editing) {
      stopInline();
      var under = document.elementFromPoint(e.clientX, e.clientY);
      if (under && !isUi(under)) t = under;
    }
    var z = textZone(t);
    if (z) {
      if (VE.sel !== z) select(z);
      startInline(e.clientX, e.clientY);
      return;
    }
    if (VE.sel !== t) select(t);
  }
  // Double-clic sur un texte : on écrit directement dessus
  function onDbl(e) {
    if (!VE.active || isUi(e.target)) return;
    if (VE.editing && VE.editing.contains(e.target)) return;
    e.preventDefault(); e.stopPropagation();
    var t = pickTarget(e.target, e.altKey);
    if (VE.sel !== t) select(t);
    if (hasText(VE.sel) && VE.editing !== VE.sel) startInline(e.clientX, e.clientY);
  }
  function onSubmit(e) { if (VE.active && !isUi(e.target)) { e.preventDefault(); e.stopPropagation(); } }

  // ── Images liées : une vignette et la même image dans la fenêtre ──
  // (modale) qu'elle ouvre, ex. page Tenues : onclick="openModal('ct-modal')"
  function imgKey(img) {
    var s = img.getAttribute('data-se-orig') || img.getAttribute('src') || '';
    try { s = decodeURIComponent(new URL(s, location.href).pathname.split('/').pop()); } catch (e) { /* ignore */ }
    return s.toLowerCase();
  }
  function idsIn(code) {
    var out = [], re = /['"]([A-Za-z][\w:.-]*)['"]/g, m;
    while ((m = re.exec(String(code || '')))) if (document.getElementById(m[1])) out.push(m[1]);
    return out;
  }
  // Fenêtres (éléments avec un id) ouvertes par un élément qui a un onclick
  function windowsOpenedBy(el) {
    var out = [];
    for (var n = el; n && n !== document.body; n = n.parentElement) {
      var oc = n.getAttribute && n.getAttribute('onclick');
      if (oc) idsIn(oc).forEach(function (id) { out.push(document.getElementById(id)); });
      var h = n.getAttribute && n.getAttribute('href');
      if (h && h.charAt(0) === '#' && h.length > 1) { var t = document.getElementById(h.slice(1)); if (t) out.push(t); }
      var dt = n.getAttribute && (n.getAttribute('data-target') || n.getAttribute('data-bs-target') || n.getAttribute('data-modal'));
      if (dt) { var t2 = document.getElementById(dt.replace(/^#/, '')); if (t2) out.push(t2); }
    }
    return out;
  }
  // Fenêtre qui surplombe la page : modale, popup, boîte de dialogue…
  function isWindow(n) {
    if (!n || n === document.body) return false;
    if (n.tagName === 'DIALOG' || /modal|popup|overlay|lightbox|dialog|fenetre/i.test(String(n.getAttribute('class') || ''))) return true;
    var cs = getComputedStyle(n);
    return cs.position === 'fixed' || cs.display === 'none';
  }
  function linkedImages(img) {
    var key = imgKey(img), found = [];
    function addFrom(container, fallback) {
      if (!container || isUi(container)) return;
      var imgs = $$('img', container).filter(function (o) { return o !== img && !isUi(o); });
      var same = imgs.filter(function (o) { return imgKey(o) === key; });
      // Si l'image a déjà été changée avant, on prend l'image unique de la fenêtre
      if (!same.length && fallback && imgs.length === 1) same = imgs;
      same.forEach(function (o) { if (found.indexOf(o) === -1) found.push(o); });
    }
    // 0. Carte + fenêtre ajoutée avec le Pannel : l'image de la carte ↔ celle de la fenêtre
    var cp = img.closest('.se-card-pop');
    if (cp) addFrom(cp, true);
    // 1. L'image est sur une vignette qui ouvre une fenêtre → image de la fenêtre
    windowsOpenedBy(img).forEach(function (w) { addFrom(w, isWindow(w)); });
    // 2. L'image est dans une fenêtre → vignettes qui ouvrent cette fenêtre
    for (var n = img.parentElement; n && n !== document.body; n = n.parentElement) {
      if (!n.id || !isWindow(n)) continue;
      var id = n.id;
      $$('[onclick],[href],[data-target],[data-bs-target],[data-modal]').forEach(function (opener) {
        if (isUi(opener) || n.contains(opener)) return;
        var oc = opener.getAttribute('onclick') || '', h = opener.getAttribute('href') || '',
          dt = (opener.getAttribute('data-target') || opener.getAttribute('data-bs-target') || opener.getAttribute('data-modal') || '').replace(/^#/, '');
        if (idsIn(oc).indexOf(id) !== -1 || h === '#' + id || dt === id) addFrom(opener, true);
      });
    }
    return found;
  }
  function setImgSrc(img, v) {
    var w = addedWrap(img);
    if (w) { img.setAttribute('src', v); img.removeAttribute('srcset'); commitAdded(w); return; }
    setRec(img).src = v;
  }

  // ── Déplacement libre des images (maintenir le clic + glisser) ──
  // L'image est décalée avec la propriété CSS « translate » : elle peut
  // aller n'importe où, sans bouger le reste de la page.
  var DRAG = null;
  function curTranslate(el) {
    var t = getComputedStyle(el).translate;
    if (!t || t === 'none') return [0, 0];
    var p = t.split(/\s+/).map(parseFloat);
    return [p[0] || 0, p[1] || 0];
  }
  // Ce qui se déplace : une image, ou un bloc ajouté avec le Pannel (en entier)
  function dragTarget(t) {
    // Carte + fenêtre : on déplace la carte entière (pas depuis l'intérieur de la fenêtre)
    var cpop = t.closest && t.closest('.se-card-pop');
    if (cpop && addedWrap(cpop)) {
      if (t.closest('.se-cp-modal')) return t.tagName === 'IMG' ? t : null;
      return cpop;
    }
    if (t.tagName === 'IMG') return t;
    var w = addedWrap(t);
    if (!w) return null;
    var n = t;
    while (n && n.parentElement !== w) n = n.parentElement;
    return n || null;
  }
  function onDown(e) {
    if (!VE.active || (e.button != null && e.button !== 0) || e.altKey || CROP || RS) return;
    var t = e.target;
    if (isUi(t) || (VE.editing && VE.editing.contains(t))) return;
    if (!dragTarget(t)) return;
    // Une écriture en cours ailleurs est terminée d'abord (la page peut être redessinée)
    if (VE.editing) {
      stopInline();
      var under = document.elementFromPoint(e.clientX, e.clientY);
      if (!under || isUi(under)) return;
      t = under;
    }
    var d = dragTarget(t);
    if (!d) return;
    // Un élément qui contient une fenêtre (position fixe) est décalé avec left/top :
    // « translate » enfermerait la fenêtre dans la carte au lieu de couvrir l'écran
    var lt = !!(d.querySelector && d.querySelector('.se-cp-modal'));
    var cs = getComputedStyle(d);
    var s = lt ? [parseFloat(cs.left) || 0, parseFloat(cs.top) || 0] : curTranslate(d);
    if (lt && cs.position === 'static') s = [0, 0];
    DRAG = { el: d, x: e.clientX, y: e.clientY, sx: s[0], sy: s[1], moved: false, v: null, lt: lt,
      wasStatic: cs.position === 'static' };
    if (t.tagName === 'IMG') e.preventDefault();
  }
  function onMove(e) {
    if (!DRAG) return;
    var dx = e.clientX - DRAG.x, dy = e.clientY - DRAG.y;
    if (!DRAG.moved) {
      if (Math.abs(dx) + Math.abs(dy) < 5) return;
      DRAG.moved = true;
      pushHistory();
      if (VE.sel !== DRAG.el) select(DRAG.el);
      document.body.classList.add('se-dragging');
      hoverBox.style.display = 'none';
      if (DRAG.wasStatic) DRAG.el.style.setProperty('position', 'relative', 'important');
      if (!DRAG.lt) DRAG.el.style.setProperty('z-index', '50', 'important');
    }
    e.preventDefault();
    try { getSelection().removeAllRanges(); } catch (er) { /* ignore */ }
    var nx = Math.round(DRAG.sx + dx), ny = Math.round(DRAG.sy + dy);
    if (DRAG.lt) {
      DRAG.v = [nx + 'px', ny + 'px'];
      DRAG.el.style.setProperty('left', DRAG.v[0], 'important');
      DRAG.el.style.setProperty('top', DRAG.v[1], 'important');
    } else {
      DRAG.v = nx + 'px ' + ny + 'px';
      DRAG.el.style.setProperty('translate', DRAG.v, 'important');
    }
    positionBoxes();
  }
  function onUp() {
    if (!DRAG) return;
    var d = DRAG;
    DRAG = null;
    document.body.classList.remove('se-dragging');
    if (!d.moved || !d.v) return;
    VE.justDragged = true; // le « clic » qui suit le glisser ne doit rien faire
    setTimeout(function () { VE.justDragged = false; }, 50);
    if (VE.sel !== d.el) select(d.el);
    var props = d.lt ? { left: d.v[0], top: d.v[1] } : { translate: d.v, 'z-index': '50' };
    if (d.wasStatic) props.position = 'relative';
    change(function (r, e) {
      if (r) { r.style = r.style || {}; Object.keys(props).forEach(function (p) { r.style[p] = props[p]; }); }
      else Object.keys(props).forEach(function (p) { e.style.setProperty(p, props[p]); });
    });
    toast((d.el.tagName === 'IMG' ? 'Image déplacée' : 'Élément déplacé') + ' (pensez à publier)');
  }
  function onDragStart(e) { if (VE.active && !isUi(e.target)) e.preventDefault(); }
  function resetImagePos() {
    pushHistory();
    resetPosNoHistory();
  }
  function resetPosNoHistory() {
    change(function (r, e) {
      if (r) {
        if (r.style) {
          delete r.style.translate; delete r.style['z-index'];
          if (r.style.position === 'relative') { delete r.style.position; delete r.style.left; delete r.style.top; }
          if (!Object.keys(r.style).length) delete r.style;
        }
      } else {
        e.style.removeProperty('translate'); e.style.removeProperty('z-index');
        if (e.style.position === 'relative') { e.style.removeProperty('position'); e.style.removeProperty('left'); e.style.removeProperty('top'); }
      }
    });
  }
  function onKey(e) {
    if (!VE.active || document.querySelector('.se-dlg')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !VE.editing && !/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName)) {
      e.preventDefault(); undo();
    } else if (e.key === 'Escape' && CROP) {
      endCrop(false);
    } else if (e.key === 'Enter' && CROP) {
      e.preventDefault(); endCrop(true);
    } else if (e.key === 'Escape') {
      if (VE.editing) stopInline(); else { VE.sel = null; VE.multi = []; positionBoxes(); renderInspector(); }
    }
  }
  function select(el) {
    if (CROP && CROP.el !== el) endCrop(false);
    stopInline();
    if (VE.multi.indexOf(el) === -1) VE.multi = [];
    VE.sel = el;
    hoverBox.style.display = 'none';
    positionBoxes();
    renderInspector();
  }
  function positionBoxes() {
    if (!selBox) return;
    // Cadres des autres éléments sélectionnés avec Maj+clic
    var others = VE.multi.filter(function (m) { return m !== VE.sel && document.body.contains(m); });
    while (multiBoxes.length > others.length) multiBoxes.pop().remove();
    while (multiBoxes.length < others.length) { var mb = el('<div class="se-multibox" data-se-ui></div>'); document.body.appendChild(mb); multiBoxes.push(mb); }
    others.forEach(function (m, i) {
      var rr = m.getBoundingClientRect();
      Object.assign(multiBoxes[i].style, { left: rr.left - 3 + 'px', top: rr.top - 3 + 'px', width: rr.width + 6 + 'px', height: rr.height + 6 + 'px' });
    });
    var el = VE.sel;
    if (!el || !document.body.contains(el)) { selBox.style.display = 'none'; placeImgUi(); return; }
    var r = el.tagName === 'IMG' ? visibleRect(el) : el.getBoundingClientRect();
    Object.assign(selBox.style, { display: CROP ? 'none' : 'block', left: r.left - 3 + 'px', top: r.top - 3 + 'px', width: r.width + 6 + 'px', height: r.height + 6 + 'px' });
    selBox.classList.toggle('editing', VE.editing === el);
    $('span', selBox).textContent = VE.editing === el ? '✏️ écriture' : (ADV() ? label(el) : kindOf(el)[1]);
    placeImgUi();
  }

  // ── Image : poignées directement sur l'image ────────────────────
  // ◢ coin = agrandir/réduire en gardant les proportions (Maj = libre)
  // ▶ côté droit = largeur seule, ▼ bas = hauteur seule (l'image se déforme)
  // ✂ Recadrer = cadre à tirer directement sur l'image
  var imgUi = null, RS = null, CROP = null;
  function visibleRect(img) {
    var R = img.getBoundingClientRect(), c = CROP && CROP.el === img ? null : readCrop(img);
    if (!c) return R;
    var v = c.v, l = R.left + R.width * v[3] / 100, t = R.top + R.height * v[0] / 100,
      rr = R.right - R.width * v[1] / 100, b = R.bottom - R.height * v[2] / 100;
    return { left: l, top: t, right: rr, bottom: b, width: rr - l, height: b - t };
  }
  function ensureImgUi() {
    if (imgUi) return imgUi;
    imgUi = { h: {} };
    [['e', 'Largeur seule (l’image se déforme)'], ['s', 'Hauteur seule (l’image se déforme)'], ['se', 'Agrandir / réduire (Maj : sans garder les proportions)']].forEach(function (k) {
      var d = el('<div class="se-h se-h-' + k[0] + '" data-se-ui title="' + k[1] + '"></div>');
      d.addEventListener('pointerdown', function (e) { startResize(e, k[0]); });
      document.body.appendChild(d);
      imgUi.h[k[0]] = d;
    });
    imgUi.bar = el('<div class="se-imgbar" data-se-ui>'
      + '<button type="button" data-x="crop" title="Recadrer directement sur l’image">✂ Recadrer</button>'
      + '<button type="button" data-x="size" title="Taille d’origine">↺ Taille</button></div>');
    document.body.appendChild(imgUi.bar);
    $('[data-x=crop]', imgUi.bar).addEventListener('click', function (e) { e.stopPropagation(); startCrop(); });
    $('[data-x=size]', imgUi.bar).addEventListener('click', function (e) {
      e.stopPropagation();
      if (!VE.sel || VE.sel.tagName !== 'IMG') return;
      pushHistory();
      ['width', 'height', 'max-width', 'max-height', 'object-fit'].forEach(function (p) { setStyle(p, ''); });
      var img = VE.sel;
      later(function () { refreshCrop(img); positionBoxes(); renderInspector(); });
    });
    return imgUi;
  }
  function hideImgUi() {
    if (!imgUi) return;
    Object.keys(imgUi.h).forEach(function (k) { imgUi.h[k].style.display = 'none'; });
    imgUi.bar.style.display = 'none';
  }
  function placeImgUi() {
    if (CROP) { renderCrop(); hideImgUi(); return; }
    var img = VE.sel;
    if (!VE.active || !img || img.tagName !== 'IMG' || !document.body.contains(img) || VE.multi.length >= 2 || VE.editing) { hideImgUi(); return; }
    ensureImgUi();
    var r = visibleRect(img);
    function put(n, x, y) { n.style.display = 'block'; n.style.left = Math.round(x - 8) + 'px'; n.style.top = Math.round(y - 8) + 'px'; }
    put(imgUi.h.e, r.right, r.top + r.height / 2);
    put(imgUi.h.s, r.left + r.width / 2, r.bottom);
    put(imgUi.h.se, r.right, r.bottom);
    var b = imgUi.bar;
    b.style.display = 'flex';
    var bw = b.offsetWidth || 170, bh = b.offsetHeight || 28;
    var top = r.top - bh - 22;
    if (top < 52) top = r.bottom + 12;
    b.style.left = Math.round(Math.max(6, Math.min(window.innerWidth - bw - 6, r.right - bw))) + 'px';
    b.style.top = Math.round(Math.min(window.innerHeight - bh - 6, top)) + 'px';
  }

  // Redimensionnement à la souris
  function startResize(e, k) {
    var img = VE.sel;
    if (!img || img.tagName !== 'IMG') return;
    e.preventDefault(); e.stopPropagation();
    if (VE.editing) stopInline();
    var w = img.offsetWidth || img.getBoundingClientRect().width, h = img.offsetHeight || img.getBoundingClientRect().height;
    RS = { img: img, k: k, x: e.clientX, y: e.clientY, w: w, h: h, ratio: h / (w || 1), pushed: false, nw: 0, nh: 0, free: k !== 'se' };
    document.body.classList.add('se-dragging');
    window.addEventListener('pointermove', moveResize, true);
    window.addEventListener('pointerup', endResize, true);
    window.addEventListener('pointercancel', endResize, true);
  }
  function moveResize(e) {
    if (!RS) return;
    e.preventDefault();
    if (!RS.pushed) { pushHistory(); RS.pushed = true; }
    var dx = e.clientX - RS.x, dy = e.clientY - RS.y, w = RS.w, h = RS.h;
    RS.free = RS.k !== 'se' || e.shiftKey;
    if (RS.k === 'se') { w = Math.max(10, RS.w + dx); h = e.shiftKey ? Math.max(10, RS.h + dy) : w * RS.ratio; }
    if (RS.k === 'e') w = Math.max(10, RS.w + dx);
    if (RS.k === 's') h = Math.max(10, RS.h + dy);
    RS.nw = Math.round(w); RS.nh = Math.round(h);
    var s = RS.img.style;
    if (computed(RS.img, 'display') === 'inline') s.setProperty('display', 'inline-block', 'important');
    s.setProperty('width', RS.nw + 'px', 'important');
    s.setProperty('max-width', 'none', 'important');
    if (RS.free) {
      s.setProperty('height', RS.nh + 'px', 'important');
      s.setProperty('max-height', 'none', 'important');
      s.setProperty('object-fit', 'fill', 'important');
    } else s.setProperty('height', 'auto', 'important');
    positionBoxes();
  }
  function endResize() {
    window.removeEventListener('pointermove', moveResize, true);
    window.removeEventListener('pointerup', endResize, true);
    window.removeEventListener('pointercancel', endResize, true);
    document.body.classList.remove('se-dragging');
    var d = RS;
    RS = null;
    if (!d || !d.nw) return;
    VE.justDragged = true;
    setTimeout(function () { VE.justDragged = false; }, 50);
    withSel(d.img, function () {
      ensureBoxable(d.img);
      setStyle('width', d.nw + 'px');
      setStyle('max-width', 'none');
      if (d.free) { setStyle('height', d.nh + 'px'); setStyle('max-height', 'none'); setStyle('object-fit', 'fill'); }
      else { setStyle('height', 'auto'); setStyle('object-fit', ''); }
    });
    later(function () { refreshCrop(VE.sel); positionBoxes(); renderInspector(); });
    toast('Taille de l’image : ' + d.nw + ' × ' + (d.free ? d.nh : Math.round(d.nw * d.ratio)) + ' px');
  }

  // Recadrage directement sur l'image
  function startCrop() {
    var img = VE.sel;
    if (!img || img.tagName !== 'IMG' || CROP) return;
    if (VE.editing) stopInline();
    var c = readCrop(img) || { v: [0, 0, 0, 0], base: null };
    CROP = { el: img, v: c.v.slice(), base: c.base, saved: img.getAttribute('style') };
    // On montre l'image entière pendant le recadrage
    img.style.setProperty('clip-path', 'none', 'important');
    if (c.base) ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].forEach(function (p, i) { img.style.setProperty(p, c.base[i] + 'px', 'important'); });
    var box = el('<div class="se-cropbox" data-se-ui data-k="move">'
      + ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(function (k) { return '<div class="ch ch-' + k + '" data-k="' + k + '"></div>'; }).join('')
      + '</div>');
    var tb = el('<div class="se-imgbar se-cropbar" data-se-ui>'
      + '<button type="button" data-x="ok" class="ok">✔ Valider</button>'
      + '<button type="button" data-x="none" title="Montrer l’image entière">↺ Image entière</button>'
      + '<button type="button" data-x="cancel">✕ Annuler</button></div>');
    document.body.appendChild(box); document.body.appendChild(tb);
    CROP.box = box; CROP.bar = tb;
    box.addEventListener('pointerdown', cropDown);
    $('[data-x=ok]', tb).addEventListener('click', function (e) { e.stopPropagation(); endCrop(true); });
    $('[data-x=cancel]', tb).addEventListener('click', function (e) { e.stopPropagation(); endCrop(false); });
    $('[data-x=none]', tb).addEventListener('click', function (e) { e.stopPropagation(); CROP.v = [0, 0, 0, 0]; renderCrop(); });
    positionBoxes();
    toast('Tirez les bords du cadre, ou déplacez-le. ✔ Valider pour recadrer.');
  }
  function renderCrop() {
    if (!CROP) return;
    var img = CROP.el;
    if (!document.body.contains(img)) { endCrop(false); return; }
    var R = img.getBoundingClientRect(), v = CROP.v;
    CROP.R = R;
    var l = R.left + R.width * v[3] / 100, t = R.top + R.height * v[0] / 100;
    var w = R.width * (100 - v[1] - v[3]) / 100, h = R.height * (100 - v[0] - v[2]) / 100;
    Object.assign(CROP.box.style, { left: l + 'px', top: t + 'px', width: w + 'px', height: h + 'px' });
    var bw = CROP.bar.offsetWidth || 260, bh = CROP.bar.offsetHeight || 28;
    var top = R.top - bh - 10;
    if (top < 52) top = R.bottom + 10;
    CROP.bar.style.left = Math.round(Math.max(6, Math.min(window.innerWidth - bw - 6, R.left + R.width / 2 - bw / 2))) + 'px';
    CROP.bar.style.top = Math.round(Math.min(window.innerHeight - bh - 6, top)) + 'px';
  }
  function cropDown(e) {
    if (!CROP) return;
    e.preventDefault(); e.stopPropagation();
    var k = e.target.getAttribute('data-k') || 'move';
    var st = { k: k, x: e.clientX, y: e.clientY, v: CROP.v.slice(), R: CROP.el.getBoundingClientRect() };
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function mv(ev) {
      ev.preventDefault();
      var dx = (ev.clientX - st.x) / st.R.width * 100, dy = (ev.clientY - st.y) / st.R.height * 100, s = st.v, v = s.slice();
      if (k === 'move') {
        v[3] = clamp(s[3] + dx, 0, s[3] + s[1]); v[1] = s[1] + s[3] - v[3];
        v[0] = clamp(s[0] + dy, 0, s[0] + s[2]); v[2] = s[2] + s[0] - v[0];
      } else {
        if (k.indexOf('n') !== -1) v[0] = clamp(s[0] + dy, 0, 90 - s[2]);
        if (k.indexOf('s') !== -1) v[2] = clamp(s[2] - dy, 0, 90 - s[0]);
        if (k.indexOf('w') !== -1) v[3] = clamp(s[3] + dx, 0, 90 - s[1]);
        if (k.indexOf('e') !== -1) v[1] = clamp(s[1] - dx, 0, 90 - s[3]);
      }
      CROP.v = v.map(function (x) { return Math.round(x * 10) / 10; });
      renderCrop();
    }
    function up() {
      window.removeEventListener('pointermove', mv, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', up, true);
      VE.justDragged = true;
      setTimeout(function () { VE.justDragged = false; }, 50);
    }
    window.addEventListener('pointermove', mv, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', up, true);
  }
  function endCrop(ok) {
    var c = CROP;
    if (!c) return;
    CROP = null;
    if (c.box) c.box.remove();
    if (c.bar) c.bar.remove();
    var img = c.el;
    if (c.saved == null) img.removeAttribute('style'); else img.setAttribute('style', c.saved);
    if (ok && document.body.contains(img)) {
      pushHistory();
      withSel(img, function () { applyCrop(img, c.v.map(function (x) { return Math.round(x); }), c.base); });
      toast(c.v.some(function (x) { return x > 0; }) ? 'Image recadrée (pensez à publier)' : 'Recadrage retiré');
    }
    later(function () { positionBoxes(); if (VE.sel === img) renderInspector(); });
  }
  function label(el) {
    var s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    var cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(function (x) { return x && x.indexOf('se-') !== 0; }).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    return s;
  }
  // Nom simple de l'élément pour l'affichage
  function kindOf(el) {
    var t = el.tagName;
    if (/^H[1-6]$/.test(t)) return ['title', 'Titre'];
    if (t === 'IMG') return ['image', 'Image'];
    if (t === 'A') return ['link', el.children.length ? 'Lien' : 'Bouton / lien'];
    if (t === 'BUTTON') return ['button', 'Bouton'];
    if (el.classList && el.classList.contains('se-card-pop')) return ['block', 'Carte + fenêtre'];
    if (el.classList && el.classList.contains('se-toc')) return ['block', 'Sommaire'];
    if (el.classList && el.classList.contains('se-toc-part')) return ['block', 'Partie du sommaire'];
    if (el.classList && el.classList.contains('se-divtext')) return ['divider', 'Séparateur avec texte'];
    if (t === 'HR') return ['divider', 'Séparateur'];
    if (el.classList && el.classList.contains('se-cp-modal')) return ['block', 'Fond de la fenêtre'];
    if (el.classList && el.classList.contains('se-cp-box')) return ['block', 'Fenêtre'];
    if (!isTextOnly(el) && zoneOk(el)) return ['text', 'Zone de texte'];
    if (t === 'UL' || t === 'OL') return ['list', 'Liste'];
    if (t === 'LI') return ['text', 'Ligne de liste'];
    if (t === 'IFRAME' || t === 'VIDEO') return ['media', 'Vidéo'];
    if (t === 'HR') return ['divider', 'Séparateur'];
    if (/^(P|SPAN|STRONG|EM|B|I|SMALL|LABEL|TD|TH|BLOCKQUOTE)$/.test(t) || isTextOnly(el)) return ['text', 'Texte'];
    return ['block', 'Bloc'];
  }
  function isTextOnly(el) {
    return !!(el.textContent || '').trim() && (!el.children.length || Array.prototype.every.call(el.children, function (c) { return /^(BR|B|I|STRONG|EM|U|SPAN|SMALL|A|SUP|SUB|MARK)$/.test(c.tagName); }));
  }
  function hasText(el) { return el && !/^(IMG|INPUT|BR|HR|IFRAME|VIDEO|CANVAS|SVG|svg|SELECT|TEXTAREA)$/.test(el.tagName) && (isTextOnly(el) || zoneOk(el)); }

  // Écriture du texte directement sur la page (curseur placé là où on a cliqué)
  function caretAt(x, y) {
    try {
      if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
      if (document.caretPositionFromPoint) {
        var p = document.caretPositionFromPoint(x, y);
        if (!p) return null;
        var r = document.createRange(); r.setStart(p.offsetNode, p.offset); r.collapse(true); return r;
      }
    } catch (e) { /* ignore */ }
    return null;
  }
  function startInline(x, y) {
    var el = VE.sel;
    if (!el || VE.editing === el) return;
    if (VE.editing) stopInline(true);
    pushHistory();
    VE.editing = el;
    VE.inlineBefore = el.innerHTML;
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    el.classList.add('se-editing');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) { /* ignore */ }
    el.focus();
    try {
      var r = x != null ? caretAt(x, y) : null;
      if (!r || !el.contains(r.startContainer)) { r = document.createRange(); r.selectNodeContents(el); r.collapse(false); }
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    } catch (e) { /* ignore */ }
    var b = $('[data-a=inline]', inspector);
    if (b) { b.textContent = '✔ J’ai fini d’écrire'; b.classList.add('primary'); }
    el.addEventListener('input', positionBoxes);
    positionBoxes();
  }
  function stopInline(noReapply) {
    var el = VE.editing;
    if (!el) return;
    VE.editing = null;
    el.removeEventListener('input', positionBoxes);
    if (selBox) selBox.classList.remove('editing');
    el.removeAttribute('contenteditable');
    el.removeAttribute('spellcheck');
    el.classList.remove('se-editing');
    if (!el.getAttribute('class')) el.removeAttribute('class');
    var html = cleanHtml(el.innerHTML);
    var wrap = addedWrap(el);
    // Titre d'une partie de sommaire modifié → le bouton du sommaire suit
    var tocPart = el.closest && el.closest('.se-toc-part');
    if (tocPart && el.closest('.se-toc-head')) { var tocT = tocPart.getAttribute('data-toc'); setTimeout(function () { rebuildToc(tocT); }, 80); }
    if (wrap) { commitAdded(wrap); }
    else if (html !== cleanHtml(VE.inlineBefore || '')) {
      // On remet le contenu d'origine pour que « Annuler » puisse y revenir
      el.innerHTML = VE.inlineBefore;
      setRec(el).html = html;
    }
    if (noReapply !== true) reapply(false);
  }

  function computed(el, prop) { try { return getComputedStyle(el).getPropertyValue(prop); } catch (e) { return ''; } }
  function loadFont(name) {
    name = String(name || '').split(',')[0].replace(/['"]/g, '').trim();
    if (!name || /^(serif|sans-serif|monospace|arial|georgia|verdana|times new roman|orbitron|exo 2)$/i.test(name)) return;
    var id = 'se-font-' + name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    if (document.getElementById(id)) return;
    var l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet'; l.setAttribute('data-se-ui', '');
    l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(name).replace(/%20/g, '+') + ':ital,wght@0,400;0,700;1,400&display=swap';
    document.head.appendChild(l);
  }

  // ── Panneau de droite ───────────────────────────────────────────
  function section(title) { inspector.appendChild(el2('<h4>' + esc(title) + '</h4>')); }
  function btnRow(buttons) {
    var row = el2('<div class="se-row se-btns"></div>');
    buttons.forEach(function (b) {
      if (!b) return;
      var n = el2('<button type="button" class="se-btn' + (b.cls ? ' ' + b.cls : '') + '" title="' + esc(b.title || '') + '">' + b.html + '</button>');
      n.addEventListener('click', function () { b.fn(n); });
      row.appendChild(n);
    });
    inspector.appendChild(row);
    return row;
  }

  // Applique une modification à un autre élément que la sélection
  function withSel(el, fn) { var prev = VE.sel; VE.sel = el; try { fn(); } finally { VE.sel = prev; } }

  // ── Sommaire (quand on sélectionne un sommaire ou une de ses parties)
  function tocSection(el) {
    var host = el.closest && (el.closest('.se-toc') || el.closest('.se-toc-part'));
    if (!host || !addedWrap(host)) return;
    var T = host.getAttribute('data-toc');
    section('📑 Sommaire');
    inspector.appendChild(el2('<div class="se-hint">' + tocParts(T).length + ' partie(s). Changez un titre de partie : le bouton du sommaire suit. Ctrl+clic sur un bouton du sommaire pour aller à sa partie.</div>'));
    btnRow([
      { html: '➕ Ajouter une partie', fn: function () { addTocPart(T); } },
      { html: '↻ Renuméroter', title: 'Remet les numéros 1, 2, 3… dans l’ordre de la page et refait les boutons', fn: function () { pushHistory(); rebuildToc(T); toast('Sommaire mis à jour'); } }
    ]);
  }

  // ── Séparateurs ────────────────────────────────────────────────
  function readHr(el) {
    var p = String(curStyle(el, '--se-hr') || '').split('|');
    return { kind: p[0] || 'gradient', th: parseFloat(p[1]) || 1, col: p[2] || '#F0B429' };
  }
  function applyHr(el, o) {
    var c = o.col, th = Math.max(1, Math.min(40, o.th));
    ['top', 'right', 'bottom', 'left'].forEach(function (s) { setStyle('border-' + s + '-style', 'none'); });
    if (o.kind === 'gradient' || o.kind === 'solid' || o.kind === 'fade') {
      setStyle('height', th + 'px');
      setStyle('background', o.kind === 'solid' ? c : o.kind === 'fade' ? 'linear-gradient(90deg,' + c + ',transparent)' : 'linear-gradient(90deg,transparent,' + c + ',transparent)');
      setStyle('border-top-width', ''); setStyle('border-top-color', '');
    } else {
      setStyle('height', '0px');
      setStyle('background', 'none');
      setStyle('border-top-style', o.kind);
      setStyle('border-top-width', (o.kind === 'double' ? Math.max(3, th) : th) + 'px');
      setStyle('border-top-color', c);
    }
    if (o.kind === 'gradient' || o.kind === 'fade' || o.kind === 'solid') setStyle('border-radius', th > 2 ? th + 'px' : '');
    setStyle('--se-hr', o.kind + '|' + th + '|' + c);
  }
  function dividerSection(el) {
    section('➖ Séparateur');
    var o = readHr(el);
    function set(k, v) { o[k] = v; applyHr(el, o); later(positionBoxes); }
    inspector.appendChild(el2('<div class="se-lbl">Style de la ligne</div>'));
    btnRow([
      { html: '✨ Dégradé', fn: function () { pushHistory(); set('kind', 'gradient'); } },
      { html: '▬ Plein', fn: function () { pushHistory(); set('kind', 'solid'); } },
      { html: '◢ Fondu', title: 'Plein à gauche, disparaît à droite', fn: function () { pushHistory(); set('kind', 'fade'); } }
    ]);
    btnRow([
      { html: '┄ Tirets', fn: function () { pushHistory(); set('kind', 'dashed'); } },
      { html: '··· Points', fn: function () { pushHistory(); set('kind', 'dotted'); } },
      { html: '═ Double', fn: function () { pushHistory(); set('kind', 'double'); } }
    ]);
    var g = el2('<div class="se-grid2"></div>');
    inspector.appendChild(g);
    numBox(g, 'Épaisseur (px)', o.th, '1', function (n) { if (n != null && n > 0) set('th', n); }, { min: 1, max: 40 });
    var cf = el2('<div class="se-field"><label>Couleur</label></div>');
    var col = document.createElement('input'); col.type = 'color'; col.value = toHex(o.col); col.style.cssText = 'width:100%;height:32px;padding:2px';
    var cp = false;
    col.addEventListener('input', function () { if (!cp) { pushHistory(); cp = true; } set('col', col.value); });
    cf.appendChild(col); g.appendChild(cf);
    var pw = String(curStyle(el, 'width') || '');
    numBox(g, 'Largeur (% de la page)', /%$/.test(pw) ? parseFloat(pw) : '', 'auto', function (n) {
      if (n == null) { setStyle('width', ''); setStyle('max-width', ''); return; }
      setStyle('width', Math.max(5, Math.min(100, n)) + '%'); setStyle('max-width', '100%');
    }, { min: 5, max: 100 });
    numBox(g, 'Espace au-dessus et en dessous (px)', pxOf(el, 'margin-top'), computed(el, 'margin-top'), function (n) {
      setStyle('margin-top', n == null ? '' : n + 'px'); setStyle('margin-bottom', n == null ? '' : n + 'px');
    }, { min: 0 });
    blockAlignRow(el, 'Position de la ligne');
    if (el.closest('.se-divtext')) inspector.appendChild(el2('<div class="se-hint">Ce séparateur a deux lignes (à gauche et à droite du texte) : cliquez sur l’autre pour la régler aussi. Cliquez sur le texte du milieu pour l’écrire.</div>'));
  }

  // ── Texte : options en plus ─────────────────────────────────────
  function textMoreSection(el) {
    var deco = computed(el, 'text-decoration-line') || computed(el, 'text-decoration');
    btnRow([
      { html: '<u>S</u>', title: 'Souligné', fn: function () { pushHistory(); setStyle('text-decoration', /underline/.test(deco) ? 'none' : 'underline'); later(renderInspector); } },
      { html: '<s>B</s>', title: 'Barré', fn: function () { pushHistory(); setStyle('text-decoration', /line-through/.test(deco) ? 'none' : 'line-through'); later(renderInspector); } },
      { html: 'AA', title: 'Tout en majuscules', fn: function () { pushHistory(); setStyle('text-transform', computed(el, 'text-transform') === 'uppercase' ? 'none' : 'uppercase'); } },
      { html: '≡ Justifié', title: 'Texte justifié (bords droits)', fn: function () { pushHistory(); setStyle('text-align', 'justify'); } }
    ]);
    var g = el2('<div class="se-grid2"></div>');
    inspector.appendChild(g);
    numBox(g, 'Espace entre les lettres (px)', pxOf(el, 'letter-spacing'), computed(el, 'letter-spacing'), function (n) {
      setStyle('letter-spacing', n == null ? '' : n + 'px');
    }, { step: '0.5' });
    var lh = parseFloat(curStyle(el, 'line-height'));
    var lhNow = parseFloat(computed(el, 'line-height')) / (parseFloat(computed(el, 'font-size')) || 16);
    numBox(g, 'Hauteur de ligne (ex : 1.6)', isNaN(lh) ? '' : lh, isNaN(lhNow) ? '1.2' : lhNow.toFixed(2), function (n) {
      setStyle('line-height', n == null ? '' : String(Math.max(0.5, n)));
    }, { step: '0.1', min: 0.5 });
    numBox(g, 'Retrait 1re ligne (px)', pxOf(el, 'text-indent'), '0', function (n) {
      setStyle('text-indent', n == null ? '' : n + 'px');
    }, { step: '1' });
    numBox(g, 'Épaisseur du texte (100-900)', parseInt(curStyle(el, 'font-weight'), 10) || '', computed(el, 'font-weight'), function (n) {
      if (n == null) { setStyle('font-weight', ''); return; }
      setStyle('font-weight', String(Math.max(100, Math.min(900, Math.round(n / 100) * 100))));
    }, { step: '100', min: 100, max: 900 });
    inspector.appendChild(el2('<div class="se-lbl">Effet sur le texte</div>'));
    btnRow([
      { html: 'Aucun', fn: function () { pushHistory(); setStyle('text-shadow', ''); } },
      { html: 'Ombre', fn: function () { pushHistory(); setStyle('text-shadow', '2px 2px 4px rgba(0,0,0,.8)'); } },
      { html: '✨ Lueur', fn: function () { pushHistory(); setStyle('text-shadow', '0 0 10px rgba(240,180,41,.75), 0 0 2px rgba(240,180,41,.9)'); } },
      { html: 'Contour', fn: function () { pushHistory(); setStyle('text-shadow', '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000'); } }
    ]);
  }

  // ── Structure : disposition du contenu d'un bloc ────────────────
  function blockAlignRow(el, title) {
    inspector.appendChild(el2('<div class="se-lbl" style="margin-top:6px">' + esc(title || 'Position du bloc sur la page') + '</div>'));
    function pos(l, r) {
      pushHistory();
      var d = computed(el, 'display');
      if (d === 'inline' || d === 'inline-block' || d === 'inline-flex') setStyle('display', el.tagName === 'IMG' ? 'block' : (d === 'inline-flex' ? 'flex' : 'block'));
      if (!curStyle(el, 'width') && el.tagName !== 'IMG' && el.tagName !== 'HR') setStyle('width', 'fit-content');
      setStyle('margin-left', l); setStyle('margin-right', r);
      later(positionBoxes);
    }
    btnRow([
      { html: '⇤ Gauche', fn: function () { pos('0px', 'auto'); } },
      { html: '⇔ Centre', fn: function () { pos('auto', 'auto'); } },
      { html: 'Droite ⇥', fn: function () { pos('auto', '0px'); } },
      { html: '↺', title: 'Position d’origine', fn: function () { pushHistory(); setStyle('margin-left', ''); setStyle('margin-right', ''); if (curStyle(el, 'width') === 'fit-content') setStyle('width', ''); } }
    ]);
  }
  function structureSection(el) {
    section('🧱 Structure');
    var kids = Array.prototype.filter.call(el.children, function (c) { return !isUi(c); }).length;
    if (kids >= 2) {
      inspector.appendChild(el2('<div class="se-lbl">Disposition du contenu (' + kids + ' éléments)</div>'));
      function lay(mode) {
        pushHistory();
        ['display', 'flex-direction', 'flex-wrap', 'grid-template-columns'].forEach(function (p) { setStyle(p, ''); });
        if (mode === 'row') { setStyle('display', 'flex'); setStyle('flex-direction', 'row'); setStyle('flex-wrap', 'wrap'); }
        else if (mode === 'col') { setStyle('display', 'flex'); setStyle('flex-direction', 'column'); }
        else if (mode > 0) { setStyle('display', 'grid'); setStyle('grid-template-columns', 'repeat(' + mode + ',minmax(0,1fr))'); }
        if (mode && !curStyle(el, 'gap')) setStyle('gap', '16px');
        later(function () { positionBoxes(); renderInspector(); });
      }
      btnRow([
        { html: '▤ Normale', title: 'Disposition d’origine', fn: function () { lay(''); } },
        { html: '⇶ En ligne', title: 'Les éléments côte à côte', fn: function () { lay('row'); } },
        { html: '☰ En colonne', title: 'Les éléments les uns sous les autres', fn: function () { lay('col'); } }
      ]);
      btnRow([
        { html: '▥ 2 colonnes', fn: function () { lay(2); } },
        { html: '▦ 3 colonnes', fn: function () { lay(3); } },
        { html: '▦ 4 colonnes', fn: function () { lay(4); } }
      ]);
      var d = computed(el, 'display');
      if (/flex|grid/.test(d)) {
        var g = el2('<div class="se-grid2"></div>');
        inspector.appendChild(g);
        numBox(g, 'Espace entre les éléments (px)', pxOf(el, 'gap'), computed(el, 'gap'), function (n) { setStyle('gap', n == null ? '' : Math.max(0, n) + 'px'); }, { min: 0 });
        inspector.appendChild(el2('<div class="se-lbl">Aligner les éléments entre eux</div>'));
        var grid = /grid/.test(d), column = computed(el, 'flex-direction') === 'column';
        function al(v) {
          pushHistory();
          setStyle('align-items', v);
          if (grid) setStyle('justify-items', v);
          else if (!column) setStyle('justify-content', v === 'stretch' ? '' : v);
          later(positionBoxes);
        }
        btnRow([
          { html: 'Début', fn: function () { al('flex-start'); } },
          { html: 'Centre', fn: function () { al('center'); } },
          { html: 'Fin', fn: function () { al('flex-end'); } },
          { html: 'Étirer', fn: function () { al('stretch'); } }
        ]);
        if (!grid && !column) btnRow([{ html: '↔ Répartir l’espace', title: 'Espace égal entre les éléments', fn: function () { pushHistory(); setStyle('justify-content', 'space-between'); } }]);
      }
    }
    blockAlignRow(el);
  }

  // ── Plusieurs éléments sélectionnés (Maj+clic) : alignement ──────
  function offsetBy(el, dx, dy) {
    if (!el || (!Math.round(dx) && !Math.round(dy))) return;
    var cs = getComputedStyle(el), stat = cs.position === 'static';
    var lt = !!(el.querySelector && el.querySelector('.se-cp-modal'));
    var props = {};
    if (lt) {
      props.left = Math.round((stat ? 0 : parseFloat(cs.left) || 0) + dx) + 'px';
      props.top = Math.round((stat ? 0 : parseFloat(cs.top) || 0) + dy) + 'px';
    } else {
      var s = curTranslate(el);
      props.translate = Math.round(s[0] + dx) + 'px ' + Math.round(s[1] + dy) + 'px';
      props['z-index'] = '50';
    }
    if (stat) props.position = 'relative';
    withSel(el, function () {
      change(function (r, e) {
        if (r) { r.style = r.style || {}; Object.keys(props).forEach(function (p) { r.style[p] = props[p]; }); }
        else Object.keys(props).forEach(function (p) { e.style.setProperty(p, props[p]); });
      });
    });
  }
  function alignMulti(kind) {
    var els = VE.multi.filter(function (e) { return document.body.contains(e); });
    if (els.length < 2) return;
    pushHistory();
    var R = els.map(function (e) { return e.getBoundingClientRect(); });
    var minL = Math.min.apply(null, R.map(function (r) { return r.left; })), maxR = Math.max.apply(null, R.map(function (r) { return r.right; }));
    var minT = Math.min.apply(null, R.map(function (r) { return r.top; })), maxB = Math.max.apply(null, R.map(function (r) { return r.bottom; }));
    var moves = els.map(function () { return [0, 0]; });
    if (kind === 'dist-h' || kind === 'dist-v') {
      var h = kind === 'dist-h';
      var order = els.map(function (e, i) { return i; }).sort(function (a, b) { return h ? R[a].left - R[b].left : R[a].top - R[b].top; });
      var total = order.reduce(function (s, i) { return s + (h ? R[i].width : R[i].height); }, 0);
      var gap = ((h ? maxR - minL : maxB - minT) - total) / (els.length - 1);
      var x = h ? minL : minT;
      order.forEach(function (i) { moves[i][h ? 0 : 1] = x - (h ? R[i].left : R[i].top); x += (h ? R[i].width : R[i].height) + gap; });
    } else if (kind === 'same-w' || kind === 'same-h') {
      var ref = R[0];
      els.forEach(function (e, i) {
        if (!i) return;
        withSel(e, function () {
          ensureBoxable(e);
          if (kind === 'same-w') { setStyle('width', Math.round(ref.width) + 'px'); setStyle('max-width', 'none'); if (e.tagName === 'IMG') setStyle('height', 'auto'); }
          else { setStyle('height', Math.round(ref.height) + 'px'); setStyle('min-height', '0px'); if (e.tagName === 'IMG') setStyle('width', 'auto'); }
        });
      });
      later(positionBoxes);
      return;
    } else {
      els.forEach(function (e, i) {
        var r = R[i];
        if (kind === 'left') moves[i][0] = minL - r.left;
        if (kind === 'hcenter') moves[i][0] = (minL + maxR) / 2 - (r.left + r.width / 2);
        if (kind === 'right') moves[i][0] = maxR - r.right;
        if (kind === 'top') moves[i][1] = minT - r.top;
        if (kind === 'vcenter') moves[i][1] = (minT + maxB) / 2 - (r.top + r.height / 2);
        if (kind === 'bottom') moves[i][1] = maxB - r.bottom;
      });
    }
    els.forEach(function (e, i) { offsetBy(e, moves[i][0], moves[i][1]); });
    later(positionBoxes);
    toast('Éléments alignés (pensez à publier)');
  }
  function multiSection() {
    var n = VE.multi.length;
    section('🎯 Aligner ' + n + ' éléments');
    inspector.appendChild(el2('<div class="se-hint">Maj+clic pour ajouter ou retirer un élément. Clic simple pour revenir à un seul élément.</div>'));
    btnRow([
      { html: '⇤ Gauches', title: 'Aligner les bords gauches', fn: function () { alignMulti('left'); } },
      { html: '↔ Centres', title: 'Centrer horizontalement entre eux', fn: function () { alignMulti('hcenter'); } },
      { html: 'Droites ⇥', title: 'Aligner les bords droits', fn: function () { alignMulti('right'); } }
    ]);
    btnRow([
      { html: '⤒ Hauts', title: 'Aligner les bords du haut', fn: function () { alignMulti('top'); } },
      { html: '↕ Milieux', title: 'Centrer verticalement entre eux', fn: function () { alignMulti('vcenter'); } },
      { html: '⤓ Bas', title: 'Aligner les bords du bas', fn: function () { alignMulti('bottom'); } }
    ]);
    btnRow([
      n >= 3 ? { html: '⇹ Répartir ↔', title: 'Même espace entre chaque élément (horizontal)', fn: function () { alignMulti('dist-h'); } } : null,
      n >= 3 ? { html: '⇳ Répartir ↕', title: 'Même espace entre chaque élément (vertical)', fn: function () { alignMulti('dist-v'); } } : null,
      { html: '▭ Même largeur', title: 'Même largeur que le premier sélectionné', fn: function () { alignMulti('same-w'); } },
      { html: '▯ Même hauteur', title: 'Même hauteur que le premier sélectionné', fn: function () { alignMulti('same-h'); } }
    ]);
    btnRow([{ html: '↺ Remettre leurs positions d’origine', fn: function () {
      pushHistory();
      VE.multi.slice().forEach(function (e) { withSel(e, function () { resetPosNoHistory(); }); });
      later(positionBoxes);
    } }]);
  }

  // ── Champs chiffrés (taille, forme, recadrage) ───────────────────
  function numBox(host, lbl, val, ph, onVal, o) {
    o = o || {};
    var f = el2('<div class="se-field"><label>' + esc(lbl) + '</label></div>');
    var inp = document.createElement('input');
    inp.type = 'number'; inp.step = o.step || '1';
    if (o.min != null) inp.min = o.min;
    if (o.max != null) inp.max = o.max;
    inp.value = val === '' || val == null || isNaN(val) ? '' : Math.round(val * 100) / 100;
    inp.placeholder = ph || '';
    var pushed = false;
    inp.addEventListener('focus', function () { if (!pushed) { pushHistory(); pushed = true; } });
    inp.addEventListener('input', function () {
      var s = String(inp.value).trim();
      onVal(s === '' ? null : parseFloat(s.replace(',', '.')), inp);
      later(positionBoxes);
    });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') inp.blur(); });
    f.appendChild(inp); host.appendChild(f);
    return inp;
  }
  function pxOf(el, prop) { var v = String(curStyle(el, prop) || ''); return /^-?[\d.]+px$/.test(v) ? parseFloat(v) : ''; }
  // Un élément « en ligne » (span…) ne prend pas de largeur/hauteur : on en fait un bloc en ligne
  function ensureBoxable(el) {
    var d = computed(el, 'display');
    if (d === 'inline') setStyle('display', 'inline-block');
  }

  // Taille et forme d'une zone de texte / d'un bloc
  function shapeSection(el) {
    section('📐 Taille et forme');
    var r = el.getBoundingClientRect();
    var g = el2('<div class="se-grid2"></div>');
    inspector.appendChild(g);
    numBox(g, 'Largeur (px)', pxOf(el, 'width'), Math.round(r.width) + ' (auto)', function (n) {
      if (n == null) { setStyle('width', ''); setStyle('max-width', ''); return; }
      if (n < 10) return;
      ensureBoxable(el);
      setStyle('box-sizing', 'border-box');
      setStyle('width', Math.round(n) + 'px');
      setStyle('max-width', '100%');
    }, { min: 10 });
    numBox(g, 'Hauteur (px)', pxOf(el, 'height'), Math.round(r.height) + ' (auto)', function (n) {
      if (n == null) { setStyle('height', ''); setStyle('min-height', ''); return; }
      if (n < 10) return;
      ensureBoxable(el);
      setStyle('box-sizing', 'border-box');
      setStyle('height', Math.round(n) + 'px');
      setStyle('min-height', '0px');
    }, { min: 10 });
    numBox(g, 'Arrondi des coins (px)', pxOf(el, 'border-radius'), computed(el, 'border-radius'), function (n) {
      setStyle('border-radius', n == null ? '' : Math.max(0, n) + 'px');
    }, { min: 0 });
    numBox(g, 'Espace intérieur (px)', pxOf(el, 'padding'), computed(el, 'padding-top'), function (n) {
      setStyle('padding', n == null ? '' : Math.max(0, n) + 'px');
    }, { min: 0 });
    numBox(g, 'Bordure (px)', pxOf(el, 'border-width'), computed(el, 'border-top-width'), function (n) {
      if (n == null) { setStyle('border-width', ''); setStyle('border-style', ''); return; }
      setStyle('border-width', Math.max(0, n) + 'px');
      setStyle('border-style', n > 0 ? 'solid' : 'none');
      if (!curStyle(el, 'border-color')) setStyle('border-color', '#F0B429');
    }, { min: 0 });
    colorFieldMini(g, 'Couleur de bordure', 'border-color', el);
    inspector.appendChild(el2('<div class="se-lbl" style="margin-top:4px">Forme</div>'));
    function shape(rad, circle) {
      pushHistory();
      setStyle('border-radius', rad);
      if (circle) {
        var w = Math.round(Math.max(el.getBoundingClientRect().width, el.getBoundingClientRect().height));
        ensureBoxable(el);
        setStyle('box-sizing', 'border-box');
        setStyle('width', w + 'px'); setStyle('height', w + 'px'); setStyle('min-height', '0px');
        setStyle('display', 'flex'); setStyle('align-items', 'center'); setStyle('justify-content', 'center'); setStyle('text-align', 'center');
      }
      later(renderInspector);
    }
    btnRow([
      { html: '▭ Carré', title: 'Coins droits', fn: function () { shape('0px'); } },
      { html: '▢ Arrondi', title: 'Coins arrondis', fn: function () { shape('14px'); } },
      { html: '💊 Pilule', title: 'Bords complètement ronds', fn: function () { shape('999px'); } }
    ]);
    btnRow([
      { html: '⬭ Ovale', title: 'Forme ovale', fn: function () { shape('50%'); } },
      { html: '◯ Cercle', title: 'Cercle (largeur = hauteur)', fn: function () { shape('50%', true); } },
      { html: '↺ Origine', title: 'Taille et forme d’origine', fn: function () {
        pushHistory();
        ['width', 'height', 'min-height', 'max-width', 'border-radius', 'padding', 'border-width', 'border-style', 'border-color', 'box-sizing', 'display', 'align-items', 'justify-content'].forEach(function (p) { setStyle(p, ''); });
        later(renderInspector);
      } }
    ]);
  }
  function colorFieldMini(host, lbl, prop, el) {
    var f = el2('<div class="se-field"><label>' + esc(lbl) + '</label></div>');
    var col = document.createElement('input');
    col.type = 'color';
    col.value = toHex(curStyle(el, prop) || computed(el, prop === 'border-color' ? 'border-top-color' : prop));
    col.style.cssText = 'width:100%;height:32px;padding:2px';
    var pushed = false;
    col.addEventListener('input', function () { if (!pushed) { pushHistory(); pushed = true; } setStyle(prop, col.value); });
    f.appendChild(col); host.appendChild(f);
  }

  // Taille d'une image : largeur et hauteur libres (même si l'image se déforme)
  function imageSizeSection(el) {
    section('📏 Taille de l’image');
    inspector.appendChild(el2('<div class="se-hint">Directement sur l’image : tirez le <b>rond doré</b> (coin) pour agrandir ou réduire, la poignée de <b>droite</b> pour la largeur seule et celle du <b>bas</b> pour la hauteur seule (l’image se déforme). Maj + coin = sans garder les proportions.</div>'));
    sizeButtons(el, 'width', 'Taille rapide (largeur de la page)', [['Petite', '25%'], ['Moyenne', '50%'], ['Grande', '100%']]);
    var r = el.getBoundingClientRect();
    var keepIt = !(pxOf(el, 'width') && pxOf(el, 'height'));
    var lab = el2('<label class="se-lbl" style="display:flex;gap:8px;align-items:center;text-transform:none;font-size:.82rem;letter-spacing:0;margin:6px 0"><input type="checkbox"> Garder les proportions (décochez pour déformer l’image)</label>');
    var keep = $('input', lab);
    keep.checked = keepIt;
    inspector.appendChild(lab);
    var g = el2('<div class="se-grid2"></div>');
    inspector.appendChild(g);
    var wIn, hIn;
    function done() { later(function () { refreshCrop(el); positionBoxes(); }); }
    wIn = numBox(g, 'Largeur (px)', pxOf(el, 'width'), Math.round(r.width) + '', function (n) {
      if (n == null || n < 5) return;
      ensureBoxable(el);
      setStyle('width', Math.round(n) + 'px');
      setStyle('max-width', 'none');
      if (keep.checked) { setStyle('height', 'auto'); setStyle('object-fit', ''); }
      else { if (!pxOf(el, 'height')) setStyle('height', Math.round(el.getBoundingClientRect().height) + 'px'); setStyle('object-fit', 'fill'); }
      done();
    }, { min: 5 });
    hIn = numBox(g, 'Hauteur (px)', pxOf(el, 'height'), Math.round(r.height) + '', function (n) {
      if (n == null || n < 5) return;
      ensureBoxable(el);
      setStyle('height', Math.round(n) + 'px');
      setStyle('max-height', 'none');
      if (keep.checked) { setStyle('width', 'auto'); setStyle('object-fit', ''); }
      else { if (!pxOf(el, 'width')) setStyle('width', Math.round(el.getBoundingClientRect().width) + 'px'); setStyle('max-width', 'none'); setStyle('object-fit', 'fill'); }
      done();
    }, { min: 5 });
    keep.addEventListener('change', function () {
      pushHistory();
      if (keep.checked) { setStyle('height', 'auto'); setStyle('object-fit', ''); hIn.value = ''; }
      done();
    });
    btnRow([{ html: '↺ Taille d’origine', fn: function () {
      pushHistory();
      ['width', 'height', 'max-width', 'max-height', 'object-fit'].forEach(function (p) { setStyle(p, ''); });
      later(function () { refreshCrop(el); renderInspector(); });
    } }]);
  }

  // Recadrage : on coupe un pourcentage de chaque bord. L'image est rognée
  // (clip-path) et la place coupée est rendue à la page (marges négatives).
  function readCrop(el) {
    var s = String(curStyle(el, '--se-crop') || '').trim();
    if (!s) return null;
    var parts = s.split('|');
    var v = parts[0].trim().split(/\s+/).map(parseFloat);
    var b = (parts[1] || '').trim().split(/\s+/).map(parseFloat);
    if (v.length !== 4 || v.some(isNaN)) return null;
    if (b.length !== 4 || b.some(isNaN)) b = [0, 0, 0, 0];
    return { v: v, base: b };
  }
  function applyCrop(el, v, base) {
    var props = ['clip-path', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', '--se-crop'];
    if (!v.some(function (x) { return x > 0; })) { props.forEach(function (p) { setStyle(p, ''); }); return; }
    if (!base) {
      base = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'].map(function (p) { return parseFloat(computed(el, p)) || 0; });
    }
    ensureBoxable(el);
    var r = el.getBoundingClientRect();
    var W = el.offsetWidth || r.width, H = el.offsetHeight || r.height;
    setStyle('clip-path', 'inset(' + v[0] + '% ' + v[1] + '% ' + v[2] + '% ' + v[3] + '%)');
    setStyle('margin-top', Math.round(base[0] - H * v[0] / 100) + 'px');
    setStyle('margin-right', Math.round(base[1] - W * v[1] / 100) + 'px');
    setStyle('margin-bottom', Math.round(base[2] - H * v[2] / 100) + 'px');
    setStyle('margin-left', Math.round(base[3] - W * v[3] / 100) + 'px');
    setStyle('--se-crop', v.join(' ') + '|' + base.map(function (x) { return Math.round(x * 10) / 10; }).join(' '));
  }
  function refreshCrop(el) {
    if (!el || VE.sel !== el) return;
    var c = readCrop(el);
    if (c) applyCrop(el, c.v, c.base);
  }
  function cropSection(el) {
    section('✂ Recadrer l’image');
    btnRow([{ html: '✂ Recadrer directement sur l’image', cls: 'primary', fn: function () { startCrop(); } }]);
    inspector.appendChild(el2('<div class="se-hint">Un cadre apparaît sur l’image : tirez ses bords ou ses coins, déplacez-le, puis <b>✔ Valider</b> (ou Entrée ; Échap pour annuler). Ou réglez au pourcentage près avec les curseurs :</div>'));
    var c = readCrop(el) || { v: [0, 0, 0, 0], base: null };
    var names = [['Haut', 0], ['Droite', 1], ['Bas', 2], ['Gauche', 3]];
    var pushed = false;
    names.forEach(function (n) {
      var row = el2('<div class="se-field"><label>' + n[0] + ' : <b data-v>' + c.v[n[1]] + ' %</b></label><input type="range" min="0" max="90" step="1" style="width:100%"></div>');
      var rg = $('input', row);
      rg.value = c.v[n[1]];
      rg.addEventListener('pointerdown', function () { if (!pushed) { pushHistory(); pushed = true; } });
      rg.addEventListener('input', function () {
        var val = +rg.value;
        // On garde au moins 10 % de l'image dans chaque sens
        var opp = n[1] % 2 === 0 ? c.v[(n[1] + 2) % 4] : c.v[(n[1] + 2) % 4];
        if (val + opp > 90) { val = 90 - opp; rg.value = val; }
        c.v[n[1]] = val;
        $('[data-v]', row).textContent = val + ' %';
        applyCrop(el, c.v.slice(), c.base);
        c.base = (readCrop(el) || {}).base || c.base;
        later(positionBoxes);
      });
      inspector.appendChild(row);
    });
    btnRow([{ html: '↺ Annuler le recadrage', fn: function () { pushHistory(); applyCrop(el, [0, 0, 0, 0]); later(renderInspector); } }]);
  }

  function renderInspector() {
    if (!inspector) return;
    var el = VE.sel;
    var min = inspector.classList.contains('min');
    inspector.innerHTML = '';
    var top = el2('<div class="se-ins-top"><button class="se-btn se-ins-toggle" title="Réduire / agrandir">' + (min ? '◀' : '▶') + '</button><span class="grow"></span></div>');
    inspector.appendChild(top);
    $('.se-ins-toggle', top).addEventListener('click', function () { inspector.classList.toggle('min'); renderInspector(); });
    if (!el || !document.body.contains(el)) {
      $('.grow', top).textContent = 'Modifier la page';
      inspector.appendChild(el2('<div class="se-help">'
        + '<p>👆 <b>Cliquez</b> sur ce que vous voulez modifier : un texte, un titre, une image, un bouton…</p>'
        + '<p>✏️ <b>Cliquez dans une zone de texte</b> pour écrire directement dedans (tout le bloc est groupé, tirets compris). Alt+clic pour sélectionner un seul élément.</p>'
        + '<p>➕ Pour ajouter un élément, utilisez <b>➕ Ajouter</b> en haut, puis maintenez le clic dessus pour le glisser où vous voulez.</p>'
        + '<p>🪟 <b>Ctrl+clic</b> sur une vignette ouvre la fenêtre qu’elle affiche (ex : Tenues) pour la modifier ; Ctrl+clic sur ✕ ou Échap pour la refermer.</p>'
        + '<p>💾 Quand vous avez fini, cliquez sur <b>Publier</b> en haut : tout le monde verra la page modifiée.</p>'
        + '</div>'));
      return;
    }
    var kind = kindOf(el);
    $('.grow', top).textContent = VE.multi.length >= 2 ? VE.multi.length + ' éléments sélectionnés' : kind[1];
    if (VE.multi.length >= 2) multiSection();
    var wrap = addedWrap(el);
    var rec = wrap ? null : getRec(el);
    var tag = el.tagName;
    if (rec && rec.hidden) inspector.appendChild(el2('<div class="se-warn">Cet élément est masqué.</div>'));

    // Texte
    if (hasText(el) && !isTextOnly(el)) {
      section('✏️ Zone de texte');
      inspector.appendChild(el2('<div class="se-hint">Toute la zone est sélectionnée (paragraphes, lignes, tirets…). Écrivez directement dedans sur la page : <b>Entrée</b> = nouveau paragraphe ou nouvelle ligne de liste, <b>Maj+Entrée</b> = retour à la ligne. <b>Alt+clic</b> pour sélectionner un seul élément (ex : un lien).</div>'));
      btnRow([{ html: VE.editing === el ? '✔ J’ai fini d’écrire' : '✏️ Écrire dans la zone', cls: VE.editing === el ? 'primary' : '', fn: function () { if (VE.editing) stopInline(); else startInline(); } }]).firstChild.setAttribute('data-a', 'inline');
    } else if (hasText(el)) {
      section('✏️ Texte');
      var ta = field(null, 'textarea', el.innerText, function (v) {
        var html = esc(v).replace(/\n/g, '<br>');
        change(function (r, e) { if (r) r.html = html; else e.innerHTML = html; });
      }, { rows: Math.min(6, Math.max(2, Math.ceil((el.innerText || '').length / 40))) });
      ta.classList.add('se-big');
      btnRow([{ html: '✏️ Écrire directement sur la page', fn: function () { if (VE.editing) stopInline(); else startInline(); } }]).firstChild.setAttribute('data-a', 'inline');
    } else if (!/^(IMG|HR|IFRAME|VIDEO)$/.test(tag) && el.children.length) {
      inspector.appendChild(el2('<div class="se-hint">Ce bloc contient plusieurs éléments : cliquez directement sur le texte ou l’image à modifier.</div>'));
    }

    // Image
    if (tag === 'IMG') {
      section('🖼 Image');
      inspector.appendChild(el2('<img src="' + esc(el.currentSrc || el.src) + '" style="max-width:100%;max-height:140px;display:block;margin:4px auto 8px;border-radius:4px" data-prev>'));
      field('Coller le lien de la nouvelle image (Imgur)', 'text', '', function (v, inp) {
        if (!String(v || '').trim()) return;
        try { v = requireImgur(v); } catch (e) { toast(e.message, 'error'); return; }
        inp.value = v;
        var prev = $('[data-prev]', inspector); if (prev) prev.src = v;
        var linked = linkedImages(el);
        change(function (r, e) { if (r) r.src = v; else { e.setAttribute('src', v); e.removeAttribute('srcset'); } });
        linked.forEach(function (l) { setImgSrc(l, v); });
        if (linked.length) reapplySoon();
        toast(linked.length ? 'Image remplacée (+ ' + linked.length + ' image' + (linked.length > 1 ? 's' : '') + ' liée' + (linked.length > 1 ? 's' : '') + ' dans la fenêtre)' : 'Image remplacée');
      }, { onChange: true, placeholder: 'https://i.imgur.com/…' });
      inspector.appendChild(el2('<div class="se-hint">Sur imgur.com : clic droit sur l’image → « Copier l’adresse de l’image ».</div>'));
      imageSizeSection(el);
      blockAlignRow(el, 'Position de l’image sur la page');
      cropSection(el);
      section('✋ Position');
      inspector.appendChild(el2('<div class="se-hint">Maintenez le clic sur l’image et glissez-la où vous voulez sur la page.</div>'));
      btnRow([{ html: '↺ Remettre l’image à sa place', fn: resetImagePos }]);
    } else {
      if (wrap && el.parentElement === wrap) {
        section('✋ Position');
        inspector.appendChild(el2('<div class="se-hint">Élément ajouté avec le Pannel : maintenez le clic dessus et glissez-le où vous voulez sur la page.</div>'));
        btnRow([{ html: '↺ Remettre à sa place d’origine', fn: resetImagePos }]);
      }
      if (tag === 'HR') dividerSection(el);
      else if (!/^(BR|IFRAME|VIDEO|svg|SVG)$/.test(tag)) shapeSection(el);
    }
    tocSection(el);

    // Lien
    var link = tag === 'A' ? el : (el.closest('a') && !isUi(el.closest('a')) ? el.closest('a') : null);
    if (link) {
      section('🔗 Où mène ce lien ?');
      var cur = link.getAttribute('href') || '';
      var opts = pageOptions();
      var known = opts.some(function (p) { return p[0] === cur; });
      var sel = document.createElement('select');
      opts.concat([['__other', 'Une autre adresse (lien internet)…']]).forEach(function (p) {
        var o = document.createElement('option'); o.value = p[0]; o.textContent = p[1]; sel.appendChild(o);
      });
      sel.value = known ? cur : '__other';
      var wrapF = el2('<div class="se-field"></div>');
      wrapF.appendChild(sel);
      var other = document.createElement('input'); other.type = 'text'; other.placeholder = 'https://…'; other.value = known ? '' : cur;
      other.style.marginTop = '6px'; other.style.display = known ? 'none' : '';
      wrapF.appendChild(other);
      inspector.appendChild(wrapF);
      function setHref(h) {
        pushHistory();
        var target = link;
        var prevSel = VE.sel;
        VE.sel = target;
        change(function (r, e) { if (r) r.href = h; else e.setAttribute('href', h); });
        VE.sel = prevSel;
      }
      sel.addEventListener('change', function () {
        other.style.display = sel.value === '__other' ? '' : 'none';
        if (sel.value !== '__other') setHref(sel.value);
      });
      other.addEventListener('change', function () { if (other.value.trim()) setHref(other.value.trim()); });
    }

    // Apparence
    if (tag !== 'IMG' && tag !== 'HR') {
      section('🎨 Apparence');
      // Police
      var fsel = document.createElement('select');
      var curFont = String(curStyle(el, 'font-family')).split(',')[0].replace(/['"]/g, '').trim();
      [['', 'Police : par défaut']].concat(FONTS.map(function (f) { return [f, f]; })).forEach(function (p) {
        var o = document.createElement('option'); o.value = p[0]; o.textContent = p[1];
        if (p[0]) o.style.fontFamily = "'" + p[0] + "'";
        fsel.appendChild(o);
      });
      fsel.value = curFont;
      fsel.addEventListener('change', function () { pushHistory(); setStyle('font-family', fsel.value); });
      var ff = el2('<div class="se-field"></div>'); ff.appendChild(fsel); inspector.appendChild(ff);
      // Taille
      var sizeNow = function () { return Math.round(parseFloat(curStyle(el, 'font-size') || computed(el, 'font-size')) || 16); };
      inspector.appendChild(el2('<div class="se-lbl" style="margin-top:6px">Taille du texte (en pixels)</div>'));
      var sizeRow = btnRow([
        { html: 'A−', title: 'Plus petit', fn: function () { pushHistory(); setStyle('font-size', Math.max(1, sizeNow() - 1) + 'px'); later(showSize); } },
        { html: 'A+', title: 'Plus grand', fn: function () { pushHistory(); setStyle('font-size', (sizeNow() + 1) + 'px'); later(showSize); } },
        { html: '↺', title: 'Taille d’origine', fn: function () { pushHistory(); setStyle('font-size', ''); later(showSize); } }
      ]);
      // Nombre libre : on tape la taille voulue (ex : 17, 23.5)
      var sizeInp = document.createElement('input');
      sizeInp.type = 'number'; sizeInp.min = '1'; sizeInp.max = '400'; sizeInp.step = 'any';
      sizeInp.title = 'Tapez la taille voulue en pixels';
      sizeInp.setAttribute('data-size', '');
      sizeInp.style.cssText = 'width:76px;flex:0 0 76px;text-align:center';
      sizeRow.insertBefore(sizeInp, sizeRow.children[1]);
      var sizePushed = false;
      sizeInp.addEventListener('focus', function () { if (!sizePushed) { pushHistory(); sizePushed = true; } });
      sizeInp.addEventListener('input', function () {
        var n = parseFloat(String(sizeInp.value).replace(',', '.'));
        if (!(n > 0) || n > 400) return;
        setStyle('font-size', (Math.round(n * 100) / 100) + 'px');
      });
      sizeInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') sizeInp.blur(); });
      function showSize() {
        if (document.activeElement === sizeInp) return;
        var v = parseFloat(computed(VE.sel || el, 'font-size'));
        sizeInp.value = v ? Math.round(v * 100) / 100 : '';
      }
      showSize();
      // Gras / italique / alignement
      btnRow([
        { html: '<b>G</b>', title: 'Gras', fn: function () { pushHistory(); setStyle('font-weight', parseInt(computed(el, 'font-weight'), 10) >= 600 ? '400' : '700'); } },
        { html: '<i>I</i>', title: 'Italique', fn: function () { pushHistory(); setStyle('font-style', computed(el, 'font-style') === 'italic' ? 'normal' : 'italic'); } },
        { html: '⯇ Gauche', title: 'Aligner à gauche', fn: function () { pushHistory(); setStyle('text-align', 'left'); } },
        { html: 'Centre', title: 'Centrer', fn: function () { pushHistory(); setStyle('text-align', 'center'); } },
        { html: 'Droite ⯈', title: 'Aligner à droite', fn: function () { pushHistory(); setStyle('text-align', 'right'); } }
      ]);
      if ((el.textContent || '').trim()) textMoreSection(el);
      swatchField('Couleur du texte', 'color', el);
      swatchField('Couleur de fond', 'background-color', el);
    }
    if (tag !== 'IMG' && tag !== 'HR' && !/^(BR|IFRAME|VIDEO|svg|SVG)$/.test(tag)) structureSection(el);

    // Ajouter
    section('➕ Ajouter après cet élément');
    var grid = el2('<div class="se-add-grid"></div>');
    Object.keys(BLOCKS).forEach(function (k) {
      var b = BLOCKS[k];
      if (b[3] && !ADV()) return;
      var n = el2('<button type="button" class="se-add"><span>' + esc(b[0]) + '</span>' + esc(b[1]) + '</button>');
      n.addEventListener('click', function () { insertBlock(k, 'after'); });
      grid.appendChild(n);
    });
    inspector.appendChild(grid);

    // Déplacer / supprimer
    section('🧩 Cet élément');
    btnRow([
      { html: '▲ Monter', fn: function () { action('up'); } },
      { html: '▼ Descendre', fn: function () { action('down'); } },
      { html: '⧉ Dupliquer', fn: function () { action('dup'); } },
      { html: '🗑 Supprimer', cls: 'danger', fn: function () { action('del'); } }
    ]);
    btnRow([
      el.parentElement && el.parentElement !== document.body ? { html: '⬚ Sélectionner le bloc autour', fn: selectParent } : null,
      !wrap && (rec || VE.edits['m' + hash(SE.pathOf(el))]) ? { html: '↺ Remettre comme avant', fn: function () { action('reset'); } } : null
    ]);

    if (ADV()) renderAdvanced(el, wrap, rec);
  }
  function later(fn) { setTimeout(fn, 60); }
  function selectParent() {
    var p = VE.sel && VE.sel.parentElement;
    if (!p || p === document.body) return;
    if (p.hasAttribute('data-se-added') && p.parentElement) p = p.parentElement;
    select(p);
  }
  function sizeButtons(el, prop, title, choices) {
    var lbl = el2('<div class="se-lbl" style="margin-top:8px">' + esc(title) + '</div>');
    inspector.appendChild(lbl);
    btnRow(choices.map(function (c) {
      return { html: c[0], fn: function () { pushHistory(); setStyle(prop, c[1]); if (prop === 'width') setStyle('height', 'auto'); } };
    }).concat([{ html: '↺', title: 'Taille d’origine', fn: function () { pushHistory(); setStyle(prop, ''); setStyle('height', ''); } }]));
  }
  function swatchField(title, prop, el) {
    var f = el2('<div class="se-field"><label>' + esc(title) + '</label><div class="se-swatches"></div></div>');
    var box = $('.se-swatches', f);
    SWATCHES.forEach(function (c) {
      var s = el2('<button type="button" class="se-sw" title="' + c + '" style="background:' + c + '"></button>');
      s.addEventListener('click', function () { pushHistory(); setStyle(prop, c); });
      box.appendChild(s);
    });
    var pick = document.createElement('input'); pick.type = 'color'; pick.title = 'Autre couleur';
    pick.value = toHex(curStyle(el, prop) || computed(el, prop));
    var pushed = false;
    pick.addEventListener('input', function () { if (!pushed) { pushHistory(); pushed = true; } setStyle(prop, pick.value); });
    box.appendChild(pick);
    var reset = el2('<button type="button" class="se-btn" title="Couleur d’origine">↺</button>');
    reset.addEventListener('click', function () { pushHistory(); setStyle(prop, ''); });
    box.appendChild(reset);
    inspector.appendChild(f);
  }

  // Outils détaillés (mode avancé)
  function renderAdvanced(el, wrap, rec) {
    inspector.appendChild(el2('<h4>🧰 Avancé</h4>'));
    if (!/^(IMG|INPUT|BR|HR|IFRAME|VIDEO|CANVAS|SVG|svg)$/.test(el.tagName)) {
      field('HTML intérieur', 'textarea', cleanHtml(el.innerHTML), function (v) {
        change(function (r, e) { if (r) r.html = v; else e.innerHTML = v; });
      }, { rows: 4, mono: true });
    }
    if (!$('#se-ve-fonts')) document.body.appendChild(el2(fontDatalist('se-ve-fonts').replace('<datalist', '<datalist data-se-ui')));
    var cur = wrap ? {} : ((rec && rec.style) || {});
    STYLE_FIELDS.forEach(function (f) {
      var prop = f[0], type = f[2];
      var val = wrap ? el.style.getPropertyValue(prop) : (cur[prop] || '');
      var setter = function (v) { setStyle(prop, v); };
      var shown = prop === 'font-family' ? String(val).split(',')[0].replace(/['"]/g, '').trim() : val;
      if (type === 'select') field(f[1], 'select', shown, setter, { options: f[3], placeholder: computed(el, prop) });
      else if (type === 'color') colorField(f[1], shown, computed(el, prop), setter);
      else field(f[1], 'text', shown, setter, { placeholder: type === 'font' ? computed(el, prop).split(',')[0].replace(/['"]/g, '') : (f[3] ? f[3] + ' (actuel : ' + computed(el, prop) + ')' : computed(el, prop)), list: type === 'font' ? 'se-ve-fonts' : null, onChange: type === 'font' });
    });
    field('Image de fond (lien)', 'text', wrap ? '' : ((rec && rec.bg) || ''), function (v, inp) {
      if (String(v || '').trim()) { try { v = requireImgur(v); } catch (e) { toast(e.message, 'error'); return; } } else v = '';
      inp.value = v;
      change(function (r, e) {
        if (r) { if (v) r.bg = v; else delete r.bg; }
        else if (v) { e.style.backgroundImage = 'url("' + v + '")'; e.style.backgroundSize = 'cover'; e.style.backgroundPosition = 'center'; }
        else e.style.removeProperty('background-image');
      });
    }, { onChange: true, placeholder: 'https://i.imgur.com/…' });
    field('CSS libre pour cet élément', 'textarea', wrap ? (el.getAttribute('style') || '') : ((rec && rec.css) || ''), function (v) {
      change(function (r, e) { if (r) { if (v) r.css = v; else delete r.css; } else e.setAttribute('style', v); });
    }, { rows: 3, mono: true });
    field('Classes CSS', 'text', el.getAttribute('class') || '', function (v) {
      change(function (r, e) { if (r) r.className = v; else e.setAttribute('class', v); });
    }, { onChange: true });
    btnRow([{ html: '✎ Remplacer par du HTML', fn: function () { action('replace'); } }]);
    inspector.appendChild(el2('<div class="se-mono" style="margin-top:12px">' + esc(wrap ? SE.livePath(el) : SE.pathOf(el)) + '</div>'));
  }

  function el2(html) { return el(html); }
  function field(lbl, type, value, onSet, opt) {
    opt = opt || {};
    var f = el2('<div class="se-field">' + (lbl ? '<label>' + esc(lbl) + '</label>' : '') + '</div>');
    var inp;
    if (type === 'textarea') { inp = document.createElement('textarea'); inp.rows = opt.rows || 3; }
    else if (type === 'select') {
      inp = document.createElement('select');
      (opt.options || []).forEach(function (o) {
        var op = document.createElement('option'); op.value = o; op.textContent = o || ('(actuel : ' + (opt.placeholder || 'auto') + ')'); inp.appendChild(op);
      });
    } else { inp = document.createElement('input'); inp.type = 'text'; }
    if (opt.list) inp.setAttribute('list', opt.list);
    if (opt.placeholder && type !== 'select') inp.placeholder = opt.placeholder;
    if (opt.mono) inp.style.fontFamily = 'Consolas,monospace';
    inp.value = value == null ? '' : value;
    var pushed = false;
    inp.addEventListener('focus', function () { if (!pushed) { pushHistory(); pushed = true; } });
    var ev = type === 'select' || opt.onChange ? 'change' : 'input';
    inp.addEventListener(ev, function () { if (!pushed) { pushHistory(); pushed = true; } onSet(inp.value, inp); });
    f.appendChild(inp);
    inspector.appendChild(f);
    return inp;
  }
  function colorField(lbl, value, current, onSet) {
    var f = el2('<div class="se-field"><label>' + esc(lbl) + '</label><div class="se-color"><input type="color"><input type="text"><button class="se-btn" title="Valeur d’origine">↺</button></div></div>');
    var col = $('input[type=color]', f), txt = $('input[type=text]', f);
    col.value = toHex(value || current); txt.value = value || ''; txt.placeholder = current;
    var pushed = false;
    function ph() { if (!pushed) { pushHistory(); pushed = true; } }
    col.addEventListener('input', function () { ph(); txt.value = col.value; onSet(col.value); });
    txt.addEventListener('change', function () { ph(); if (txt.value) col.value = toHex(txt.value); onSet(txt.value.trim()); });
    $('button', f).addEventListener('click', function () { ph(); txt.value = ''; onSet(''); });
    inspector.appendChild(f);
  }

  function anchorPathOf(el) {
    var wrap = addedWrap(el);
    return wrap ? SE.livePath(el) : SE.pathOf(el);
  }
  function insertBlock(type, pos, anywhere) {
    if (VE.editing) stopInline();
    var anchorEl = VE.sel && document.body.contains(VE.sel) ? VE.sel : (anywhere ? anchorAtCenter() : null);
    if (!anchorEl) { toast('Impossible de trouver où ajouter le bloc : cliquez d’abord sur un élément de la page.', 'error'); return; }
    // On n'ajoute pas un bloc à l'intérieur d'un texte
    if (anchorEl.closest && anchorEl.closest('p,li,h1,h2,h3,h4,h5,h6,a,button') && !addedWrap(anchorEl)) {
      var blk = anchorEl.closest('p,li,h1,h2,h3,h4,h5,h6,a,button');
      if (blk.tagName === 'LI') blk = blk.closest('ul,ol') || blk;
      anchorEl = blk;
    }
    var anchor = anchorPathOf(anchorEl);
    BLOCKS[type][2]().then(function (html) {
      if (!html) return;
      pushHistory();
      // Un bloc peut en créer plusieurs à la suite (ex : sommaire + ses parties)
      var list = Array.isArray(html) ? html : [html], id = null, last = null;
      list.forEach(function (h, i) {
        var nid = uid('a');
        VE.edits[nid] = { type: 'add', anchor: i ? '@' + last : anchor, pos: i ? 'after' : pos, html: h, order: nextOrder() };
        if (!id) id = nid;
        last = nid;
      });
      reapply(true);
      var w = document.querySelector('[data-se-added="' + id + '"]');
      if (w && w.firstElementChild) { select(w.firstElementChild); w.firstElementChild.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }).catch(fail);
  }
  function siblingOf(el, dir) {
    var n = el;
    do { n = dir < 0 ? n.previousElementSibling : n.nextElementSibling; } while (n && n.hasAttribute('data-se-ui'));
    return n;
  }
  function action(x) {
    var el = VE.sel;
    if (!el) return;
    var wrap = addedWrap(el);
    pushHistory();
    if (x === 'del') {
      if (wrap) {
        el.remove(); commitAdded(wrap);
        VE.sel = null;
        reapply(false);
      } else {
        change(function (r) { r.hidden = true; });
        VE.sel = null; positionBoxes(); renderInspector();
      }
    } else if (x === 'reset') {
      delete VE.edits['s' + hash(SE.pathOf(el))];
      delete VE.edits['m' + hash(SE.pathOf(el))];
      reapply(false);
    } else if (x === 'dup') {
      var nid = uid('a');
      VE.edits[nid] = { type: 'add', anchor: anchorPathOf(el), pos: 'after', html: cleanHtml(el.outerHTML), order: nextOrder() };
      reapply(true);
      var w = document.querySelector('[data-se-added="' + nid + '"]');
      if (w && w.firstElementChild) select(w.firstElementChild);
    } else if (x === 'replace') {
      VE.history.pop();
      dialog({ title: 'Remplacer par du HTML', fields: [{ key: 'h', label: 'Code HTML', type: 'textarea', rows: 10, value: cleanHtml(el.outerHTML) }], ok: 'Remplacer' }).then(function (v) {
        if (!v) return;
        pushHistory();
        if (wrap) { el.outerHTML = v.h; commitAdded(wrap); VE.sel = null; reapply(false); return; }
        var aid = uid('a');
        VE.edits[aid] = { type: 'add', anchor: SE.pathOf(el), pos: 'after', html: v.h, order: nextOrder() };
        setRec(el).hidden = true;
        VE.sel = null;
        reapply(true);
        var w2 = document.querySelector('[data-se-added="' + aid + '"]');
        if (w2 && w2.firstElementChild) select(w2.firstElementChild); else renderInspector();
      });
      return;
    } else if (x === 'up' || x === 'down') {
      var dir = x === 'up' ? -1 : 1;
      var target = wrap && el.parentElement === wrap ? wrap : el;
      var sib = siblingOf(target, dir);
      if (!sib) { VE.history.pop(); toast('Impossible d’aller plus loin ici. Essayez « Sélectionner le bloc autour ».'); return; }
      if (wrap && target === wrap) {
        var rec = VE.edits[wrap.getAttribute('data-se-added')];
        rec.anchor = sib.hasAttribute('data-se-added') ? '@' + sib.getAttribute('data-se-added') : SE.pathOf(sib);
        rec.pos = dir < 0 ? 'before' : 'after';
        reapply(true);
      } else if (wrap) {
        if (dir < 0) sib.before(el); else sib.after(el);
        commitAdded(wrap);
      } else {
        var path = SE.pathOf(el);
        var anchor = sib.hasAttribute('data-se-added') ? '@' + sib.getAttribute('data-se-added') : SE.pathOf(sib);
        VE.edits['m' + hash(path)] = { type: 'move', path: path, anchor: anchor, pos: dir < 0 ? 'before' : 'after', order: nextOrder() };
        reapply(true);
      }
      positionBoxes();
    }
    updateBar();
  }

  window.SiteEditorPanel = {
    open: open,
    close: close,
    startVisual: function () { open(); },
    isOpen: function () { return !!(panel && panel.classList.contains('open')) || VE.active; },
    isVisualEditing: function () { return VE.active; }
  };
})();
