/* ==========================================================================
   Municipales 2026 — Shared Library (PollLib)
   Constants, party detection, poll aggregation, formatting helpers
   ========================================================================== */

(function () {
  'use strict';

  /* ========================================================================
     Constants & Configuration
     ======================================================================== */

  const ELECTION_DATE = new Date('2026-03-15T08:00:00+01:00');
  const DECAY_LAMBDA = 0.1;       // demi-vie ~7 jours
  const SAMPLE_REF = 1000;         // échantillon de référence
  const DEDUP_WINDOW_DAYS = 14;    // fenêtre de déduplication

  /* Party colors — spectrum: dark red → red → pink → green → yellow → blue → dark */
  const PARTY_COLORS = {
    'LO':           { color: '#a01010', badge: 'lo' },
    'NPA':          { color: '#c41e1e', badge: 'npa' },
    'LFI':          { color: '#b42828', badge: 'lfi' },
    'PCF':          { color: '#d63030', badge: 'pcf' },
    'PS':           { color: '#e85868', badge: 'ps' },
    'DVG':          { color: '#f49aaa', badge: 'dvg' },
    'EELV':         { color: '#2ecc71', badge: 'eelv' },
    'Renaissance':  { color: '#f0c830', badge: 'renaissance' },
    'Horizons':     { color: '#d4b030', badge: 'horizons' },
    'UDI':          { color: '#7ab0d8', badge: 'udi' },
    'DVD':          { color: '#508cc0', badge: 'dvd' },
    'LR':           { color: '#2e6fb0', badge: 'lr' },
    'RN':           { color: '#4a5878', badge: 'rn' },
    'Reconquête':   { color: '#303048', badge: 'reconquete' },
  };

  const LEFT_PARTIES = ['PS', 'LFI', 'PCF', 'EELV', 'DVG', 'Génération.s', 'NPA', 'LO'];
  const RIGHT_PARTIES = ['LR', 'RN', 'Reconquête', 'DVD', 'UDI', 'Horizons', 'Renaissance', 'DLF'];

  const PARTY_SHORT_LABELS = {
    'LO':           'LO',
    'NPA':          'NP',
    'PS':           'PS',
    'LR':           'LR',
    'RN':           'RN',
    'LFI':          'FI',
    'EELV':         'EV',
    'Renaissance':  'RE',
    'Horizons':     'HZ',
    'PCF':          'PC',
    'Reconquête':   'RQ',
    'UDI':          'UD',
    'DVG':          'DG',
    'DVD':          'DD',
  };

  /* ========================================================================
     Candidate Reference Lookup (from CANDIDATS_DATA)
     ======================================================================== */

  const _candidateLookup = {};
  if (typeof CANDIDATS_DATA !== 'undefined' && CANDIDATS_DATA.candidates) {
    for (const c of CANDIDATS_DATA.candidates) {
      _candidateLookup[c.id] = c;
    }
  }

  function resolvePartyKey(candidate) {
    if (candidate.candidateId && _candidateLookup[candidate.candidateId]) {
      return _candidateLookup[candidate.candidateId].party;
    }
    return detectPartyKey(candidate.party);
  }

  /* ========================================================================
     Party Detection
     ======================================================================== */

  function detectPartyKey(partyStr) {
    if (!partyStr) return null;
    const s = partyStr.toUpperCase();

    if (s.includes('LUTTE OUVRI') || /\bLO\b/.test(s)) return 'LO';
    if (/\bNPA\b/.test(s) || s.includes('ANTICAPITALISTE')) return 'NPA';
    if (s.includes('RECONQU')) return 'Reconquête';
    if (s.includes('RENAISSANCE') || s.includes('LREM') || s.includes('MODEM')) return 'Renaissance';
    if (s.includes('HORIZON')) return 'Horizons';
    if (s.includes('LFI') || s.includes('INSOUMIS')) return 'LFI';
    if (s.includes('EELV') || s.includes('ÉCOLOG') || s.includes('ECOLOG') || s.includes('VERT')) return 'EELV';
    if (s.includes('PCF') || s.includes('COMMUNIS')) return 'PCF';
    if (/\bRN\b/.test(s) || s.includes('RASSEMBLEMENT NATIONAL') || /\bUDR\b/.test(s)) return 'RN';
    if (/\bPS\b/.test(s) || s.includes('SOCIALISTE')) return 'PS';
    if (/\bLR\b/.test(s) || s.includes('RÉPUBLICAIN') || s.includes('REPUBLICAIN')) return 'LR';
    if (s.includes('UDI')) return 'UDI';
    if (s.includes('DVG') || s.includes('DIVERS GAUCHE')) return 'DVG';
    if (s.includes('DVD') || s.includes('DIVERS DROITE')) return 'DVD';

    return null;
  }

  function getPartyColor(partyStr) {
    const key = detectPartyKey(partyStr);
    if (key && PARTY_COLORS[key]) return PARTY_COLORS[key].color;
    return '#9ca3af';
  }

  function getPartyBadgeClass(partyStr) {
    const key = detectPartyKey(partyStr);
    if (key && PARTY_COLORS[key]) return `badge-${PARTY_COLORS[key].badge}`;
    return 'badge-other';
  }

  function getPartyShortLabel(partyStr) {
    const key = detectPartyKey(partyStr);
    if (key && PARTY_SHORT_LABELS[key]) return PARTY_SHORT_LABELS[key];
    return 'SE';
  }

  function isLeftParty(partyStr) {
    const key = detectPartyKey(partyStr);
    return key && LEFT_PARTIES.includes(key);
  }

  function isRightParty(partyStr) {
    const key = detectPartyKey(partyStr);
    return key && RIGHT_PARTIES.includes(key);
  }

  /* ========================================================================
     Poll Aggregation Engine (FiveThirtyEight-inspired)
     ======================================================================== */

  function daysBetween(dateStr, refDate) {
    const d = new Date(dateStr);
    const diff = refDate - d;
    return Math.max(0, diff / (1000 * 60 * 60 * 24));
  }

  function computeRecencyWeight(publishDate, refDate) {
    const days = daysBetween(publishDate, refDate);
    return Math.exp(-DECAY_LAMBDA * days);
  }

  function computeSampleWeight(sampleSize) {
    return Math.sqrt(sampleSize / SAMPLE_REF);
  }

  function computeReliabilityWeight(instituteKey, institutes) {
    const inst = institutes[instituteKey];
    if (!inst) return 0.5;
    return inst.reliability / 10;
  }

  function computeDedupWeight(poll, allPolls) {
    const sameInstitute = allPolls.filter(p =>
      p.institute === poll.institute &&
      Math.abs(daysBetween(p.publishDate, new Date(poll.publishDate))) < DEDUP_WINDOW_DAYS
    );
    return 1 / sameInstitute.length;
  }

  function aggregatePolls(polls, institutes, refDate) {
    if (!polls || polls.length === 0) return [];

    refDate = refDate || new Date();

    const firstRoundPolls = polls.filter(p => p.round === 1);
    if (firstRoundPolls.length === 0) return [];

    const candidateMap = new Map();

    for (const poll of firstRoundPolls) {
      const w_recency = computeRecencyWeight(poll.publishDate, refDate);
      const w_sample = computeSampleWeight(poll.sampleSize || 1000);
      const w_reliability = computeReliabilityWeight(poll.institute, institutes);
      const w_dedup = computeDedupWeight(poll, firstRoundPolls);
      const weight = w_recency * w_sample * w_reliability * w_dedup;

      for (const candidate of poll.candidates) {
        const key = candidate.name;
        if (!candidateMap.has(key)) {
          const officialParty = resolvePartyKey(candidate);
          candidateMap.set(key, {
            name: candidate.name,
            party: officialParty || candidate.party,
            candidateId: candidate.candidateId || null,
            weightedSum: 0,
            totalWeight: 0,
            scores: [],
            pollCount: 0,
          });
        }
        const entry = candidateMap.get(key);
        entry.weightedSum += candidate.score * weight;
        entry.totalWeight += weight;
        entry.scores.push(candidate.score);
        entry.pollCount++;
      }
    }

    const results = [];
    for (const [, entry] of candidateMap) {
      if (entry.totalWeight === 0) continue;

      const avg = entry.weightedSum / entry.totalWeight;
      const n_eff = firstRoundPolls.reduce((sum, p) => sum + (p.sampleSize || 1000), 0);
      const marginOfError = 1.96 * Math.sqrt((avg / 100) * (1 - avg / 100) / n_eff) * 100;

      results.push({
        name: entry.name,
        party: entry.party,
        candidateId: entry.candidateId,
        score: Math.round(avg * 10) / 10,
        marginOfError: Math.round(marginOfError * 10) / 10,
        pollCount: entry.pollCount,
        minScore: Math.min(...entry.scores),
        maxScore: Math.max(...entry.scores),
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  /* ========================================================================
     Formatting Helpers
     ======================================================================== */

  function formatPopulation(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.', ',') + ' M';
    if (n >= 1000) return Math.round(n / 1000) + ' k';
    return String(n);
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ========================================================================
     Theme Management
     ======================================================================== */

  function initTheme() {
    var stored = localStorage.getItem('theme');
    var theme = stored || 'light';

    document.documentElement.setAttribute('data-theme', theme);

    window.addEventListener('storage', function (e) {
      if (e.key === 'theme' && e.newValue) {
        document.documentElement.setAttribute('data-theme', e.newValue);
      }
    });
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme');
    var next = current === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  }

  /* ========================================================================
     Expose as window.PollLib
     ======================================================================== */

  window.PollLib = {
    ELECTION_DATE,
    DECAY_LAMBDA,
    SAMPLE_REF,
    DEDUP_WINDOW_DAYS,
    PARTY_COLORS,
    LEFT_PARTIES,
    RIGHT_PARTIES,
    PARTY_SHORT_LABELS,
    detectPartyKey,
    resolvePartyKey,
    getPartyColor,
    getPartyBadgeClass,
    getPartyShortLabel,
    isLeftParty,
    isRightParty,
    daysBetween,
    computeRecencyWeight,
    computeSampleWeight,
    computeReliabilityWeight,
    computeDedupWeight,
    aggregatePolls,
    formatPopulation,
    formatDate,
    escapeHtml,
    initTheme,
    toggleTheme,
  };
})();
