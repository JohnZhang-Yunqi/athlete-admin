/* 轻量 Canvas 图表引擎（折线 / 分组柱状 / 叠加柱状 / 散点+回归线） */
(function () {
  const PALETTE = ['#1b6ab0', '#0ea5a4', '#e25563', '#f2a03d', '#6d5bd0', '#16a34a', '#7c93ad', '#d97706'];
  const GRAY = '#8fa1b5';

  function fitCanvas(canvas, cssH) {
    const dpr = window.devicePixelRatio || 1;
    const parent = canvas.parentElement;
    const w = parent.clientWidth || 600;
    const h = cssH || parent.clientHeight || 240;
    canvas.style.height = h + 'px';
    canvas.width = Math.max(40, Math.round(w * dpr));
    canvas.height = Math.max(40, Math.round(h * dpr));
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: w, h: h };
  }

  function resolveCanvas(arg) {
    if (arg && arg.tagName === 'CANVAS') return arg;
    const cv = document.createElement('canvas');
    if (arg && arg.appendChild) arg.appendChild(cv);
    return cv;
  }

  function niceTicks(min, max, count) {
    if (min === max) { min -= 1; max += 1; }
    const span = max - min;
    const step0 = span / count;
    const mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const norm = step0 / mag;
    let step;
    if (norm <= 1) step = 1; else if (norm <= 2) step = 2; else if (norm <= 5) step = 5; else step = 10;
    step *= mag;
    const lo = Math.floor(min / step) * step;
    const hi = Math.ceil(max / step) * step;
    const ticks = [];
    for (let v = lo; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 10000) / 10000);
    return { min: ticks[0], max: ticks[ticks.length - 1], ticks: ticks };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawLegend(ctx, series, x, y, maxW) {
    let cx = x;
    ctx.font = '11px -apple-system,"PingFang SC",sans-serif';
    ctx.textBaseline = 'middle';
    series.forEach(function (s, i) {
      const txt = s.name || '';
      const w = ctx.measureText(txt).width + 18;
      if (cx + w > x + maxW) { cx = x; y += 16; }
      ctx.fillStyle = s.color || PALETTE[i % PALETTE.length];
      ctx.fillRect(cx, y - 2.5, 10, 5);
      ctx.fillStyle = '#4a5a6e';
      ctx.fillText(txt, cx + 14, y + 0.5);
      cx += w;
    });
  }

  function drawEmpty(canvas, msg) {
    const ctx = canvas.getContext('2d');
    const r = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = '13px "PingFang SC",sans-serif';
    ctx.fillStyle = GRAY;
    ctx.textAlign = 'center';
    ctx.fillText(msg || '暂无数据', r.width / 2, r.height / 2);
  }

  /* ---------------- 折线图 ---------------- */
  function line(canvas, cfg) {
    canvas = resolveCanvas(canvas);
    const cssH = cfg.height || null;
    const { ctx, w, h } = fitCanvas(canvas, cssH);
    ctx.clearRect(0, 0, w, h);
    const labels = cfg.labels || [];
    const series = (cfg.series || []).filter(function (s) { return s.data && s.data.some(function (v) { return v !== null && v !== undefined; }); });
    if (!labels.length || !series.length) { drawEmpty(canvas, cfg.emptyText); return; }

    let topPad = cfg.legend === false ? 10 : 26;
    const left = 52, right = cfg.rightPad || 18, bottom = cfg.xAxis === false ? 26 : 40, top = topPad;
    const plotW = w - left - right, plotH = h - top - bottom;
    const all = [];
    series.forEach(function (s) { s.data.forEach(function (v) { if (v !== null && v !== undefined) all.push(v); }); });
    if (cfg.goal) all.push(cfg.goal.value);
    let mn = all.length ? Math.min.apply(null, all) : 0;
    let mx = all.length ? Math.max.apply(null, all) : 1;
    if (cfg.zeroBaseline) mn = Math.min(0, mn);
    const padSpan = Math.max((mx - mn) * 0.12, 0.6);
    mn -= padSpan; mx += padSpan;
    const ticks = niceTicks(mn, mx, 4);
    const xAt = function (i) { return labels.length <= 1 ? left + plotW / 2 : left + plotW * i / (labels.length - 1); };
    const yAt = function (v) { return top + plotH - (v - ticks.min) / (ticks.max - ticks.min) * plotH; };

    // 网格 + Y 轴
    ctx.font = '10.5px -apple-system,sans-serif';
    ctx.lineWidth = 1;
    ticks.ticks.forEach(function (tv) {
      const y = yAt(tv);
      ctx.strokeStyle = '#e7edf4';
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotW, y); ctx.stroke();
      ctx.fillStyle = GRAY; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      const fmt = cfg.yFmt || function (v) { return Math.round(v * 100) / 100; };
      ctx.fillText(String(fmt(tv)), left - 7, y);
    });
    if (cfg.yLabel) {
      ctx.save();
      ctx.translate(11, top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.fillStyle = GRAY;
      ctx.fillText(cfg.yLabel, 0, 0);
      ctx.restore();
    }

    // X 轴标签（稀疏）
    const step = Math.max(1, Math.ceil(labels.length / 10));
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillStyle = GRAY;
    for (let i = 0; i < labels.length; i++) {
      if (i % step !== 0 && i !== labels.length - 1) continue;
      ctx.fillText(String(labels[i]), xAt(i), top + plotH + 7);
    }
    if (cfg.xLabel) { ctx.fillText(cfg.xLabel, left + plotW / 2, h - 13); }

    // 参考线
    if (cfg.goal) {
      const y = yAt(cfg.goal.value);
      ctx.strokeStyle = 'rgba(217,119,6,.45)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotW, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#b45309'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      const goalTxt = (cfg.goal.label ? cfg.goal.label + ' ' : '目标 ') + String(cfg.goal.value);
      ctx.fillText(goalTxt, left + plotW, y - 3);
    }

    // 数据系列
    series.forEach(function (s, si) {
      const color = s.color || PALETTE[si % PALETTE.length];
      const pts = [];
      s.data.forEach(function (v, i) {
        if (v === null || v === undefined) return;
        pts.push({ x: xAt(i), y: yAt(v), v: v, i: i });
      });
      if (!pts.length) return;
      if (s.area && pts.length > 1) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, top + plotH);
        pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.lineTo(pts[pts.length - 1].x, top + plotH);
        ctx.closePath();
        const g = ctx.createLinearGradient(0, top, 0, top + plotH);
        const c = s.areaColor || color;
        g.addColorStop(0, s.areaColor || c + '33');
        g.addColorStop(1, s.areaColor || c + '08');
        ctx.fillStyle = g;
        ctx.fill();
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = s.width || 2;
      ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      pts.forEach(function (p, j) { if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
      ctx.setLineDash([]);
      if (s.points !== false) {
        pts.forEach(function (p) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, s.radius || 3, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
      if (s.avg) {
        const avg = s.data.filter(function (v) { return v !== null; }).reduce(function (a, b) { return a + b; }, 0) / s.data.filter(function (v) { return v !== null; }).length;
        const y = yAt(avg);
        ctx.strokeStyle = color;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotW, y); ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    if (cfg.legend !== false) drawLegend(ctx, series, left, 11, plotW);
    // 边框
    ctx.strokeStyle = '#eef2f7';
    ctx.strokeRect(left, top, plotW, plotH);
  }

  /* ---------------- 柱状图 ---------------- */
  function bar(canvas, cfg) {
    canvas = resolveCanvas(canvas);
    const cssH = cfg.height || null;
    const { ctx, w, h } = fitCanvas(canvas, cssH);
    ctx.clearRect(0, 0, w, h);
    const labels = cfg.labels || [];
    const series = (cfg.series || []).filter(function (s) { return s.data && s.data.some(function (v) { return v; }); });
    if (!labels.length || !series.length) { drawEmpty(canvas, cfg.emptyText); return; }
    const stacked = cfg.stacked;
    const left = 52, right = 14, top = cfg.legend === false ? 12 : 27, bottom = 42;
    const plotW = w - left - right, plotH = h - top - bottom;
    const all = [];
    series.forEach(function (s) {
      s.data.forEach(function (v, i) {
        if (!v) return;
        if (stacked) {
          // 计算累计列需要二次遍历，简化：先收集单值再换算最大值
        }
        all.push(v);
      });
    });
    if (stacked) {
      labels.forEach(function (_, i) {
        let sum = 0;
        series.forEach(function (s) { sum += s.data[i] || 0; });
        all.push(sum);
      });
    }
    let mn = 0, mx = all.length ? Math.max.apply(null, all) : 1;
    mx += mx * 0.1 || 1;
    const ticks = niceTicks(mn, mx, 4);
    const yAt = function (v) { return top + plotH - (v - ticks.min) / (ticks.max - ticks.min) * plotH; };
    ctx.font = '10.5px -apple-system,sans-serif';
    ticks.ticks.forEach(function (tv) {
      const y = yAt(tv);
      ctx.strokeStyle = '#e7edf4';
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + plotW, y); ctx.stroke();
      ctx.fillStyle = GRAY; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(tv * 100) / 100), left - 7, y);
    });
    const step = Math.max(1, Math.ceil(labels.length / 12));
    ctx.fillStyle = GRAY; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i < labels.length; i++) {
      if (i % step !== 0 && i !== labels.length - 1) continue;
      const x = left + plotW * (i + 0.5) / labels.length;
      ctx.fillText(String(labels[i]), x, top + plotH + 7);
    }
    const groupW = plotW / labels.length * 0.72;
    const slotW = stacked ? groupW : groupW / series.length;
    labels.forEach(function (_, i) {
      const gx = left + plotW * i / labels.length + plotW / labels.length * 0.14;
      if (stacked) {
        let base = 0;
        series.forEach(function (s, si) {
          const v = s.data[i] || 0;
          const y0 = yAt(base + v), y1 = yAt(base);
          ctx.fillStyle = s.color || PALETTE[si % PALETTE.length];
          roundRect(ctx, gx + 1, y0, groupW - 2, Math.max(1, y1 - y0), 2);
          ctx.fill();
          base += v;
        });
      } else {
        series.forEach(function (s, si) {
          const v = s.data[i] || 0;
          const bw = Math.min(16, slotW * 0.72);
          const x = gx + slotW * si + (slotW - bw) / 2;
          ctx.fillStyle = s.color || PALETTE[si % PALETTE.length];
          roundRect(ctx, x, yAt(v), bw, Math.max(1, yAt(0) - yAt(v)), 2);
          ctx.fill();
          if (v !== 0 && cfg.showValues && plotH > 150) {
            ctx.fillStyle = '#66788e'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
            ctx.fillText(String(Math.round(v * 10) / 10), x + bw / 2, yAt(v) - 2);
          }
        });
      }
    });
    if (cfg.yLabel) {
      ctx.save();
      ctx.translate(11, top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center'; ctx.fillStyle = GRAY;
      ctx.fillText(cfg.yLabel, 0, 0);
      ctx.restore();
    }
    if (cfg.legend !== false) drawLegend(ctx, series, left, 11, plotW);
    ctx.strokeStyle = '#eef2f7';
    ctx.strokeRect(left, top, plotW, plotH);
  }

  /* ---------------- 散点 + 回归 ---------------- */
  function scatter(canvas, cfg) {
    canvas = resolveCanvas(canvas);
    const cssH = cfg.height || null;
    const { ctx, w, h } = fitCanvas(canvas, cssH);
    ctx.clearRect(0, 0, w, h);
    const sets = (cfg.sets || []).filter(function (s) { return s.points && s.points.length; });
    if (!sets.length) { drawEmpty(canvas, cfg.emptyText); return; }
    const left = 56, right = 20, top = cfg.legend === false ? 14 : 30, bottom = 44;
    const plotW = w - left - right, plotH = h - top - bottom;
    const xs = [], ys = [];
    sets.forEach(function (s) { s.points.forEach(function (p) { xs.push(p.x); ys.push(p.y); }); });
    const xT = niceTicks(Math.min.apply(null, xs), Math.max.apply(null, xs), 4);
    const yT = niceTicks(Math.min.apply(null, ys), Math.max.apply(null, ys), 4);
    const xAt = function (v) { return left + (v - xT.min) / (xT.max - xT.min) * plotW; };
    const yAt = function (v) { return top + plotH - (v - yT.min) / (yT.max - yT.min) * plotH; };
    ctx.font = '10px -apple-system,sans-serif';
    ctx.strokeStyle = '#e7edf4';
    xT.ticks.forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(xAt(v), top); ctx.lineTo(xAt(v), top + plotH); ctx.stroke();
      ctx.fillStyle = GRAY; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(String(Math.round(v * 100) / 100), xAt(v), top + plotH + 6);
    });
    yT.ticks.forEach(function (v) {
      ctx.beginPath(); ctx.moveTo(left, yAt(v)); ctx.lineTo(left + plotW, yAt(v)); ctx.stroke();
      ctx.fillStyle = GRAY; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(v * 100) / 100), left - 6, yAt(v));
    });
    if (cfg.xLabel) { ctx.fillStyle = GRAY; ctx.textAlign = 'center'; ctx.fillText(cfg.xLabel, left + plotW / 2, h - 8); }
    if (cfg.yLabel) {
      ctx.save();
      ctx.translate(12, top + plotH / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = GRAY; ctx.textAlign = 'center';
      ctx.fillText(cfg.yLabel, 0, 0);
      ctx.restore();
    }
    sets.forEach(function (s, si) {
      const color = s.color || PALETTE[si % PALETTE.length];
      if (s.line) {
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(s.dash || []);
        ctx.beginPath();
        const x0 = xT.min, x1 = xT.max;
        ctx.moveTo(xAt(x0), yAt(s.line.a * x0 + s.line.b));
        ctx.lineTo(xAt(x1), yAt(s.line.a * x1 + s.line.b));
        ctx.stroke(); ctx.setLineDash([]);
      }
      s.points.forEach(function (p) {
        ctx.beginPath();
        ctx.arc(xAt(p.x), yAt(p.y), s.r || 4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke();
      });
    });
    ctx.fillStyle = '#4a5a6e'; ctx.font = '11px -apple-system,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    sets.forEach(function (s, si) {
      const color = s.color || PALETTE[si % PALETTE.length];
      ctx.fillStyle = color;
      ctx.fillRect(left, top - 18 + si * 16, 9, 5);
      ctx.fillStyle = '#4a5a6e';
      ctx.fillText(s.name || ('系列 ' + (si + 1)), left + 13, top - 15.5 + si * 16);
    });
    ctx.strokeStyle = '#eef2f7';
    ctx.strokeRect(left, top, plotW, plotH);
  }

  window.Charts = {
    PALETTE: PALETTE,
    line: line,
    bar: bar,
    scatter: scatter,
    fitCanvas: fitCanvas,
    niceTicks: niceTicks
  };
})();
