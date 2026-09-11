// Auto-derived from src/data.js pure matrix engine.
// This module is side-effect free: it has no UI, browser storage, network, or credential access.
const scope = Object.create(null);

/* Awen Study — Matrix data, brand defaults, reference sample, fallback prompt engine.
   Isolated pure algorithm source; no build step. */
(function () {
  const DIMS = [
    {
      key: 'environment', label: 'Environment', zh: '环境', ja: '環境', ko: '환경', fr: 'Environnement', es: 'Entorno', de: 'Umgebung', pt: 'Ambiente', code: 'ENV', layer: 'content',
      options: ['Library', 'Rainy Window', 'Cozy Desk', 'Forest Cabin', 'Ocean View',
                'Kyoto Study Room', 'Space Station', 'Night City', 'Mountain Lodge', 'Quiet Café'],
    },
    {
      key: 'nature', label: 'Nature', zh: '自然', ja: '自然', ko: '자연', fr: 'Nature', es: 'Naturaleza', de: 'Natur', pt: 'Natureza', code: 'NAT', layer: 'content',
      options: ['Rain', 'Light Snow', 'Soft Wind', 'Ocean Waves', 'Birdsong',
                'Fireplace', 'Distant Thunder', 'Forest Stream', 'Rustling Leaves', 'None'],
    },
    {
      key: 'time', label: 'Time', zh: '时间', ja: '時間', ko: '시간', fr: 'Heure', es: 'Hora', de: 'Zeit', pt: 'Hora', code: 'TIME', layer: 'content',
      options: ['Dawn', 'Early Morning', 'Afternoon', 'Golden Hour', 'Dusk',
                'Evening', 'Night', 'Midnight', '3 AM'],
    },
    {
      key: 'mood', label: 'Mood', zh: '情绪', ja: '気分', ko: '기분', fr: 'Humeur', es: 'Ánimo', de: 'Stimmung', pt: 'Humor', code: 'MOOD', layer: 'content',
      options: ['Calm', 'Cozy', 'Warm', 'Nostalgic', 'Bittersweet',
                'Hopeful', 'Dreamy', 'Focused', 'Lonely'],
    },
    {
      key: 'instrument', label: 'Instrument', zh: '乐器', ja: '楽器', ko: '기구', fr: 'Instrument', es: 'Instrumento', de: 'Instrument', pt: 'Instrumento', code: 'INST', layer: 'content',
      options: ['Felt Piano', 'Grand Piano', 'Warm Pad', 'Strings', 'Rhodes',
                'Acoustic Guitar', 'Music Box', 'Vibraphone', 'Cello', 'Harp'],
    },
    {
      key: 'style', label: 'Style', zh: '风格', ja: 'スタイル', ko: '스타일', fr: 'Style', es: 'Estilo', de: 'Stil', pt: 'Estilo', code: 'STY', layer: 'production',
      options: ['Ambient', 'Neo Classical', 'Lo-fi Hip Hop', 'Chillhop', 'Jazzhop',
                'Minimal Piano', 'Drone Ambient', 'Slowcore'],
    },
  ];

  const BPM = { key: 'bpm', label: 'BPM', code: 'BPM', layer: 'production',
                values: [55, 58, 60, 62, 65, 68, 70] };

  // Brand-fixed recommendations from the master plan (Calm / Cozy / Warm · Ambient · Felt Piano · 55-70).
  const DEFAULTS = {
    environment: 'Library', nature: 'Rain', time: 'Night',
    mood: 'Calm', instrument: 'Felt Piano', style: 'Ambient', bpm: 60,
  };

  // Imported mainstream lo-fi sample — represented abstractly, only used to seed decompose defaults.
  const REFERENCE = {
    source: 'Spotify', id: '3q7MJsEXF5aDhjOPx8nbaI',
    label: 'Imported reference', sub: 'mainstream lo-fi sample · decomposed',
    decomposed: {
      environment: 'Rainy Window', nature: 'Rain', time: 'Night',
      mood: 'Calm', instrument: 'Felt Piano', style: 'Lo-fi Hip Hop', bpm: 62,
    },
  };

  const CONTENT_KEYS = ['environment', 'nature', 'time', 'mood', 'instrument'];

  function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function randomSelection() {
    const s = {};
    DIMS.forEach(d => { s[d.key] = rand(d.options); });
    s.bpm = rand(BPM.values);
    return s;
  }

  // Count how many dimensions differ from the reference baseline.
  function mutations(sel) {
    let n = 0;
    Object.keys(REFERENCE.decomposed).forEach(k => {
      if (sel[k] !== REFERENCE.decomposed[k]) n++;
    });
    return n;
  }

  // Production/texture tag layer — the part Suno actually responds to.
  // Beat-driven styles get drums + swing; ambient/piano styles stay drumless and airy.
  const BEAT_STYLES = ['Lo-fi Hip Hop', 'Chillhop', 'Jazzhop'];
  function textureTags(style) {
    return BEAT_STYLES.includes(style)
      ? 'soft brushed drums, gentle swing, warm tape saturation, vinyl crackle, sidechained pad, mellow'
      : 'no drums, warm tape saturation, soft room reverb, low-pass filter, airy, intimate';
  }

  // Deterministic fallback prompt engine (used when the AI call fails).
  function fallbackPrompt(s) {
    const natureClause = s.nature === 'None' ? '' : `, ${s.nature.toLowerCase()} ambience`;
    const sceneLight = s.nature === 'None' ? 'soft warm light' : `${s.nature.toLowerCase()} in the scene`;
    const place = s.environment.toLowerCase();
    const titleWords = {
      'Rainy Window': 'Rain on the Glass', 'Library': 'Quiet in the Stacks',
      'Cozy Desk': 'Desk Lamp Hours', 'Forest Cabin': 'Cabin in the Pines',
      'Ocean View': 'Tide Line', 'Kyoto Study Room': 'Paper Screens',
      'Space Station': 'Low Orbit', 'Night City': 'After the Last Train',
      'Mountain Lodge': 'Above the Treeline', 'Quiet Café': 'Corner Table',
    };
    const title = titleWords[s.environment] || `${s.environment} ${s.time}`;
    return {
      title,
      tagline: `${s.mood.toLowerCase()} · ${s.time.toLowerCase()}`,
      suno: {
        style: `${s.style}, ${s.mood.toLowerCase()} lo-fi, ${s.instrument.toLowerCase()}, ${s.bpm} bpm, ${textureTags(s.style)}, instrumental`,
        prompt: `Instrumental ${s.style.toLowerCase()} led by ${s.instrument.toLowerCase()}${natureClause}, ${s.mood.toLowerCase()} and study-friendly.`,
        exclude: 'vocals, lyrics, harsh percussion, sudden dynamics',
      },
      cover: `Square 1:1 album cover: a ${place} at ${s.time.toLowerCase()}, ${s.mood.toLowerCase()} mood, ${sceneLight}. Centered composition with calm negative space near the top for a title, soft warm light, painterly film grain. No text, no motion.`,
      video: `16:9 looping background: a ${place} at ${s.time.toLowerCase()}, ${s.mood.toLowerCase()} and still, ${sceneLight}. Very slow cinematic camera drift, shallow depth of field, gentle film grain, seamless loop.`,
    };
  }

  /* ============================ ALBUM ENGINE ============================
     An album = a FIXED sonic identity (the base recipe) + ONE traversal axis
     that progresses across tracks. Only the axis's "moving" dimension(s) change
     track-to-track; everything else is held constant. That is what makes a set
     of tracks read as a single album instead of a playlist. */

  const ENV_JOURNEY = ['Quiet Café', 'Library', 'Cozy Desk', 'Rainy Window', 'Forest Cabin',
                       'Mountain Lodge', 'Ocean View', 'Kyoto Study Room', 'Night City', 'Space Station'];
  const NATURE_SEASON = ['Birdsong', 'Rustling Leaves', 'Soft Wind', 'Forest Stream', 'Ocean Waves',
                         'Rain', 'Distant Thunder', 'Light Snow', 'Fireplace'];
  const MOOD_ARC = ['Hopeful', 'Warm', 'Cozy', 'Calm', 'Dreamy', 'Nostalgic', 'Bittersweet', 'Lonely'];
  const MOOD_HEAL = ['Lonely', 'Bittersweet', 'Nostalgic', 'Calm', 'Warm', 'Hopeful'];
  const TIME_ARC = ['Dawn', 'Early Morning', 'Afternoon', 'Golden Hour', 'Dusk', 'Evening', 'Night', 'Midnight', '3 AM'];
  const TIME_MORNING = ['Dawn', 'Early Morning', 'Afternoon', 'Golden Hour'];
  const TIME_LATE = ['Evening', 'Night', 'Midnight', '3 AM'];
  const STORM_FRONT = ['Soft Wind', 'Rain', 'Distant Thunder', 'Rain', 'Forest Stream', 'Birdsong'];

  const ALBUM_AXES = [
    { key: 'day',    label: 'Day Arc',          moves: ['time'],
      zh: '时间从清晨走到午夜，一天的完整弧线（最经典）',
      ja: '清晨から深夜まで、一日の完成弧（最も経典的）', ko: '찬배부터 심약까지, 하루의 완전한 호', fr: "Du matin à minuit, l'arc complet d'une journée", es: 'Del amanecer a medianoche, el arco completo de un día', de: 'Von früh bis Mitternacht — der komplette Tagesbogen', pt: 'Do amanhecer à meia-noite, o arco completo de um dia',
      en: 'Time walks from dawn to midnight — a full day arc (classic).', seq: { time: TIME_ARC } },
    { key: 'place',  label: 'Place Journey',    moves: ['environment'],
      zh: '镜头穿过一连串场景空间，像一段漫游',
      ja: 'カメラが一紪のシーン空間を通り過ぎるような漫遊', ko: '카메라가 연이된 장소를 걷는 만하천', fr: "La caméra traverse une série d'espaces", es: 'La cámara atraviesa una serie de espacios', de: 'Die Kamera wandert durch eine Reihe von Räumen', pt: 'A câmera atravessa uma série de espaços',
      en: 'The camera moves through a series of spaces, like a journey.', seq: { environment: ENV_JOURNEY } },
    { key: 'season', label: 'Seasons Turning',  moves: ['nature'],
      zh: '环境氛围从生机流转到深冬',
      ja: '環境の雅が春から深冬まで流れる', ko: '환경 분위기가 보리부터 겨울까지 흐른다', fr: "L'ambiance passe du printemps à l'hiver profond", es: 'El ambiente fluye desde la primavera hasta el invierno profundo', de: 'Die Stimmung wandert vom Frühling bis zum tiefen Winter', pt: 'O ambiente flui da primavera ao inverno profundo',
      en: 'Ambience turns from fresh spring to deep winter.', seq: { nature: NATURE_SEASON } },
    { key: 'morning', label: 'Morning Rise',    moves: ['time', 'bpm', 'mood'], gen: 'morning',
      zh: '清晨到午后，节奏渐快、情绪转向专注——学习开场',
      ja: '清晨から午後まで、リズムが上がり気分が専門に向かう――学習開場', ko: '찬배부터 오후까지, 리펀가 높아지고 문든이 집중돈', fr: "Du matin à l'après-midi, rythme accéléré — ouverture d'étude", es: 'De mañana a tarde, ritmo acelerándose — apertura de estudio', de: 'Von früh bis nachmittags, Tempo steigt — Studienauftakt', pt: 'Da manhã à tarde, ritmo acelerando — abertura de estudo',
      en: 'Dawn to afternoon: tempo lifts, mood turns toward focus — a study warm-up.' },
    { key: 'focus',  label: 'Focus Session',    moves: ['bpm', 'mood'], gen: 'focus',
      zh: '节奏先升后落、中段进入专注——贴合一次真实学习时段',
      ja: 'リズムが先上後落ち、中段で集中に入る――一回の真実の学習時帯', ko: '리펀이 선 상승 후 하락, 중단에 집중 입잌', fr: "Rythme monte puis descend — colle à une vraie session d'étude", es: 'Ritmo sube y baja — coincide con una sesión real de estudio', de: 'Tempo erst hoch dann runter — passt zu einer echten Lerneinheit', pt: 'Ritmo sobe e desce — combina com uma sessão real de estudo',
      en: 'Tempo rises then falls, focus peaks mid-set — one real study session.' },
    { key: 'latenight', label: 'Late-Night Descent', moves: ['time', 'bpm', 'mood'], gen: 'latenight',
      zh: '黄昏到凌晨三点，节奏渐慢、情绪向内下沉（深夜/失眠）',
      ja: '黄昏から午前3時まで、リズムが後から内側へ沉む（深夜/不眠）', ko: '현장부터 오전 3시까지, 리펀이 느려지고 문든이 내로 강함', fr: 'Crépuscule à 3h, rythme ralentit — nuit profonde / insomnie', es: 'Atardecer a las 3AM, ritmo frenando — noche profunda / insomnio', de: 'Abend bis 3 Uhr, Tempo sinkt — tiefe Nacht / Schlaflosigkeit', pt: 'Entardecer às 3h, ritmo desacelerando — noite profunda / insônia',
      en: 'Evening to 3 AM: tempo slows, mood sinks inward (late night / insomnia).' },
    { key: 'storm',  label: 'Storm Passing',    moves: ['nature', 'mood'], gen: 'storm',
      zh: '一场雨从微风酰酿、到雷雨、再到放晴',
      ja: '微風から雷雨、そして晴天まで、一場の雨の経過', ko: '재밝은 바바름부터 번거름, 그리고 희건까지', fr: "Une pluie qui commence en brise, devient orage", es: 'Una lluvia que empieza en brisa, se convierte en tormenta', de: 'Ein Regen von Brise über Gewitter bis Aufklärung', pt: 'Uma chuva que começa em brisa, vira tempestade',
      en: 'One rainstorm: from breeze, to thunder, to clearing skies.' },
    { key: 'mood',   label: 'Mood Drift',       moves: ['mood'],
      zh: '情绪从明亮沿一条曲线渐渐向内漂移',
      ja: '気分が明るいから渐々に内側へ漂う', ko: '문든이 명량하게서 안으로 놓이는다', fr: "L'humeur dérive doucement du lumineux vers l'intérieur", es: 'El ánimo se desliza gradualmente de brillante hacia adentro', de: 'Die Stimmung driftet langsam von hell nach innen', pt: 'O humor desliza gradualmente do brilhante para o interior',
      en: 'Emotion drifts along a curve from bright to inward.', seq: { mood: MOOD_ARC } },
    { key: 'comfort', label: 'Comfort Arc',     moves: ['mood'],
      zh: '情绪从孤独/苦涩 → 平静 → 温暖，一条向上的修复曲线',
      ja: '気分が孤独/苦準 → 平静 → 温暖、一つ上の修復曲線', ko: '문든이 고외/압 nộ → 평정 → 온남, 하나의 상승 수정 곡선', fr: "L'humeur passe de solitude à calme à chaleur", es: 'El ánimo va de soledad → calma → calidez', de: 'Stimmung von Einsamkeit → Ruhe → Wärme', pt: 'O humor vai de solidão → calma → calor',
      en: 'From lonely / bittersweet → calm → warm: an upward, healing curve.', seq: { mood: MOOD_HEAL } },
    { key: 'ep',     label: 'Concept EP',       moves: ['nature', 'time'], gen: 'ep', maxTracks: 5,
      zh: '几乎全锁、只做细微变奏（EP 形态，自动限 5 首内）',
      ja: 'ほぼ全ディメンションをロックし、微細な変奏だけ（EP形態、自動制限5曲以内）', ko: '모든 차원을 고정하고 자여도를 만 변환 (EP 형태, 자동 제한 5곡)', fr: 'Presque tout verrouillé, variations subtiles (format EP)', es: 'Casi todo bloqueado, solo variaciones sutiles (formato EP)', de: 'Fast alles gesperrt, nur subtile Variationen (EP-Format)', pt: 'Quase tudo travado, apenas variações sutis (formato EP)',
      en: 'Almost fully locked, tiny variations only (EP form, capped at 5).' },
  ];

  function sampleSeq(arr, n) {
    if (n <= 1) return [arr[0]];
    const out = [];
    for (let i = 0; i < n; i++) out.push(arr[Math.round(i * (arr.length - 1) / (n - 1))]);
    return out;
  }
  function nearest(arr, target) {
    return arr.reduce((best, v) => Math.abs(v - target) < Math.abs(best - target) ? v : best, arr[0]);
  }
  function rampBpm(n, from, to) {
    const out = [];
    for (let i = 0; i < n; i++) { const p = n > 1 ? i / (n - 1) : 0; out.push(nearest(BPM.values, from + (to - from) * p)); }
    return out;
  }

  // Returns { axis, recipes:[selection…] }. recipes.length === effective track count.
  function buildAlbum(axisKey, base, count) {
    const axis = ALBUM_AXES.find(a => a.key === axisKey) || ALBUM_AXES[0];
    const n = Math.max(3, Math.min(count, axis.maxTracks || count));
    const recipes = [];
    const mk = (over) => Object.assign({}, base, over);

    if (axis.gen === 'focus') { // BPM rises then falls, mood deepens mid-set
      for (let i = 0; i < n; i++) {
        const pos = n > 1 ? i / (n - 1) : 0;
        const tri = 1 - Math.abs(0.5 - pos) * 2;
        recipes.push(mk({ bpm: nearest(BPM.values, 55 + tri * (68 - 55)),
                          mood: (pos > 0.28 && pos < 0.72) ? 'Focused' : base.mood }));
      }
    } else if (axis.gen === 'morning') { // dawn→afternoon, energy rising, hopeful→focused
      const tseq = sampleSeq(TIME_MORNING, n), bseq = rampBpm(n, 55, 68);
      for (let i = 0; i < n; i++) {
        const pos = n > 1 ? i / (n - 1) : 0;
        recipes.push(mk({ time: tseq[i], bpm: bseq[i], mood: pos < 0.5 ? 'Hopeful' : 'Focused' }));
      }
    } else if (axis.gen === 'latenight') { // evening→3am, slowing, drifting inward
      const tseq = sampleSeq(TIME_LATE, n), bseq = rampBpm(n, 65, 55),
            mseq = sampleSeq(['Calm', 'Dreamy', 'Nostalgic', 'Lonely'], n);
      for (let i = 0; i < n; i++) recipes.push(mk({ time: tseq[i], bpm: bseq[i], mood: mseq[i] }));
    } else if (axis.gen === 'storm') { // weather front building then clearing
      const nseq = sampleSeq(STORM_FRONT, n);
      for (let i = 0; i < n; i++) {
        const pos = n > 1 ? i / (n - 1) : 0;
        recipes.push(mk({ nature: nseq[i], mood: (pos > 0.3 && pos < 0.6) ? 'Bittersweet' : base.mood }));
      }
    } else if (axis.gen === 'ep') { // near-static micro-variation
      const nseq = sampleSeq(NATURE_SEASON.slice(4), n), tseq = sampleSeq(TIME_LATE, n);
      for (let i = 0; i < n; i++) recipes.push(mk({ nature: nseq[i], time: tseq[i] }));
    } else { // single-dimension sequence (day / place / season / mood / comfort)
      const dim = axis.moves[0], seq = sampleSeq(axis.seq[dim], n);
      for (let i = 0; i < n; i++) recipes.push(mk({ [dim]: seq[i] }));
    }
    return { axis, recipes };
  }

  // Which dims are held constant (the "anchor") for a given axis.
  function anchorDims(axisKey) {
    const axis = ALBUM_AXES.find(a => a.key === axisKey) || ALBUM_AXES[0];
    const moving = new Set(axis.moves);
    return ['style', 'instrument', 'environment', 'nature', 'time', 'mood', 'bpm']
      .filter(k => !moving.has(k));
  }

  // Offline album fallback (used when AI is off/fails). Includes liner-note description.
  function fallbackAlbum(axisKey, base, recipes) {
    const axis = ALBUM_AXES.find(a => a.key === axisKey) || ALBUM_AXES[0];
    const titles = {
      day: 'Hours', place: 'Passages', season: 'Turning', focus: 'Deep Work',
      mood: 'Undercurrents', comfort: 'Coming Home', morning: 'First Light',
      latenight: 'Small Hours', storm: 'The Passing Rain', ep: 'Quiet Set',
    };
    const albumTitle = `${base.environment} ${titles[axisKey] || 'Sessions'}`;
    const anchor = `${base.style}, ${base.mood.toLowerCase()} lo-fi, ${base.instrument.toLowerCase()}, ${base.bpm} bpm range, ${textureTags(base.style)}, instrumental`;
    const tracks = recipes.map((s) => {
      const moveLabels = axis.moves.map(k => k === 'bpm' ? s.bpm + ' bpm' : s[k]).join(' · ');
      return {
        title: `${moveLabels}`,
        scene: `${s.time} · ${s.environment}`,
        prompt: `${axis.moves.includes('bpm') ? s.bpm + ' bpm, ' : ''}${s.mood.toLowerCase()} ${s.style.toLowerCase()} in a ${s.environment.toLowerCase()} at ${s.time.toLowerCase()}${s.nature === 'None' ? '' : ', ' + s.nature.toLowerCase() + ' ambience'}.`,
      };
    });
    const firstT = recipes[0], lastT = recipes[recipes.length - 1];
    const description =
      `Built from a single ${base.instrument.toLowerCase()} identity recorded in a ${base.environment.toLowerCase()}, ` +
      `${recipes.length} instrumental tracks follow one ${axis.label.toLowerCase()}. ` +
      `It opens with “${tracks[0].title}” and closes on “${tracks[tracks.length - 1].title}”, ` +
      `holding the same warm tape texture and ${base.bpm} bpm pulse throughout — made for long, uninterrupted study.`;
    const descriptionZh =
      `以一段在 ${base.environment} 里的 ${base.instrument} 为核心，${recipes.length} 首纯器乐沿着「${axis.label}」展开，` +
      `从「${tracks[0].title}」开始，在「${tracks[tracks.length - 1].title}」收束，` +
      `全程维持同样温暖的磁带质感与 ${base.bpm} 左右的脉动——为长时间不被打断的学习而作。`;
    return {
      album: albumTitle,
      concept: `${recipes.length} instrumental tracks · ${axis.label.toLowerCase()} · one ${base.instrument.toLowerCase()} identity held throughout`,
      description,
      descriptionZh,
      anchor,
      cover: `Square 1:1 cover for "${albumTitle}": a ${base.environment.toLowerCase()} at ${base.time.toLowerCase()}, ${base.mood.toLowerCase()} mood, soft cinematic light, painterly film grain. Centered composition with negative space near the top for the album title. No text, no motion.`,
      video: `16:9 looping background video for "${albumTitle}": a ${base.environment.toLowerCase()} at ${base.time.toLowerCase()}, ${base.mood.toLowerCase()} and still, very slow cinematic camera drift, shallow depth of field, gentle film grain, seamless loop.`,
      tracks,
    };
  }

  const PRESETS = [
    { key: 'deep-focus', icon: '🎯', label: 'Deep Focus', zh: '深度专注',
      ja: 'ディープフォーカス', ko: '딥 포커스', fr: 'Focus intense', es: 'Enfoque profundo', de: 'Tieffokus', pt: 'Foco intenso',
      sel: { environment: 'Library', nature: 'Rain', time: 'Night', mood: 'Focused', instrument: 'Felt Piano', style: 'Ambient', bpm: 60 } },
    { key: 'morning-coffee', icon: '☕', label: 'Morning Coffee', zh: '晨间咖啡',
      ja: '朝のコーヒー', ko: '아침 커피', fr: 'Café du matin', es: 'Café de la mañana', de: 'Morgenkaffee', pt: 'Café da manhã',
      sel: { environment: 'Cozy Desk', nature: 'Birdsong', time: 'Early Morning', mood: 'Warm', instrument: 'Acoustic Guitar', style: 'Lo-fi Hip Hop', bpm: 72 } },
    { key: 'rainy-day', icon: '🌧', label: 'Rainy Day', zh: '雨天发呆',
      ja: '雨の日', ko: '비오는 날', fr: 'Jour de pluie', es: 'Día de lluvia', de: 'Regentag', pt: 'Dia chuvoso',
      sel: { environment: 'Rainy Window', nature: 'Rain', time: 'Afternoon', mood: 'Nostalgic', instrument: 'Rhodes', style: 'Chillhop', bpm: 68 } },
    { key: 'late-night', icon: '🌙', label: 'Late Night', zh: '深夜独处',
      ja: '深夜の独り', ko: '심야의 고독', fr: 'Nuit tardive', es: 'Noche tardía', de: 'Späte Nacht', pt: 'Noite tardia',
      sel: { environment: 'Night City', nature: 'Light Snow', time: 'Midnight', mood: 'Lonely', instrument: 'Warm Pad', style: 'Drone Ambient', bpm: 55 } },
    { key: 'forest-escape', icon: '🌲', label: 'Forest Escape', zh: '森林逃离',
      ja: '森の逃走', ko: '숲 탈출', fr: 'Évasion forestière', es: 'Escape al bosque', de: 'Waldflucht', pt: 'Fuga para a floresta',
      sel: { environment: 'Forest Cabin', nature: 'Forest Stream', time: 'Golden Hour', mood: 'Calm', instrument: 'Acoustic Guitar', style: 'Neo Classical', bpm: 62 } },
    { key: 'dreamy-dusk', icon: '🌅', label: 'Dreamy Dusk', zh: '黄昏入梦',
      ja: '夢の黄昏', ko: '꼬나는 현장', fr: 'Crépuscule rêveur', es: 'Atardecer soñador', de: 'Träumerische Dämmerung', pt: 'Entardecer sonhador',
      sel: { environment: 'Ocean View', nature: 'Ocean Waves', time: 'Dusk', mood: 'Dreamy', instrument: 'Harp', style: 'Ambient', bpm: 58 } },
    { key: 'cozy-winter', icon: '🔥', label: 'Cozy Winter', zh: '冬日壁炉',
      ja: '温かい冬', ko: '아늑한 겨울', fr: 'Hiver douillet', es: 'Invierno acogedor', de: 'Gemütlicher Winter', pt: 'Inverno aconchegante',
      sel: { environment: 'Mountain Lodge', nature: 'Fireplace', time: 'Evening', mood: 'Cozy', instrument: 'Cello', style: 'Minimal Piano', bpm: 58 } },
    { key: 'zen-garden', icon: '🍃', label: 'Zen Garden', zh: '禅意庭院',
      ja: '禅の庭', ko: '젠 정원', fr: 'Jardin zen', es: 'Jardín zen', de: 'Zen-Garten', pt: 'Jardim zen',
      sel: { environment: 'Kyoto Study Room', nature: 'Rustling Leaves', time: 'Dawn', mood: 'Calm', instrument: 'Music Box', style: 'Ambient', bpm: 55 } },
  ];

  scope.AWEN = {
    DIMS, BPM, DEFAULTS, REFERENCE, CONTENT_KEYS, PRESETS,
    randomSelection, mutations, fallbackPrompt, rand,
    ALBUM_AXES, buildAlbum, anchorDims, fallbackAlbum,
  };
})();


const core = Object.freeze({ ...scope.AWEN });
export default core;
export const { DIMS, BPM, DEFAULTS, REFERENCE, CONTENT_KEYS, PRESETS, randomSelection, mutations, fallbackPrompt, rand, ALBUM_AXES, buildAlbum, anchorDims, fallbackAlbum } = core;
