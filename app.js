/* ==========================================================================
   Municipales 2026 — Dashboard Application
   Rendering engine + filters (uses PollLib from lib.js)
   ========================================================================== */

(function () {
  'use strict';

  const {
    ELECTION_DATE,
    PARTY_COLORS,
    PARTY_SHORT_LABELS,
    detectPartyKey,
    resolvePartyKey,
    getPartyColor,
    getPartyBadgeClass,
    getPartyShortLabel,
    isLeftParty,
    isRightParty,
    aggregatePolls,
    formatPopulation,
    formatDate,
    escapeHtml,
    initTheme,
    toggleTheme,
  } = window.PollLib;

  const TOP_N = 5;

  /* ========================================================================
     Countdown
     ======================================================================== */

  function updateCountdown() {
    const now = new Date();
    const diff = ELECTION_DATE - now;

    if (diff <= 0) {
      document.getElementById('countdown').innerHTML = '<span class="countdown-label">Scrutin</span><span class="countdown-value">En cours</span>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    document.getElementById('countdown').innerHTML =
      `<span class="countdown-label">1er tour dans</span>` +
      `<span class="countdown-value">${days}j ${hours}h</span>`;
  }

  /* ========================================================================
     Header Stats
     ======================================================================== */

  function renderHeaderStats(cities, institutes) {
    const withPolls = cities.filter(c => c.polls && c.polls.length > 0).length;
    const totalPolls = cities.reduce((sum, c) => sum + (c.polls ? c.polls.length : 0), 0);
    const avgPolls = withPolls > 0 ? (totalPolls / withPolls).toFixed(1) : '0';

    const leftMayors = cities.filter(c => isLeftParty(c.currentMayor.party)).length;
    const rightMayors = cities.filter(c => isRightParty(c.currentMayor.party)).length;

    document.getElementById('headerStats').innerHTML = `
      <div class="stat-item"><span class="stat-value">${cities.length}</span><span class="stat-label">villes</span></div>
      <div class="stat-item"><span class="stat-value">${withPolls}</span><span class="stat-label">avec sondages</span></div>
      <div class="stat-item"><span class="stat-value">${totalPolls}</span><span class="stat-label">sondages collectés</span></div>
      <div class="stat-item"><span class="stat-value">${avgPolls}</span><span class="stat-label">sondages/ville (moy.)</span></div>
      <div class="stat-item"><span class="stat-value">${leftMayors}</span><span class="stat-label">maires gauche</span></div>
      <div class="stat-item"><span class="stat-value">${rightMayors}</span><span class="stat-label">maires droite</span></div>
    `;

    document.getElementById('lastUpdate').textContent =
      `Dernière MAJ : ${formatDate(TENDANCES_DATA.metadata.lastUpdate)}`;
  }

  /* ========================================================================
     City Card Rendering
     ======================================================================== */

  function renderCandidateBars(candidates, maxScore) {
    return candidates.slice(0, TOP_N).map((c, i) => {
      const barWidth = maxScore > 0 ? (c.score / maxScore) * 100 : 0;
      const color = getPartyColor(c.party);
      const ciLeft = maxScore > 0 ? ((c.score - c.marginOfError) / maxScore) * 100 : 0;
      const ciWidth = maxScore > 0 ? ((c.marginOfError * 2) / maxScore) * 100 : 0;

      return `
        <div class="candidate-row">
          <span class="candidate-rank">${i + 1}</span>
          <span class="card-mayor-badge ${getPartyBadgeClass(c.party)}">${getPartyShortLabel(c.party)}</span>
          <span class="candidate-name" title="${escapeHtml(c.name)} (${escapeHtml(c.party)})">${escapeHtml(c.name)}</span>
          <div class="candidate-bar-wrapper">
            <div class="candidate-bar" style="width:${barWidth}%;background:${color}"></div>
            ${c.marginOfError > 0 ? `<div class="ci-whisker" style="left:${Math.max(0, ciLeft)}%;width:${ciWidth}%"></div>` : ''}
          </div>
          <span class="candidate-score">${c.score.toFixed(1)}%</span>
        </div>`;
    }).join('');
  }

  function renderSecondRound(city) {
    if (!city.secondRound || !city.secondRound.scenarios || city.secondRound.scenarios.length === 0) {
      return '';
    }

    const scenarios = city.secondRound.scenarios.filter(s =>
      s.candidates && s.candidates.length >= 2 &&
      s.candidates.some(c => c.score != null)
    );

    if (scenarios.length === 0) return '';

    const scenarioHtml = scenarios.slice(0, 2).map(s => {
      const validCandidates = s.candidates.filter(c => c.score != null);
      if (validCandidates.length < 2) return '';

      const total = validCandidates.reduce((sum, c) => sum + c.score, 0);

      const segments = validCandidates.map(c => {
        const pct = total > 0 ? (c.score / total) * 100 : 50;
        const partyKey = resolvePartyKey(c) || c.party;
        const color = getPartyColor(partyKey);
        return `<div class="duel-segment" style="width:${pct}%;background:${color}">${c.score}%</div>`;
      }).join('');

      const names = validCandidates.map(c => {
        const pct = total > 0 ? (c.score / total) * 100 : 50;
        const partyKey = resolvePartyKey(c) || c.party;
        return `<span style="width:${pct}%"><span class="card-mayor-badge ${getPartyBadgeClass(partyKey)}">${getPartyShortLabel(partyKey)}</span> ${escapeHtml(c.name.split(' ').pop())}</span>`;
      });

      const label = s.description ? escapeHtml(s.description) : `${validCandidates.length === 2 ? 'Duel' : 'Triangulaire'}`;

      return `
        <div class="second-round-scenario">
          <div class="scenario-label">${label}</div>
          <div class="duel-bar">${segments}</div>
          <div class="duel-names">${names.join('')}</div>
        </div>`;
    }).join('');

    if (!scenarioHtml.trim()) return '';

    return `
      <div class="round-section">
        <div class="round-label">2nd tour — Hypothèses</div>
        ${scenarioHtml}
      </div>`;
  }

  function renderDeclaredCandidates(candidates) {
    return candidates.map(c => {
      const partyKey = resolvePartyKey(c) || c.party;
      const badgeClass = getPartyBadgeClass(partyKey);
      const shortLabel = getPartyShortLabel(partyKey);
      return `
        <div class="declared-candidate-row">
          <span class="card-mayor-badge ${badgeClass}">${shortLabel}</span>
          <span class="declared-candidate-name">${escapeHtml(c.name)}${c.incumbent ? ' ★' : ''}</span>
        </div>`;
    }).join('');
  }

  function renderCityCard(city, aggregated) {
    const hasPolls = city.polls && city.polls.length > 0;
    const mayorBadge = getPartyBadgeClass(city.currentMayor.party);
    const hasCandidates = city.declaredCandidates && city.declaredCandidates.length > 0;

    let bodyHtml = '';

    if (hasPolls && aggregated.length > 0) {
      const maxScore = aggregated[0].score;
      bodyHtml = `
        <div class="card-body">
          <div class="round-section">
            <div class="round-label">1er tour — Top ${Math.min(TOP_N, aggregated.length)} (moy. pondérée)</div>
            ${renderCandidateBars(aggregated, maxScore)}
          </div>
          ${renderSecondRound(city)}
        </div>`;
    } else if (hasCandidates) {
      bodyHtml = `
        <div class="card-body">
          <div class="round-section">
            <div class="round-label">${city.declaredCandidates.length} candidats déclarés — Pas de sondage</div>
            <div class="declared-candidates-list">
              ${renderDeclaredCandidates(city.declaredCandidates)}
            </div>
          </div>
        </div>`;
    } else {
      const context = city.context || '';
      bodyHtml = `
        <div class="card-body">
          <div class="no-polls-message">
            Aucun sondage disponible
            ${context ? `<div class="context-info">${escapeHtml(context)}</div>` : ''}
          </div>
        </div>`;
    }

    const pollSources = hasPolls
      ? city.polls.map(p => {
          const inst = TENDANCES_DATA.institutes[p.institute];
          return `<span class="poll-source-tag">${escapeHtml(inst ? inst.name : p.institute)} · ${formatDate(p.publishDate)}</span>`;
        }).join('')
      : '';

    return `
      <div class="city-card ${hasPolls ? '' : 'no-polls'}" data-city="${escapeHtml(city.name)}">
        <div class="card-header">
          <div class="card-city-info">
            <div class="card-city-name">${escapeHtml(city.name)}</div>
            <div class="card-city-meta">
              <span class="card-population">${formatPopulation(city.population)} hab.</span>
              <span>${escapeHtml(city.department)}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <span class="card-mayor-badge ${mayorBadge}">${escapeHtml(city.currentMayor.party)}</span>
            ${hasPolls ? `<span class="card-polls-count">${city.polls.length} sondage${city.polls.length > 1 ? 's' : ''}</span>` : ''}
          </div>
        </div>
        ${bodyHtml}
        ${pollSources ? `<div class="card-footer">${pollSources}</div>` : ''}
      </div>`;
  }

  /* ========================================================================
     Modal — Detailed City View
     ======================================================================== */

  function renderModal(city, aggregated) {
    const hasPolls = city.polls && city.polls.length > 0;
    const mayorBadge = getPartyBadgeClass(city.currentMayor.party);

    let content = `
      <div class="modal-city-header">
        <h2>${escapeHtml(city.name)}</h2>
        <div class="meta-row">
          <span>${formatPopulation(city.population)} habitants</span>
          <span>${escapeHtml(city.department)} · ${escapeHtml(city.region)}</span>
          <span>Maire : <strong>${escapeHtml(city.currentMayor.name)}</strong> <span class="card-mayor-badge ${mayorBadge}">${escapeHtml(city.currentMayor.party)}</span></span>
        </div>
      </div>`;

    if (city.municipales2020) {
      const m = city.municipales2020;
      content += `
        <div class="modal-section">
          <h3>Municipales 2020</h3>
          <p style="font-size:0.85rem;color:var(--text-secondary)">
            ${escapeHtml(m.winner)} (${escapeHtml(m.party)}) — ${m.score}% au ${m.round === 1 ? '1er' : '2nd'} tour
          </p>
        </div>`;
    }

    if (hasPolls && aggregated.length > 0) {
      const maxScore = aggregated[0].score;
      content += `
        <div class="modal-section">
          <h3>Moyenne pondérée — 1er tour (${aggregated.length} candidat${aggregated.length > 1 ? 's' : ''})</h3>
          ${aggregated.map((c, i) => `
            <div class="modal-candidate-row">
              <span class="candidate-rank">${i + 1}</span>
              <span class="card-mayor-badge ${getPartyBadgeClass(c.party)}">${getPartyShortLabel(c.party)}</span>
              <span class="candidate-name" title="${escapeHtml(c.party)}">${escapeHtml(c.name)}</span>
              <div class="candidate-bar-wrapper">
                <div class="candidate-bar" style="width:${(c.score / maxScore) * 100}%;background:${getPartyColor(c.party)}"></div>
              </div>
              <span class="candidate-score">${c.score.toFixed(1)}%</span>
            </div>
            <div style="font-size:0.7rem;color:var(--text-tertiary);margin-left:158px;margin-bottom:8px">
              IC 95% : ${(c.score - c.marginOfError).toFixed(1)}–${(c.score + c.marginOfError).toFixed(1)}% · ${c.pollCount} sondage${c.pollCount > 1 ? 's' : ''} · étendue ${c.minScore}–${c.maxScore}%
            </div>
          `).join('')}
        </div>`;
    }

    if (city.secondRound && city.secondRound.scenarios && city.secondRound.scenarios.length > 0) {
      const validScenarios = city.secondRound.scenarios.filter(s =>
        s.candidates && s.candidates.length >= 2 && s.candidates.some(c => c.score != null)
      );

      if (validScenarios.length > 0) {
        content += `
          <div class="modal-section">
            <h3>Hypothèses de 2nd tour</h3>
            ${validScenarios.map(s => {
              const validCandidates = s.candidates.filter(c => c.score != null);
              const total = validCandidates.reduce((sum, c) => sum + c.score, 0);
              const inst = s.institute ? (TENDANCES_DATA.institutes[s.institute]?.name || s.institute) : '';

              const segments = validCandidates.map(c => {
                const pct = total > 0 ? (c.score / total) * 100 : 50;
                const pk = resolvePartyKey(c) || c.party;
                return `<div class="duel-segment" style="width:${pct}%;background:${getPartyColor(pk)}">${c.score}%</div>`;
              }).join('');

              const names = validCandidates.map(c => {
                const pct = total > 0 ? (c.score / total) * 100 : 50;
                const pk = resolvePartyKey(c) || c.party;
                return `<span style="width:${pct}%"><span class="card-mayor-badge ${getPartyBadgeClass(pk)}">${getPartyShortLabel(pk)}</span> ${escapeHtml(c.name)}</span>`;
              });

              return `
                <div class="second-round-scenario">
                  <div class="scenario-label">${s.description ? escapeHtml(s.description) : 'Scénario'}${inst ? ` — ${escapeHtml(inst)}` : ''}</div>
                  <div class="duel-bar">${segments}</div>
                  <div class="duel-names">${names.join('')}</div>
                </div>`;
            }).join('')}
          </div>`;
      }
    }

    if (hasPolls) {
      content += `
        <div class="modal-section">
          <h3>Détail des sondages (${city.polls.length})</h3>
          ${city.polls.map(p => {
            const inst = TENDANCES_DATA.institutes[p.institute];
            const instName = inst ? inst.name : p.institute;
            const reliability = inst ? inst.reliability : '?';
            const maxS = Math.max(...p.candidates.map(c => c.score));

            return `
              <div class="modal-poll-detail">
                <div class="poll-detail-header">
                  <span class="poll-detail-institute">${escapeHtml(instName)} <span style="font-weight:400;font-size:0.75rem;color:var(--text-tertiary)">(fiabilité ${reliability}/10)</span></span>
                  <div class="poll-detail-meta">
                    <span>${escapeHtml(p.commissioner || '')}</span>
                    <span>${formatDate(p.publishDate)}</span>
                    <span>n=${p.sampleSize || '?'}</span>
                  </div>
                </div>
                ${p.candidates.map((c, i) => {
                  const pk = resolvePartyKey(c) || c.party;
                  return `
                  <div class="modal-candidate-row">
                    <span class="candidate-rank">${i + 1}</span>
                    <span class="card-mayor-badge ${getPartyBadgeClass(pk)}">${getPartyShortLabel(pk)}</span>
                    <span class="candidate-name">${escapeHtml(c.name)}</span>
                    <div class="candidate-bar-wrapper">
                      <div class="candidate-bar" style="width:${(c.score / maxS) * 100}%;background:${getPartyColor(pk)}"></div>
                    </div>
                    <span class="candidate-score">${c.score}%</span>
                  </div>`;
                }).join('')}
              </div>`;
          }).join('')}
        </div>`;
    }

    if (!hasPolls && city.declaredCandidates && city.declaredCandidates.length > 0) {
      content += `
        <div class="modal-section">
          <h3>Candidats déclarés (${city.declaredCandidates.length})</h3>
          ${city.declaredCandidates.map(c => {
            const pk = resolvePartyKey(c) || c.party;
            return `
            <div class="modal-declared-candidate">
              <span class="card-mayor-badge ${getPartyBadgeClass(pk)}">${getPartyShortLabel(pk)}</span>
              <span class="declared-candidate-name">${escapeHtml(c.name)}${c.incumbent ? ' ★ sortant' : ''}</span>
              <span class="declared-candidate-party">${escapeHtml(c.party)}</span>
              ${c.listName ? `<span class="declared-candidate-list">« ${escapeHtml(c.listName)} »</span>` : ''}
            </div>`;
          }).join('')}
        </div>`;
    }

    if (!hasPolls && city.context) {
      content += `
        <div class="modal-section">
          <h3>Contexte politique</h3>
          <p style="font-size:0.85rem;color:var(--text-secondary);line-height:1.7">${escapeHtml(city.context)}</p>
        </div>`;
    }

    return content;
  }

  /* ========================================================================
     Filter & Sort Logic
     ======================================================================== */

  function filterCities(cities, filter) {
    switch (filter) {
      case 'with-polls':
        return cities.filter(c => c.polls && c.polls.length > 0);
      case 'no-polls':
        return cities.filter(c => !c.polls || c.polls.length === 0);
      case 'left':
        return cities.filter(c => isLeftParty(c.currentMayor.party));
      case 'right':
        return cities.filter(c => isRightParty(c.currentMayor.party));
      case 'green':
        return cities.filter(c => detectPartyKey(c.currentMayor.party) === 'EELV');
      default:
        return cities;
    }
  }

  function sortCities(cities, sortKey, aggregatedMap) {
    const sorted = [...cities];
    switch (sortKey) {
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        break;
      case 'polls':
        sorted.sort((a, b) => (b.polls?.length || 0) - (a.polls?.length || 0));
        break;
      case 'competition': {
        sorted.sort((a, b) => {
          const aggA = aggregatedMap.get(a.name) || [];
          const aggB = aggregatedMap.get(b.name) || [];
          const gapA = aggA.length >= 2 ? aggA[0].score - aggA[1].score : 999;
          const gapB = aggB.length >= 2 ? aggB[0].score - aggB[1].score : 999;
          return gapA - gapB;
        });
        break;
      }
      default: // population
        sorted.sort((a, b) => b.population - a.population);
    }
    return sorted;
  }

  /* ========================================================================
     Main Application
     ======================================================================== */

  function init() {
    const data = TENDANCES_DATA;
    const grid = document.getElementById('cityGrid');
    const searchInput = document.getElementById('searchInput');
    const sortSelect = document.getElementById('sortSelect');
    const filterSelect = document.getElementById('filterSelect');
    const modalOverlay = document.getElementById('modalOverlay');
    const modalContent = document.getElementById('modalContent');
    const modalClose = document.getElementById('modalClose');
    const viewBtns = document.querySelectorAll('.view-btn[data-view]');
    const legendBtn = document.getElementById('legendBtn');
    const legendOverlay = document.getElementById('legendOverlay');
    const legendContent = document.getElementById('legendContent');
    const legendClose = document.getElementById('legendClose');

    // Pre-compute aggregated results for all cities
    const aggregatedMap = new Map();
    for (const city of data.cities) {
      const agg = aggregatePolls(city.polls, data.institutes);
      aggregatedMap.set(city.name, agg);
    }

    // Theme
    initTheme();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Render header
    updateCountdown();
    setInterval(updateCountdown, 60000);
    renderHeaderStats(data.cities, data.institutes);

    // Render function
    function render() {
      const search = searchInput.value.toLowerCase().trim();
      const sort = sortSelect.value;
      const filter = filterSelect.value;

      let cities = data.cities;

      if (search) {
        cities = cities.filter(c =>
          c.name.toLowerCase().includes(search) ||
          c.department.toLowerCase().includes(search) ||
          c.region.toLowerCase().includes(search) ||
          c.currentMayor.name.toLowerCase().includes(search)
        );
      }

      cities = filterCities(cities, filter);
      cities = sortCities(cities, sort, aggregatedMap);

      grid.innerHTML = cities.map(city => {
        const agg = aggregatedMap.get(city.name) || [];
        return renderCityCard(city, agg);
      }).join('');

      // Attach click handlers
      grid.querySelectorAll('.city-card').forEach(card => {
        card.addEventListener('click', () => {
          const cityName = card.dataset.city;
          const city = data.cities.find(c => c.name === cityName);
          if (!city) return;
          const agg = aggregatedMap.get(cityName) || [];
          modalContent.innerHTML = renderModal(city, agg);
          modalOverlay.classList.add('active');
          document.body.style.overflow = 'hidden';
        });
      });
    }

    // Event listeners
    searchInput.addEventListener('input', render);
    sortSelect.addEventListener('change', render);
    filterSelect.addEventListener('change', render);

    modalClose.addEventListener('click', () => {
      modalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (legendOverlay.classList.contains('active')) {
          legendOverlay.classList.remove('active');
          document.body.style.overflow = '';
        } else if (modalOverlay.classList.contains('active')) {
          modalOverlay.classList.remove('active');
          document.body.style.overflow = '';
        }
      }
    });

    // Legend popup
    function renderLegend() {
      const PARTY_SPECTRUM = [
        { group: 'Extrême gauche', parties: ['LO', 'NPA', 'LFI', 'PCF'] },
        { group: 'Gauche', parties: ['PS', 'DVG'] },
        { group: 'Écologiste', parties: ['EELV'] },
        { group: 'Centre', parties: ['Renaissance', 'Horizons'] },
        { group: 'Droite', parties: ['UDI', 'DVD', 'LR'] },
        { group: 'Extrême droite', parties: ['RN', 'Reconquête'] },
      ];

      let rows = '';
      for (const section of PARTY_SPECTRUM) {
        rows += `<div class="legend-group-header">${escapeHtml(section.group)}</div>`;
        for (const key of section.parties) {
          const val = PARTY_COLORS[key];
          if (!val) continue;
          const shortLabel = PARTY_SHORT_LABELS[key] || '??';
          rows += `
            <div class="legend-row">
              <span class="legend-color" style="background:${val.color}"></span>
              <span class="card-mayor-badge badge-${val.badge}">${shortLabel}</span>
              <span class="legend-party-name">${escapeHtml(key)}</span>
            </div>`;
        }
      }
      rows += `<div class="legend-group-header">Autres</div>
        <div class="legend-row">
          <span class="legend-color" style="background:#9ca3af"></span>
          <span class="card-mayor-badge badge-other">SE</span>
          <span class="legend-party-name">Autres / Sans étiquette</span>
        </div>`;

      return `
        <div class="legend-header">
          <h3>Partis politiques</h3>
          <p class="legend-subtitle">De l'extrême gauche à l'extrême droite</p>
        </div>
        <div class="legend-grid">${rows}</div>`;
    }

    legendBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      legendContent.innerHTML = renderLegend();
      legendOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    });

    legendClose.addEventListener('click', () => {
      legendOverlay.classList.remove('active');
      document.body.style.overflow = '';
    });

    legendOverlay.addEventListener('click', (e) => {
      if (e.target === legendOverlay) {
        legendOverlay.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // View toggle
    viewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        viewBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.dataset.view;
        grid.classList.toggle('list-view', view === 'list');
      });
    });

    // Initial render
    render();
  }

  // Boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
