/* 分析页：力速曲线（加速 F-v 剖面）与 RSI 反应力量指数 */
(function () {
  const S = function () { return Store.state; };
  const esc = UI.esc;
  const Views = window.Views;
  Views.analysisTab = Views.analysisTab || 'fv';
  Views.fvSelectedId = null;
  Views.rsiSelectedId = null;

  function fmt(v, d) { return v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d === undefined ? 2 : d); }
  function kvItem(k, v, sub) {
    return '<div class="kv-item"><div class="k">' + k + '</div><div class="v">' + v + (sub ? ' <small>' + sub + '</small>' : '') + '</div></div>';
  }

  Views.renderers.analysis = function (el) {
    el.innerHTML =
      '<div class="sub-tabs">' +
      '<button class="sub-tab" data-tab="fv">力速曲线（F-v 剖面）</button>' +
      '<button class="sub-tab" data-tab="rsi">反应力量指数 RSI</button>' +
      '</div><div id="analysisBody"></div>';
    el.querySelectorAll('.sub-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === Views.analysisTab);
      b.onclick = function () {
        Views.analysisTab = b.dataset.tab;
        Views.render('analysis');
      };
    });
    const body = el.querySelector('#analysisBody');
    if (Views.analysisTab === 'fv') renderFv(body); else renderRsi(body);
  };

  /* ==================== 力速曲线 ==================== */
  function computeAllProfiles() {
    return S().fv.map(function (t) {
      return { test: t, p: Analytics.profileFromSprint(t) };
    }).filter(function (x) { return x.p; });
  }

  function renderFv(el) {
    const list = Analytics.sortDescByDate(S().fv);
    const profs = computeAllProfiles();
    if (list.length && !S().fv.some(function (t) { return t.id === Views.fvSelectedId; })) Views.fvSelectedId = list[0].id;
    const test = S().fv.find(function (t) { return t.id === Views.fvSelectedId; }) || list[0] || null;
    const p = test ? Analytics.profileFromSprint(test) : null;

    let html =
      '<div class="toolbar"><span class="small muted">方法：分段时间法 + 单指数速度模型（d(t)=Vmax·[t+τ(e<sup>-t/τ</sup>-1)]），</span>' +
      '<span class="small muted">水平力 F=m·a（忽略风阻的常用近似）。</span><div class="spacer"></div>' +
      '<button class="btn btn-primary" id="addFv">＋ 录入力速测试</button></div>';
    html += '<div class="grid" style="grid-template-columns:minmax(220px,280px) 1fr;align-items:start;gap:14px">';
    // 测试列表
    html += '<div class="card"><div class="card-head"><h3>测试记录</h3></div>' +
      (list.length ? list.map(function (t) {
        const pp = Analytics.profileFromSprint(t);
        return '<div class="recent-item" style="cursor:pointer;border-color:' + (t.id === (test && test.id) ? '#aac8ea' : 'transparent') + ';background:' + (t.id === (test && test.id) ? '#f2f7fd' : 'transparent') + ';border-radius:9px;align-items:flex-start" data-fv="' + esc(t.id) + '">' +
          '<div class="ic" style="background:#e0f5f3">⚡</div><div style="flex:1"><div class="bold" style="font-size:13px">' + esc(t.name || '力速测试') + '</div>' +
          '<div class="small muted">' + UI.dateCN(t.date) + '<br>Vmax ' + fmt(pp && pp.V0, 2) + ' m/s · Pmax/kg ' + fmt(pp && pp.Pmaxkg, 1) + ' W/kg · ' + (pp ? pp.type : '') + '</div></div>' +
          '<button class="icon-btn" data-fv-del="' + esc(t.id) + '" title="删除">🗑</button></div>';
      }).join('') : '<div class="empty"><div class="big">⚡</div>暂无力速测试<br><span class="small">录入一次分段时间测试即可生成剖面</span></div>') +
      '</div></div>';

    // 主面板
    if (test && p) {
      const svPct = Math.min(100, Math.max(0, (p.sv - 0.4) / 0.8 * 100));
      const splitRows = (test.splits || []).slice();
      html += '<div>' +
        '<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>' + esc(test.name || '力速测试') + ' · ' + UI.dateCN(test.date, true) + '</h3>' +
        '<button class="btn btn-sm" data-fv-edit="' + esc(test.id) + '">编辑</button></div>' +
        '<div class="kv-grid">' +
        kvItem('理论最大速度 V0', fmt(p.V0, 2), 'm/s') +
        kvItem('理论最大加速度 a0', fmt(p.a0, 2), 'm/s²') +
        kvItem('最大水平力 F0', fmt(p.F0, 0), 'N') +
        kvItem('相对力量 F0/kg', fmt(p.F0kg, 2), 'N/kg') +
        kvItem('最大功率 Pmax', fmt(p.Pmax, 0), 'W') +
        kvItem('相对功率 Pmax/kg', fmt(p.Pmaxkg, 1), 'W/kg') +
        kvItem('力速斜率 |S|', fmt(p.sv, 3), 'a0/V0') +
        kvItem('拟合优度 R²', fmt(p.r2, 3), '') +
        '</div>' +
        '<div style="margin-top:12px"><div class="small muted" style="margin-bottom:4px">剖面类型（力量主导 ↔ 速度主导）</div>' +
        '<div class="score-scale"><i style="background:#1b6ab0"></i><i style="background:#4a8cc9"></i><i style="background:#20b3aa"></i><i style="background:#f2a03d"></i><i style="background:#e25563"></i></div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:3px"><span>力量主导<br>高 a0、低 V0</span><span style="transform:translateX(-50%);font-weight:700;color:var(--brand)">▲ ' + esc(p.type) + '</span><span>速度主导<br>低 a0、高 V0</span></div></div>' +
        (test.note ? '<div class="tagline">' + esc(test.note) + '</div>' : '') +
        '</div>' +
        '<div class="grid g-2" style="margin-bottom:14px">' +
        '<div class="card"><div class="card-head"><h3>距离-时间拟合</h3></div><div class="chart-box" id="fvDtChart"></div></div>' +
        '<div class="card"><div class="card-head"><h3>加速力速剖面（F-v）</h3></div><div class="chart-box" id="fvChart"></div></div>' +
        '</div>' +
        '<div class="card"><div class="card-head"><h3>分段时间数据</h3></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>距离 (m)</th><th class="num">实测时间 (s)</th><th class="num">模型拟合 (s)</th><th class="num">误差 (s)</th></tr></thead><tbody>' +
        p.fit.fitted.map(function (r) {
          const diff = r.tFit - r.tObs;
          return '<tr><td class="bold">' + r.d + '</td><td class="num mono">' + r.tObs.toFixed(3) + '</td><td class="num mono">' + r.tFit.toFixed(3) + '</td>' +
            '<td class="num mono">' + (diff >= 0 ? '+' : '') + diff.toFixed(3) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
        '</div>';
    } else {
      html += '<div class="card"><div class="empty"><div class="big">⚡</div>' +
        '<p>录入分段时间测试：测量 30–60 m 冲刺中多个标记点的<b>累计时间</b>（如 5、10、15、20、30、40、50、60 m），系统将拟合单指数加速模型，生成力速剖面并给出 V0、F0、Pmax 等指标。</p>' +
        '<p class="small">建议：使用光电计时或高清视频逐帧计时；同一测试尽量一次全力跑完成。</p></div></div>';
    }
    html += '</div>';
    el.innerHTML = html;

    if (test && p) {
      // 距离-时间
      const fit = p.fit;
      const dtPts = fit.fitted.map(function (r) { return { x: r.tObs, y: r.d }; });
      const curve = [];
      for (let t = 0; t <= Math.max.apply(null, fit.fitted.map(function (r) { return r.tFit; })); t += 0.05) {
        curve.push({ x: t, y: Analytics.modelDist(p.V0, p.fit.tau, t) });
      }
      Charts.scatter(document.getElementById('fvDtChart'), {
        sets: [
          { name: '实测距离-时间', color: '#0ea5a4', points: dtPts, r: 5 },
          { name: '模型 d(t)', color: '#1b6ab0', points: curve, r: 1.5, line: null }
        ],
        xLabel: '时间 (s)', yLabel: '距离 (m)', height: 230, emptyText: '无数据'
      });
      // F-v 剖面：实测分段 F & v 与拟合线
      const linePts = [];
      for (let v = 0; v <= p.V0 * 1.001; v += p.V0 / 40) {
        const F = p.mass * (p.a0 - v / p.fit.tau);
        linePts.push({ x: v, y: Math.max(0, F) });
      }
      const obsPts = [];
      for (let i = 1; i < test.splits.length; i++) {
        const s0 = test.splits[i - 1], s1 = test.splits[i];
        const dt = s1.t - s0.t;
        if (dt <= 0) continue;
        const vMid = Analytics.modelTime(p.V0, p.fit.tau, (s0.d + s1.d) / 2);
        const aMid = (p.V0 / p.fit.tau) * Math.exp(-vMid / p.fit.tau);
        obsPts.push({ x: vMid, y: p.mass * aMid });
      }
      Charts.scatter(document.getElementById('fvChart'), {
        sets: [
          { name: '拟合 F-v 线', color: '#1b6ab0', points: linePts, r: 1.5 },
          { name: '分段中点估算', color: '#e25563', points: obsPts, r: 4 }
        ],
        xLabel: '速度 (m/s)', yLabel: '水平力 F (N)', height: 230, emptyText: '无数据'
      });
    }

    document.getElementById('addFv').onclick = openFvForm;
    el.querySelectorAll('[data-fv]').forEach(function (b) {
      b.onclick = function (e) {
        if (e.target.closest('[data-fv-del]')) return;
        Views.fvSelectedId = b.dataset.fv;
        renderFv(document.getElementById('analysisBody'));
      };
    });
    el.querySelectorAll('[data-fv-edit]').forEach(function (b) {
      b.onclick = function () { const t = S().fv.find(function (x) { return x.id === b.dataset.fvEdit; }); t && openFvForm(t); };
    });
    el.querySelectorAll('[data-fv-del]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('删除这次力速测试？', function () {
          Store.remove('fv', b.dataset.fvDel);
          Views.fvSelectedId = null;
          renderFv(document.getElementById('analysisBody'));
          UI.toast('已删除', 'ok');
        });
      };
    });
  }

  function openFvForm(rec) {
    const defaultSplits = [5, 10, 15, 20, 30, 40, 50, 60];
    const m = UI.modal({
      title: rec ? '编辑力速测试' : '录入力速测试（分段时间法）',
      wide: true,
      body:
        '<div class="form-grid" style="margin-bottom:10px">' +
        '<div class="field"><label>测试日期</label><input id="fv-date" type="date" value="' + esc(rec ? rec.date : Store.today()) + '"></div>' +
        '<div class="field"><label>测试名称</label><input id="fv-name" value="' + esc(rec ? rec.name : '加速力速测试') + '"></div>' +
        '<div class="field"><label>测试时体重（kg）</label><input id="fv-mass" type="number" step="0.1" value="' + (rec ? rec.mass : (S().profile.weight || '')) + '"></div>' +
        '<div class="field"><label>类型</label><select id="fv-type"><option value="短跑分段时间法" selected>短跑分段时间法</option><option value="其他">其他</option></select></div>' +
        '</div>' +
        '<div class="hint-text" style="margin-bottom:8px">填入每个标记点的<b>累计时间</b>（秒，保留 3 位小数）。至少 4 个点，建议含 5 m 起点段。</div>' +
        '<div class="table-wrap"><table class="data" id="fvSplits"><thead><tr><th class="num">距离 (m)</th><th class="num">累计时间 (s)</th></tr></thead><tbody>' +
        (rec ? rec.splits : defaultSplits.map(function (d) { return { d: d, t: '' }; })).map(function (s) {
          return '<tr><td class="num mono">' + s.d + '</td><td><input class="fv-t" type="number" step="0.001" min="0" style="width:110px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value="' + esc(s.t) + '"></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="field full" style="margin-top:10px"><label>备注</label><input id="fv-note" value="' + esc(rec ? rec.note : '') + '"></div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存并分析</button>',
      onMount: function (body) {
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id); };
          const date = q('#fv-date').value, name = q('#fv-name').value.trim();
          const mass = +q('#fv-mass').value;
          if (!date || !name || !mass || mass <= 20) { UI.toast('请填写日期、名称与有效体重', 'err'); return; }
          const splits = [];
          let ok = true;
          body.querySelectorAll('#fvSplits tbody tr').forEach(function (tr) {
            const tds = tr.querySelectorAll('td');
            const d = +tds[0].textContent;
            const t = +tds[1].querySelector('input').value;
            if (!t || t <= 0) { ok = false; return; }
            splits.push({ d: d, t: t });
          });
          if (!ok || splits.length < 4) { UI.toast('请至少填写 4 个有效的分段时间', 'err'); return; }
          splits.sort(function (a, b) { return a.d - b.d; });
          const data = { date: date, name: name, mass: mass, type: q('#fv-type').value, splits: splits, note: q('#fv-note').value.trim() };
          const fit = Analytics.fitMonoExp(splits);
          if (!fit) { UI.toast('数据不足，无法拟合', 'err'); return; }
          if (fit.r2 < 0.85) UI.toast('提示：拟合优度偏低（R²=' + fmt(fit.r2, 2) + '），请检查计时数据是否有误', 'err');
          if (rec) { Store.update('fv', rec.id, data); Views.fvSelectedId = rec.id; }
          else { const created = Store.add('fv', data); Views.fvSelectedId = created.id; }
          UI.toast('力速测试已保存并完成分析', 'ok');
          m.close();
        };
      }
    });
  }

  /* ==================== RSI ==================== */
  const RSI_BANDS = [
    ['< 1.5', '较低（需发展反应力量）', '#e25563'],
    ['1.5 – 2.0', '一般', '#f2a03d'],
    ['2.0 – 2.5', '良好', '#20b3aa'],
    ['> 2.5', '优秀（快速 SSC 能力）', '#16a34a']
  ];

  function renderRsi(el) {
    const list = Analytics.sortDescByDate(S().rsi);
    if (list.length && !S().rsi.some(function (t) { return t.id === Views.rsiSelectedId; })) Views.rsiSelectedId = list[0].id;
    const test = S().rsi.find(function (t) { return t.id === Views.rsiSelectedId; }) || list[0] || null;
    const stat = test ? Analytics.sessionRSI(test) : null;

    let html =
      '<div class="toolbar"><span class="small muted">RSI（反应力量指数）= 跳起高度 ÷ 触地时间。用跳深（Drop Jump）配合测力台 / 接触垫测量腾空与触地时间。</span>' +
      '<div class="spacer"></div><button class="btn btn-primary" id="addRsi">＋ 录入 RSI 测试</button></div>' +
      '<div class="grid" style="grid-template-columns:minmax(220px,280px) 1fr;align-items:start;gap:14px">';
    html += '<div class="card"><div class="card-head"><h3>测试记录</h3></div>' +
      (list.length ? list.map(function (t) {
        const st = Analytics.sessionRSI(t);
        return '<div class="recent-item" style="cursor:pointer;border-color:' + (t.id === (test && test.id) ? '#aac8ea' : 'transparent') + ';background:' + (t.id === (test && test.id) ? '#f2f7fd' : 'transparent') + ';border-radius:9px;align-items:flex-start" data-rsi="' + esc(t.id) + '">' +
          '<div class="ic" style="background:#e0f3e5">🦘</div><div style="flex:1"><div class="bold" style="font-size:13px">' + esc(t.name || 'RSI 测试') + '</div>' +
          '<div class="small muted">' + UI.dateCN(t.date) + '<br>最佳 RSI ' + fmt(st && st.best, 2) + ' · 均值 ' + fmt(st && st.mean, 2) + '</div></div>' +
          '<button class="icon-btn" data-rsi-del="' + esc(t.id) + '">🗑</button></div>';
      }).join('') : '<div class="empty"><div class="big">🦘</div>暂无 RSI 测试<br><span class="small">录入跳深测试的腾空/触地时间即可计算</span></div>') +
      '</div></div>';

    if (test && stat) {
      const asc = Analytics.sortAscByDate(S().rsi);
      const bestSeries = [], meanSeries = [], labels = [];
      asc.forEach(function (t) {
        const st = Analytics.sessionRSI(t);
        if (!st) return;
        labels.push(UI.shortDate(t.date));
        bestSeries.push(+st.best.toFixed(2));
        meanSeries.push(+st.mean.toFixed(2));
      });
      const latestByDrop = {};
      test.rows.forEach(function (r) {
        const rr = Analytics.rsiRow(r);
        if (!rr) return;
        if (!latestByDrop[rr.drop]) latestByDrop[rr.drop] = [];
        latestByDrop[rr.drop].push(rr.rsi);
      });
      html += '<div>' +
        '<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>' + esc(test.name || 'RSI 测试') + ' · ' + UI.dateCN(test.date, true) + '</h3>' +
        '<button class="btn btn-sm" data-rsi-edit="' + esc(test.id) + '">编辑</button></div>' +
        '<div class="kv-grid">' +
        kvItem('最佳 RSI', fmt(stat.best, 2), '') +
        kvItem('平均 RSI', fmt(stat.mean, 2), '') +
        kvItem('最差 RSI', fmt(stat.worst, 2), '') +
        kvItem('试跳次数', stat.n, '次') +
        kvItem('平均腾空高度', fmt(Analytics.mean(stat.rows.map(function (r) { return r.heightCm; })), 1), 'cm') +
        kvItem('平均触地时间', fmt(Analytics.mean(stat.rows.map(function (r) { return r.contactMs; })), 0), 'ms') +
        '</div>' +
        '<div style="margin-top:12px"><div class="small muted" style="margin-bottom:5px">RSI 参考分级（有跳深高度等影响因素，仅作参考）</div>' +
        '<div class="score-scale">' + RSI_BANDS.map(function (b) { return '<i style="background:' + b[2] + '"></i>'; }).join('') + '</div>' +
        '<div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted)">' + RSI_BANDS.map(function (b) { return '<span>' + b[0] + '<br>' + b[1] + '</span>'; }).join('') + '</div></div>' +
        (test.note ? '<div class="tagline">' + esc(test.note) + '</div>' : '') +
        '</div>' +
        '<div class="grid g-2" style="margin-bottom:14px">' +
        '<div class="card"><div class="card-head"><h3>📈 RSI 历次趋势</h3></div><div class="chart-box" id="rsiTrendChart"></div></div>' +
        '<div class="card"><div class="card-head"><h3>本次各跳深高度平均 RSI</h3></div><div class="chart-box" id="rsiDropChart"></div></div>' +
        '</div>' +
        '<div class="card"><div class="card-head"><h3>试跳明细</h3></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr><th>#</th><th class="num">跳深高度 (cm)</th><th class="num">腾空时间 (ms)</th><th class="num">触地时间 (ms)</th><th class="num">跳起高度 (cm)</th><th class="num">RSI</th><th>评级</th></tr></thead><tbody>' +
        stat.rows.map(function (r, i) {
          const band = RSI_BANDS[0];
          let grade = RSI_BANDS[0];
          if (r.rsi >= 2.5) grade = RSI_BANDS[3];
          else if (r.rsi >= 2.0) grade = RSI_BANDS[2];
          else if (r.rsi >= 1.5) grade = RSI_BANDS[1];
          return '<tr><td>' + (i + 1) + '</td><td class="num mono">' + r.drop + '</td><td class="num mono">' + Math.round(r.flightMs) + '</td>' +
            '<td class="num mono">' + Math.round(r.contactMs) + '</td><td class="num mono">' + fmt(r.heightCm, 1) + '</td>' +
            '<td class="num mono bold">' + fmt(r.rsi, 2) + '</td>' +
            '<td><span class="pill" style="background:' + grade[2] + '22;color:' + grade[2] + '">' + grade[0] + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="formula" style="margin-top:8px">计算：JH = 9.81 × Tf² ÷ 8（m）&nbsp;&nbsp;·&nbsp;&nbsp;RSI = JH ÷ 触地时间(s)</div>' +
        '</div>' +
        '</div>';
      // 趋势图
      Charts.line(document.getElementById('rsiTrendChart'), {
        labels: labels,
        series: [
          { name: '最佳 RSI', color: '#16a34a', data: bestSeries, points: true },
          { name: '平均 RSI', color: '#0ea5a4', data: meanSeries, points: true }
        ],
        yLabel: 'RSI', height: 230, emptyText: '暂无数据'
      });
      const drops = Object.keys(latestByDrop).sort(function (a, b) { return +a - +b; });
      Charts.bar(document.getElementById('rsiDropChart'), {
        labels: drops.map(function (d) { return d + ' cm'; }),
        series: [{ name: '平均 RSI', color: '#20b3aa', data: drops.map(function (d) { return +Analytics.mean(latestByDrop[d]).toFixed(2); }) }],
        yLabel: 'RSI', height: 230, emptyText: '暂无数据'
      });
    } else {
      html += '<div class="card"><div class="empty"><div class="big">🦘</div><p>跳深测试（Drop Jump）：从 20–40 cm 跳箱落下，落地后<b>尽快向上跳起</b>，记录每次试跳的腾空时间与触地时间。</p>' +
        '<p class="small">有测力台或 SmartJump 等接触垫可直接读时间；也可用高速摄像（240fps+）逐帧分析。</p></div></div>';
    }
    html += '</div>';
    el.innerHTML = html;

    document.getElementById('addRsi').onclick = openRsiForm;
    el.querySelectorAll('[data-rsi]').forEach(function (b) {
      b.onclick = function (e) {
        if (e.target.closest('[data-rsi-del]')) return;
        Views.rsiSelectedId = b.dataset.rsi;
        renderRsi(document.getElementById('analysisBody'));
      };
    });
    el.querySelectorAll('[data-rsi-edit]').forEach(function (b) {
      b.onclick = function () { const t = S().rsi.find(function (x) { return x.id === b.dataset.rsiEdit; }); t && openRsiForm(t); };
    });
    el.querySelectorAll('[data-rsi-del]').forEach(function (b) {
      b.onclick = function () {
        UI.confirm('删除这次 RSI 测试？', function () {
          Store.remove('rsi', b.dataset.rsiDel);
          Views.rsiSelectedId = null;
          renderRsi(document.getElementById('analysisBody'));
          UI.toast('已删除', 'ok');
        });
      };
    });
  }

  function openRsiForm(rec) {
    const defaultRows = rec ? rec.rows : [
      { drop: 20, flightMs: '', contactMs: '' },
      { drop: 20, flightMs: '', contactMs: '' },
      { drop: 30, flightMs: '', contactMs: '' },
      { drop: 40, flightMs: '', contactMs: '' }
    ];
    const m = UI.modal({
      title: rec ? '编辑 RSI 测试' : '录入 RSI 跳深测试',
      wide: true,
      body:
        '<div class="form-grid" style="margin-bottom:10px">' +
        '<div class="field"><label>测试日期</label><input id="rsi-date" type="date" value="' + esc(rec ? rec.date : Store.today()) + '"></div>' +
        '<div class="field"><label>测试名称</label><input id="rsi-name" value="' + esc(rec ? rec.name : '跳深 RSI 测试') + '"></div>' +
        '<div class="field full"><label>试跳数据</label></div>' +
        '</div>' +
        '<div class="table-wrap"><table class="data" id="rsiRows"><thead><tr><th class="num">跳深高度 (cm)</th><th class="num">腾空时间 (ms)</th><th class="num">触地时间 (ms)</th><th class="num">RSI（自动）</th><th></th></tr></thead><tbody>' +
        defaultRows.map(function (r) {
          return '<tr>' +
            '<td><input class="r-drop" type="number" step="1" min="0" style="width:80px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value="' + esc(r.drop) + '"></td>' +
            '<td><input class="r-flight" type="number" step="1" min="0" style="width:95px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value="' + esc(r.flightMs) + '"></td>' +
            '<td><input class="r-contact" type="number" step="1" min="0" style="width:95px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value="' + esc(r.contactMs) + '"></td>' +
            '<td class="r-auto mono muted" style="text-align:right">—</td>' +
            '<td class="actions"><button class="icon-btn" data-rm>🗑</button></td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<div class="row" style="margin-top:8px"><button class="btn btn-sm" id="rsiAddRow">＋ 加一行</button></div>' +
        '<div class="field full" style="margin-top:8px"><label>备注</label><input id="rsi-note" value="' + esc(rec ? rec.note : '') + '"></div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" data-save>保存</button>',
      onMount: function (body) {
        function recalc(tr) {
          const drop = +tr.querySelector('.r-drop').value;
          const flight = +tr.querySelector('.r-flight').value;
          const contact = +tr.querySelector('.r-contact').value;
          const out = tr.querySelector('.r-auto');
          if (flight > 0 && contact > 0) {
            const rr = Analytics.rsiRow({ drop: drop, flightMs: flight, contactMs: contact });
            out.textContent = rr ? fmt(rr.rsi, 2) : '—';
          } else out.textContent = '—';
        }
        body.querySelectorAll('#rsiRows tbody tr').forEach(function (tr) {
          tr.querySelectorAll('input').forEach(function (i) {
            i.oninput = function () { recalc(tr); };
          });
          tr.querySelector('[data-rm]').onclick = function () {
            if (body.querySelectorAll('#rsiRows tbody tr').length <= 1) return;
            tr.remove();
          };
        });
        body.querySelector('#rsiAddRow').onclick = function () {
          const tb = body.querySelector('#rsiRows tbody');
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><input class="r-drop" type="number" min="0" style="width:80px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value="30"></td>' +
            '<td><input class="r-flight" type="number" min="0" style="width:95px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value=""></td>' +
            '<td><input class="r-contact" type="number" min="0" style="width:95px;border:1px solid #d5deea;border-radius:7px;padding:5px 8px" value=""></td>' +
            '<td class="r-auto muted" style="text-align:right">—</td>' +
            '<td class="actions"><button class="icon-btn" data-rm>🗑</button></td>';
          tb.appendChild(tr);
          tr.querySelectorAll('input').forEach(function (i) {
            i.oninput = function () {
              const flight = +tr.querySelector('.r-flight').value, contact = +tr.querySelector('.r-contact').value;
              const drop = +tr.querySelector('.r-drop').value;
              if (flight > 0 && contact > 0) {
                const rr = Analytics.rsiRow({ drop: drop, flightMs: flight, contactMs: contact });
                tr.querySelector('.r-auto').textContent = rr ? fmt(rr.rsi, 2) : '—';
              } else tr.querySelector('.r-auto').textContent = '—';
            };
          });
          tr.querySelector('[data-rm]').onclick = function () { tr.remove(); };
        };
        body.querySelector('[data-save]').onclick = function () {
          const q = function (id) { return body.querySelector(id); };
          const date = q('#rsi-date').value, name = q('#rsi-name').value.trim();
          if (!date || !name) { UI.toast('请填写日期与名称', 'err'); return; }
          const rows = [];
          let hasData = false;
          body.querySelectorAll('#rsiRows tbody tr').forEach(function (tr) {
            const drop = +tr.querySelector('.r-drop').value;
            const flight = +tr.querySelector('.r-flight').value;
            const contact = +tr.querySelector('.r-contact').value;
            if (!flight && !contact) return;
            if (!flight || !contact) { UI.toast('存在未填写完整的试跳行', 'err'); hasData = 'bad'; return; }
            rows.push({ drop: drop || 0, flightMs: flight, contactMs: contact });
            hasData = true;
          });
          if (hasData === 'bad') return;
          if (!hasData) { UI.toast('请至少填写一次有效试跳', 'err'); return; }
          const data = { date: date, name: name, rows: rows, note: q('#rsi-note').value.trim() };
          if (rec) { Store.update('rsi', rec.id, data); Views.rsiSelectedId = rec.id; }
          else { const created = Store.add('rsi', data); Views.rsiSelectedId = created.id; }
          UI.toast('RSI 测试已保存', 'ok');
          m.close();
        };
      }
    });
  }

  UI.registerHook('fv', function () {
    Views.analysisTab = 'fv';
    UI.switchView('analysis');
    openFvForm(null);
  });
  UI.registerHook('rsi', function () {
    Views.analysisTab = 'rsi';
    UI.switchView('analysis');
    openRsiForm(null);
  });
})();
