/* UI 基础：弹窗 / Toast / 导航 / 通用小工具 */
(function () {
  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  const esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  const DOW_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  function dateCN(dateStr, withYear) {
    const d = Store.dateFromStr(dateStr);
    const p = withYear ? d.getFullYear() + '年' : '';
    return p + (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + DOW_CN[d.getDay()];
  }
  function shortDate(dateStr) {
    const d = Store.dateFromStr(dateStr);
    return (d.getMonth() + 1) + '.' + String(d.getDate()).padStart(2, '0');
  }
  function toast(msg, type) {
    const root = $('#toastRoot');
    const t = document.createElement('div');
    t.className = 'toast ' + (type || 'ok');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, 2400);
    setTimeout(function () { t.remove(); }, 2800);
  }

  function modal(opts) {
    const root = $('#modalRoot');
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.innerHTML =
      '<div class="modal' + (opts.wide ? ' wide' : '') + '">' +
      '<div class="modal-head"><h3>' + esc(opts.title || '') + '</h3><button class="close-x" type="button">×</button></div>' +
      '<div class="modal-body"></div>' +
      (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
      '</div>';
    const modalEl = $('.modal', wrap);
    const bodyEl = $('.modal-body', modalEl);
    const close = function () { wrap.remove(); };
    $$('.close-x', wrap).forEach(function (b) { b.onclick = close; });
    // 表单底部“取消”等 data-x 按钮统一绑定关闭
    $$('[data-x]', wrap).forEach(function (b) { b.onclick = close; });
    wrap.addEventListener('mousedown', function (e) { if (e.target === wrap && opts.dismissible !== false) close(); });
    document.addEventListener('keydown', function key(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', key); }
    });
    if (opts.body) bodyEl.innerHTML = opts.body;
    root.appendChild(wrap);
    // 传入整个 modal，便于同时绑定 body 与 footer 中的按钮
    if (opts.onMount) opts.onMount(modalEl, wrap);
    return { root: wrap, bodyEl: bodyEl, modalEl: modalEl, close: close };
  }

  function confirm(msg, onYes, optTitle) {
    const m = modal({
      title: optTitle || '确认操作',
      body: '<div style="font-size:13.5px">' + esc(msg) + '</div>',
      footer: '<button class="btn" data-act="no">取消</button><button class="btn btn-danger" data-act="yes">确认</button>',
      onMount: function (body, wrap) {
        const yes = $('[data-act=yes]', wrap);
        const no = $('[data-act=no]', wrap);
        const close = function () { wrap.remove(); };
        if (yes) yes.onclick = function () { close(); onYes && onYes(); };
        if (no) no.onclick = close;
      }
    });
    return m;
  }

  function fileInput(accept, onFile) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept || '.json';
    inp.style.display = 'none';
    document.body.appendChild(inp);
    inp.onchange = function () {
      const f = inp.files && inp.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function () { try { onFile(reader.result, f); } catch (e) { toast('文件读取失败：' + e.message, 'err'); } };
      reader.readAsText(f);
      inp.remove();
    };
    inp.click();
  }

  function pill(text, kind) {
    return '<span class="pill ' + (kind || 'gray') + '">' + esc(text) + '</span>';
  }
  function catPill(cat) {
    const map = {
      '起跑/加速': 'blue', '最大速度': 'blue', '速度耐力': 'purple', '专项耐力': 'purple',
      '一般耐力/节奏': 'teal', '技术/技巧': 'gray', '力量训练': 'amber', '跳跃/增强式': 'teal',
      '恢复/再生': 'green', '比赛/测验': 'red', '综合': 'gray'
    };
    return pill(cat, map[cat] || 'gray');
  }
  function recordDotHtml(type) {
    return '<i class="' + esc(type) + '"></i>';
  }

  function stateBadge(profile) {
    profile = profile || {};
    const initials = (profile.name || '新').trim().slice(0, 1) || '新';
    return '<div class="ath-avatar">' + esc(initials) + '</div><div>' +
      '<div class="t1">' + esc(profile.name || '未命名运动员') + '</div>' +
      '<div class="t2">' + esc(profile.event || '') + '</div></div>';
  }

  function switchView(name) {
    $$('.nav-item').forEach(function (b) { b.classList.toggle('active', b.dataset.view === name); });
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + name); });
    const meta = window.Views && window.Views.meta && window.Views.meta[name];
    $('#pageTitle').textContent = meta ? meta.title : (name || '');
    $('#pageSub').textContent = meta ? meta.sub : '';
    document.querySelector('.main').scrollTop = 0;
    if (window.Views && window.Views.render) window.Views.render(name);
  }

  const quickLabels = {
    sleep: '睡眠记录', heart: '静息心率', training: '专项训练', body: '身体围度',
    fv: '力速曲线测试', rsi: 'RSI 跳深测试', plan: '训练计划', profile: '运动员档案'
  };

  function bindGlobal() {
    $$('#mainNav .nav-item').forEach(function (b) {
      b.addEventListener('click', function () { switchView(b.dataset.view); });
    });

    const qBtn = $('#btnQuickAdd');
    const qMenu = $('#quickAddMenu');
    qBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      qMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', function (e) {
      if (!qMenu.classList.contains('hidden') && !qMenu.contains(e.target) && e.target !== qBtn) qMenu.classList.add('hidden');
    });
    $$('#quickAddMenu button').forEach(function (b) {
      b.addEventListener('click', function () {
        qMenu.classList.add('hidden');
        const kind = b.dataset.qa;
        const hook = UI.recordHooks[kind];
        if (hook) hook(); else toast('暂不支持', 'err');
      });
    });
    $('#btnExportPdf').addEventListener('click', function () { window.PdfExport && window.PdfExport.showDialog(); });
    const langBtn = $('#btnLang');
    if (langBtn) langBtn.addEventListener('click', function () { window.I18n && I18n.toggle(); });
  }

  function registerHook(kind, fn) { UI.recordHooks[kind] = fn; }
  function setCurrent(name) { UI.currentView = name; }

  const UI = {
    $: $, $$: $$, esc: esc,
    DOW_CN: DOW_CN,
    dateCN: dateCN, shortDate: shortDate,
    toast: toast, modal: modal, confirm: confirm, fileInput: fileInput,
    pill: pill, catPill: catPill, stateBadge: stateBadge, recordDotHtml: recordDotHtml,
    bindGlobal: bindGlobal, switchView: switchView,
    recordHooks: {}, registerHook: registerHook,
    quickLabels: quickLabels,
    currentView: 'dashboard',
    tr: function (s) { return window.I18n ? I18n.tr(s) : s; }
  };
  window.UI = UI;
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') $('#quickAddMenu').classList.add('hidden');
  });
})();
