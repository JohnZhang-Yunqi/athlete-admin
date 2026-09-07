/* 运动科学计算：力速剖面 / RSI / 统计汇总 / 回归 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Analytics = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const G = 9.81;

  function round(v, d) {
    const m = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(v * m) / m;
  }
  function mean(arr) {
    const a = arr.filter(function (x) { return x !== null && x !== undefined && isFinite(x); });
    return a.length ? a.reduce(function (s, v) { return s + v; }, 0) / a.length : null;
  }
  function stats(arr) {
    const a = arr.filter(function (x) { return x !== null && x !== undefined && isFinite(x); });
    if (!a.length) return { n: 0, mean: null, min: null, max: null, sum: 0 };
    let s = 0, mn = Infinity, mx = -Infinity;
    a.forEach(function (v) { s += v; if (v < mn) mn = v; if (v > mx) mx = v; });
    return { n: a.length, mean: s / a.length, min: mn, max: mx, sum: s };
  }

  function linReg(xs, ys) {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return { a: 0, b: 0, r2: 0, n: n };
    let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
    for (let i = 0; i < n; i++) {
      sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; syy += ys[i] * ys[i];
    }
    const denom = n * sxx - sx * sx;
    const a = denom ? (n * sxy - sx * sy) / denom : 0;
    const b = denom ? (sy - a * sx) / n : mean(ys);
    let r2 = 0;
    if (n > 2) {
      const ssTot = syy - sy * sy / n;
      const ssRes = syy - b * sy - a * sxy;
      r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 1;
    } else {
      r2 = 1;
    }
    return { a: a, b: b, r2: r2, n: n };
  }

  /* 单指数模型 d(t)=vmax*(t+tau*(e^(-t/tau)-1)) 的 t(d) 数值求根 */
  function modelTime(vmax, tau, d) {
    let lo = 0, hi = 2 + d / Math.max(0.5, vmax);
    for (let k = 0; k < 80; k++) {
      const mid = (lo + hi) / 2;
      const val = vmax * (mid + tau * (Math.exp(-mid / tau) - 1));
      if (val < d) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function modelDist(vmax, tau, t) {
    return vmax * (t + tau * (Math.exp(-t / tau) - 1));
  }

  /* Nelder-Mead 最小二乘拟合 (vmax, tau) */
  function fitMonoExp(splits) {
    const pts = (splits || []).filter(function (p) { return p && isFinite(p.d) && isFinite(p.t) && p.d > 0 && p.t > 0; });
    if (pts.length < 3) return null;
    // 初始猜测
    let maxD = 0, maxT = 0;
    pts.forEach(function (p) { if (p.d > maxD) maxD = p.d; if (p.t > maxT) maxT = p.t; });
    const vGuess = maxD / maxT * 1.08;
    const tauGuess = 1.5;

    function cost(x) {
      const vmax = Math.max(0.5, x[0]), tau = Math.max(0.2, x[1]);
      let s = 0;
      pts.forEach(function (p) {
        const e = modelTime(vmax, tau, p.d) - p.t;
        s += e * e;
      });
      return s;
    }
    function nm(f, x0, tol) {
      const n = x0.length;
      let simplex = [];
      for (let i = 0; i <= n; i++) {
        const p = x0.slice();
        if (i > 0) p[i - 1] *= 1.12;
        simplex.push({ p: p, f: f(p) });
      }
      simplex.sort(function (a, b) { return a.f - b.f; });
      for (let it = 0; it < 500; it++) {
        const best = simplex[0], worst = simplex[n];
        if (Math.abs(worst.f - best.f) < (tol || 1e-10) * (1 + Math.abs(best.f))) break;
        const centroid = [];
        for (let j = 0; j < n; j++) {
          let s = 0;
          for (let i = 0; i < n; i++) s += simplex[i].p[j];
          centroid.push(s / n);
        }
        function reflect(alpha) {
          const p = [];
          for (let j = 0; j < n; j++) p.push(centroid[j] + alpha * (centroid[j] - worst.p[j]));
          return { p: p, f: f(p) };
        }
        const r = reflect(1);
        if (r.f < best.f) {
          const e = reflect(2);
          simplex[n] = e.f < r.f ? e : r;
        } else if (r.f < simplex[n - 1].f) {
          simplex[n] = r;
        } else {
          const c = reflect(-0.5);
          if (c.f < worst.f) { simplex[n] = c; }
          else {
            for (let i = 1; i <= n; i++) {
              simplex[i].p = simplex[i].p.map(function (v, j) { return (simplex[0].p[j] + v) / 2; });
              simplex[i].f = f(simplex[i].p);
            }
          }
        }
        simplex.sort(function (a, b) { return a.f - b.f; });
      }
      return { vmax: simplex[0].p[0], tau: simplex[0].p[1], cost: simplex[0].f };
    }

    const fit = nm(cost, [vGuess, tauGuess], 1e-12);
    const vmax = Math.max(0.5, fit.vmax), tau = Math.max(0.2, fit.tau);
    // 拟合优度
    const tMean = mean(pts.map(function (p) { return p.t; }));
    let ssTot = 0, ssRes = 0;
    pts.forEach(function (p) {
      ssTot += Math.pow(p.t - tMean, 2);
      ssRes += Math.pow(modelTime(vmax, tau, p.d) - p.t, 2);
    });
    const r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 1;
    return {
      vmax: vmax, tau: tau, r2: r2,
      fitted: pts.map(function (p) {
        return { d: p.d, tObs: p.t, tFit: modelTime(vmax, tau, p.d) };
      }),
      residuals: pts.map(function (p) { return modelTime(vmax, tau, p.d) - p.t; })
    };
  }

  /* 由短跑分段时间计算加速力速剖面（单指数模型；F = m·a，忽略风阻的常用简化） */
  function profileFromSprint(test) {
    const mass = test && test.mass ? Number(test.mass) : 0;
    const fit = fitMonoExp(test && test.splits);
    if (!fit || !mass) return null;
    const a0 = fit.vmax / fit.tau;               // 理论最大加速度 m/s²
    const F0 = mass * a0;                         // 最大水平力 N
    const Pmax = mass * a0 * fit.vmax / 4;        // 最大功率 W
    const sv = a0 / fit.vmax;                     // 标准化力速斜率 1/s
    let type;
    if (sv > 0.8) type = '力量主导';
    else if (sv >= 0.6) type = '力量-速度均衡';
    else type = '速度主导';
    return {
      fit: fit,
      mass: mass,
      F0: F0, F0kg: F0 / mass,
      a0: a0,
      V0: fit.vmax,
      Pmax: Pmax, Pmaxkg: Pmax / mass,
      sv: sv,
      type: type,
      r2: fit.r2
    };
  }

  /* RSI：JH = g·Tf²/8；RSI = JH(m) / 触地时间(s) */
  function rsiRow(row) {
    const tf = Number(row.flightMs) / 1000, tc = Number(row.contactMs) / 1000;
    if (!isFinite(tf) || !isFinite(tc) || tf <= 0 || tc <= 0) return null;
    const jh = G * tf * tf / 8;   // m
    return {
      flightMs: row.flightMs, contactMs: row.contactMs, drop: row.drop || 0,
      heightCm: jh * 100,
      rsi: jh / tc
    };
  }
  function sessionRSI(session) {
    const rows = (session.rows || []).map(rsiRow).filter(Boolean);
    if (!rows.length) return null;
    const vals = rows.map(function (r) { return r.rsi; });
    return {
      rows: rows,
      mean: mean(vals),
      best: Math.max.apply(null, vals),
      worst: Math.min.apply(null, vals),
      n: rows.length
    };
  }

  /* 周一开始的 ISO 周 key */
  function monday(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const day = x.getDay() || 7;
    x.setDate(x.getDate() - day + 1);
    return x;
  }
  function weekKey(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const m = monday(d);
    return m.getFullYear() + '-W' + String(Math.ceil((m - new Date(m.getFullYear(), 0, 1)) / 86400000 / 7) + 1);
  }
  function weekLabel(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const m = monday(d);
    return (m.getMonth() + 1) + '.' + String(m.getDate()).padStart(2, '0');
  }

  /* 最近 n 天内的记录按天分组 map date -> {sleep,rhr,training:[],body,fv,rsi} */
  function indexByDate(state) {
    const map = {};
    function add(date, key, val) {
      if (!date) return;
      if (!map[date]) map[date] = {};
      if (!map[date][key]) map[date][key] = [];
      map[date][key].push(val);
    }
    (state.sleep || []).forEach(function (r) { add(r.date, 'sleep', r); });
    (state.rhr || []).forEach(function (r) { add(r.date, 'rhr', r); });
    (state.training || []).forEach(function (r) { add(r.date, 'training', r); });
    (state.body || []).forEach(function (r) { add(r.date, 'body', r); });
    (state.fv || []).forEach(function (r) { add(r.date, 'fv', r); });
    (state.rsi || []).forEach(function (r) { add(r.date, 'rsi', r); });
    (state.plans || []).forEach(function (pl) {
      Object.keys(pl.days || {}).forEach(function (date) {
        const d = pl.days[date];
        add(date, 'plan', Object.assign({ planName: pl.name, planId: pl.id }, d, { date: date }));
      });
    });
    return map;
  }

  function sortDescByDate(arr) {
    return arr.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }
  function sortAscByDate(arr) {
    return arr.slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }

  /* 最近 n 天里每个日期的最近一次 rhr/sleep/training 负荷 合计 */
  function dailySeries(state, days) {
    const idx = indexByDate(state);
    const todayD = new Date();
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(todayD);
      d.setDate(d.getDate() - i);
      const ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      const rec = idx[ds] || {};
      out.push({
        date: ds,
        sleep: rec.sleep && rec.sleep.length ? rec.sleep[rec.sleep.length - 1] : null,
        rhr: rec.rhr && rec.rhr.length ? rec.rhr[rec.rhr.length - 1] : null,
        trainings: rec.training || [],
        bodies: rec.body || []
      });
    }
    return out;
  }

  function sleepDuration(rec) {
    if (rec && rec.duration) return +rec.duration;
    if (!rec || !rec.bed || !rec.wake) return null;
    const p = function (t) { const a = t.split(':'); return +a[0] * 60 + +a[1]; };
    let min = p(rec.wake) - p(rec.bed);
    if (min <= 0) min += 1440;
    return +(min / 60).toFixed(2);
  }

  function rhrAlert(state, rec) {
    // 与近 7 天（不含当天）均值比较
    const base = sortAscByDate(state.rhr || []).filter(function (r) { return !rec.date || r.date < rec.date; }).slice(-7).map(function (r) { return r.bpm; });
    const m = mean(base);
    if (!m) return null;
    const d = rec.bpm - m;
    return { base: +m.toFixed(1), delta: +d.toFixed(1), alert: d > (state.settings.rhrWarnDelta || 5) };
  }

  return {
    G: G, round: round, mean: mean, stats: stats, linReg: linReg,
    modelTime: modelTime, modelDist: modelDist, fitMonoExp: fitMonoExp,
    profileFromSprint: profileFromSprint,
    rsiRow: rsiRow, sessionRSI: sessionRSI,
    monday: monday, weekKey: weekKey, weekLabel: weekLabel,
    indexByDate: indexByDate, sortDescByDate: sortDescByDate, sortAscByDate: sortAscByDate,
    dailySeries: dailySeries, sleepDuration: sleepDuration, rhrAlert: rhrAlert
  };
});
