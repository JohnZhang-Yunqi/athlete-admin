/* 数据层：localStorage 持久化、示例数据、通用增删改 */
(function () {
  const KEY = 'athlete-os-v1';
  const sleepCats = ['睡眠', '静息心率', '专项训练', '身体围度', '力速测试', 'RSI测试'];
  const trainingCats = ['起跑/加速', '最大速度', '速度耐力', '专项耐力', '一般耐力/节奏', '技术/技巧', '力量训练', '跳跃/增强式', '恢复/再生', '比赛/测验', '综合'];

  const defaults = {
    athletes: [],
    activeAthleteId: null,
    profile: {
      name: '张筠骐',
      event: '',
      team: '',
      coach: '',
      birth: '',
      sex: '',
      height: 180,
      weight: 64,
      pbs: {},
      note: ''
    },
    settings: {
      sleepGoalH: 8,
      rhrWarnDelta: 5,
      weightWarnDelta: 1.2
    },
    sleep: [],
    rhr: [],
    training: [],
    body: [],
    fv: [],
    rsi: [],
    plans: []
  };
  const DATA_COLLS = ['sleep', 'rhr', 'training', 'body', 'fv', 'rsi', 'plans'];
  function emptyData() {
    const d = {};
    DATA_COLLS.forEach(function (c) { d[c] = []; });
    return d;
  }
  function cloneProfile(p) {
    return JSON.parse(JSON.stringify(p || defaults.profile));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function dstr(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function today() { return dstr(new Date()); }
  function addDays(base, n) {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  }
  function dateFromStr(s) {
    const p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
  }

  function mulberry(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function fmtTime(d) {
    return pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function normBody(rec) {
    const metrics = {
      weight: 'kg', neck: 'cm', shoulder: 'cm', chest: 'cm', waist: 'cm',
      hip: 'cm', thighL: 'cm', thighR: 'cm', calfL: 'cm', calfR: 'cm',
      armL: 'cm', armR: 'cm'
    };
    const out = {};
    Object.keys(metrics).forEach(function (k) {
      out[k] = (typeof rec[k] === 'number' && isFinite(rec[k])) ? +rec[k].toFixed(1) : null;
    });
    return out;
  }

  /* ---------------- 示例数据生成 ---------------- */
  function sampleData() {
    const rand = mulberry(20260801);
    const now = new Date();
    const data = JSON.parse(JSON.stringify(defaults));
    data.profile = JSON.parse(JSON.stringify(defaults.profile));
    const S = {};

    // 为每天生成一份确定性的伪随机序列
    for (let i = 0; i <= 75; i++) {
      const d = addDays(now, -i);
      S[dstr(d)] = rand();
    }
    function rnd(date, a, b) { return a + S[date] * (b - a); }
    function pick(date, arr) { return arr[Math.floor(S[date] * arr.length) % arr.length]; }

    /* --- 睡眠：床/醒时间、时长、质量 --- */
    for (let i = 74; i >= 0; i--) {
      const date = dstr(addDays(now, -i));
      const r = S[date];
      const hard = i >= 1 && i <= 70 && S[dstr(addDays(now, -i - 1))] > 0.82;
      const weekend = new Date(dateFromStr(date)).getDay() === 0 || new Date(dateFromStr(date)).getDay() === 6;
      let hours = 7.1 + (r * 1.5) + (weekend ? 0.35 : 0) + (hard ? -0.6 : 0);
      hours = Math.max(5.7, Math.min(9.3, hours));
      const bedMin = Math.round(23 * 60 + 5 + (r * 55) - (weekend ? 12 : 0));
      const totalMin = Math.round(hours * 60);
      const wakeMin = bedMin + totalMin - (bedMin >= 24 * 60 ? 24 * 60 : 0);
      const bedH = Math.floor((bedMin % (24 * 60)) / 60), bedM = bedMin % 60;
      const wakeH = Math.floor((wakeMin % (24 * 60)) / 60), wakeM = wakeMin % 60;
      const quality = Math.min(5, Math.max(2, Math.round(3.2 + r * 2.1 - (hard ? 0.7 : 0))));
      const notes = [];
      if (hard) notes.push('训练强度大，入睡稍晚');
      if (r > 0.93 && !hard) notes.push('睡前少看手机，状态良好');
      data.sleep.push({
        id: uid(), date: date,
        bed: pad(bedH) + ':' + pad(bedM),
        wake: pad(wakeH) + ':' + pad(wakeM),
        wakeups: r > 0.86 ? 1 : 0,
        quality: quality,
        duration: +hours.toFixed(2),
        note: notes.join('；')
      });
    }

    /* --- 静息心率 --- */
    let trend = 0;
    for (let i = 74; i >= 0; i--) {
      const date = dstr(addDays(now, -i));
      const priorTraining = data.training.length > 0;
      const isHeavy = i >= 2 && i <= 72 && S[dstr(addDays(now, -i - 2))] > 0.8;
      trend = trend + (rand() - 0.5) * 1.8 - trend * 0.16;
      let bpm = 47 + trend + (isHeavy ? 2.8 + rand() * 2 : 0) + Math.round((rand() - 0.5) * 2);
      bpm = Math.max(41, Math.round(bpm));
      const note = [];
      if (isHeavy) note.push('前一训练日后偏高');
      if (bpm <= 43) note.push('恢复良好');
      data.rhr.push({ id: uid(), date: date, bpm: bpm, note: note.join('；') });
    }

    /* --- 专项训练（参考附件训练表风格） --- */
    const catMap = {
      1: ['起跑/加速', ['4×30m 起跑（RI=3\')', '2×50m 行进间加速', '高翻 45kg×3×3 组', '臀中肌+栏架热身'], 70, 7],
      2: ['最大速度', ['flying 30m×5（RI=4\', SI=8\'）', 'flying 60m×3（95%）', '卧推 6×70%→3×85%'], 80, 8],
      3: ['速度耐力', ['(200+150+100)m×2 组（RI=2\', SI=5\'）', '250m×1 95% 冲刺', '150m×2 接近全力'], 85, 9],
      4: ['力量训练', ['深蹲 5×70% / 4×75% / 3×80% / 2×85%', '保加利亚分腿蹲 4×6', '髋部爆发 3×6'], 75, 8],
      5: ['技术/技巧', ['4×50m 技术跑', '栏架灵活度', '跑的专门性练习'], 40, 4],
      6: ['跳跃/增强式', ['跳箱 3×6', '跨步跳 10 级×4', 'Pogo 跳 4×12'], 45, 6],
      7: ['一般耐力/节奏', ['慢跑 15min', 'tempo (200+150+100)×3'], 65, 6],
      8: ['恢复/再生', ['慢跑 20min', '动态拉伸 + 泡沫轴', '哥本哈根侧桥 3×30s'], 35, 2]
    };
    const weekContent = {
      1: ['慢跑热身 15min', '栏架灵活度 + 跑的专门性练习', '4×50m 技术跑', '4×30m 起跑（RI=3\'）', '高翻 40kg×3×4 → 50kg×2×2'],
      2: ['慢跑热身 15min', '动态激活 + 栏架', '6×50m 技术跑', '(200+150+100)m×3（RI=2\', SI=5\'）', '卧推 6e 70% / 4e 80% / 3e 88%'],
      3: ['主动恢复：慢跑 15min', '臀中肌支撑 3×10', '蚌式 3×12', '哥本哈根 3×30s'],
      4: ['慢跑热身 15min', '栏架灵活度', '4×50m 技术跑', '雪橇拖 10kg×4（25-30m，3min）', '起跑 10m×2 / 30m×2 / 50m×1', '高翻 45kg×3×3 / 弓步走'],
      5: ['慢跑热身 15min', '技术跑 4×50m', 'flying 30m×6（RI=4\'）', '100m×4 上坡（走回休息）', '安全杠深蹲 7/6/5/4/3/2 次'],
      6: ['主动恢复：慢跑 15min', '跳箱 3×6', '跳上跳下 3×12', '跨步跳 10 级×4']
    };
    let heavyFlag = 0;
    for (let i = 74; i >= 0; i--) {
      const date = dstr(addDays(now, -i));
      const day = new Date(dateFromStr(date)).getDay(); // 0 Sun..6 Sat
      if (day === 0) continue;
      const r = S[date];
      if (r > 0.12) {
        const weekKey = Math.min(6, day === 6 ? 6 : ((i % 4) === 0 ? 5 : (day === 4 ? 4 : (day === 2 ? 2 : (day === 5 ? 5 : 1)))));
        const conf = day === 2 && (i % 3 === 0) ? catMap[3] : (day === 5 && i % 4 === 0 ? catMap[6] : (day === 1 ? catMap[1] : (day === 2 ? catMap[2] : (day === 4 ? catMap[4] : catMap[5]))));
        const content = weekContent[weekKey] || weekContent[1];
        const duration = Math.max(30, Math.round(55 + r * 50));
        const rpe = conf[3] || 6;
        const fatigue = Math.min(10, rpe + Math.round((r - 0.5) * 3));
        const session = {
          id: uid(), date: date,
          category: conf[0], theme: conf[0] + '课',
          durationMin: duration, rpe: rpe, fatigue: fatigue,
          content: content.join('\n'),
          distance: conf[0] === '恢复/再生' ? null : Math.round(900 + r * 1800),
          notes: '',
          load: +(duration * rpe / 60).toFixed(1)
        };
        data.training.push(session);
      }
    }
    data.training.sort(function (a, b) { return a.date < b.date ? -1 : 1; });

    /* --- 身体围度：每 6-8 天 --- */
    let bw = 64.4;
    for (let i = 74; i >= 0; i -= 7) {
      const date = dstr(addDays(now, -i));
      bw += (rand() - 0.58) * 0.9;
      const rec = {
        id: uid(), date: date,
        weight: +Math.max(61, bw).toFixed(1),
        neck: +(36.1 + rand() * 0.8).toFixed(1),
        shoulder: +(108 + rand() * 2).toFixed(1),
        chest: +(94 + rand() * 2).toFixed(1),
        waist: +(74.5 - i * 0.018 + rand() * 1.4).toFixed(1),
        hip: +(93 + rand() * 2).toFixed(1),
        thighL: +(55.5 + rand() * 1.4).toFixed(1),
        thighR: +(55.4 + rand() * 1.4).toFixed(1),
        calfL: +(37.5 + rand() * 1).toFixed(1),
        calfR: +(37.4 + rand() * 1).toFixed(1),
        armL: +(29.8 + rand() * 0.9).toFixed(1),
        armR: +(29.9 + rand() * 0.9).toFixed(1),
        note: ''
      };
      data.body.push(rec);
    }

    /* --- 力速测试（Sprint F-v，模拟 splits） --- */
    function sprintSplits(vmax, tau, distances) {
      const out = [];
      function rootFor(d) {
        // 解 d = vmax*(t + tau*(exp(-t/tau)-1))
        let lo = 0, hi = d / 1 + 2;
        for (let k = 0; k < 60; k++) {
          const mid = (lo + hi) / 2;
          const val = vmax * (mid + tau * (Math.exp(-mid / tau) - 1));
          if (val < d) lo = mid; else hi = mid;
        }
        return lo;
      }
      distances.forEach(function (d) {
        out.push({ d: d, t: +rootFor(d).toFixed(3) });
      });
      return out;
    }
    const fvDates = [];
    for (let i = 0; i < 5; i++) fvDates.push(dstr(addDays(now, -i * 13 - 4)));
    fvDates.reverse().forEach(function (date, idx) {
      const progress = idx * 0.02 + (rand() - 0.5) * 0.02;
      const vmax = 10.25 + progress * 0.8;
      const tau = 1.48 - progress * 0.05 + (rand() - 0.5) * 0.06;
      const splits = sprintSplits(vmax, tau, [5, 10, 15, 20, 30, 40, 50, 60]);
      data.fv.push({
        id: uid(), date: date, name: '最大速度加速剖面 ' + (idx + 1),
        type: '短跑分段时间法', mass: 64,
        splits: splits,
        note: idx === 4 ? '赛季末冲刺能力有提升' : ''
      });
    });

    /* --- RSI（跳深测试） --- */
    const rsiDates = [];
    for (let i = 0; i < 4; i++) rsiDates.push(dstr(addDays(now, -i * 16 - 6)));
    rsiDates.reverse().forEach(function (date, idx) {
      const base = 2.05 + idx * 0.11 + (rand() - 0.5) * 0.08;
      const rows = [20, 30, 40].map(function (h, k) {
        const jh = 0.30 + idx * 0.012 + (rand() - 0.5) * 0.04 + h * 0.0025;
        const ct = (jh * 1000) / (base + idx * 0.05 + (k - 1) * 0.05 - (rand() - 0.5) * 0.08);
        return {
          drop: h, flightMs: Math.round(Math.sqrt(jh * 8 / 9.81) * 1000),
          contactMs: Math.round(ct), note: ''
        };
      });
      data.rsi.push({
        id: uid(), date: date, name: '跳深 RSI 测试 ' + (idx + 1),
        rows: rows, note: idx === 3 ? '触地时间改善明显' : ''
      });
    });

    /* --- 训练计划示例 --- */
    const planStart = dstr(addDays(now, -10));
    const planEnd = dstr(addDays(now, 3));
    const days = {};
    const blocks = {
      1: ['慢跑 15min', '栏架灵活度', '4×50m 技术跑', '4×30m 起跑（RI=3\'）', '高翻 45kg 3×3'],
      2: ['慢跑 15min', '动态激活', 'flying 30m×5', '200m+150m+100m 组合×2'],
      3: ['主动恢复 20min', '臀中肌支撑 3×10', '泡沫轴放松'],
      4: ['慢跑 15min', '4×50m 技术跑', '雪橇拖 10kg×4', '起跑 30m×4'],
      5: ['慢跑 15min', '技术跑', 'flying 60m×3', '100m 上坡×4'],
      6: ['主动恢复', '跳箱 3×6', '跨步跳 10 级×4']
    };
    for (let i = -9; i <= 2; i++) {
      const d = addDays(now, i);
      const day = d.getDay();
      if (day === 0) continue;
      const date = dstr(d);
      const title = ['加速力量日', '速度耐力日', '恢复日', '起跑+爆发日', '最大速度日', '跳跃/恢复日'][day - 1];
      days[date] = {
        title: title, category: ['起跑/加速', '速度耐力', '恢复/再生', '起跑/加速', '最大速度', '跳跃/增强式'][day - 1],
        content: (blocks[day] || []).join('\n'),
        done: i < 0,
        logId: i < 0 ? 'seed' : ''
      };
    }
    data.plans.push({
      id: uid(), name: '赛前训练周（示例）', phase: '赛前训练 TP', cycle: '2026 年 8-9 月',
      start: planStart, end: planEnd,
      note: '参考 Randy Huntington 风格周计划模板。绿色代表已完成。',
      days: days
    });

    // 将示例数据打包为第一位运动员（张筠骐）
    const sampleId = 'athlete-sample';
    data.profile = Object.assign({ id: sampleId }, data.profile);
    data.athletes = [{
      id: sampleId,
      profile: data.profile,
      data: {
        sleep: data.sleep,
        rhr: data.rhr,
        training: data.training,
        body: data.body,
        fv: data.fv,
        rsi: data.rsi,
        plans: data.plans
      }
    }];
    data.activeAthleteId = sampleId;
    data.meta = { sample: true, created: new Date().toISOString() };
    return data;
  }

  /* ---------------- Store ---------------- */
  const Store = {
    KEY: KEY,
    defaults: defaults,
    sleepCats: sleepCats,
    trainingCats: trainingCats,
    state: null,
    uid: uid,
    today: today,
    dstr: dstr,
    addDays: addDays,
    dateFromStr: dateFromStr,
    fmtTime: fmtTime,
    normBody: normBody,

    activeAthlete: function () {
      return this.state.athletes.find(function (a) { return a.id === this.state.activeAthleteId; }, this) || this.state.athletes[0] || null;
    },
    activeCounts: function () {
      const out = {};
      DATA_COLLS.forEach(function (c) { out[c] = (this.state[c] || []).length; }, this);
      out.profile = this.state.profile || {};
      return out;
    },

    /* 兼容老备份：把旧的顶层 profile + 各数组收敛为 athletes 结构 */
    _ensureAthleteStructure: function (opts) {
      const state = this.state;
      const personalMigration = !opts || opts.personalMigration !== false;
      state.athletes = Array.isArray(state.athletes) ? state.athletes : [];

      if (!state.athletes.length) {
        let legacyProfile = cloneProfile(state.profile);
        const untouchedSample = legacyProfile.height === 179 && legacyProfile.weight === 64.5 && legacyProfile.birth === '2006-03-18';
        if (personalMigration && (!legacyProfile.name || legacyProfile.name === '张驰（示例）' ||
            String(legacyProfile.name).indexOf('示例') >= 0 || untouchedSample)) {
          legacyProfile = cloneProfile(defaults.profile);
        }
        legacyProfile = Object.assign({ id: legacyProfile.id || uid() }, legacyProfile);
        state.athletes.push({
          id: legacyProfile.id,
          profile: legacyProfile,
          data: {
            sleep: Array.isArray(state.sleep) ? state.sleep : [],
            rhr: Array.isArray(state.rhr) ? state.rhr : [],
            training: Array.isArray(state.training) ? state.training : [],
            body: Array.isArray(state.body) ? state.body : [],
            fv: Array.isArray(state.fv) ? state.fv : [],
            rsi: Array.isArray(state.rsi) ? state.rsi : [],
            plans: Array.isArray(state.plans) ? state.plans : []
          }
        });
      }

      // 规范化每位运动员
      state.athletes = state.athletes.map(function (a) {
        const id = a.id || uid();
        const prof = Object.assign({ id: id }, cloneProfile(a.profile), { id: id });
        const data = emptyData();
        DATA_COLLS.forEach(function (c) {
          data[c] = Array.isArray(a.data && a.data[c]) ? a.data[c] : [];
        });
        return { id: id, profile: prof, data: data };
      });

      const active = state.athletes.find(function (a) { return a.id === state.activeAthleteId; }) || state.athletes[0];
      state.activeAthleteId = active.id;
      // 顶层数组与 profile 作为“当前运动员”的镜像
      state.profile = cloneProfile(active.profile);
      DATA_COLLS.forEach(function (c) { state[c] = active.data[c]; });
    },

    load: function () {
      let raw = null;
      try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          this.state = Object.assign({}, JSON.parse(JSON.stringify(defaults)), parsed);
          this._ensureAthleteStructure();
          this.save();
          return;
        } catch (e) { /* fallthrough 重建 */ }
      }
      this.state = sampleData();
      this.save();
    },
    _syncCurrent: function () {
      const active = this.activeAthlete();
      if (!active) return;
      this.state.profile = Object.assign({}, this.state.profile || {}, { id: active.id });
      active.profile = cloneProfile(this.state.profile);
      DATA_COLLS.forEach(function (c) {
        if (Array.isArray(this.state[c])) active.data[c] = this.state[c];
      }, this);
    },
    save: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch (e) {
        UI && UI.toast && UI.toast('保存失败：浏览器存储空间可能已满', 'err');
      }
    },
    changed: function () {
      this._syncCurrent();
      this.save();
      if (window.__onDataChange) window.__onDataChange();
    },
    add: function (coll, obj) {
      obj.id = obj.id || uid();
      this.state[coll].push(obj);
      this.changed();
      return obj;
    },
    update: function (coll, id, patch) {
      const it = this.state[coll].find(function (x) { return x.id === id; });
      if (it) { Object.assign(it, patch, { id: id }); this.changed(); }
      return it;
    },
    remove: function (coll, id) {
      this.state[coll] = this.state[coll].filter(function (x) { return x.id !== id; });
      this.changed();
    },

    setActiveAthlete: function (id) {
      if (!this.state.athletes.some(function (a) { return a.id === id; })) return;
      this._syncCurrent();
      this.state.activeAthleteId = id;
      this._ensureAthleteStructure({ personalMigration: false });
      this.changed();
    },
    addAthlete: function (profileData) {
      this._syncCurrent();
      const id = uid();
      const prof = Object.assign({ id: id }, cloneProfile(defaults.profile), profileData || {}, { id: id });
      const athlete = { id: id, profile: prof, data: emptyData() };
      this.state.athletes.push(athlete);
      this.state.activeAthleteId = id;
      this._ensureAthleteStructure({ personalMigration: false });
      this.changed();
      return athlete;
    },
    removeAthlete: function (id) {
      if (this.state.athletes.length <= 1) { UI.toast('至少保留一名运动员', 'err'); return false; }
      this._syncCurrent();
      this.state.athletes = this.state.athletes.filter(function (a) { return a.id !== id; });
      if (this.state.activeAthleteId === id) {
        this.state.activeAthleteId = this.state.athletes[0].id;
        this._ensureAthleteStructure({ personalMigration: false });
      }
      this.changed();
      return true;
    },
    clearCurrentData: function () {
      const active = this.activeAthlete();
      if (!active) return;
      active.data = emptyData();
      this.state.activeAthleteId = active.id;
      this._ensureAthleteStructure({ personalMigration: false });
      this.changed();
    },

    replaceState: function (data) {
      const base = JSON.parse(JSON.stringify(defaults));
      this.state = Object.assign(base, data || {}, { meta: Object.assign({ sample: false }, (data || {}).meta) });
      if (!data || !data.athletes) this.state.profile = Object.assign({}, defaults.profile, data && data.profile || {});
      this._ensureAthleteStructure({ personalMigration: false });
      this.changed();
    },
    loadSample: function () {
      this.state = sampleData();
      this._ensureAthleteStructure({ personalMigration: false });
      this.changed();
    },
    clearAll: function () {
      // 清空全部：保留一名空白默认运动员，数据全部为空
      const id = uid();
      const prof = Object.assign({ id: id }, cloneProfile(defaults.profile));
      this.state = Object.assign({}, JSON.parse(JSON.stringify(defaults)), {
        athletes: [{ id: id, profile: prof, data: emptyData() }],
        activeAthleteId: id,
        profile: prof
      });
      this.changed();
    },
    exportJson: function () {
      return JSON.stringify(this.state, null, 2);
    },
    importJson: function (text) {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object') throw new Error('不是有效的备份文件');
      if (!Array.isArray(data.sleep) || !Array.isArray(data.rhr)) throw new Error('备份缺少必要数据字段');
      this.replaceState(data);
    }
  };

  // CSV 工具（导出用）
  function csvEscape(v) {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  Store.csv = function (cols, rows) {
    return [cols.map(csvEscape).join(',')]
      .concat(rows.map(function (r) { return cols.map(function (c) { return csvEscape(r[c] === undefined ? '' : r[c]); }).join(','); }))
      .join('\n');
  };
  Store.download = function (filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1200);
  };

  window.Store = Store;
})();
