/* PDF 报告导出：Canvas 分页排版 → JPEG → pdf-lib 组装，本地生成，无需网络 */
(function () {
  const esc = UI.esc;
  const A4W = 794, A4H = 1123, SCALE = 2, M = 46;
  const INK = '#1c2733', MUTED = '#6b7a8d', BRAND = '#123b73', BRAND2 = '#1b6ab0', LINE = '#dde5ef';
  const C = {
    sleep: '#6d5bd0', rhr: '#e25563', training: '#1b6ab0', body: '#f2a03d',
    fv: '#0ea5a4', rsi: '#16a34a', accent: '#20b3aa'
  };

  function hexA(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + alpha + ')';
  }
  function cloneCanvas(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  /* ---------------- 报告文档对象 ---------------- */
  function makeDoc() {
    const doc = {
      pages: [], cur: null, pageNo: 0,
      addPage: function () {
        const c = document.createElement('canvas');
        c.width = A4W * SCALE; c.height = A4H * SCALE;
        const ctx = c.getContext('2d');
        ctx.scale(SCALE, SCALE);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, A4W, A4H);
        this.pages.push(c);
        this.cur = ctx;
        this.pageNo++;
        return ctx;
      },
      addHeader: function (title, sub) {
        const ctx = this.ensure();
        ctx.save();
        ctx.fillStyle = BRAND;
        ctx.fillRect(0, 0, A4W, 80);
        ctx.fillStyle = hexA('#20b3aa', 0.35);
        ctx.fillRect(0, 76, A4W, 4);
        ctx.fillStyle = '#ffffff';
        ctx.font = '700 23px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(title, M, 32);
        ctx.font = '500 12px -apple-system,"PingFang SC",sans-serif';
        ctx.fillStyle = '#c7d9ef';
        ctx.fillText(sub, M, 57);
        ctx.restore();
        return 96;
      },
      ensure: function () {
        if (!this.cur) this.addPage();
        return this.cur;
      },
      footer: function (y) {
        const ctx = this.ensure();
        if (!y) y = A4H - 28;
        ctx.save();
        ctx.fillStyle = '#9aa9ba';
        ctx.font = '10px -apple-system,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('运动员训练管理系统 · Athlete OS — 本地生成报告  第 ' + this.pageNo + ' 页', A4W / 2, y);
        ctx.restore();
      },
      text: function (str, x, y, o) {
        const ctx = this.ensure();
        o = o || {};
        ctx.save();
        ctx.font = (o.bold ? '700 ' : '500 ') + (o.size || 13) + 'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
        ctx.fillStyle = o.color || INK;
        ctx.textBaseline = o.baseline || 'top';
        if (o.maxWidth) {
          const lines = wrapText(ctx, String(str), o.maxWidth);
          lines.forEach(function (ln, i) {
            ctx.fillText(ln, x, y + i * ((o.lineH || 1.45) * (o.size || 13)));
          });
          return y + lines.length * ((o.lineH || 1.45) * (o.size || 13));
        }
        ctx.fillText(String(str), x, y);
        ctx.restore();
        return y + (o.size || 13);
      },
      section: function (title, y, color) {
        const ctx = this.ensure();
        y = y + 2;
        ctx.save();
        ctx.fillStyle = color || BRAND;
        ctx.fillRect(M, y, 4, 18);
        ctx.font = '700 15px -apple-system,"PingFang SC",sans-serif';
        ctx.fillStyle = INK;
        ctx.textBaseline = 'top';
        ctx.fillText(title, M + 13, y);
        ctx.restore();
        return y + 25;
      },
      rule: function (y, color) {
        const ctx = this.ensure();
        ctx.save();
        ctx.strokeStyle = color || LINE;
        ctx.beginPath();
        ctx.moveTo(M, y);
        ctx.lineTo(A4W - M, y);
        ctx.stroke();
        ctx.restore();
        return y + 10;
      },
      line: function (x1, y1, x2, y2, color, lw) {
        const ctx = this.ensure();
        ctx.save();
        ctx.strokeStyle = color || LINE;
        ctx.lineWidth = lw || 1;
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        ctx.restore();
      },
      rect: function (x, y, w, h, fill, radius) {
        const ctx = this.ensure();
        ctx.save();
        ctx.fillStyle = fill;
        if (radius) {
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.arcTo(x + w, y, x + w, y + h, radius);
          ctx.arcTo(x + w, y + h, x, y + h, radius);
          ctx.arcTo(x, y + h, x, y, radius);
          ctx.arcTo(x, y, x + w, y, radius);
          ctx.closePath();
          ctx.fill();
        } else ctx.fillRect(x, y, w, h);
        ctx.restore();
      },
      image: function (img, x, y, w, h) {
        const ctx = this.ensure();
        if (typeof img === 'string') {
          const im = new Image();
          // 调用方统一传 canvas
        }
        ctx.drawImage(img, x, y, w, h);
        return y + h;
      },
      need: function (h) {
        // 若剩余空间不足则翻页（不含页脚）
        if (this.cur && this.pageY + h > A4H - 62) {
          this.footer();
          this.addPage();
          return true;
        }
        return false;
      },
      table: function (cols, rows, o) {
        const self = this;
        o = o || {};
        const startX = M;
        const totalW = A4W - M * 2;
        const widths = o.widths || cols.map(function (_, i) { return totalW / cols.length; });
        const headerH = 25;
        const startY = o.y || 0;
        let y = startY;
        const fontSize = o.fontSize || 10.5;
        const padding = 6;

        function header() {
          const ctx = self.ensure();
          ctx.save();
          ctx.fillStyle = '#eef4fb';
          ctx.fillRect(startX, y, totalW, headerH);
          ctx.strokeStyle = LINE;
          let x = startX;
          ctx.font = '700 ' + fontSize + 'px -apple-system,"PingFang SC",sans-serif';
          cols.forEach(function (c, i) {
            ctx.fillStyle = '#3b4c63';
            ctx.textBaseline = 'middle';
            ctx.fillText(c, x + padding, y + headerH / 2 + 0.5);
            x += widths[i];
          });
          ctx.restore();
          y += headerH;
        }
        header();
        rows.forEach(function (row, ri) {
          // 计算本行需要的高度
          let maxLines = 1;
          row.forEach(function (cell, ci) {
            const lines = wrapTextWithCtx(self.ensure(), String(cell === null || cell === undefined ? '' : cell), widths[ci] - padding * 2, fontSize);
            if (lines.length > maxLines) maxLines = lines.length;
          });
          const rowH = Math.max(20, maxLines * (fontSize + 3) + padding);
          if (y + rowH > A4H - 54) {
            self.footer(y - 10);
            self.addPage();
            y = 92;
            self.section(o.continuedTitle || '续上页', y - 16);
            y += 12;
            header();
          }
          const ctx = self.ensure();
          ctx.save();
          if (o.rowColor && o.rowColor(ri)) {
            ctx.fillStyle = o.rowColor(ri);
            ctx.fillRect(startX, y, totalW, rowH);
          }
          ctx.strokeStyle = '#eef2f7';
          ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX + totalW, y); ctx.stroke();
          ctx.font = (o.rowBold && o.rowBold(ri) ? '700 ' : '400 ') + fontSize + 'px -apple-system,"PingFang SC",sans-serif';
          let x = startX;
          row.forEach(function (cell, ci) {
            ctx.fillStyle = o.cellColor || INK;
            const lines = wrapTextWithCtx(ctx, String(cell === null || cell === undefined ? '' : cell), widths[ci] - padding * 2, fontSize);
            ctx.textBaseline = 'top';
            lines.forEach(function (ln, li) {
              ctx.fillText(ln, x + padding, y + 5 + li * (fontSize + 3));
            });
            x += widths[ci];
          });
          ctx.restore();
          y += rowH;
        });
        const ctx = self.ensure();
        ctx.save();
        ctx.strokeStyle = '#dde5ef';
        ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(startX + totalW, y); ctx.stroke();
        ctx.restore();
        return y + 12;
      }
    };
    doc.pageY = 0;
    return doc;
  }

  function wrapText(ctx, str, maxW) {
    const out = [];
    String(str).split('\n').forEach(function (seg) {
      if (!seg) { out.push(''); return; }
      let cur = '';
      for (const ch of seg) {
        const test = cur + ch;
        if (ctx.measureText(test).width > maxW && cur) {
          out.push(cur);
          cur = ch;
        } else cur = test;
      }
      if (cur) out.push(cur);
    });
    return out.length ? out : [''];
  }
  function wrapTextWithCtx(ctx, str, maxW, fontSize) {
    ctx.save();
    ctx.font = '400 ' + fontSize + 'px -apple-system,"PingFang SC",sans-serif';
    const out = wrapText(ctx, str, maxW);
    ctx.restore();
    return out;
  }

  function dateBetween(arr, start, end) {
    return (arr || []).filter(function (r) {
      return (!start || r.date >= start) && (!end || r.date <= end);
    });
  }
  function fmtNum(v, d) { return v === null || v === undefined || !isFinite(v) ? '—' : Number(v).toFixed(d === undefined ? 1 : d); }

  /* 把已有图表 canvas 画进文档（按宽度等比缩放） */
  function placeChart(doc, canvas, y, width, caption) {
    const h = canvas.height / canvas.width * width;
    doc.pageY = y;
    if (doc.need(h + 36)) y = 96;
    const x = M + (A4W - M * 2 - width) / 2;
    doc.line(M, y, A4W - M, y, '#dde5ef');
    y += 6;
    doc.image(canvas, x, y, width, h);
    y += h + 5;
    if (caption) { doc.text(caption, x, y, { size: 10, color: MUTED }); y += 14; }
    return y;
  }

  /* 渲染离屏图表，返回 canvas */
  function renderChart(type, cfg, w, h) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;left:-20000px;top:0;width:' + w + 'px;height:' + h + 'px';
    const cv = document.createElement('canvas');
    box.appendChild(cv);
    document.body.appendChild(box);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    cv.style.width = w + 'px'; cv.style.height = h + 'px';
    cv.getContext('2d').setTransform(dpr, 0, 0, dpr, 0, 0);
    cfg.height = h;
    if (type === 'line') Charts.line(cv, cfg);
    else if (type === 'bar') Charts.bar(cv, cfg);
    else if (type === 'scatter') Charts.scatter(cv, cfg);
    const out = cloneCanvas(cv);
    box.remove();
    return out;
  }

  /* ---------------- 报告内容 ---------------- */
  async function generate(opts, onStatus) {
    if (!window.PDFLib) { UI.toast('PDF 库加载失败，请检查 vendor/pdf-lib.min.js', 'err'); return; }
    const state = Store.state;
    const prof = state.profile;
    const start = opts.start, end = opts.end;
    const sleepArr = dateBetween(state.sleep, start, end);
    const rhrArr = dateBetween(state.rhr, start, end);
    const trArr = Analytics.sortAscByDate(dateBetween(state.training, start, end));
    const bodyArr = Analytics.sortAscByDate(dateBetween(state.body, start, end));
    const fvArr = dateBetween(state.fv, start, end);
    const rsiArr = dateBetween(state.rsi, start, end);
    onStatus('正在整理数据…');

    const days = [];
    let cur = Store.dateFromStr(start);
    const endD = Store.dateFromStr(end);
    while (cur <= endD) {
      days.push(Store.dstr(cur));
      cur = Store.addDays(cur, 1);
    }
    const dayIndex = Analytics.indexByDate(state);
    const sleepDaily = days.map(function (d) {
      const rec = (dayIndex[d] && dayIndex[d].sleep || [])[0];
      return { date: d, v: rec ? Analytics.sleepDuration(rec) : null };
    }).filter(function (x) { return x.v !== null; });
    const rhrDaily = days.map(function (d) {
      const rec = (dayIndex[d] && dayIndex[d].rhr || [])[0];
      return { date: d, v: rec ? rec.bpm : null };
    }).filter(function (x) { return x.v !== null; });

    const doc = makeDoc();
    let y = 0;
    const sleepStats = Analytics.stats(sleepDaily.map(function (x) { return x.v; }));
    const rhrStats = Analytics.stats(rhrDaily.map(function (x) { return x.v; }));
    const loadSum = trArr.reduce(function (a, t) { return a + (t.load || 0); }, 0);
    const durSum = trArr.reduce(function (a, t) { return a + (t.durationMin || 0); }, 0);

    /* ---- 第 1 页：封面/概览 ---- */
    doc.addPage();
    y = doc.addHeader('运动员阶段训练与恢复报告', '生成时间：' + new Date().toLocaleString('zh-CN') + ' · 统计区间：' + UI.dateCN(start) + ' ~ ' + UI.dateCN(end));
    y = doc.section('运动员档案', y);
    doc.rect(M, y, A4W - M * 2, 110, '#f5f9fd', 10);
    let x = M + 18;
    y += 16;
    doc.text(prof.name || '未命名', x, y, { size: 19, bold: true, color: BRAND });
    y += 25;
    doc.text('专项：' + (prof.event || '—') + '   队伍：' + (prof.team || '—') + '   教练：' + (prof.coach || '—'), x, y, { size: 11.5, color: MUTED });
    y += 17;
    doc.text('身高 ' + fmtNum(prof.height, 0) + ' cm · 体重 ' + fmtNum(prof.weight, 1) + ' kg · 出生 ' + (prof.birth || '—'), x, y, { size: 11.5, color: MUTED });
    const pbTxt = Object.keys(prof.pbs || {}).map(function (k) { return k + ' ' + prof.pbs[k]; }).join('   |   ');
    if (pbTxt) {
      y += 17;
      doc.text('PB：' + pbTxt, x, y, { size: 11.5, color: BRAND2 });
    }
    y += 28;

    y = doc.section('区间关键指标', y);
    const kpi = [
      { k: '有效睡眠天数', v: sleepDaily.length + ' 天', s: '平均 ' + fmtNum(sleepStats.mean, 1) + ' h' },
      { k: '晨脉记录', v: rhrDaily.length + ' 天', s: '平均 ' + fmtNum(rhrStats.mean, 1) + ' bpm' },
      { k: '训练次数', v: trArr.length + ' 次', s: '总时长 ' + fmtNum(durSum, 0) + ' min' },
      { k: '训练负荷', v: fmtNum(loadSum, 0) + ' AU', s: 'RPE × 时长估算' }
    ];
    const kpiW = (A4W - M * 2 - 36) / 4;
    kpi.forEach(function (k, i) {
      const kx = M + i * (kpiW + 12);
      doc.rect(kx, y, kpiW, 68, i % 2 ? '#f0f7ff' : '#eefbf9', 8);
      doc.text(k.k, kx + 13, y + 11, { size: 10.5, color: MUTED });
      doc.text(k.v, kx + 13, y + 25, { size: 16, bold: true, color: i % 2 ? BRAND2 : '#0d7f78' });
      doc.text(k.s, kx + 13, y + 47, { size: 10, color: MUTED });
    });
    y += 84;
    y = doc.section('区间小结', y);
    const notes = [];
    if (sleepDaily.length) notes.push('区间内有效睡眠记录 ' + sleepDaily.length + ' 天，平均 ' + fmtNum(sleepStats.mean, 1) + ' h/晚' + (sleepStats.mean >= (state.settings.sleepGoalH || 8) ? '，达到目标。' : '，低于 ' + fmtNum(state.settings.sleepGoalH) + ' h 的目标。'));
    if (rhrDaily.length) notes.push('平均晨脉 ' + fmtNum(rhrStats.mean, 1) + ' bpm，区间范围 ' + fmtNum(rhrStats.min, 0) + '–' + fmtNum(rhrStats.max, 0) + ' bpm。');
    if (trArr.length) notes.push('完成 ' + trArr.length + ' 次训练，累计负荷 ' + fmtNum(loadSum, 0) + ' AU（平均 ' + fmtNum(trArr.length ? loadSum / trArr.length : 0, 1) + ' AU/次）。');
    if (bodyArr.length) {
      const last = bodyArr[bodyArr.length - 1];
      notes.push('最近一次围度测量（' + UI.dateCN(last.date) + '）：体重 ' + fmtNum(last.weight) + ' kg' + (last.waist ? '、腰围 ' + fmtNum(last.waist) + ' cm' : '') + (last.hip ? '、臀围 ' + fmtNum(last.hip) + ' cm' : '') + '。');
    }
    if (fvArr.length) {
      const lastFv = fvArr[fvArr.length - 1];
      const p = Analytics.profileFromSprint(lastFv);
      if (p) notes.push('最近力速测试（' + UI.dateCN(lastFv.date) + '）：V0 ' + fmtNum(p.V0, 2) + ' m/s，F0 ' + fmtNum(p.F0, 0) + ' N，Pmax ' + fmtNum(p.Pmax, 0) + ' W，剖面类型：' + p.type + '。');
    }
    if (rsiArr.length) {
      const lastR = rsiArr[rsiArr.length - 1];
      const st = Analytics.sessionRSI(lastR);
      if (st) notes.push('最近 RSI 测试（' + UI.dateCN(lastR.date) + '）：最佳 ' + fmtNum(st.best, 2) + '，平均 ' + fmtNum(st.mean, 2) + '。');
    }
    notes.forEach(function (n) {
      y = doc.text('•  ' + n, M + 4, y, { size: 11.5, color: '#34465d', maxWidth: A4W - M * 2 - 12, lineH: 1.45 });
      y += 8;
    });
    if (!notes.length) y = doc.text('区间内没有足够数据。', M + 4, y, { size: 12, color: MUTED });
    doc.footer();

    /* ---- 睡眠 & 晨脉页 ---- */
    if (opts.modules.sleep && sleepArr.length) {
      doc.addPage();
      y = doc.addHeader('睡眠与晨脉监控', UI.dateCN(start) + ' ~ ' + UI.dateCN(end));
      y = doc.section('睡眠', y, C.sleep);
      doc.rect(M, y, 152, 52, '#f3f0fc', 8);
      doc.text('平均时长', M + 12, y + 9, { size: 10.5, color: MUTED });
      doc.text(fmtNum(sleepStats.mean, 1) + ' h', M + 12, y + 21, { size: 15, bold: true, color: '#5d49c4' });
      doc.rect(M + 164, y, 152, 52, '#f3f0fc', 8);
      doc.text('有效记录', M + 176, y + 9, { size: 10.5, color: MUTED });
      doc.text(sleepArr.length + ' 晚', M + 176, y + 21, { size: 15, bold: true, color: '#5d49c4' });
      y += 64;
      const c1 = renderChart('line', {
        labels: sleepDaily.map(function (d) { return UI.shortDate(d.date); }),
        series: [{ name: '睡眠时长 (h)', color: C.sleep, data: sleepDaily.map(function (d) { return d.v; }), area: true }],
        yLabel: 'h', goal: { value: state.settings.sleepGoalH || 8, label: '目标' }, xAxis: false
      }, 640, 220);
      y = placeChart(doc, c1, y, 640, '图 1：区间逐日睡眠时长与目标线');
      y = doc.section('静息心率', y, C.rhr);
      const rhrAlertN = rhrArr.filter(function (r) {
        const a = Analytics.rhrAlert(state, r);
        return a && a.alert;
      }).length;
      doc.rect(M, y, 240, 48, '#fdf1f2', 8);
      doc.text('平均 ' + fmtNum(rhrStats.mean, 1) + ' bpm', M + 14, y + 8, { size: 14, bold: true, color: '#c43b4d' });
      doc.text('高于 7 日基线天数：' + rhrAlertN, M + 14, y + 29, { size: 10.5, color: MUTED });
      y += 62;
      const rhrBase = [];
      rhrDaily.forEach(function (d, i) {
        const win = rhrDaily.slice(Math.max(0, i - 6), i + 1).map(function (z) { return z.v; });
        rhrBase.push(+Analytics.mean(win).toFixed(1));
      });
      const c2 = renderChart('line', {
        labels: rhrDaily.map(function (d) { return UI.shortDate(d.date); }),
        series: [
          { name: '晨脉', color: C.rhr, data: rhrDaily.map(function (d) { return d.v; }) },
          { name: '7 天基线', color: BRAND2, data: rhrBase, dash: [5, 4], width: 1.5 }
        ],
        yLabel: 'bpm', xAxis: false
      }, 640, 220);
      y = placeChart(doc, c2, y, 640, '图 2：晨脉逐日值与 7 天滚动基线（基线 +' + fmtNum(state.settings.rhrWarnDelta || 5, 0) + ' bpm 以上标为异常）');
      if (rhrArr.length) {
        y = doc.section('最近晨脉记录', y);
        const rows = Analytics.sortDescByDate(rhrArr).slice(0, 24).map(function (r) {
          const a = Analytics.rhrAlert(state, r);
          return [r.date, String(r.bpm), a ? ((a.delta >= 0 ? '+' : '') + fmtNum(a.delta, 1)) : '—', r.note || ''];
        });
        y = doc.table(['日期', '晨脉 (bpm)', '相对基线 (bpm)', '备注'], rows, { y: y, widths: [100, 95, 110, 390], continuedTitle: '晨脉记录' });
      }
      doc.footer();
    } else if (opts.modules.sleep && !sleepArr.length && !rhrArr.length) {
      // 若区间无数据，给提示页
    }

    /* ---- 训练页 ---- */
    if (opts.modules.training && trArr.length) {
      doc.addPage();
      y = doc.addHeader('专项训练记录', UI.dateCN(start) + ' ~ ' + UI.dateCN(end));
      y = doc.section('负荷统计', y, C.training);
      const weekLoads = [], weekDur = [], weekLabels = [];
      const wStart = Analytics.monday(Store.dateFromStr(start));
      for (let i = 0; i < 8; i++) {
        const s = Store.addDays(wStart, i * 7);
        const e = Store.addDays(s, 6);
        const inW = trArr.filter(function (t) { return t.date >= Store.dstr(s) && t.date <= Store.dstr(e); });
        weekLoads.push(+inW.reduce(function (a, t) { return a + (t.load || 0); }, 0).toFixed(1));
        weekDur.push(inW.reduce(function (a, t) { return a + (t.durationMin || 0); }, 0));
        weekLabels.push(UI.shortDate(Store.dstr(s)));
      }
      const c3 = renderChart('bar', {
        labels: weekLabels,
        series: [{ name: '训练负荷 AU', color: C.training, data: weekLoads }],
        yLabel: 'AU', legend: false
      }, 620, 210);
      y = placeChart(doc, c3, y, 620, '图 3：区间所在周训练负荷（含区间前后周便于观察趋势）');
      y = doc.section('训练明细', y, C.training);
      const catCount = {};
      trArr.forEach(function (t) { catCount[t.category] = (catCount[t.category] || 0) + 1; });
      const catTxt = Object.keys(catCount).map(function (k) { return k + ' ×' + catCount[k]; }).join('  ·  ');
      y = doc.text('共 ' + trArr.length + ' 次 · ' + catTxt, M, y, { size: 11, color: MUTED });
      y += 14;
      const trRows = Analytics.sortDescByDate(trArr).slice(0, 80).map(function (t) {
        const firstLine = String(t.content || '').split('\n')[0] || '';
        return [t.date, t.category, t.theme || '—', String(t.durationMin || 0) + "'", t.rpe === null || t.rpe === undefined ? '—' : String(t.rpe), firstLine];
      });
      y = doc.table(['日期', '类别', '主题', '时长', 'RPE', '内容首行'], trRows, {
        y: y, fontSize: 9.5, widths: [84, 82, 110, 48, 38, 392], continuedTitle: '训练明细（续）'
      });
      doc.footer();
    }

    /* ---- 围度页 ---- */
    if (opts.modules.body && bodyArr.length) {
      doc.addPage();
      y = doc.addHeader('身体围度变化', UI.dateCN(start) + ' ~ ' + UI.dateCN(end));
      y = doc.section('体重趋势', y, C.body);
      const c4 = renderChart('line', {
        labels: bodyArr.map(function (b) { return UI.shortDate(b.date); }),
        series: [{ name: '体重 (kg)', color: C.body, data: bodyArr.map(function (b) { return b.weight; }), area: true }],
        yLabel: 'kg', xAxis: false
      }, 640, 210);
      y = placeChart(doc, c4, y, 640, '图 4：体重变化');
      y = doc.section('关键围度趋势', y, C.body);
      const c5 = renderChart('line', {
        labels: bodyArr.map(function (b) { return UI.shortDate(b.date); }),
        series: [
          { name: '胸围', color: '#1b6ab0', data: bodyArr.map(function (b) { return b.chest; }) },
          { name: '腰围', color: '#e25563', data: bodyArr.map(function (b) { return b.waist; }) },
          { name: '臀围', color: '#16a34a', data: bodyArr.map(function (b) { return b.hip; }) }
        ],
        yLabel: 'cm', xAxis: false
      }, 640, 220);
      y = placeChart(doc, c5, y, 640, '图 5：胸 / 腰 / 臀围变化（单位 cm）');
      y = doc.section('围度明细', y, C.body);
      const bRows = Analytics.sortDescByDate(bodyArr).slice(0, 40).map(function (b) {
        return [b.date, fmtNum(b.weight, 1), b.chest ? fmtNum(b.chest, 1) : '—', b.waist ? fmtNum(b.waist, 1) : '—', b.hip ? fmtNum(b.hip, 1) : '—',
          b.thighL ? fmtNum(b.thighL, 1) : '—', b.calfL ? fmtNum(b.calfL, 1) : '—'];
      });
      y = doc.table(['日期', '体重', '胸围', '腰围', '臀围', '左大腿', '左小腿'], bRows, {
        y: y, fontSize: 9.5, widths: [110, 70, 70, 70, 70, 90, 90], continuedTitle: '围度明细（续）'
      });
      doc.footer();
    }

    /* ---- 分析页 ---- */
    if (opts.modules.analysis && (fvArr.length || rsiArr.length)) {
      if (fvArr.length) {
        doc.addPage();
        y = doc.addHeader('力速曲线与 RSI 分析', UI.dateCN(start) + ' ~ ' + UI.dateCN(end));
        const lastFv = Analytics.sortDescByDate(fvArr)[0];
        const p = Analytics.profileFromSprint(lastFv);
        if (p) {
          y = doc.section('加速力速剖面（F-v）', y, C.fv);
          y = doc.text('测试：' + (lastFv.name || '力速测试') + ' · ' + UI.dateCN(lastFv.date) + ' · 体重 ' + fmtNum(lastFv.mass, 1) + ' kg', M, y, { size: 11, color: MUTED });
          y += 14;
          const pW = (A4W - M * 2 - 36) / 4;
          const pItems = [
            ['V0', fmtNum(p.V0, 2) + ' m/s'], ['a0', fmtNum(p.a0, 2) + ' m/s²'],
            ['F0', fmtNum(p.F0, 0) + ' N'], ['Pmax', fmtNum(p.Pmax, 0) + ' W'],
            ['F0/kg', fmtNum(p.F0kg, 2) + ' N/kg'], ['Pmax/kg', fmtNum(p.Pmaxkg, 1) + ' W/kg'],
            ['力速斜率', fmtNum(p.sv, 3)], ['R²', fmtNum(p.r2, 3)]
          ];
          pItems.forEach(function (it, i) {
            const px = M + (i % 4) * (pW + 12);
            const py = y + Math.floor(i / 4) * 58;
            doc.rect(px, py, pW, 52, i % 2 ? '#f0f7ff' : '#eefbf9', 8);
            doc.text(it[0], px + 12, py + 8, { size: 10, color: MUTED });
            doc.text(it[1], px + 12, py + 22, { size: 13.5, bold: true, color: BRAND2 });
          });
          y += 122;
          y = doc.section('剖面图示与拟合', y, C.fv);
          const fit = p.fit;
          const dtPts = fit.fitted.map(function (r) { return { x: r.tObs, y: r.d }; });
          const curve = [];
          const tMax = Math.max.apply(null, fit.fitted.map(function (r) { return r.tFit; }));
          for (let t = 0; t <= tMax; t += 0.04) curve.push({ x: t, y: Analytics.modelDist(p.V0, fit.tau, t) });
          const c6 = renderChart('scatter', {
            sets: [
              { name: '实测', color: '#0ea5a4', points: dtPts, r: 5 },
              { name: '单指数模型 d(t)', color: '#1b6ab0', points: curve, r: 1.2 }
            ],
            xLabel: '时间 (s)', yLabel: '距离 (m)'
          }, 320, 220);
          const linePts = [];
          for (let v = 0; v <= p.V0 * 1.001; v += p.V0 / 40) linePts.push({ x: v, y: Math.max(0, p.mass * (p.a0 - v / fit.tau)) });
          const obsPts = [];
          for (let i = 1; i < lastFv.splits.length; i++) {
            const s0 = lastFv.splits[i - 1], s1 = lastFv.splits[i];
            if (s1.t - s0.t <= 0) continue;
            const vMid = Analytics.modelTime(p.V0, fit.tau, (s0.d + s1.d) / 2);
            const aMid = (p.V0 / fit.tau) * Math.exp(-vMid / fit.tau);
            obsPts.push({ x: vMid, y: p.mass * aMid });
          }
          const c7 = renderChart('scatter', {
            sets: [
              { name: '拟合 F-v 线', color: '#1b6ab0', points: linePts, r: 1.2 },
              { name: '分段估算', color: '#e25563', points: obsPts, r: 4 }
            ],
            xLabel: '速度 (m/s)', yLabel: '水平力 (N)'
          }, 320, 220);
          const c6h = c6.height / c6.width * 320;
          doc.image(c6, M, y, 320, c6h);
          doc.text('图 6a：距离-时间拟合', M, y + c6h + 3, { size: 10, color: MUTED });
          const c7h = c7.height / c7.width * 320;
          doc.image(c7, M + 352, y, 320, c7h);
          doc.text('图 6b：水平力-速度剖面', M + 352, y + c7h + 3, { size: 10, color: MUTED });
          y = y + Math.max(c6h, c7h) + 22;
        }
      }
      if (rsiArr.length) {
        doc.addPage();
        y = doc.addHeader('RSI 反应力量分析', UI.dateCN(start) + ' ~ ' + UI.dateCN(end));
        const rsiAsc = Analytics.sortAscByDate(rsiArr);
        const lastRsi = rsiAsc[rsiAsc.length - 1];
        const st = Analytics.sessionRSI(lastRsi);
        if (st) {
          y = doc.section('反应力量指数 RSI', y, C.rsi);
          y = doc.text('测试：' + (lastRsi.name || 'RSI 测试') + ' · ' + UI.dateCN(lastRsi.date) + ' · RSI = 跳起高度 ÷ 触地时间', M, y, { size: 11, color: MUTED });
          y += 16;
          const bestLabels = [], bestVals = [], meanVals = [];
          rsiAsc.forEach(function (t) {
            const s2 = Analytics.sessionRSI(t);
            if (!s2) return;
            bestLabels.push(UI.shortDate(t.date));
            bestVals.push(+s2.best.toFixed(2));
            meanVals.push(+s2.mean.toFixed(2));
          });
          const c8 = renderChart('line', {
            labels: bestLabels,
            series: [
              { name: '最佳 RSI', color: C.rsi, data: bestVals, points: true },
              { name: '平均 RSI', color: C.fv, data: meanVals, points: true }
            ],
            yLabel: 'RSI'
          }, 620, 210);
          y = placeChart(doc, c8, y, 620, '图 7：历次 RSI 最佳值与平均值趋势');
          y = doc.section('本次试跳明细', y, C.rsi);
          const rRows = st.rows.map(function (r, i) {
            return [String(i + 1), String(r.drop) + ' cm', String(Math.round(r.flightMs)) + ' ms', String(Math.round(r.contactMs)) + ' ms',
              fmtNum(r.heightCm, 1) + ' cm', fmtNum(r.rsi, 2)];
          });
          y = doc.table(['#', '跳深高度', '腾空时间', '触地时间', '跳起高度', 'RSI'], rRows, {
            y: y, widths: [70, 120, 120, 120, 120, 150], continuedTitle: '试跳明细（续）'
          });
          doc.footer();
        }
      }
    }

    /* ---- 拼装 PDF ---- */
    onStatus('正在生成 PDF…');
    const pdfDoc = await PDFLib.PDFDocument.create();
    for (let i = 0; i < doc.pages.length; i++) {
      const dataUrl = doc.pages[i].toDataURL('image/jpeg', 0.9);
      const b64 = dataUrl.split(',')[1];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      const img = await pdfDoc.embedJpg(bytes);
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 pt
      page.drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
      onStatus('正在写入页面 ' + (i + 1) + ' / ' + doc.pages.length + ' …');
      await new Promise(function (res) { setTimeout(res, 8); }); // 让 UI 有时间刷新
    }
    const outBytes = await pdfDoc.save();
    const blob = new Blob([outBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '训练报告-' + start + '_' + end + '.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return doc.pages.length;
  }

  function showDialog() {
    const m = UI.modal({
      title: '导出 PDF 报告',
      wide: false,
      body:
        '<div class="form-grid">' +
        '<div class="field"><label>开始日期</label><input id="pdf-start" type="date" value="' + Store.dstr(Store.addDays(new Date(), -29)) + '"></div>' +
        '<div class="field"><label>结束日期</label><input id="pdf-end" type="date" value="' + Store.today() + '"></div>' +
        '</div>' +
        '<div class="row" style="margin:10px 0 6px">' + [[7, '近 7 天'], [30, '近 30 天'], [90, '近 90 天']].map(function (x) {
          return '<button class="btn btn-sm" data-preset="' + x[0] + '">' + x[1] + '</button>';
        }).join('') + '<button class="btn btn-sm" data-preset="0">全选日期</button></div>' +
        '<div class="hint-text">包含模块：</div>' +
        '<div class="row" style="margin-top:6px">' +
        '<label class="small"><input type="checkbox" data-mod="sleep" checked> 睡眠与晨脉</label>' +
        '<label class="small"><input type="checkbox" data-mod="training" checked> 训练记录</label>' +
        '<label class="small"><input type="checkbox" data-mod="body" checked> 身体围度</label>' +
        '<label class="small"><input type="checkbox" data-mod="analysis" checked> 力速 / RSI</label>' +
        '</div>' +
        '<div id="pdfStatus" class="tagline hidden" style="margin-top:8px"></div>',
      footer: '<button class="btn" data-x>取消</button><button class="btn btn-primary" id="pdfGo" disabled>生成 PDF</button>',
      onMount: function (body) {
        const start = body.querySelector('#pdf-start');
        const end = body.querySelector('#pdf-end');
        const go = body.querySelector('#pdfGo');
        function enable() { go.disabled = !(start.value && end.value && end.value >= start.value); }
        start.onchange = enable; end.onchange = enable;
        body.querySelectorAll('[data-preset]').forEach(function (b) {
          b.onclick = function () {
            const n = +b.dataset.preset;
            if (n === 0) {
              const earliest = [].concat(Store.state.sleep, Store.state.rhr, Store.state.training, Store.state.body, Store.state.fv, Store.state.rsi)
                .map(function (r) { return r.date; }).sort()[0] || Store.today();
              start.value = earliest; end.value = Store.today();
            } else {
              end.value = Store.today();
              start.value = Store.dstr(Store.addDays(new Date(), -(n - 1)));
            }
            enable();
          };
        });
        enable();
        go.onclick = async function () {
          const modules = {};
          body.querySelectorAll('[data-mod]').forEach(function (c) { modules[c.dataset.mod] = c.checked; });
          const opts = { start: start.value, end: end.value, modules: modules };
          go.disabled = true;
          const status = body.querySelector('#pdfStatus');
          status.classList.remove('hidden');
          status.textContent = '正在准备…（页面较多时请稍候）';
          try {
            const n = await generate(opts, function (msg) { status.textContent = msg; });
            UI.toast('PDF 报告已导出（' + n + ' 页）', 'ok');
            setTimeout(m.close, 500);
          } catch (e) {
            console.error(e);
            status.textContent = '生成失败：' + e.message;
            go.disabled = false;
            UI.toast('PDF 生成失败', 'err');
          }
        };
      }
    });
  }

  window.PdfExport = { showDialog: showDialog, generate: generate };
})();
