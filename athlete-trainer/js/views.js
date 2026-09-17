/* 页面渲染：总览 / 日历 / 睡眠 / 静息心率 / 训练 / 身体围度 / 计划 / 数据 */
(function () {
  const S = function () { return Store.state; };
  const esc = UI.esc;

  const Views = {
    meta: {
      athletes: { title: '运动员管理', sub: '新增 / 切换运动员，每位运动员的训练与监控数据相互独立' },
      dashboard: { title: '总览', sub: '睡眠 · 晨脉 · 训练负荷与恢复状态' },
      calendar: { title: '日历回看', sub: '点击日期查看当天全部记录，支持按类别筛选' },
      sleep: { title: '睡眠记录', sub: '记录入睡 / 起床时间、质量与醒后状态' },
      heart: { title: '静息心率', sub: '晨脉监控与恢复预警（7 日基线对照）' },
      training: { title: '专项训练', sub: '训练内容、负荷与 RPE 记录' },
      body: { title: '身体围度', sub: '体重与关键围度的纵向追踪' },
      analysis: { title: '力速 / RSI 分析', sub: '加速力速剖面（F-v）与反应力量指数（RSI）' },
      plans: { title: '训练计划', sub: '周期化日计划、完成情况与一键转为训练日志' },
      data: { title: '数据管理', sub: '本地备份、导入导出与示例数据' }
    },
    renderers: {},
    current: 'dashboard'
  };

  Views.render = function (name) {
    Views.current = name;
    const el = document.getElementById('content-' + name);
    if (!el) return;
    if (Views.renderers[name]) Views.renderers[name](el);
    else el.innerHTML = '';
  };
  Views.refreshCurrent = function () {
    Views.render(Views.current);
    Views.renderMini();
  };
  Views.renderMini = function () {
    const mini = document.getElementById('athMini');
    if (mini) mini.innerHTML = UI.stateBadge(S().profile);
    const sw = document.getElementById('athSwitch');
    if (sw && Store.state.athletes) {
      const act = Store.activeAthlete();
      sw.innerHTML = Store.state.athletes.map(function (a) {
        return '<option value="' + UI.esc(a.id) + '"' + (act && act.id === a.id ? ' selected' : '') + '>' + UI.esc(a.profile.name || '未命名') + '</option>';
      }).join('') + '<option value="__manage">＋ 管理运动员…</option>';
      sw.value = act ? act.id : '__manage';
      sw.onchange = function () {
        if (sw.value === '__manage') UI.switchView('athletes');
        else Store.setActiveAthlete(sw.value);
      };
    }
  };

  function fmtNum(v, d) { return v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d === undefined ? 1 : d); }
  function percent(v, d) { return v === null || v === undefined ? '—' : Number(v).toFixed(d === undefined ? 0 : d) + '%'; }
  function statCard(label, value, hint, accent, extra) {
    return '<div class="card stat ' + (accent || '') + '"><div class="label">' + label + '</div><div class="value">' + value +
      '</div><div class="hint">' + (hint || '') + '</div>' + (extra || '') + '</div>';
  }
  function deltaHtml(cur, prev, unit, goodDirection) {
    if (cur === null || cur === undefined || prev === null || prev === undefined) return '<span class="muted">—</span>';
    const d = cur - prev;
    const cls = Math.abs(d) < 0.005 ? 'delta-flat' : (d > 0) === (goodDirection !== false) ? 'delta-up' : 'delta-down';
    const arrow = d > 0.004 ? '▲' : d < -0.004 ? '▼' : '◆';
    return '<span class="' + cls + '">' + arrow + ' ' + fmtNum(Math.abs(d)) + ' ' + (unit || '') + '</span>';
  }

  /* ========================= 智能健康分析 ========================= */
  const HEALTH_LEVELS = [
    { label: '恢复状态良好', color: '#16a34a', bg: '#e8f7ed', pill: 'green' },
    { label: '需要关注', color: '#d97706', bg: '#fdf4e3', pill: 'amber' },
    { label: '恢复预警', color: '#dc2626', bg: '#fdeaea', pill: 'red' },
    { label: '高风险警告', color: '#991b1b', bg: '#fbe0e0', pill: 'red' }
  ];
  Views.healthLevelMeta = function (level) { return HEALTH_LEVELS[Math.max(0, Math.min(3, level))]; };

  Views.healthCardHtml = function (h) {
    const meta = Views.healthLevelMeta(h.level);
    const factors = h.factors.filter(function (f) { return f.sev > 0; });
    const mainFactors = (factors.length ? factors : h.factors).slice(0, 4);
    return '<div class="card" style="margin-bottom:14px;border-left:5px solid ' + meta.color + ';background:' + meta.bg + '">' +
      '<div class="card-head"><h3>🧠 智能健康分析</h3><span class="pill ' + meta.pill + '">' + meta.label + ' · ' + h.score + ' 分</span></div>' +
      '<div class="row" style="align-items:flex-start;gap:18px">' +
      '<div style="min-width:110px"><div style="font-size:34px;font-weight:800;line-height:1.1;color:' + meta.color + '">' + h.score + '</div>' +
      '<div class="small muted">健康评分（0–100）</div></div>' +
      '<div style="flex:1;min-width:220px">' +
      '<div class="small bold">主要发现</div>' +
      mainFactors.map(function (f) {
        return '<div class="mini-row" style="align-items:flex-start"><span style="color:' + Views.healthLevelMeta(f.sev).color + '">●</span><span><b>' + UI.esc(f.title) + '</b>' + (f.detail ? '：' + UI.esc(f.detail) : '') + '</span></div>';
      }).join('') +
      '<div class="small bold" style="margin-top:8px">建议</div>' +
      h.advice.map(function (a) { return '<div class="mini-row" style="align-items:flex-start"><span>•</span><span>' + UI.esc(a) + '</span></div>'; }).join('') +
      '</div></div>' +
      '<div class="row" style="margin-top:10px">' +
      '<button class="btn btn-sm healthNotifyBtn">开启系统提醒</button>' +
      '<span class="small muted">出现恢复预警时自动弹窗提醒，并可发送系统通知</span>' +
      '</div></div>';
  };

  Views.bindHealthNotify = function (root) {
    (root || document).querySelectorAll('.healthNotifyBtn').forEach(function (btn) {
      btn.onclick = function () {
        if (!('Notification' in window)) { UI.toast('当前浏览器不支持系统提醒', 'err'); return; }
        if (Notification.permission === 'granted') {
          Store.state.settings.browserNotify = true; Store.changed();
          UI.toast('系统提醒已开启', 'ok');
          return;
        }
        Notification.requestPermission().then(function (p) {
          if (p === 'granted') {
            Store.state.settings.browserNotify = true; Store.changed();
            UI.toast('系统提醒已开启', 'ok');
          } else {
            UI.toast('未获得通知权限，仍会使用页面内预警', 'err');
          }
        });
      };
    });
  };

  Views.checkHealthAlert = function () {
    const h = Analytics.healthAnalysis(Store.state);
    if (h.level < 2) return;
    const meta = Views.healthLevelMeta(h.level);
    const factors = h.factors.filter(function (f) { return f.sev > 0; });
    const key = 'athlete-os-health-alert-date';
    let last = null;
    try { last = localStorage.getItem(key); } catch (e) { last = null; }
    if (last === Store.today()) return;
    try { localStorage.setItem(key, Store.today()); } catch (e) { /* ignore */ }

    if (Store.state.settings.browserNotify && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification('恢复预警', { body: factors.length ? factors[0].title + '：' + factors[0].detail : '存在恢复风险，请查看智能健康分析。' });
      } catch (e) { /* ignore */ }
    }
    UI.modal({
      title: '⚠️ ' + meta.label,
      body: '<div class="alert ' + (h.level >= 3 ? 'danger' : 'warn') + '" style="margin-bottom:10px">检测到可能的恢复风险：' + meta.label + '（健康评分 ' + h.score + '）。</div>' +
        mainFactorsHtml(factors) +
        '<div class="tagline">以上为基于你记录的睡眠、晨脉与训练负荷的自动分析，不构成医疗诊断。若持续异常或伴随不适，请及时联系教练、队医或医生。</div>',
      footer: '<button class="btn btn-primary" data-x>知道了</button>'
    });
  };
  function mainFactorsHtml(factors) {
    if (!factors.length) return '';
    return factors.slice(0, 4).map(function (f) {
      return '<div class="mini-row" style="align-items:flex-start"><span>●</span><span><b>' + UI.esc(f.title) + '</b>' + (f.detail ? '：' + UI.esc(f.detail) : '') + '</span></div>';
    }).join('');
  }

  /* ========================= 运动员管理 ========================= */
  Views.renderers.athletes = function (el) {
    const state = S();
    const athletes = state.athletes || [];
    const active = Store.activeAthlete();

    let html =
      '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" id="addAthlete">＋ 新增运动员</button></div>' +
      '<div class="tagline">每位运动员都有独立的睡眠、晨脉、训练、围度、力速/RSI 测试与训练计划数据。通过左侧或下方“当前运动员”下拉框快速切换。</div>' +
      (athletes.length ? '<div class="grid g-3">' + athletes.map(function (a) {
        const counts = {
          training: a.data.training.length,
          plans: a.data.plans.length,
          sleep: a.data.sleep.length,
          rhr: a.data.rhr.length,
          body: a.data.body.length,
          fv: a.data.fv.length,
          rsi: a.data.rsi.length
        };
        const isActive = active && active.id === a.id;
        const initials = (a.profile.name || 'A').trim().slice(0, 1);
        return '<div class="card" style="border-color:' + (isActive ? '#20b3aa' : 'var(--line)') + '">' +
          '<div class="card-head"><div class="row"><div class="ath-avatar" style="width:42px;height:42px;flex:0 0 42px;font-size:17px">' + UI.esc(initials) + '</div>' +
          '<div><div class="bold" style="font-size:15px">' + UI.esc(a.profile.name || '未命名') + '</div>' +
          '<div class="small muted">' + UI.esc(a.profile.event || '专项未填写') + '</div></div></div>' +
          (isActive ? '<span class="pill teal">当前</span>' : '') + '</div>' +
          '<div class="mini-row">🏃 训练 ' + counts.training + ' 次 · 😴 睡眠 ' + counts.sleep + ' 晚 · ❤️ 晨脉 ' + counts.rhr + ' 天</div>' +
          '<div class="mini-row">📏 围度 ' + counts.body + ' 次 · ⚡ 力速 ' + counts.fv + ' · 🦘 RSI ' + counts.rsi + ' · 🗓️ 计划 ' + counts.plans + '</div>' +
          '<div class="mini-row muted">' + (a.profile.birth ? '出生 ' + UI.esc(a.profile.birth) + ' · ' : '') +
          (a.profile.height ? '身高 ' + a.profile.height + ' cm · ' : '') + (a.profile.weight ? '体重 ' + a.profile.weight + ' kg' : '') + '</div>' +
          '<div class="row" style="margin-top:12px">' +
          (!isActive ? '<button class="btn btn-sm btn-accent" data-act="set" data-id="' + UI.esc(a.id) + '">设为当前</button>' : '') +
          '<button class="btn btn-sm" data-act="edit" data-id="' + UI.esc(a.id) + '">编辑档案</button>' +
          (athletes.length > 1 ? '<button class="btn btn-sm btn-danger" data-act="del" data-id="' + UI.esc(a.id) + '">删除</button>' : '') +
          '</div></div>';
      }).join('') + '</div>' : '<div class="empty"><div class="big">👥</div>还没有运动员，点击右上角“新增运动员”开始。</div>') +
      '<div class="card" style="margin-top:16px"><div class="card-head"><h3>📌 当前视图说明</h3></div>' +
      '<div class="small" style="line-height:1.9">总览、日历、各记录页、分析与 PDF 报告始终显示「当前运动员」的数据；切换后会自动加载对应运动员的内容。删除运动员会连同其全部记录一起删除，请谨慎操作。</div></div>';
    el.innerHTML = html;

    document.getElementById('addAthlete').onclick = function () { openAthleteForm(null); };
    el.querySelectorAll('[data-act="set"]').forEach(function (b) {
      b.onclick = function () {
        Store.setActiveAthlete(b.dataset.id);
        UI.toast('已切换到当前运动员', 'ok');
      };
    });
    el.querySelectorAll('[data-act="edit"]').forEach(function (b) {
      b.onclick = function () {
        const id = b.dataset.id;
        if (Store.state.activeAthleteId !== id) Store.setActiveAthlete(id);
        Views.openProfile();
      };
    });
    el.querySelectorAll('[data-act="del"]').forEach(function (b) {
      b.onclick = function () {
        const id = b.dataset.id;
        const ath = Store.state.athletes.find(function (a) { return a.id === id; });
        const name = ath && ath.profile.name || '该运动员';
        UI.confirm('删除「' + name + '」？其全部训练与监控数据将一并删除，无法恢复。', function () {
          Store.removeAthlete(id);
          UI.toast('运动员已删除', 'ok');
        });
      };
    });
  };

  function openAthleteForm(ath) {
    const p = ath ? ath.profile : {};
    const m = UI.modal({
      title: ath ? '编辑运动员' : '新增运动员',
      wide: true,
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>姓名 *</label><input id="at-name" value="' + UI.esc(p.name || '') + '" placeholder="运动员姓名"></div>' +
        '<div class="field"><label>专项 / 主项</label><input id="at-event" value="' + UI.esc(p.event || '') + '" placeholder="如 短跑 100m/200m"></div>' +
        '<div class="field"><label>性别</label><select id="at-sex"><option>男</option><option' + (p.sex === '女' ? ' selected' : '') + '>女</option></select></div>' +
        '<div class="field"><label>出生日期</label><input id="at-birth" type="date" value="' + UI.esc(p.birth || '') + '"></div>' +
        '<div class="field"><label>身高 (cm)</label><input id="at-height" type="number" step="0.5" value="' + UI.esc(p.height || '') + '"></div>' +
        '<div class="field"><label>体重 (kg)</label><input id="at-weight" type="number" step="0.1" value="' + UI.esc(p.weight || '') + '"></div>' +
        '<div class="field"><label>队伍 / 学校</label><input id="at-team" value="' + UI.esc(p.team || '') + '"></div>' +
        '<div class="field"><label>教练</label><input id="at-coach" value="' + UI.esc(p.coach || '') + '"></div>' +
        '<div class="field full"><label>备注</label><textarea id="at-note" rows="2">' + UI.esc(p.note || '') + '</textarea></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id).value.trim(); };
          const name = q('#at-name');
          if (!name) { UI.toast('请填写运动员姓名', 'err'); return; }
          const data = {
            name: name, event: q('#at-event'), sex: body.querySelector('#at-sex').value,
            birth: q('#at-birth'), height: +q('#at-height') || null, weight: +q('#at-weight') || null,
            team: q('#at-team'), coach: q('#at-coach'), note: body.querySelector('#at-note').value.trim(),
            pbs: (ath ? ath.profile.pbs || {} : {})
          };
          if (ath) {
            if (Store.state.activeAthleteId !== ath.id) Store.setActiveAthlete(ath.id);
            Store.state.profile = Object.assign({}, Store.state.profile, data);
            Store.changed();
            UI.toast('档案已保存', 'ok');
          } else {
            const created = Store.addAthlete(data);
            Store.state.profile = Object.assign({}, Store.state.profile, data);
            Store.changed();
            UI.toast('已新增「' + name + '」并切换为当前运动员', 'ok');
          }
          m.close();
        };
      }
    });
  }

  /* ========================= 总览 ========================= */
  Views.renderers.dashboard = function (el) {
    const state = S();
    const series = Analytics.dailySeries(state, 14);
    const sleepRecs = series.map(function (d) { return d.sleep; }).filter(Boolean);
    const rhrRecs = series.map(function (d) { return d.rhr; }).filter(Boolean);
    const d7Start = Store.dstr(Store.addDays(new Date(), -6));
    const training7 = state.training.filter(function (t) { return t.date >= d7Start && t.date <= Store.today(); });
    const lastSleep = sleepRecs[sleepRecs.length - 1] || null;
    const rhrAscAll = Analytics.sortAscByDate(state.rhr);
    const lastRhr = rhrAscAll[rhrAscAll.length - 1] || null;
    const rhrAlert = lastRhr ? Analytics.rhrAlert(state, lastRhr) : null;
    const bodyDesc = Analytics.sortDescByDate(state.body);
    const lastBody = bodyDesc[0] || null;
    const prevBody = bodyDesc[1] || null;

    const sleepStat = Analytics.stats(series.slice(-7).map(function (d) { return d.sleep ? Analytics.sleepDuration(d.sleep) : null; }).filter(function (v) { return v !== null; }));
    const rhr7 = rhrAscAll.slice(-7).map(function (r) { return r.bpm; });
    const load7 = training7.reduce(function (a, t) { return a + (t.load || 0); }, 0);
    const dur7 = training7.reduce(function (a, t) { return a + (t.durationMin || 0); }, 0);

    const idx = Analytics.indexByDate(state);
    const todayData = idx[Store.today()] || {};
    const alerts = [];
    if (!state.profile || !state.profile.name) {
      alerts.push('<div class="alert info">👤 欢迎使用！当前还没有运动员档案，建议先填写姓名、专项、身高与体重，再开始记录数据。 <button class="btn btn-sm btn-ghost" id="dashProfile" style="margin-left:6px">完善档案</button></div>');
    }
    const todayPlan = (todayData.plan || [])[0];
    if (todayPlan && !todayPlan.done) {
      alerts.push('<div class="alert info">🗓️ 今日有训练计划《' + esc(todayPlan.planName) + '》：' + esc(todayPlan.title || '训练') + '。可在「训练计划」中标记完成或转为训练日志。</div>');
    }
    const health = Analytics.healthAnalysis(state);

    const recent = [];
    for (let i = 0; i < 6; i++) {
      const d = Store.dstr(Store.addDays(new Date(), -i));
      if (idx[d]) {
        Object.keys(idx[d]).forEach(function (k) {
          idx[d][k].forEach(function (r) {
            recent.push({ date: d, kind: k, rec: r });
          });
        });
      }
    }
    recent.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });

    const rhrStats = Analytics.stats(rhrRecs.map(function (r) { return r.bpm; }));
    let bodyDelta = '';
    if (lastBody && prevBody && lastBody.weight !== null && prevBody.weight !== null) {
      const d = lastBody.weight - prevBody.weight;
      bodyDelta = deltaHtml(lastBody.weight, prevBody.weight, 'kg');
    }

    el.innerHTML =
      '<div class="grid g-stats" style="margin-bottom:14px">' +
    statCard('近 7 天平均睡眠', fmtNum(sleepStat.mean, 1) + ' <small>h/晚</small>',
        '共 ' + sleepStat.n + ' 晚有效记录 · 目标 ' + fmtNum(state.settings.sleepGoalH) + ' h', 'accent-teal') +
      statCard('今日晨脉', (lastRhr ? lastRhr.bpm + ' <small>bpm</small>' : '—'),
        rhrAlert ? '7 日基线 ' + fmtNum(rhrAlert.base) + ' bpm · ' + (rhrAlert.delta >= 0 ? '+' : '') + fmtNum(rhrAlert.delta) + ' bpm' : '暂无基线', 'accent-left') +
      statCard('近 7 天训练', training7.length + ' <small>次</small> · ' + fmtNum(dur7, 0) + ' <small>min</small>',
        '训练负荷 ' + fmtNum(load7, 1) + ' AU', 'accent-green') +
      statCard('最近体重', (lastBody && lastBody.weight ? fmtNum(lastBody.weight) + ' <small>kg</small>' : '—'),
        '较上次 ' + bodyDelta, 'accent-amber') +
      '</div>' +
      (alerts.length ? '<div class="grid" style="margin-bottom:14px">' + alerts.join('') + '</div>' : '') +
      Views.healthCardHtml(health) +
      '<div class="grid g-2" style="margin-bottom:14px">' +
      '<div class="card"><div class="card-head"><h3>😴 最近 14 天睡眠时长</h3></div><div class="chart-box" id="dashSleepChart"></div></div>' +
      '<div class="card"><div class="card-head"><h3>❤️ 最近 14 天静息心率</h3></div><div class="chart-box" id="dashRhrChart"></div></div>' +
      '</div>' +
      '<div class="grid g-2">' +
      '<div class="card"><div class="card-head"><h3>📋 最近记录</h3></div><div class="recent-list">' +
      (recent.length ? recent.slice(0, 9).map(function (r) {
        const icon = { sleep: '😴', rhr: '❤️', training: '🏃', body: '📏', fv: '🔬', rsi: '🦘', plan: '🗓️' }[r.kind] || '•';
        const color = { sleep: '#ede9fb', rhr: '#fde7ea', training: '#e6f0fb', body: '#fdeeda', fv: '#e3f5f3', rsi: '#e0f3e5', plan: '#e3f3e8' }[r.kind] || '#f0f2f6';
        let main = '';
        if (r.kind === 'sleep') main = '睡眠 ' + fmtNum(Analytics.sleepDuration(r.rec)) + 'h（质量 ' + (r.rec.quality || '—') + '/5）';
        else if (r.kind === 'rhr') main = '静息心率 ' + r.rec.bpm + ' bpm';
        else if (r.kind === 'training') main = '[' + esc(r.rec.category) + '] ' + esc(r.rec.theme || '训练课') + ' · RPE ' + (r.rec.rpe || '—');
        else if (r.kind === 'body') main = '体重 ' + fmtNum(r.rec.weight) + ' kg' + (r.rec.waist ? ' · 腰围 ' + fmtNum(r.rec.waist) + ' cm' : '');
        else if (r.kind === 'fv') main = '力速测试：' + esc(r.rec.name || '');
        else if (r.kind === 'rsi') main = 'RSI 测试：' + esc(r.rec.name || '');
        else if (r.kind === 'plan') main = '计划：' + esc(r.rec.title || '') + (r.rec.done ? '（已完成）' : '');
        return '<div class="recent-item"><div class="ic" style="background:' + color + '">' + icon + '</div>' +
          '<div class="date">' + UI.shortDate(r.date) + '</div><div class="main">' + main + '</div></div>';
      }).join('') : '<div class="empty"><div class="big">📭</div>还没有记录，从上方「快速记录」开始吧。</div>') +
      '</div></div>' +
      '<div class="card"><div class="card-head"><h3>📈 近 6 周训练时长（分钟）</h3></div><div class="chart-box" id="dashLoadChart"></div></div>' +
      '</div>';

    // 睡眠图
    const ch = document.getElementById('dashSleepChart');
    Charts.line(ch, {
      labels: series.map(function (d) { return UI.shortDate(d.date); }),
      series: [{ name: '睡眠时长 (h)', color: '#0ea5a4', data: series.map(function (d) { return d.sleep ? Analytics.sleepDuration(d.sleep) : null; }), area: true }],
      yLabel: 'h', goal: { value: state.settings.sleepGoalH || 8, label: '目标' }, xAxis: false, height: 200,
      emptyText: '暂无睡眠记录'
    });
    const ch2 = document.getElementById('dashRhrChart');
    const base7 = series.map(function (d) { return d.rhr ? d.rhr.bpm : null; });
    Charts.line(ch2, {
      labels: series.map(function (d) { return UI.shortDate(d.date); }),
      series: [{ name: '晨脉 (bpm)', color: '#e25563', data: base7, points: true }],
      yLabel: 'bpm', height: 200, emptyText: '暂无静息心率记录'
    });
    // 周训练图
    const weeks = [];
    for (let w = 5; w >= 0; w--) {
      const start = Analytics.monday(Store.addDays(new Date(), -w * 7 - 6));
      const end = Store.addDays(start, 6);
      const list = state.training.filter(function (t) { return t.date >= Store.dstr(start) && t.date <= Store.dstr(end); });
      weeks.push({ label: UI.shortDate(Store.dstr(start)), total: list.reduce(function (a, t) { return a + (t.durationMin || 0); }, 0), n: list.length });
    }
    const ch3 = document.getElementById('dashLoadChart');
    Charts.bar(ch3, {
      labels: weeks.map(function (w) { return w.label; }),
      series: [{ name: '总时长 (min)', color: '#1b6ab0', data: weeks.map(function (w) { return w.total; }) }],
      yLabel: 'min', height: 200, showValues: false, legend: false,
      emptyText: '暂无训练记录'
    });
    const dashProfileBtn = document.getElementById('dashProfile');
    if (dashProfileBtn) dashProfileBtn.onclick = function () { Views.openProfile(); };
    Views.bindHealthNotify(el);
  };

  /* ========================= 通用记录行 & 删除 ========================= */
  function deleteRecord(coll, id, msg) {
    UI.confirm(msg || '确定删除这条记录吗？删除后不可恢复。', function () {
      Store.remove(coll, id);
      UI.toast('已删除', 'ok');
    });
  }

  /* ========================= 睡眠记录 ========================= */
  Views.renderers.sleep = function (el) {
    const state = S();
    const range = Views.sleepRange || 30;
    const start = Store.dstr(Store.addDays(new Date(), -range + 1));
    let list = Analytics.sortDescByDate(state.sleep).filter(function (r) { return range === 0 || r.date >= start; });
    const stats = Analytics.stats(list.map(function (r) { return Analytics.sleepDuration(r); }));
    const qs = Analytics.stats(list.map(function (r) { return r.quality; }));
    const asc = Analytics.sortAscByDate(list);

    el.innerHTML =
      '<div class="toolbar"><div class="seg" id="sleepRangeSeg">' +
      [[7, '7 天'], [30, '30 天'], [90, '90 天'], [0, '全部']].map(function (x) {
        return '<button data-r="' + x[0] + '" class="' + (range === x[0] ? 'active' : '') + '">' + x[1] + '</button>';
      }).join('') +
      '</div><div class="spacer"></div><button class="btn btn-primary" id="addSleep">＋ 记录睡眠</button></div>' +
      '<div class="grid g-stats" style="margin-bottom:14px">' +
      statCard('平均睡眠时长', fmtNum(stats.mean, 2) + ' <small>h</small>', '共 ' + stats.n + ' 条记录 · 目标 ' + fmtNum(state.settings.sleepGoalH) + ' h', 'accent-teal') +
      statCard('平均质量', fmtNum(qs.mean, 1) + ' <small>/ 5</small>', '范围 ' + (qs.min || '—') + '–' + (qs.max || '—'), 'accent-amber') +
      statCard('最近一晚', list.length ? fmtNum(Analytics.sleepDuration(list[0]), 2) + ' <small>h</small>' : '—',
        list.length ? UI.dateCN(list[0].date) + ' · 质量 ' + (list[0].quality || '—') : '暂无', 'accent-green') +
      '</div>' +
      '<div class="grid g-2" style="margin-bottom:14px">' +
      '<div class="card"><div class="card-head"><h3>😴 时长趋势</h3></div><div class="chart-box" id="sleepDurChart"></div></div>' +
      '<div class="card"><div class="card-head"><h3>⭐ 睡眠质量</h3></div><div class="chart-box" id="sleepQualityChart"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>记录列表</h3></div>' +
      (list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>日期</th><th>入睡</th><th>起床</th><th class="num">时长 (h)</th><th class="num">醒来</th><th class="num">质量</th><th>备注</th><th></th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr data-id="' + esc(r.id) + '"><td>' + UI.dateCN(r.date, true) + '</td><td class="mono">' + esc(r.bed) + '</td><td class="mono">' + esc(r.wake) + '</td>' +
            '<td class="num mono">' + fmtNum(Analytics.sleepDuration(r), 2) + '</td><td class="num">' + (r.wakeups || 0) + '</td><td class="num">' + (r.quality || '—') + '/5</td>' +
            '<td class="small">' + esc(r.note || '') + '</td>' +
            '<td class="actions"><button class="icon-btn" data-edit="' + esc(r.id) + '" title="编辑">✏️</button> <button class="icon-btn" data-del="' + esc(r.id) + '" title="删除">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="empty"><div class="big">😴</div>暂无睡眠记录</div>') + '</div>';

    const durSeries = asc.map(function (r) { return { d: r.date, v: Analytics.sleepDuration(r) }; });
    Charts.line(document.getElementById('sleepDurChart'), {
      labels: durSeries.map(function (x) { return UI.shortDate(x.d); }),
      series: [{ name: '时长 (h)', color: '#0ea5a4', data: durSeries.map(function (x) { return x.v; }), area: true }],
      yLabel: 'h', goal: { value: state.settings.sleepGoalH || 8, label: '目标' }, height: 200, emptyText: '暂无数据'
    });
    const qSeries = asc.map(function (r) { return { d: r.date, v: r.quality }; });
    Charts.bar(document.getElementById('sleepQualityChart'), {
      labels: qSeries.map(function (x) { return UI.shortDate(x.d); }),
      series: [{ name: '质量 (1-5)', color: '#f2a03d', data: qSeries.map(function (x) { return x.v; }) }],
      yLabel: '分', height: 200, showValues: false, emptyText: '暂无数据'
    });

    document.getElementById('sleepRangeSeg').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (b) { Views.sleepRange = +b.dataset.r; Views.render('sleep'); }
    });
    document.getElementById('addSleep').onclick = function () { openSleepForm(null); };
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { deleteRecord('sleep', b.dataset.del, '删除这条睡眠记录？'); };
    });
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        const rec = state.sleep.find(function (x) { return x.id === b.dataset.edit; });
        rec && openSleepForm(rec);
      };
    });
  };

  function openSleepForm(rec) {
    const m = UI.modal({
      title: rec ? '编辑睡眠记录' : '记录睡眠',
      body:
        '<div class="form-grid">' +
        '<div class="field full"><label>日期</label><input id="sl-date" type="date" value="' + esc(rec ? rec.date : Store.today()) + '"></div>' +
        '<div class="field"><label>入睡时间</label><input id="sl-bed" type="time" value="' + esc(rec ? rec.bed : '23:00') + '"></div>' +
        '<div class="field"><label>起床时间</label><input id="sl-wake" type="time" value="' + esc(rec ? rec.wake : '07:00') + '"></div>' +
        '<div class="field"><label>夜间醒来次数</label><input id="sl-wakeups" type="number" min="0" max="8" value="' + (rec ? (rec.wakeups || 0) : 0) + '"></div>' +
        '<div class="field"><label>睡眠质量（1-5）</label><select id="sl-quality">' +
        [1, 2, 3, 4, 5].map(function (q) { return '<option value="' + q + '"' + ((rec ? rec.quality : 4) === q ? ' selected' : '') + '>' + q + ' 分</option>'; }).join('') +
        '</select></div>' +
        '<div class="field full"><label>备注 / 醒后状态</label><input id="sl-note" placeholder="如：训练后晚睡、感觉疲劳" value="' + esc(rec ? rec.note : '') + '"></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body, wrap) {
        const save = function () {
          const val = function (id) { return body.querySelector(id); };
          const data = {
            date: val('#sl-date').value,
            bed: val('#sl-bed').value,
            wake: val('#sl-wake').value,
            wakeups: +val('#sl-wakeups').value || 0,
            quality: +val('#sl-quality').value,
            note: val('#sl-note').value.trim()
          };
          if (!data.date || !data.bed || !data.wake) { UI.toast('请填写日期与时间', 'err'); return; }
          data.duration = Analytics.sleepDuration(data);
          if (rec) Store.update('sleep', rec.id, data); else Store.add('sleep', data);
          UI.toast('睡眠记录已保存', 'ok');
          m.close();
        };
        body.querySelector('[data-save]').onclick = save;
      }
    });
  }

  /* ========================= 静息心率 ========================= */
  Views.renderers.heart = function (el) {
    const state = S();
    const list = Analytics.sortDescByDate(state.rhr);
    const asc = Analytics.sortAscByDate(list);
    const latest = list[0] || null;
    const alert = latest ? Analytics.rhrAlert(state, latest) : null;
    const week = asc.slice(-7).map(function (r) { return r.bpm; });
    const month = asc.slice(-30).map(function (r) { return r.bpm; });
    const base7 = asc.map(function (r, i, arr) {
      const win = arr.slice(Math.max(0, i - 6), i + 1).map(function (x) { return x.bpm; });
      return Analytics.mean(win);
    });

    el.innerHTML =
      Views.healthCardHtml(Analytics.healthAnalysis(state)) +
      '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" id="addRhr">＋ 记录晨脉</button></div>' +
      '<div class="grid g-stats" style="margin-bottom:14px">' +
      statCard('最新晨脉', (latest ? latest.bpm + ' <small>bpm</small>' : '—'),
        latest ? UI.dateCN(latest.date, true) : '', (alert && alert.alert ? 'accent-amber' : 'accent-green')) +
      statCard('近 7 天平均', fmtNum(Analytics.mean(week), 1) + ' <small>bpm</small>', '共 ' + week.length + ' 天', 'accent-left') +
      statCard('近 30 天平均', fmtNum(Analytics.mean(month), 1) + ' <small>bpm</small>', '共 ' + month.length + ' 天', 'accent-teal') +
      statCard('相对基线', alert ? (alert.delta >= 0 ? '+' : '') + fmtNum(alert.delta, 1) + ' <small>bpm</small>' : '—',
        alert ? '基线 ' + fmtNum(alert.base, 1) + ' bpm（近 7 天）' : '数据不足', (alert && alert.alert ? 'accent-amber' : 'accent-green')) +
      '</div>' +
      (alert && alert.alert ?
        '<div class="alert danger" style="margin-bottom:14px">⚠️ 最新晨脉高于近 7 天基线 ' + fmtNum(alert.delta) + ' bpm。连续多日偏高可能提示恢复不足 / 疲劳或潜在健康问题，请结合睡眠与训练负荷评估。</div>' : '') +
      '<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>❤️ 静息心率趋势（最近 ' + asc.length + ' 天）</h3>' +
      '<span class="small muted">虚线：7 天滚动基线</span></div><div class="chart-box" id="rhrChart"></div></div>' +
      '<div class="card"><div class="card-head"><h3>记录列表</h3></div>' +
      (list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>日期</th><th class="num">晨脉 (bpm)</th><th>相对 7 日基线</th><th>备注</th><th></th></tr></thead><tbody>' +
        list.slice(0, 120).map(function (r) {
          const a = Analytics.rhrAlert(state, r);
          const delta = a ? a.delta : null;
          const bad = a && a.alert;
          return '<tr><td>' + UI.dateCN(r.date, true) + '</td><td class="num mono bold">' + r.bpm + '</td>' +
            '<td>' + (delta === null ? '<span class="muted">—</span>' : '<span class="pill ' + (bad ? 'red' : (delta > 0 ? 'amber' : 'green')) + '">' + (delta >= 0 ? '+' : '') + fmtNum(delta, 1) + ' bpm</span>') + '</td>' +
            '<td class="small">' + esc(r.note || '') + '</td>' +
            '<td class="actions"><button class="icon-btn" data-edit="' + esc(r.id) + '">✏️</button> <button class="icon-btn" data-del="' + esc(r.id) + '">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="empty"><div class="big">❤️</div>暂无静息心率记录</div>') + '</div>';

    Charts.line(document.getElementById('rhrChart'), {
      labels: asc.map(function (r) { return UI.shortDate(r.date); }),
      series: [
        { name: '晨脉', color: '#e25563', data: asc.map(function (r) { return r.bpm; }) },
        { name: '7 天基线', color: '#1b6ab0', data: base7, dash: [5, 4], width: 1.5 }
      ],
      yLabel: 'bpm', height: 250, emptyText: '暂无数据'
    });

    document.getElementById('addRhr').onclick = function () { openRhrForm(null); };
    Views.bindHealthNotify(el);
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { deleteRecord('rhr', b.dataset.del, '删除这条静息心率记录？'); };
    });
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        const rec = state.rhr.find(function (x) { return x.id === b.dataset.edit; });
        rec && openRhrForm(rec);
      };
    });
  };

  function openRhrForm(rec) {
    const m = UI.modal({
      title: rec ? '编辑静息心率' : '记录静息心率',
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>日期</label><input id="hr-date" type="date" value="' + esc(rec ? rec.date : Store.today()) + '"></div>' +
        '<div class="field"><label>晨脉（bpm）</label><input id="hr-bpm" type="number" min="25" max="120" step="1" value="' + (rec ? rec.bpm : '') + '" placeholder="如 52"></div>' +
        '<div class="field full"><label>备注</label><input id="hr-note" placeholder="如：昨晚训练量大 / 睡眠不足" value="' + esc(rec ? rec.note : '') + '"></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const date = body.querySelector('#hr-date').value;
          const bpm = +body.querySelector('#hr-bpm').value;
          const note = body.querySelector('#hr-note').value.trim();
          if (!date || !bpm || bpm < 25 || bpm > 200) { UI.toast('请填写有效的日期与心率', 'err'); return; }
          const data = { date: date, bpm: Math.round(bpm), note: note };
          if (rec) Store.update('rhr', rec.id, data); else Store.add('rhr', data);
          const a = Analytics.rhrAlert(Store.state, data);
          if (a && a.alert) UI.toast('已保存。注意：该值高于 7 日基线 ' + fmtNum(a.delta) + ' bpm', 'ok');
          else UI.toast('晨脉已保存', 'ok');
          m.close();
        };
      }
    });
  }

  /* ========================= 身体围度 ========================= */
  Views.renderers.body = function (el) {
    const state = S();
    const list = Analytics.sortDescByDate(state.body);
    const asc = Analytics.sortAscByDate(list);
    const latest = list[0] || null;
    const prev = list[1] || null;

    el.innerHTML =
      '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" id="addBody">＋ 记录围度</button></div>' +
      '<div class="grid g-stats" style="margin-bottom:14px">' +
      statCard('体重', latest && latest.weight ? fmtNum(latest.weight) + ' <small>kg</small>' : '—',
        latest ? '较上次 ' + (prev && latest.weight !== null && prev.weight !== null ? deltaHtml(latest.weight, prev.weight, 'kg') : '—') : '尚无记录', 'accent-amber') +
      statCard('腰围', latest && latest.waist ? fmtNum(latest.waist) + ' <small>cm</small>' : '—',
        '较上次 ' + (prev && latest.waist && prev.waist ? deltaHtml(latest.waist, prev.waist, 'cm') : '—'), 'accent-left') +
      statCard('体脂率', latest && latest.bodyFat ? fmtNum(latest.bodyFat) + ' <small>%</small>' : '—',
        '较上次 ' + (prev && latest.bodyFat && prev.bodyFat ? deltaHtml(latest.bodyFat, prev.bodyFat, '%') : '—'), 'accent-green') +
      statCard('体测次数', list.length + ' <small>次</small>', '最近 ' + (latest ? UI.dateCN(latest.date, true) : '—'), 'accent-teal') +
      '</div>' +
      '<div class="grid g-2" style="margin-bottom:14px">' +
      '<div class="card"><div class="card-head"><h3>⚖️ 体重趋势</h3></div><div class="chart-box" id="bodyWeightChart"></div></div>' +
      '<div class="card"><div class="card-head"><h3>📏 围度趋势</h3><select id="bodyMetricSel" style="border:1px solid #d5deea;border-radius:7px;padding:4px 8px;font-size:12px">' +
      [['waist', '腰围'], ['bodyFat', '体脂率 (%)'], ['chest', '胸围'], ['hip', '臀围'], ['thighL', '左大腿'], ['thighR', '右大腿'], ['calfL', '左小腿'], ['calfR', '右小腿'], ['armL', '左上臂'], ['armR', '右上臂'], ['shoulder', '肩宽'], ['neck', '颈围']].map(function (x) {
        return '<option value="' + x[0] + '"' + (x[0] === 'waist' ? ' selected' : '') + '>' + x[1] + '</option>';
      }).join('') + '</select></div><div class="chart-box" id="bodyCircChart"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>围度记录</h3></div>' +
      (list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>日期</th><th class="num">体重</th><th class="num">体脂 (%)</th><th class="num">颈</th><th class="num">肩</th><th class="num">胸</th><th class="num">腰</th><th class="num">臀</th><th class="num">左大腿</th><th class="num">右大腿</th><th class="num">左小腿</th><th class="num">右小腿</th><th class="num">左上臂</th><th class="num">右上臂</th><th></th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr><td>' + UI.dateCN(r.date, true) + '</td>' +
            ['weight', 'bodyFat', 'neck', 'shoulder', 'chest', 'waist', 'hip', 'thighL', 'thighR', 'calfL', 'calfR', 'armL', 'armR'].map(function (k) {
              return '<td class="num mono">' + (r[k] !== null && r[k] !== undefined ? fmtNum(r[k]) : '—') + '</td>';
            }).join('') +
            '<td class="actions"><button class="icon-btn" data-edit="' + esc(r.id) + '">✏️</button> <button class="icon-btn" data-del="' + esc(r.id) + '">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="empty"><div class="big">📏</div>暂无身体围度记录</div>') + '</div>';

    Charts.line(document.getElementById('bodyWeightChart'), {
      labels: asc.map(function (r) { return UI.shortDate(r.date); }),
      series: [{ name: '体重 (kg)', color: '#d97706', data: asc.map(function (r) { return r.weight; }), area: true }],
      yLabel: 'kg', height: 220, emptyText: '暂无数据'
    });
    function drawCirc() {
      const sel = document.getElementById('bodyMetricSel');
      if (!sel) return;
      const k = sel.value;
      const label = sel.options[sel.selectedIndex].text;
      const isPct = k === 'bodyFat';
      Charts.line(document.getElementById('bodyCircChart'), {
        labels: asc.map(function (r) { return UI.shortDate(r.date); }),
        series: [{ name: label, color: '#0ea5a4', data: asc.map(function (r) { return r[k]; }), area: true }],
        yLabel: isPct ? '%' : 'cm', height: 220, emptyText: '暂无该数据'
      });
    }
    drawCirc();
    const selEl = document.getElementById('bodyMetricSel');
    if (selEl) selEl.onchange = drawCirc;

    document.getElementById('addBody').onclick = function () { openBodyForm(null); };
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { deleteRecord('body', b.dataset.del, '删除这条围度记录？'); };
    });
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        const rec = state.body.find(function (x) { return x.id === b.dataset.edit; });
        rec && openBodyForm(rec);
      };
    });
  };

  const BODY_FIELDS = [
    ['weight', '体重 (kg)'], ['bodyFat', '体脂率 (%)'], ['neck', '颈围 (cm)'], ['shoulder', '肩宽 (cm)'], ['chest', '胸围 (cm)'],
    ['waist', '腰围 (cm)'], ['hip', '臀围 (cm)'], ['thighL', '左大腿 (cm)'], ['thighR', '右大腿 (cm)'],
    ['calfL', '左小腿 (cm)'], ['calfR', '右小腿 (cm)'], ['armL', '左上臂 (cm)'], ['armR', '右上臂 (cm)']
  ];
  function openBodyForm(rec) {
    const m = UI.modal({
      title: rec ? '编辑身体围度' : '记录身体围度',
      wide: true,
      body:
        '<div class="field" style="margin-bottom:10px"><label>测量日期</label><input id="bd-date" type="date" value="' + esc(rec ? rec.date : Store.today()) + '"></div>' +
        '<div class="form-grid" id="bdGrid">' +
        BODY_FIELDS.map(function (f) {
          const v = rec && rec[f[0]] !== null && rec[f[0]] !== undefined ? rec[f[0]] : '';
          return '<div class="field"><label>' + f[1] + '</label><input id="bd-' + f[0] + '" type="number" step="0.1" value="' + esc(v) + '" placeholder="选填"></div>';
        }).join('') +
        '<div class="field full"><label>备注</label><input id="bd-note" placeholder="如：晨起空腹测量 / 训练后测量" value="' + esc(rec ? rec.note : '') + '"></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const date = body.querySelector('#bd-date').value;
          if (!date) { UI.toast('请选择日期', 'err'); return; }
          const data = { date: date, note: body.querySelector('#bd-note').value.trim() };
          BODY_FIELDS.forEach(function (f) {
            const el2 = body.querySelector('#bd-' + f[0]);
            const v = el2.value === '' ? null : +el2.value;
            data[f[0]] = (v !== null && isFinite(v)) ? +v.toFixed(1) : null;
          });
          if (rec) Store.update('body', rec.id, data); else Store.add('body', data);
          UI.toast('围度记录已保存', 'ok');
          m.close();
        };
      }
    });
  }

  /* ========================= 专项训练 ========================= */
  Views.renderers.training = function (el) {
    const state = S();
    const range = Views.trainingRange || 30;
    const cat = Views.trainingCat || '';
    const start = Store.dstr(Store.addDays(new Date(), -range + 1));
    let list = Analytics.sortDescByDate(state.training).filter(function (t) { return range === 0 || t.date >= start; });
    if (cat) list = list.filter(function (t) { return t.category === cat; });
    const total = list.length;
    const durTotal = list.reduce(function (a, t) { return a + (t.durationMin || 0); }, 0);
    const distTotal = list.reduce(function (a, t) { return a + (t.distance || 0); }, 0);
    const loadTotal = list.reduce(function (a, t) { return a + (t.load || 0); }, 0);
    const rpeMean = Analytics.mean(list.map(function (t) { return t.rpe; }));
    const catCount = {};
    list.forEach(function (t) { catCount[t.category] = (catCount[t.category] || 0) + 1; });
    const catHtml = Object.keys(catCount).slice(0, 6).map(function (c) {
      return '<span class="pill ' + (c === cat ? 'blue' : 'gray') + '">' + esc(c) + ' ×' + catCount[c] + '</span>';
    }).join(' ');

    // 周负荷
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const s = Analytics.monday(Store.addDays(new Date(), -w * 7 - 6));
      const e = Store.addDays(s, 6);
      const ss = Store.dstr(s), ee = Store.dstr(e);
      const inWeek = state.training.filter(function (t) { return t.date >= ss && t.date <= ee; });
      const load = inWeek.reduce(function (a, t) { return a + (t.load || 0); }, 0);
      const dur = inWeek.reduce(function (a, t) { return a + (t.durationMin || 0); }, 0);
      weeks.push({ label: UI.shortDate(ss), load: +load.toFixed(1), dur: dur });
    }

    el.innerHTML =
      '<div class="toolbar"><div class="seg" id="trRangeSeg">' +
      [[7, '7 天'], [30, '30 天'], [90, '90 天'], [0, '全部']].map(function (x) {
        return '<button data-r="' + x[0] + '" class="' + (range === x[0] ? 'active' : '') + '">' + x[1] + '</button>';
      }).join('') + '</div>' +
      '<select id="trCatSel" style="border:1px solid #d5deea;border-radius:8px;padding:6px 10px;background:#fff">' +
      '<option value="">全部类别</option>' + Store.trainingCats.map(function (c) { return '<option' + (cat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select>' +
      '<div class="spacer"></div><button class="btn btn-primary" id="addTraining">＋ 记录训练</button></div>' +
      '<div class="grid g-stats" style="margin-bottom:14px">' +
      statCard('训练次数', total + ' <small>次</small>', catHtml || '全部类别', 'accent-left') +
      statCard('总时长', fmtNum(durTotal, 0) + ' <small>min</small>', '平均 ' + fmtNum(total ? durTotal / total : 0, 0) + ' min/次', 'accent-teal') +
      statCard('总跑动距离', distTotal ? fmtNum(distTotal, 0) + ' <small>m</small>' : '—', '有距离记录的部分训练', 'accent-amber') +
      statCard('训练负荷', fmtNum(loadTotal, 1) + ' <small>AU</small>', 'RPE×时长 估算 · 平均 RPE ' + fmtNum(rpeMean, 1), 'accent-green') +
      '</div>' +
      '<div class="grid g-2" style="margin-bottom:14px">' +
      '<div class="card"><div class="card-head"><h3>⏱️ 周训练负荷（8 周）</h3></div><div class="chart-box" id="trLoadChart"></div></div>' +
      '<div class="card"><div class="card-head"><h3>⏱️ 周训练时长（8 周）</h3></div><div class="chart-box" id="trDurChart"></div></div>' +
      '</div>' +
      '<div class="card"><div class="card-head"><h3>训练日志</h3><span class="small muted">共 ' + list.length + ' 条</span></div>' +
      (list.length ? '<div class="table-wrap"><table class="data"><thead><tr><th>日期</th><th>类别</th><th>主题 / 备注</th><th class="num">时长</th><th class="num">RPE</th><th class="num">负荷</th><th class="num">距离</th><th></th></tr></thead><tbody>' +
        list.slice(0, 200).map(function (t) {
          return '<tr><td class="nowrap">' + UI.dateCN(t.date, true) + '</td><td>' + UI.catPill(t.category) + '</td>' +
            '<td><details style="max-width:360px"><summary>' + esc(t.theme || '') + '</summary><pre class="dd-body" style="font-family:inherit;white-space:pre-wrap;margin:6px 0 2px">' + esc(t.content || '') + '</pre></details></td>' +
            '<td class="num mono">' + (t.durationMin || '—') + '′</td>' +
            '<td class="num">' + (t.rpe !== null && t.rpe !== undefined ? t.rpe : '—') + '</td>' +
            '<td class="num mono">' + fmtNum(t.load, 1) + '</td>' +
            '<td class="num mono">' + (t.distance ? fmtNum(t.distance, 0) + ' m' : '—') + '</td>' +
            '<td class="actions"><button class="icon-btn" data-edit="' + esc(t.id) + '">✏️</button> <button class="icon-btn" data-del="' + esc(t.id) + '">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>' :
        '<div class="empty"><div class="big">🏃</div>该范围内暂无训练记录</div>') + '</div>';

    Charts.bar(document.getElementById('trLoadChart'), {
      labels: weeks.map(function (w) { return w.label; }),
      series: [{ name: '负荷 AU', color: '#1b6ab0', data: weeks.map(function (w) { return w.load; }) }],
      yLabel: 'AU', height: 220, showValues: false, emptyText: '暂无数据'
    });
    Charts.bar(document.getElementById('trDurChart'), {
      labels: weeks.map(function (w) { return w.label; }),
      series: [{ name: '时长 min', color: '#0ea5a4', data: weeks.map(function (w) { return w.dur; }) }],
      yLabel: 'min', height: 220, showValues: false, emptyText: '暂无数据'
    });

    document.getElementById('trRangeSeg').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (b) { Views.trainingRange = +b.dataset.r; Views.render('training'); }
    });
    document.getElementById('trCatSel').onchange = function (e) {
      Views.trainingCat = e.target.value;
      Views.render('training');
    };
    document.getElementById('addTraining').onclick = function () { openTrainingForm(null); };
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () { deleteRecord('training', b.dataset.del, '删除这条训练记录？'); };
    });
    el.querySelectorAll('[data-edit]').forEach(function (b) {
      b.onclick = function () {
        const rec = state.training.find(function (x) { return x.id === b.dataset.edit; });
        rec && openTrainingForm(rec);
      };
    });
  };

  function openTrainingForm(rec, prefillDate) {
    const m = UI.modal({
      title: rec ? '编辑训练' : '记录专项训练',
      wide: true,
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>日期</label><input id="tr-date" type="date" value="' + esc(rec ? rec.date : (prefillDate || Store.today())) + '"></div>' +
        '<div class="field"><label>训练类别</label><select id="tr-cat">' +
        Store.trainingCats.map(function (c) { return '<option' + ((rec ? rec.category : '') === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>主题</label><input id="tr-theme" value="' + esc(rec ? rec.theme : '') + '" placeholder="如：最大速度课 / 起跑技术"></div>' +
        '<div class="field"><label>时长（分钟）</label><input id="tr-dur" type="number" min="0" value="' + (rec && rec.durationMin ? rec.durationMin : '') + '"></div>' +
        '<div class="field"><label>RPE（0-10）</label><input id="tr-rpe" type="number" min="0" max="10" step="1" value="' + (rec && rec.rpe !== null && rec.rpe !== undefined ? rec.rpe : '') + '" placeholder="主观疲劳"></div>' +
        '<div class="field"><label>疲劳感（0-10）</label><input id="tr-fatigue" type="number" min="0" max="10" value="' + (rec && rec.fatigue ? rec.fatigue : '') + '"></div>' +
        '<div class="field"><label>跑动距离合计（m）</label><input id="tr-dist" type="number" min="0" value="' + (rec && rec.distance ? rec.distance : '') + '" placeholder="选填"></div>' +
        '<div class="field full"><label>训练内容（每行一组）</label><textarea id="tr-content" rows="8" placeholder="例：&#10;慢跑热身 15min&#10;栏架灵活度 + 跑的专门性练习&#10;4×50m 技术跑&#10;flying 30m×6（RI=4\', SI=8\'）&#10;卧推 6e 70% → 3e 85%">' + esc(rec ? rec.content : '') + '</textarea></div>' +
        '<div class="field full"><label>备注 / 感觉</label><input id="tr-note" value="' + esc(rec ? rec.notes : '') + '" placeholder="状态、技术要点、伤病提示等"></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id); };
          const date = q('#tr-date').value;
          const dur = +q('#tr-dur').value || 0;
          const rpe = q('#tr-rpe').value === '' ? null : +q('#tr-rpe').value;
          const fatigue = q('#tr-fatigue').value === '' ? null : +q('#tr-fatigue').value;
          if (!date) { UI.toast('请选择日期', 'err'); return; }
          const data = {
            date: date,
            category: q('#tr-cat').value,
            theme: q('#tr-theme').value.trim(),
            durationMin: dur,
            rpe: rpe,
            fatigue: fatigue,
            distance: q('#tr-dist').value === '' ? null : +q('#tr-dist').value,
            content: q('#tr-content').value,
            notes: q('#tr-note').value.trim(),
            load: dur && rpe ? +(dur * rpe / 60).toFixed(1) : 0
          };
          if (rec) Store.update('training', rec.id, data); else Store.add('training', data);
          UI.toast('训练已保存', 'ok');
          m.close();
        };
      }
    });
  }

  /* ========================= 日历回看 ========================= */
  const CAL_COLORS = { sleep: '#6d5bd0', rhr: '#e25563', training: '#1b6ab0', body: '#f2a03d', fv: '#0ea5a4', rsi: '#16a34a', plan: '#7a9a4f' };
  const CAL_LABELS = { sleep: '睡眠', rhr: '静息心率', training: '训练', body: '围度', fv: '力速', rsi: 'RSI', plan: '计划' };
  Views.calCursor = (function () {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  })();
  Views.calSelected = Store.today();

  Views.renderers.calendar = function (el) {
    const state = S();
    const y = Views.calCursor.y, m = Views.calCursor.m;
    const first = new Date(y, m, 1);
    const monthLabel = y + ' 年 ' + (m + 1) + ' 月';
    const idx = Analytics.indexByDate(state);
    const filters = Views.calFilters || { sleep: true, rhr: true, training: true, body: true, fv: true, rsi: true, plan: true };
    const dayStart = (first.getDay() + 6) % 7; // 周一起始
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = Store.today();

    // 月度统计
    let trCount = 0, trLoad = 0, sleepN = 0, sleepSum = 0, rhrN = 0, rhrSum = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const date = Store.dstr(new Date(y, m, d));
      const rec = idx[date] || {};
      (rec.training || []).forEach(function (t) { trCount++; trLoad += t.load || 0; });
      (rec.sleep || []).forEach(function (s) { sleepN++; sleepSum += Analytics.sleepDuration(s) || 0; });
      (rec.rhr || []).forEach(function (r) { rhrN++; rhrSum += r.bpm; });
    }

    let calHtml = '<div class="card" style="margin-bottom:14px"><div class="cal-head">' +
      '<div class="cal-month-nav"><button class="btn btn-sm" id="calPrev">‹ 上月</button><div class="month-label">' + monthLabel + '</div><button class="btn btn-sm" id="calNext">下月 ›</button>' +
      '<button class="btn btn-sm" id="calToday">今天</button></div>' +
      '<div class="cal-legend">' + Object.keys(CAL_COLORS).map(function (k) {
        return '<label style="cursor:pointer"><input type="checkbox" data-f="' + k + '" ' + (filters[k] ? 'checked' : '') + ' style="display:none"><i style="background:' + CAL_COLORS[k] + (filters[k] ? '' : ';opacity:.18') + '"></i>' + CAL_LABELS[k] + '</label>';
      }).join('') + '</div></div>' +
      '<div class="cal-grid" style="margin-top:10px">' + ['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(function (w) {
        return '<div class="cal-dow">' + w + '</div>';
      }).join('') +
      Array(dayStart).fill('<div class="cal-cell other"></div>').join('');

    const sums = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = Store.dstr(new Date(y, m, d));
      const rec = idx[date] || {};
      const cls = ['cal-cell'];
      if (date < today && false) cls.push('past');
      if (date === today) cls.push('today');
      if (date === Views.calSelected) cls.push('selected');
      const dots = Object.keys(filters).filter(function (k) {
        return filters[k] && rec[k] && rec[k].length;
      }).map(function (k) {
        return '<i class="' + k + '" style="background:' + CAL_COLORS[k] + '"></i>';
      }).join('');
      const label = (d % 7 === 0 || d === 1) ? '<b>' + d + '</b>' : d;
      const sumBits = [];
      if (rec.sleep && rec.sleep.length && filters.sleep) sumBits.push('眠 ' + fmtNum(Analytics.mean(rec.sleep.map(function (s) { return Analytics.sleepDuration(s); })), 1) + 'h');
      if (rec.rhr && rec.rhr.length && filters.rhr) sumBits.push('♥ ' + rec.rhr[rec.rhr.length - 1].bpm);
      if (rec.training && rec.training.length && filters.training) sumBits.push('练 ' + rec.training.length + ' 次');
      if (rec.body && rec.body.length && filters.body) sumBits.push('围度');
      const planFlags = (rec.plan || []).filter(function (p) { return filters.plan; });
      const planDone = planFlags.filter(function (p) { return p.done; }).length;
      calHtml += '<div class="' + cls.join(' ') + '" data-date="' + date + '"><div class="cal-date">' + label +
        (planFlags.length ? '<span class="plan-badge ' + (planFlags.length === planDone ? 'done' : '') + '" title="计划 ' + planDone + '/' + planFlags.length + '"></span>' : '') +
        '</div><div class="cal-dots">' + dots + '</div><div class="cal-sum">' + esc(sumBits.join(' · ').slice(0, 30)) + '</div></div>';
      sums.push(date);
    }
    calHtml += '</div></div>';

    // 右侧/底部详情
    const sel = idx[Views.calSelected] || {};
    calHtml += '<div class="grid g-stats" style="margin-bottom:14px">' +
      statCard('本月训练', trCount + ' <small>次</small>', '负荷合计 ' + fmtNum(trLoad, 1) + ' AU', 'accent-left') +
      statCard('本月平均睡眠', sleepN ? fmtNum(sleepSum / sleepN, 1) + ' <small>h</small>' : '—', '记录 ' + sleepN + ' 晚', 'accent-teal') +
      statCard('本月平均晨脉', rhrN ? fmtNum(rhrSum / rhrN, 0) + ' <small>bpm</small>' : '—', '记录 ' + rhrN + ' 天', 'accent-green') +
      statCard('今日安排', (idx[today] && idx[today].plan && idx[today].plan.length ? '有 ' + idx[today].plan.length + ' 项计划' : '无计划'),
        today === Views.calSelected ? '查看下方详情' : '点击今天查看', 'accent-amber') +
      '</div>';

    const dayHtml = Views.calSelected === today ? '<b>今天</b>' : UI.dateCN(Views.calSelected, true);
    const dayTypes = [
      ['sleep', '😴 睡眠', 'sleep'],
      ['rhr', '❤️ 静息心率', 'heart'],
      ['training', '🏃 专项训练', 'training'],
      ['body', '📏 身体围度', 'body'],
      ['fv', '🔬 力速测试', 'fv'],
      ['rsi', '🦘 RSI 测试', 'rsi'],
      ['plan', '🗓️ 训练计划', 'plan']
    ];
    let dayCards = '';
    dayTypes.forEach(function (tp) {
      const items = sel[tp[0]] || [];
      if (!items.length) return;
      items.forEach(function (r) {
        let bodyTxt = '';
        if (tp[0] === 'sleep') bodyTxt = '入睡 ' + r.bed + ' · 起床 ' + r.wake + ' · 时长 ' + fmtNum(Analytics.sleepDuration(r), 2) + ' h · 质量 ' + (r.quality || '—') + '/5' + (r.wakeups ? ' · 醒 ' + r.wakeups + ' 次' : '') + (r.note ? '\n备注：' + r.note : '');
        else if (tp[0] === 'rhr') bodyTxt = r.bpm + ' bpm' + (r.note ? '\n备注：' + r.note : '');
        else if (tp[0] === 'training') bodyTxt = '[' + esc(r.category) + '] ' + esc(r.theme || '') + ' · ' + (r.durationMin || '—') + ' min · RPE ' + (r.rpe === null || r.rpe === undefined ? '—' : r.rpe) + (r.content ? '\n' + esc(r.content) : '') + (r.notes ? '\n备注：' + esc(r.notes) : '');
        else if (tp[0] === 'body') {
          const parts = [];
          if (r.weight !== null) parts.push('体重 ' + fmtNum(r.weight) + ' kg');
          if (r.bodyFat !== null && r.bodyFat !== undefined) parts.push('体脂 ' + fmtNum(r.bodyFat) + ' %');
          [['waist', '腰围'], ['hip', '臀围'], ['chest', '胸围'], ['thighL', '左大腿'], ['thighR', '右大腿'], ['calfL', '左小腿'], ['calfR', '右小腿']].forEach(function (x) {
            if (r[x[0]] !== null && r[x[0]] !== undefined) parts.push(x[1] + ' ' + fmtNum(r[x[0]]) + ' cm');
          });
          bodyTxt = parts.join(' · ') + (r.note ? '\n备注：' + esc(r.note) : '');
        } else if (tp[0] === 'fv') bodyTxt = esc(r.name || '力速测试') + (r.mass ? ' · 体重 ' + r.mass + ' kg' : '') + (r.note ? '\n' + esc(r.note) : '');
        else if (tp[0] === 'rsi') bodyTxt = esc(r.name || 'RSI 测试') + ' · ' + (r.rows ? r.rows.length + ' 次试跳' : '') + (r.note ? '\n' + esc(r.note) : '');
        else if (tp[0] === 'plan') bodyTxt = esc(r.planName) + ' · ' + esc(r.title || '训练') + ' · ' + (r.done ? '✅ 已完成' : '⬜ 未完成') + (r.content ? '\n' + esc(r.content) : '');
        dayCards += '<div class="day-detail-card"><div class="dd-head" style="background:#f7fafd">' + tp[1] +
          '<span class="spacer" style="flex:1"></span>' +
          (r.id && ['sleep', 'rhr', 'training', 'body', 'fv', 'rsi'].indexOf(tp[0]) >= 0 ?
            '<button class="icon-btn" data-del="' + esc(tp[0]) + ':' + esc(r.id) + '" title="删除">🗑</button>' : '') +
          '</div><div class="dd-body">' + bodyTxt + '</div></div>';
      });
    });

    calHtml += '<div class="card"><div class="card-head"><h3>' + dayHtml + ' 当日记录</h3>' +
      '<div class="row"><span class="small muted">快捷添加：</span>' +
      ['sleep', 'heart', 'training', 'body'].map(function (k) {
        return '<button class="btn btn-sm" data-add="' + k + '">' + UI.quickLabels[k] + '</button>';
      }).join('') + '</div></div>' +
      (dayCards || '<div class="empty"><div class="big">📅</div>这一天还没有任何记录。<br><span class="small">使用右上角按钮为这一天添加记录。</span></div>') +
      '</div>';
    el.innerHTML = calHtml;

    document.getElementById('calPrev').onclick = function () {
      Views.calCursor.m--; if (Views.calCursor.m < 0) { Views.calCursor.m = 11; Views.calCursor.y--; }
      Views.render('calendar');
    };
    document.getElementById('calNext').onclick = function () {
      Views.calCursor.m++; if (Views.calCursor.m > 11) { Views.calCursor.m = 0; Views.calCursor.y++; }
      Views.render('calendar');
    };
    document.getElementById('calToday').onclick = function () {
      const d = new Date();
      Views.calCursor = { y: d.getFullYear(), m: d.getMonth() };
      Views.calSelected = Store.today();
      Views.render('calendar');
    };
    el.querySelectorAll('.cal-legend input').forEach(function (chk) {
      chk.onchange = function () {
        Views.calFilters = Views.calFilters || {};
        Views.calFilters[chk.dataset.f] = chk.checked;
        Views.render('calendar');
      };
    });
    el.querySelectorAll('.cal-cell[data-date]').forEach(function (cell) {
      cell.onclick = function () {
        Views.calSelected = cell.dataset.date;
        Views.render('calendar');
      };
    });
    el.querySelectorAll('[data-add]').forEach(function (b) {
      b.onclick = function () {
        Views.openRecord(b.dataset.add, Views.calSelected);
      };
    });
    el.querySelectorAll('[data-del]').forEach(function (b) {
      b.onclick = function () {
        const p = b.dataset.del.split(':');
        deleteRecord(p[0], p[1], '删除该条记录？');
      };
    });
  };

  /* ========================= 训练计划 ========================= */
  Views.selectedPlanId = null;
  Views.renderers.plans = function (el) {
    const state = S();
    const plans = state.plans || [];
    if (plans.length && !plans.some(function (p) { return p.id === Views.selectedPlanId; })) Views.selectedPlanId = plans[0].id;
    const plan = plans.find(function (p) { return p.id === Views.selectedPlanId; }) || null;

    let html = '<div class="toolbar"><div class="spacer"></div><button class="btn btn-primary" id="addPlan">＋ 新建训练计划</button></div>';
    html += '<div class="grid" style="grid-template-columns:minmax(230px,300px) 1fr;align-items:start;gap:14px">';
    html += '<div class="card"><div class="card-head"><h3>🗓️ 计划列表</h3></div><div id="planList">' +
      (plans.length ? plans.map(function (p) {
        const days = Object.keys(p.days || {}).length;
        const done = Object.keys(p.days || {}).filter(function (d) { return p.days[d].done; }).length;
        return '<div class="recent-item" style="cursor:pointer;border-color:' + (p.id === plan.id ? '#aac8ea' : 'transparent') + ';background:' + (p.id === plan.id ? '#f2f7fd' : 'transparent') + ';border-radius:9px" data-plan="' + esc(p.id) + '">' +
          '<div class="ic" style="background:#e6f0fb">🗓️</div><div><div class="bold" style="font-size:13px">' + esc(p.name) + '</div>' +
          '<div class="small muted">' + esc(p.phase || '') + ' · ' + days + ' 天 · 完成 ' + done + '/' + days + '</div></div></div>';
      }).join('') : '<div class="empty"><div class="big">🗓️</div>还没有训练计划</div>') + '</div></div>';

    if (plan) {
      const days = Object.keys(plan.days || {}).sort();
      const done = days.filter(function (d) { return plan.days[d].done; }).length;
      const progress = days.length ? Math.round(done / days.length * 100) : 0;
      const today = Store.today();
      html += '<div class="card"><div class="card-head"><h3>' + esc(plan.name) + '</h3>' +
        '<div class="row"><span class="pill ' + (progress === 100 ? 'green' : 'blue') + '">完成 ' + progress + '%</span>' +
        '<button class="btn btn-sm" id="editPlan">编辑</button><button class="btn btn-sm btn-danger" id="delPlan">删除</button></div></div>' +
        '<div class="kgrid-lines" style="margin-bottom:12px"><span class="muted">阶段：</span><b>' + esc(plan.phase || '—') + '</b>' +
        '<span class="muted">周期：</span><b>' + esc(plan.cycle || '—') + '</b>' +
        '<span class="muted">范围：</span><b>' + UI.dateCN(plan.start, true) + ' 至 ' + UI.dateCN(plan.end, true) + '</b></div>' +
        (plan.note ? '<div class="tagline">' + esc(plan.note) + '</div>' : '') +
        '<div class="toolbar"><button class="btn btn-sm" id="addPlanDay">＋ 添加训练日</button><span class="spacer"></span>' +
        '<span class="small muted">共 ' + days.length + ' 天，已完成 ' + done + ' 天</span></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>日期</th><th>标题</th><th>类别</th><th>内容预览</th><th>状态</th><th></th></tr></thead><tbody>' +
        days.map(function (d) {
          const day = plan.days[d];
          const upcoming = d > today;
          const firstLine = String(day.content || '').split('\n')[0] || '';
          return '<tr data-day="' + esc(d) + '" style="' + (d === today ? 'background:#f6fdfb' : '') + '">' +
            '<td class="nowrap">' + UI.dateCN(d, true) + (d === today ? ' <span class="pill teal">今天</span>' : '') + '</td>' +
            '<td class="bold">' + esc(day.title || '训练') + '</td>' +
            '<td>' + UI.catPill(day.category) + '</td>' +
            '<td class="small" style="max-width:300px">' + esc(firstLine) + (String(day.content || '').split('\n').length > 1 ? ' …' : '') + '</td>' +
            '<td>' + (day.done ? '<span class="pill green">✅ 完成</span>' : (upcoming ? '<span class="pill gray">待执行</span>' : '<span class="pill amber">未完成</span>')) + '</td>' +
            '<td class="actions"><button class="icon-btn" data-act="done" title="标记完成/未完成">' + (day.done ? '↩️' : '✅') + '</button>' +
            '<button class="icon-btn" data-act="log" title="转为训练日志">📋</button>' +
            '<button class="icon-btn" data-act="edit">✏️</button>' +
            '<button class="icon-btn" data-act="del">🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="tagline">💡 点击「📋」可以把计划日转成一条专项训练日志（RPE 默认 6，可在训练页补充）。</div></div>';
    } else {
      html += '<div class="card"><div class="empty"><div class="big">🗓️</div>选择左侧计划查看详情</div></div>';
    }
    html += '</div>';
    el.innerHTML = html;

    el.querySelectorAll('#planList [data-plan]').forEach(function (b) {
      b.onclick = function () { Views.selectedPlanId = b.dataset.plan; Views.render('plans'); };
    });
    document.getElementById('addPlan').onclick = openPlanForm;
    if (!plan) return;
    document.getElementById('addPlanDay').onclick = function () { openPlanDayForm(plan.id, null); };
    document.getElementById('editPlan').onclick = function () { openPlanForm(plan); };
    document.getElementById('delPlan').onclick = function () {
      UI.confirm('删除计划《' + plan.name + '》？其中的完成记录会一并删除。', function () {
        Store.remove('plans', plan.id);
        Views.selectedPlanId = null;
        UI.toast('计划已删除', 'ok');
      });
    };
    el.querySelectorAll('tr[data-day]').forEach(function (tr) {
      const d = tr.dataset.day;
      const day = plan.days[d];
      tr.querySelector('[data-act=done]').onclick = function () {
        Store.update('plans', plan.id, { days: Object.assign({}, plan.days, { [d]: Object.assign({}, day, { done: !day.done }) }) });
        UI.toast(day.done ? '已标记为未完成' : '已标记完成', 'ok');
      };
      tr.querySelector('[data-act=log]').onclick = function () {
        openPlanToTraining(plan, d, day);
      };
      tr.querySelector('[data-act=edit]').onclick = function () { openPlanDayForm(plan.id, d); };
      tr.querySelector('[data-act=del]').onclick = function () {
        UI.confirm('删除 ' + UI.dateCN(d) + ' 的训练安排？', function () {
          const copy = Object.assign({}, plan.days);
          delete copy[d];
          Store.update('plans', plan.id, { days: copy });
          UI.toast('已删除该日安排', 'ok');
        });
      };
    });
  };

  function openPlanForm(plan) {
    const m = UI.modal({
      title: plan ? '编辑训练计划' : '新建训练计划',
      wide: true,
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>计划名称</label><input id="pl-name" value="' + esc(plan ? plan.name : '') + '" placeholder="如：2026 秋季速度储备期"></div>' +
        '<div class="field"><label>阶段 Phase</label><input id="pl-phase" value="' + esc(plan ? plan.phase : '') + '" placeholder="如：GPP / SPP / TP / 比赛期"></div>' +
        '<div class="field"><label>周期 Cycle</label><input id="pl-cycle" value="' + esc(plan ? plan.cycle : '') + '" placeholder="如：2026.9-10"></div>' +
        '<div class="field"><label>开始日期</label><input id="pl-start" type="date" value="' + esc(plan ? plan.start : Store.today()) + '"></div>' +
        '<div class="field"><label>结束日期</label><input id="pl-end" type="date" value="' + esc(plan ? plan.end : Store.dstr(Store.addDays(new Date(), 6))) + '"></div>' +
        '<div class="field full"><label>说明</label><textarea id="pl-note" rows="3" placeholder="周期目标、注意事项等">' + esc(plan ? plan.note : '') + '</textarea></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id).value.trim(); };
          const name = q('#pl-name');
          if (!name) { UI.toast('请填写计划名称', 'err'); return; }
          const data = {
            name: name,
            phase: q('#pl-phase'), cycle: q('#pl-cycle'),
            start: q('#pl-start'), end: q('#pl-end'),
            note: body.querySelector('#pl-note').value.trim()
          };
          if (plan) {
            Store.update('plans', plan.id, data);
            UI.toast('计划已更新', 'ok');
          } else {
            const created = Store.add('plans', Object.assign({ days: {} }, data));
            Views.selectedPlanId = created.id;
            UI.toast('计划已创建，接下来添加训练日', 'ok');
          }
          m.close();
        };
      }
    });
  }

  function openPlanDayForm(planId, dayDate) {
    const plan = Store.state.plans.find(function (p) { return p.id === planId; });
    if (!plan) return;
    const old = dayDate ? plan.days[dayDate] : null;
    const m = UI.modal({
      title: old ? '编辑训练日' : '添加训练日',
      wide: true,
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>日期</label><input id="pd-date" type="date" value="' + esc(dayDate || Store.today()) + '"></div>' +
        '<div class="field"><label>标题</label><input id="pd-title" value="' + esc(old ? old.title : '') + '" placeholder="如：速度耐力课"></div>' +
        '<div class="field"><label>类别</label><select id="pd-cat">' +
        Store.trainingCats.map(function (c) { return '<option' + (old && old.category === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label>状态</label><select id="pd-done"><option value="0">待执行</option><option value="1"' + (old && old.done ? ' selected' : '') + '>已完成</option></select></div>' +
        '<div class="field full"><label>训练内容（每行一组）</label><textarea id="pd-content" rows="8" placeholder="慢跑 15min&#10;flying 30m×5&#10;力量……">' + esc(old ? old.content : '') + '</textarea></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id); };
          const date = q('#pd-date').value;
          if (!date) { UI.toast('请选择日期', 'err'); return; }
          const record = {
            title: q('#pd-title').value.trim() || '训练日',
            category: q('#pd-cat').value,
            content: q('#pd-content').value,
            done: q('#pd-done').value === '1',
            logId: old ? old.logId : ''
          };
          const days = Object.assign({}, plan.days);
          if (dayDate && dayDate !== date) delete days[dayDate];
          days[date] = record;
          Store.update('plans', plan.id, { days: days });
          UI.toast('训练日已保存', 'ok');
          m.close();
        };
      }
    });
  }

  function openPlanToTraining(plan, date, day) {
    const existing = Store.state.training.find(function (t) { return t.date === date && t.fromPlan === plan.id; });
    if (existing) { UI.toast('这一天已有来自该计划的训练记录', 'err'); return; }
    const data = {
      date: date,
      category: day.category || '综合',
      theme: day.title || '计划训练',
      durationMin: 0,
      rpe: 6,
      fatigue: null,
      distance: null,
      content: day.content || '',
      notes: '由计划《' + plan.name + '》生成',
      load: 0,
      fromPlan: plan.id
    };
    Store.add('training', data);
    Store.update('plans', plan.id, { days: Object.assign({}, plan.days, { [date]: Object.assign({}, day, { done: true, logId: data.id }) }) });
    UI.toast('已转为训练日志并标记完成', 'ok');
  }

  /* ========================= 数据管理 ========================= */
  Views.renderers.data = function (el) {
    const state = S();
    let sizeKb = 0;
    try { sizeKb = (localStorage.getItem(Store.KEY) || '').length / 1024; } catch (e) { /* ignore */ }
    const rows = [
      ['sleep', '睡眠记录', state.sleep.length + ' 条'],
      ['rhr', '静息心率', state.rhr.length + ' 条'],
      ['training', '专项训练', state.training.length + ' 条'],
      ['body', '身体围度', state.body.length + ' 条'],
      ['fv', '力速测试', state.fv.length + ' 次'],
      ['rsi', 'RSI 测试', state.rsi.length + ' 次'],
      ['plans', '训练计划', state.plans.length + ' 个']
    ];
    el.innerHTML =
      '<div class="grid g-2" style="margin-bottom:14px">' +
      '<div class="card"><div class="card-head"><h3>💾 JSON 完整备份</h3></div>' +
      '<p class="small muted">全部数据保存为单个 JSON 文件，可随时导入恢复或迁移到其他浏览器 / 电脑。</p>' +
      '<div class="row"><button class="btn btn-primary" id="exportJson">下载备份文件</button><button class="btn" id="importJson">导入备份</button></div>' +
      '<div class="small muted" style="margin-top:8px">本地存储占用约 ' + fmtNum(sizeKb, 1) + ' KB</div></div>' +
      '<div class="card"><div class="card-head"><h3>📄 CSV 导出</h3></div><p class="small muted">导出当前运动员（' + UI.esc((Store.state.profile && Store.state.profile.name) || '—') + '）数据，可直接用 Excel / Numbers 打开分析。</p>' +
      '<div class="row">' + rows.map(function (r, i) {
        return '<button class="btn btn-sm" data-csv="' + r[0] + '">' + r[1] + '（' + r[2] + '）</button>';
      }).join('') + '</div></div>' +
      '</div>' +
      '<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>数据与初始化</h3></div>' +
      '<div class="row"><button class="btn btn-accent" id="loadSample">重新载入示例数据</button>' +
      '<button class="btn" id="clearCurrent">清空当前运动员记录</button>' +
      '<button class="btn btn-danger" id="resetAll">删除全部数据与运动员</button></div>' +
      '<div class="small muted" style="margin-top:8px">“清空当前运动员记录”只清空正在查看的运动员（其个人档案保留）；“删除全部数据与运动员”会回到初始状态并保留一名空白档案。操作不可恢复，建议先下载备份。</div></div>' +
      '<div class="card"><div class="card-head"><h3>📖 数据说明</h3></div>' +
      '<div class="small" style="line-height:1.9">' +
      '· 本系统为纯本地网页应用：数据保存在当前浏览器的 localStorage 中，不经过任何服务器。<br>' +
      '· 换电脑 / 浏览器前请先「下载备份文件」，到新环境打开 index.html 后「导入备份」。<br>' +
      '· 如需多人或多设备协作，可将整个文件夹部署到任意静态站点（GitHub Pages / Netlify / 自有服务器）。<br>' +
      '· 所有分析与图表均在本地实时计算，PDF 报告也由浏览器本地生成。</div></div>';

    document.getElementById('exportJson').onclick = function () {
      Store.download('运动员数据备份-' + Store.today() + '.json', Store.exportJson(), 'application/json');
      UI.toast('备份已下载', 'ok');
    };
    document.getElementById('importJson').onclick = function () {
      UI.fileInput('.json,application/json', function (text) {
        try {
          Store.importJson(text);
          UI.toast('导入成功', 'ok');
        } catch (e) {
          UI.toast('导入失败：' + e.message, 'err');
        }
      });
    };
    document.getElementById('loadSample').onclick = function () {
      UI.confirm('重新载入示例数据会覆盖当前全部数据，确定继续？（建议先下载备份）', function () {
        Store.loadSample();
        UI.toast('已载入示例数据', 'ok');
      });
    };
    document.getElementById('clearCurrent').onclick = function () {
      const name = (Store.state.profile && Store.state.profile.name) || '当前运动员';
      UI.confirm('确定清空「' + name + '」的全部记录吗？个人档案保留，训练与监控数据不可恢复。', function () {
        Store.clearCurrentData();
        UI.toast('已清空当前运动员记录', 'ok');
      });
    };
    document.getElementById('resetAll').onclick = function () {
      UI.confirm('确定删除全部运动员与数据吗？此操作不可恢复，请确认已下载备份。', function () {
        Store.clearAll();
        UI.toast('已重置为初始状态', 'ok');
      });
    };
    el.querySelectorAll('[data-csv]').forEach(function (b) {
      b.onclick = function () { exportCsv(b.dataset.csv); };
    });
  };

  function exportCsv(kind) {
    const state = Store.state;
    let cols, rows, fname;
    if (kind === 'sleep') {
      cols = ['id', 'date', 'bed', 'wake', 'duration', 'quality', 'wakeups', 'note'];
      rows = state.sleep;
      fname = 'sleep';
    } else if (kind === 'rhr') {
      cols = ['id', 'date', 'bpm', 'note'];
      rows = state.rhr; fname = 'rhr';
    } else if (kind === 'training') {
      cols = ['id', 'date', 'category', 'theme', 'durationMin', 'rpe', 'fatigue', 'load', 'distance', 'content', 'notes'];
      rows = state.training; fname = 'training';
    } else if (kind === 'body') {
      cols = ['id', 'date', 'weight', 'bodyFat', 'neck', 'shoulder', 'chest', 'waist', 'hip', 'thighL', 'thighR', 'calfL', 'calfR', 'armL', 'armR', 'note'];
      rows = state.body; fname = 'body';
    } else if (kind === 'fv') {
      cols = ['id', 'date', 'name', 'type', 'mass', 'splits', 'note'];
      rows = state.fv; fname = 'fv_tests';
    } else if (kind === 'rsi') {
      cols = ['id', 'date', 'name', 'rows', 'note'];
      rows = state.rsi; fname = 'rsi_tests';
    } else if (kind === 'plans') {
      cols = ['id', 'name', 'phase', 'cycle', 'start', 'end', 'note', 'days'];
      rows = state.plans.map(function (p) { return Object.assign({}, p, { days: JSON.stringify(p.days) }); });
      fname = 'plans';
    } else return;
    rows = rows.map(function (r) { return Object.assign({}, r); });
    rows.forEach(function (r) {
      Object.keys(r).forEach(function (k) {
        if (typeof r[k] === 'object' && r[k] !== null) r[k] = JSON.stringify(r[k]);
      });
    });
    Store.download(fname + '-' + Store.today() + '.csv', Store.csv(cols, rows), 'text/csv;charset=utf-8');
    UI.toast(fname + ' CSV 已导出', 'ok');
  }

  /* ---- 打开某类记录（供快速添加 / 日历使用） ---- */
  Views.openRecord = function (kind, date) {
    if (kind === 'sleep') openSleepForm(null);
    else if (kind === 'heart') openRhrForm(null);
    else if (kind === 'training') openTrainingForm(null, date);
    else if (kind === 'body') openBodyForm(null);
    else if (kind === 'profile') Views.openProfile();
    else UI.toast('暂不支持', 'err');
  };

  // 宽松解析 PB 行：项目 与 成绩 之间支持空格/冒号/全角冒号；成绩允许小数与 h:m:s
  function parsePbLine(raw) {
    const text = String(raw).trim();
    if (!text) return null;
    const sep = text.search(/[\s:：]+[0-9]/);
    if (sep < 0) return null;
    const event = text.slice(0, sep).trim();
    let value = text.slice(sep).trim();
    if (!event || !value) return null;
    // 去掉分隔时可能残留下来的冒号
    value = value.replace(/^[\s:：]+/, '');
    if (!value) return null;
    // 值只需要包含合法的数字/冒号，允许保留单位文本（如 6.72s、3.10 m）
    if (!/^[0-9]+(?::[0-9.]+)*(?:\.?[0-9]+)?\s*[a-zA-Z\u4e00-\u9fa5/]*$/.test(value)) return null;
    return { event: event, value: value };
  }

  Views.openProfile = function () {
    const p = S().profile;
    const m = UI.modal({
      title: '运动员档案',
      wide: true,
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>姓名</label><input id="pf-name" value="' + esc(p.name) + '"></div>' +
        '<div class="field"><label>专项 / 主项</label><input id="pf-event" value="' + esc(p.event || '') + '"></div>' +
        '<div class="field"><label>队伍 / 学校</label><input id="pf-team" value="' + esc(p.team || '') + '"></div>' +
        '<div class="field"><label>教练</label><input id="pf-coach" value="' + esc(p.coach || '') + '"></div>' +
        '<div class="field"><label>出生日期</label><input id="pf-birth" type="date" value="' + esc(p.birth || '') + '"></div>' +
        '<div class="field"><label>性别</label><select id="pf-sex"><option>男</option><option' + (p.sex === '女' ? ' selected' : '') + '>女</option></select></div>' +
        '<div class="field"><label>身高 (cm)</label><input id="pf-height" type="number" step="0.5" value="' + esc(p.height || '') + '"></div>' +
        '<div class="field"><label>体重 (kg)</label><input id="pf-weight" type="number" step="0.1" value="' + esc(p.weight || '') + '"></div>' +
        '<div class="field full"><label>个人最好成绩 PB</label><textarea id="pf-pbs" rows="3" placeholder="每行一个，项目与成绩可用空格或冒号分隔：&#10;60m 6.72&#10;100m: 10.84&#10;跳远 7.85">' + esc(Object.keys(p.pbs || {}).map(function (k) { return k + ' ' + p.pbs[k]; }).join('\n')) + '</textarea><div class="hint-text">支持 60m 6.72、100m: 10.84、跳远 7.85 等写法</div></div>' +
        '<div class="field full"><label>备注</label><textarea id="pf-note" rows="3">' + esc(p.note || '') + '</textarea></div>' +
        '</div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id).value.trim(); };
          const pbs = {};
          const badLines = [];
          body.querySelector('#pf-pbs').value.split('\n').forEach(function (line) {
            if (!line.trim()) return;
            const parsed = parsePbLine(line);
            if (parsed) pbs[parsed.event] = parsed.value;
            else badLines.push(line.trim());
          });
          if (badLines.length) {
            UI.toast('有 ' + badLines.length + ' 行 PB 无法识别（例：' + badLines[0].slice(0, 24) + '），请用“项目 成绩”格式', 'err');
            return;
          }
          Store.state.profile = Object.assign({}, Store.state.profile, {
            name: q('#pf-name') || '未命名',
            event: q('#pf-event'), team: q('#pf-team'), coach: q('#pf-coach'),
            birth: q('#pf-birth'), sex: body.querySelector('#pf-sex').value,
            height: +q('#pf-height') || null, weight: +q('#pf-weight') || null,
            pbs: pbs, note: body.querySelector('#pf-note').value.trim()
          });
          Store.changed();
          UI.toast('档案已保存', 'ok');
          m.close();
        };
      }
    });
  };

  UI.registerHook('sleep', function () { Views.openRecord('sleep'); });
  UI.registerHook('heart', function () { Views.openRecord('heart'); });
  UI.registerHook('training', function () { Views.openRecord('training'); });
  UI.registerHook('body', function () { Views.openRecord('body'); });
  UI.registerHook('profile', function () { Views.openProfile(); });
  UI.registerHook('fv', function () { Views.openRecord('fv'); });
  UI.registerHook('rsi', function () { Views.openRecord('rsi'); });

  window.Views = Views;
})();
