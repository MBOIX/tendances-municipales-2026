/* ==========================================================================
   Municipales 2026 — National Dashboard
   SVG map, projections, gauche/droite balance, party scores
   ========================================================================== */

(function () {
  'use strict';

  const {
    ELECTION_DATE,
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
    aggregatePolls,
    formatPopulation,
    formatDate,
    escapeHtml,
    initTheme,
    toggleTheme,
  } = window.PollLib;

  /* ========================================================================
     City coordinates — derived from France_régionale.svg (Wikipedia)
     Original SVG is 2000×1898, scaled ×0.5 → viewBox 0 0 1000 950
     IDF suburbs shown in dedicated inset (top-right)
     La Réunion shown in dedicated inset (bottom-right)
     ======================================================================== */

  // Cities placed in the IDF inset (rendered separately)
  const IDF_CITIES = new Set([
    'Paris', 'Boulogne-Billancourt', 'Saint-Denis (93)', 'Montreuil', 'Argenteuil',
    'Nanterre', 'Vitry-sur-Seine', 'Créteil', 'Aubervilliers',
    'Asnières-sur-Seine', 'Aulnay-sous-Bois', 'Colombes', 'Versailles',
    'Courbevoie', 'Rueil-Malmaison', 'Champigny-sur-Marne',
    'Saint-Maur-des-Fossés', 'Drancy', 'Issy-les-Moulineaux',
    'Noisy-le-Grand', 'Levallois-Perret', 'Cergy', 'Ivry-sur-Seine', 'Clichy',
  ]);

  // Main map coordinates (mainland + Corsica)
  const CITY_COORDS = {
    'Marseille':                { x: 670, y: 750 },
    'Lyon':                     { x: 626, y: 531 },
    'Toulouse':                 { x: 412, y: 724 },
    'Nice':                     { x: 786, y: 709 },
    'Nantes':                   { x: 233, y: 395 },
    'Montpellier':              { x: 571, y: 722 },
    'Strasbourg':               { x: 795, y: 274 },
    'Bordeaux':                 { x: 287, y: 610 },
    'Lille':                    { x: 516, y: 98 },
    'Rennes':                   { x: 232, y: 313 },
    'Toulon':                   { x: 709, y: 764 },
    'Reims':                    { x: 580, y: 210 },
    'Saint-Étienne':            { x: 601, y: 562 },
    'Le Havre':                 { x: 375, y: 155 },
    'Villeurbanne':             { x: 633, y: 527 },
    'Dijon':                    { x: 639, y: 392 },
    'Angers':                   { x: 301, y: 372 },
    'Grenoble':                 { x: 683, y: 579 },
    'Nîmes':                    { x: 599, y: 706 },
    'Aix-en-Provence':          { x: 680, y: 728 },
    'Clermont-Ferrand':         { x: 520, y: 532 },
    'Le Mans':                  { x: 347, y: 334 },
    'Brest':                    { x: 105, y: 270 },
    'Tours':                    { x: 373, y: 387 },
    'Amiens':                   { x: 474, y: 162 },
    'Annecy':                   { x: 707, y: 517 },
    'Limoges':                  { x: 404, y: 521 },
    'Metz':                     { x: 699, y: 231 },
    'Besançon':                 { x: 697, y: 397 },
    'Perpignan':                { x: 505, y: 806 },
    'Orléans':                  { x: 445, y: 342 },
    'Rouen':                    { x: 404, y: 204 },
    'Caen':                     { x: 311, y: 222 },
    'Mulhouse':                 { x: 778, y: 345 },
    // — New cities (ranks 41-80) —
    'Nancy':                    { x: 690, y: 248 },
    'Roubaix':                  { x: 532, y: 90 },
    'Tourcoing':                { x: 524, y: 78 },
    'Avignon':                  { x: 625, y: 718 },
    'Poitiers':                 { x: 380, y: 460 },
    'Dunkerque':                { x: 488, y: 62 },
    'Béziers':                  { x: 545, y: 750 },
    'La Rochelle':              { x: 240, y: 488 },
    'Pau':                      { x: 340, y: 755 },
    'Cannes':                   { x: 764, y: 724 },
    'Antibes':                  { x: 776, y: 716 },
    'Calais':                   { x: 470, y: 42 },
    'Mérignac':                 { x: 272, y: 603 },
    'Saint-Nazaire':            { x: 210, y: 405 },
    'Ajaccio':                  { x: 920, y: 845 },
    'Colmar':                   { x: 786, y: 318 },
    'Vénissieux':               { x: 622, y: 546 },
    'Pessac':                   { x: 278, y: 625 },
    'Valence':                  { x: 645, y: 565 },
    'Bourges':                  { x: 468, y: 420 },
    'Quimper':                  { x: 120, y: 308 },
  };

  // IDF inset coordinates — 6-column × 4-row grid, expanded vertically
  const IDF_INSET_COORDS = {
    // Row 1 — north
    'Cergy':                    { x: 28,  y: 30 },
    'Argenteuil':               { x: 84,  y: 30 },
    'Colombes':                 { x: 140, y: 30 },
    'Asnières-sur-Seine':       { x: 196, y: 30 },
    'Clichy':                   { x: 252, y: 30 },
    'Saint-Denis (93)':         { x: 308, y: 30 },
    // Row 2
    'Nanterre':                 { x: 28,  y: 75 },
    'Rueil-Malmaison':          { x: 84,  y: 75 },
    'Courbevoie':               { x: 140, y: 75 },
    'Levallois-Perret':         { x: 196, y: 75 },
    'Aubervilliers':            { x: 252, y: 75 },
    'Drancy':                   { x: 308, y: 75 },
    // Row 3
    'Versailles':               { x: 28,  y: 120 },
    'Boulogne-Billancourt':     { x: 84,  y: 120 },
    'Issy-les-Moulineaux':      { x: 140, y: 120 },
    'Paris':                    { x: 196, y: 120 },
    'Montreuil':                { x: 252, y: 120 },
    'Aulnay-sous-Bois':         { x: 308, y: 120 },
    // Row 4 — south
    'Champigny-sur-Marne':      { x: 28,  y: 165 },
    'Saint-Maur-des-Fossés':    { x: 84,  y: 165 },
    'Ivry-sur-Seine':           { x: 140, y: 165 },
    'Vitry-sur-Seine':          { x: 196, y: 165 },
    'Créteil':                  { x: 252, y: 165 },
    'Noisy-le-Grand':           { x: 308, y: 165 },
  };

  /* ========================================================================
     Compute national aggregates
     ======================================================================== */

  function computeNationalData(data) {
    const results = [];

    for (const city of data.cities) {
      const agg = aggregatePolls(city.polls, data.institutes);
      const hasPolls = agg.length > 0;
      const leader = hasPolls ? agg[0] : null;
      const leaderParty = leader ? detectPartyKey(leader.party) : null;
      const currentParty = detectPartyKey(city.currentMayor.party);

      results.push({
        city,
        aggregated: agg,
        hasPolls,
        leader,
        leaderParty,
        projectedParty: leaderParty || currentParty,
        currentParty,
      });
    }

    return results;
  }

  /* ========================================================================
     Section 1: SVG Map
     ======================================================================== */

  /* France outline — simplified from France_régionale.svg (Wikipedia, CC-BY-SA)
     Ramer-Douglas-Peucker ε=5, scaled ×0.5 from 2000×1898 */
  const FRANCE_OUTLINE = 'M 801.6,704.7 807.4,702.2 804.4,694.6 816.5,676.5 814.2,665.8 797.5,672.0 770.0,661.4 762.7,651.2 765.9,645.7 760.4,637.8 766.3,625.1 773.4,623.1 770.2,611.3 751.7,602.9 751.1,594.2 746.0,592.8 743.2,586.6 751.8,581.4 759.4,583.5 765.2,576.4 771.0,575.7 777.1,558.0 764.9,548.7 763.6,538.2 752.3,530.8 752.0,522.2 762.9,517.6 765.3,512.0 758.4,501.0 754.4,501.5 755.5,496.0 749.3,494.6 752.1,482.2 747.1,475.8 748.2,468.5 733.1,467.0 719.9,472.3 713.9,480.2 718.9,486.7 711.5,494.0 699.3,496.8 698.5,491.7 707.4,485.7 709.5,475.9 704.1,471.0 706.9,456.7 725.9,439.5 725.4,424.2 739.6,415.3 760.6,387.0 749.9,384.7 755.7,373.5 768.3,372.8 767.5,377.3 779.8,377.8 791.4,363.3 786.3,354.3 791.3,327.1 787.9,317.8 797.2,295.4 800.3,268.4 814.3,253.6 821.7,238.3 804.5,232.0 786.7,232.8 774.0,222.3 766.4,227.9 754.9,225.7 752.2,229.2 750.2,222.5 744.4,219.9 739.7,220.6 739.8,225.5 732.6,224.7 720.3,202.2 713.2,198.6 698.5,196.6 691.2,201.9 675.0,192.9 659.0,198.0 655.6,189.0 648.6,187.2 647.2,181.7 640.8,181.4 630.5,172.5 622.3,173.2 623.1,162.1 618.5,157.8 623.2,142.9 619.1,139.9 612.0,148.0 611.5,154.8 601.2,160.0 580.9,157.4 585.5,148.8 580.3,143.6 583.2,131.1 580.2,131.9 573.5,123.9 557.9,124.6 555.2,128.5 549.1,111.4 544.2,112.1 543.1,108.8 535.7,111.7 530.7,107.8 528.8,93.8 522.8,85.3 511.5,89.0 509.1,93.7 503.8,91.1 492.4,79.9 493.6,69.7 488.9,58.3 450.1,68.1 434.1,78.2 434.9,121.6 431.0,128.1 438.3,138.0 430.7,136.0 422.5,148.3 404.5,160.6 376.6,166.7 353.1,178.3 344.7,195.1 354.7,201.6 369.0,199.4 364.5,202.6 326.8,216.5 283.0,204.0 276.7,204.5 274.7,208.4 270.7,206.9 272.1,202.6 264.7,188.5 269.3,184.1 267.7,176.5 248.1,179.4 228.9,171.5 228.6,176.3 233.2,178.4 231.0,189.6 234.3,202.5 240.2,205.6 243.6,217.1 248.1,217.6 245.2,219.8 245.3,235.3 250.3,235.5 244.2,251.6 245.6,259.3 257.1,269.5 232.8,272.0 227.2,268.2 228.2,262.6 223.7,263.0 217.5,266.6 220.4,279.0 216.4,267.7 210.4,268.1 208.5,272.8 204.8,266.6 199.7,268.2 201.2,262.9 191.5,265.4 177.4,276.7 164.1,252.6 159.5,251.6 160.2,247.4 154.3,252.6 156.7,243.6 148.1,249.2 149.1,242.6 138.1,247.3 130.5,244.9 126.8,257.3 113.1,252.5 109.8,260.8 102.4,251.5 88.5,257.3 80.7,254.1 69.3,256.6 65.6,262.9 57.9,262.2 54.9,265.7 54.3,282.2 82.0,276.5 72.3,284.2 82.5,282.7 79.6,285.4 87.1,288.4 68.7,287.5 65.0,283.5 61.5,289.3 65.2,289.7 64.9,296.5 71.5,292.3 78.3,295.5 79.8,305.1 53.7,308.1 68.1,314.2 74.1,324.8 73.3,331.5 83.7,332.4 87.5,322.8 93.4,329.2 98.4,325.4 103.7,335.1 122.0,338.9 127.4,345.3 137.4,339.0 132.5,345.0 136.4,346.3 132.7,346.6 139.9,350.7 143.6,342.7 146.9,345.5 141.2,352.0 144.7,366.8 145.5,356.3 152.3,355.7 156.6,360.3 155.4,351.7 160.0,357.8 166.3,354.1 170.3,358.1 171.0,354.8 168.1,362.4 158.6,360.0 163.4,366.8 178.4,363.0 175.5,365.7 190.1,368.0 183.2,369.3 188.1,376.6 178.8,378.5 185.2,385.8 178.9,385.5 195.5,391.0 209.2,385.5 227.5,396.4 215.3,388.9 202.2,389.2 201.1,398.4 196.0,400.8 210.8,410.2 201.0,427.6 216.6,447.4 219.8,460.6 220.4,457.0 253.6,481.3 256.4,477.4 260.8,478.3 254.1,491.3 262.9,502.4 259.9,505.1 261.7,514.6 256.5,518.2 265.7,531.7 252.5,523.9 249.9,531.4 278.6,557.1 283.9,587.7 293.9,597.4 287.6,594.8 290.2,606.7 275.4,563.5 258.8,545.4 243.6,626.7 249.5,615.3 256.6,625.8 247.6,625.6 243.5,634.2 223.4,723.2 216.5,731.6 204.3,736.6 213.5,748.6 218.2,745.9 228.9,749.9 222.3,764.0 225.4,768.3 229.6,769.6 230.9,764.1 235.7,762.5 233.4,766.1 236.4,768.5 255.5,777.5 269.5,778.0 270.3,783.8 281.2,794.8 297.9,790.1 307.9,794.0 310.3,800.9 317.2,804.7 330.3,801.1 337.4,806.2 341.3,802.2 361.1,805.7 361.6,793.8 365.9,791.2 388.6,798.1 393.7,804.2 406.7,804.8 411.8,814.5 415.3,810.4 430.2,813.8 434.3,818.0 431.2,825.0 444.7,829.1 449.5,837.7 466.4,830.5 483.6,839.8 493.5,839.3 494.2,833.6 512.2,827.0 528.9,830.4 521.3,820.1 518.0,809.7 520.8,801.4 515.2,795.1 521.2,788.2 518.1,784.0 523.6,774.4 520.8,770.5 524.6,772.7 532.2,761.2 542.3,754.3 548.9,754.4 574.3,729.4 584.8,725.7 577.0,729.8 585.7,729.3 592.1,737.5 615.9,739.1 618.9,747.0 632.7,747.3 627.2,741.0 625.0,727.8 627.9,740.7 636.2,745.9 636.2,741.6 648.6,740.2 646.1,729.2 655.0,736.0 659.5,734.9 654.8,741.0 646.5,742.7 647.0,747.5 665.3,745.5 669.2,758.4 690.4,760.8 701.5,771.9 706.6,765.0 722.7,771.2 724.3,764.7 733.9,767.3 737.4,761.1 746.7,757.3 751.1,759.3 755.3,749.5 748.3,749.6 757.8,736.3 767.2,735.5 771.1,726.5 782.6,723.1 783.3,714.8 801.6,704.7 Z M 950.0,838.6 940.9,856.8 942.8,879.5 936.0,887.8 940.3,890.5 932.1,903.0 933.9,908.1 924.8,908.0 923.1,900.9 912.3,900.2 903.0,894.7 902.9,888.3 911.0,883.3 893.5,878.1 900.2,872.1 901.3,863.6 888.9,864.5 887.5,859.3 896.8,850.9 884.5,843.4 883.3,835.6 891.5,832.4 881.8,823.7 888.1,819.1 892.0,804.7 910.1,797.3 919.8,788.5 928.7,793.1 931.9,762.9 937.4,765.6 939.1,794.6 945.4,802.7 950.0,838.6 Z';

  function renderMap(nationalData) {
    const container = document.getElementById('mapContainer');

    // Build city dots for the main map (excluding IDF and La Réunion)
    let mainCitiesSvg = '';
    let idfCitiesSvg = '';
    let reunionEntry = null;

    for (const entry of nationalData) {
      const name = entry.city.name;
      const color = entry.hasPolls
        ? getPartyColor(entry.leader.party)
        : getPartyColor(entry.city.currentMayor.party);
      const shortLabel = getPartyShortLabel(
        entry.hasPolls ? entry.leader.party : entry.city.currentMayor.party
      );
      const label = name.replace(/ \(.*\)/, '').replace('Saint-', 'St-');

      if (name === 'Saint-Denis (La Réunion)') {
        reunionEntry = { entry, color, shortLabel, label };
        continue;
      }

      if (IDF_CITIES.has(name)) {
        const coords = IDF_INSET_COORDS[name];
        if (!coords) continue;
        const r = Math.max(7, Math.min(12, Math.sqrt(entry.city.population / 50000) * 5));
        const IDF_ABBREVS = {
          'Boulogne-Billancourt': 'Boulogne-B.',
          'Asnières-sur-Seine': 'Asnières',
          'Aulnay-sous-Bois': 'Aulnay',
          'Issy-les-Moulineaux': 'Issy',
          'Noisy-le-Grand': 'Noisy-le-G.',
          'Levallois-Perret': 'Levallois',
          'Rueil-Malmaison': 'Rueil',
          'Champigny-sur-Marne': 'Champigny',
          'Saint-Maur-des-Fossés': 'St-Maur',
          'Ivry-sur-Seine': 'Ivry',
          'Vitry-sur-Seine': 'Vitry',
        };
        const idfLabel = IDF_ABBREVS[name] || label;
        idfCitiesSvg += renderCityDot(coords.x, coords.y, r, color, shortLabel, idfLabel, name);
        continue;
      }

      const coords = CITY_COORDS[name];
      if (!coords) continue;
      const r = Math.max(10, Math.min(24, Math.sqrt(entry.city.population / 50000) * 9));
      mainCitiesSvg += renderCityDot(coords.x, coords.y, r, color, shortLabel, label, name);
    }

    // IDF inset box (top-right of map, expanded for 24 cities)
    const idfInset = `
      <g transform="translate(640, 30)">
        <rect x="-15" y="-15" width="360" height="210" rx="6"
          class="map-inset-box"/>
        <text x="165" y="-2" text-anchor="middle" class="map-inset-title">Île-de-France</text>
        ${idfCitiesSvg}
      </g>`;

    // La Réunion inset (bottom-right)
    let reunionInset = '';
    if (reunionEntry) {
      const re = reunionEntry;
      const r = 8;
      reunionInset = `
        <g transform="translate(860, 780)">
          <rect x="-15" y="-25" width="90" height="70" rx="6"
            class="map-inset-box"/>
          <text x="30" y="-12" text-anchor="middle" class="map-inset-title">La Réunion</text>
          ${renderCityDot(30, 15, r, re.color, re.shortLabel, 'St-Denis', re.entry.city.name)}
        </g>`;
    }

    // IDF indicator on main map (small diamond showing where IDF is)
    const idfMarker = `
      <g class="map-idf-indicator">
        <rect x="473" y="250" width="18" height="18" rx="3"
          fill="none" stroke="var(--text-tertiary)" stroke-width="1" stroke-dasharray="3,2"
          transform="rotate(45, 482, 259)"/>
        <line x1="492" y1="252" x2="640" y2="130"
          stroke="var(--text-tertiary)" stroke-width="0.7" stroke-dasharray="3,2"/>
      </g>`;

    container.innerHTML = `
      <svg viewBox="0 0 1000 950" class="france-map" xmlns="http://www.w3.org/2000/svg">
        <path d="${FRANCE_OUTLINE}" class="france-outline"/>
        ${idfMarker}
        ${mainCitiesSvg}
        ${idfInset}
        ${reunionInset}
      </svg>
      <div class="map-legend">
        <span class="map-legend-item"><span class="map-legend-dot" style="background:#e85868"></span> Gauche</span>
        <span class="map-legend-item"><span class="map-legend-dot" style="background:#2ecc71"></span> Écolo</span>
        <span class="map-legend-item"><span class="map-legend-dot" style="background:#f0c830"></span> Centre</span>
        <span class="map-legend-item"><span class="map-legend-dot" style="background:#2e6fb0"></span> Droite</span>
        <span class="map-legend-item"><span class="map-legend-dot" style="background:#4a5878"></span> Ext. droite</span>
        <span class="map-legend-item"><span class="map-legend-dot" style="background:#9ca3af"></span> Sans sondage</span>
      </div>`;
  }

  function renderCityDot(cx, cy, r, color, shortLabel, label, fullName) {
    return `
      <g class="map-city-group" data-city="${escapeHtml(fullName)}">
        <circle cx="${cx}" cy="${cy}" r="${r}"
          fill="${color}" fill-opacity="0.85" stroke="${color}" stroke-width="1.5"
          stroke-opacity="0.4"/>
        <text x="${cx}" y="${cy - r - 5}"
          text-anchor="middle" class="map-city-label">${escapeHtml(label)}</text>
        <text x="${cx}" y="${cy + 4}"
          text-anchor="middle" class="map-city-badge">${shortLabel}</text>
      </g>`;
  }

  /* ========================================================================
     Section 2: Projection Grid
     ======================================================================== */

  function renderProjectionGrid(nationalData) {
    const container = document.getElementById('projectionGrid');

    const sorted = [...nationalData].sort((a, b) => b.city.population - a.city.population);

    const cards = sorted.map(entry => {
      const partyKey = entry.projectedParty;
      const badgeClass = partyKey ? getPartyBadgeClass(partyKey) : 'badge-other';
      const shortLabel = partyKey ? (PARTY_SHORT_LABELS[partyKey] || 'SE') : 'SE';
      const color = partyKey ? getPartyColor(partyKey) : '#9ca3af';
      const cityLabel = entry.city.name.replace(/ \(.*\)/, '');
      const leaderName = entry.leader ? entry.leader.name.split(' ').pop() : '—';
      const leaderScore = entry.leader ? `${entry.leader.score.toFixed(1)}%` : '';
      const hasPollsClass = entry.hasPolls ? '' : 'projection-no-poll';

      return `
        <div class="projection-card ${hasPollsClass}" style="border-left: 3px solid ${color}">
          <div class="projection-card-header">
            <span class="projection-city">${escapeHtml(cityLabel)}</span>
            <span class="card-mayor-badge ${badgeClass}">${shortLabel}</span>
          </div>
          <div class="projection-card-body">
            <span class="projection-leader">${escapeHtml(leaderName)}</span>
            ${leaderScore ? `<span class="projection-score">${leaderScore}</span>` : '<span class="projection-score no-data">pas de sondage</span>'}
          </div>
        </div>`;
    }).join('');

    container.innerHTML = cards;
  }

  /* ========================================================================
     Section 3: Gauche / Droite Balance
     ======================================================================== */

  function renderBalance(nationalData) {
    const container = document.getElementById('balanceContainer');

    // Current mayors
    let currentLeft = 0;
    let currentRight = 0;
    let currentOther = 0;

    // Projected
    let projLeft = 0;
    let projRight = 0;
    let projOther = 0;

    for (const entry of nationalData) {
      // Current
      if (isLeftParty(entry.city.currentMayor.party)) currentLeft++;
      else if (isRightParty(entry.city.currentMayor.party)) currentRight++;
      else currentOther++;

      // Projected
      const pp = entry.projectedParty;
      if (pp && LEFT_PARTIES.includes(pp)) projLeft++;
      else if (pp && RIGHT_PARTIES.includes(pp)) projRight++;
      else projOther++;
    }

    const total = nationalData.length;

    function balanceBar(left, right, other, label) {
      const pctL = (left / total) * 100;
      const pctR = (right / total) * 100;
      const pctO = (other / total) * 100;
      return `
        <div class="balance-row">
          <div class="balance-label">${label}</div>
          <div class="balance-bar">
            <div class="balance-segment balance-left" style="width:${pctL}%">${left}</div>
            ${other > 0 ? `<div class="balance-segment balance-other" style="width:${pctO}%">${other}</div>` : ''}
            <div class="balance-segment balance-right" style="width:${pctR}%">${right}</div>
          </div>
          <div class="balance-counts">
            <span class="balance-count-left">${left} gauche</span>
            ${other > 0 ? `<span class="balance-count-other">${other} autre</span>` : ''}
            <span class="balance-count-right">${right} droite</span>
          </div>
        </div>`;
    }

    container.innerHTML = `
      ${balanceBar(currentLeft, currentRight, currentOther, 'Maires sortants')}
      ${balanceBar(projLeft, projRight, projOther, 'Projection sondages')}
      <div class="balance-delta">
        <span class="balance-delta-item ${projLeft > currentLeft ? 'positive' : projLeft < currentLeft ? 'negative' : ''}">
          Gauche : ${projLeft > currentLeft ? '+' : ''}${projLeft - currentLeft}
        </span>
        <span class="balance-delta-item ${projRight > currentRight ? 'positive' : projRight < currentRight ? 'negative' : ''}">
          Droite : ${projRight > currentRight ? '+' : ''}${projRight - currentRight}
        </span>
      </div>`;
  }

  /* ========================================================================
     Section 4: Average Party Scores
     ======================================================================== */

  function renderPartyScores(nationalData) {
    const container = document.getElementById('partyScoresContainer');

    // Aggregate scores per party across cities with polls
    const partyTotals = new Map();

    for (const entry of nationalData) {
      if (!entry.hasPolls) continue;
      for (const candidate of entry.aggregated) {
        const pk = detectPartyKey(candidate.party);
        if (!pk) continue;
        if (!partyTotals.has(pk)) {
          partyTotals.set(pk, { totalScore: 0, count: 0, cities: 0 });
        }
        const pt = partyTotals.get(pk);
        pt.totalScore += candidate.score;
        pt.count++;
      }
    }

    // Count distinct cities per party
    for (const entry of nationalData) {
      if (!entry.hasPolls) continue;
      const seenParties = new Set();
      for (const candidate of entry.aggregated) {
        const pk = detectPartyKey(candidate.party);
        if (pk && !seenParties.has(pk)) {
          seenParties.add(pk);
          const pt = partyTotals.get(pk);
          if (pt) pt.cities++;
        }
      }
    }

    // Sort by average score descending
    const partyEntries = [];
    for (const [key, val] of partyTotals) {
      partyEntries.push({
        party: key,
        avgScore: val.totalScore / val.count,
        cities: val.cities,
      });
    }
    partyEntries.sort((a, b) => b.avgScore - a.avgScore);

    const maxAvg = partyEntries.length > 0 ? partyEntries[0].avgScore : 1;

    const rows = partyEntries.map(entry => {
      const color = getPartyColor(entry.party);
      const barWidth = (entry.avgScore / maxAvg) * 100;
      const badgeClass = getPartyBadgeClass(entry.party);
      const shortLabel = PARTY_SHORT_LABELS[entry.party] || 'SE';

      return `
        <div class="party-score-row">
          <span class="card-mayor-badge ${badgeClass}">${shortLabel}</span>
          <span class="party-score-name">${escapeHtml(entry.party)}</span>
          <div class="party-score-bar-wrapper">
            <div class="party-score-bar" style="width:${barWidth}%;background:${color}"></div>
          </div>
          <span class="party-score-value">${entry.avgScore.toFixed(1)}%</span>
          <span class="party-score-cities">${entry.cities} ville${entry.cities > 1 ? 's' : ''}</span>
        </div>`;
    }).join('');

    container.innerHTML = rows;
  }

  /* ========================================================================
     Header helpers (countdown + last update)
     ======================================================================== */

  function updateCountdown() {
    const el = document.getElementById('countdown');
    if (!el) return;
    const now = new Date();
    const diff = ELECTION_DATE - now;

    if (diff <= 0) {
      el.innerHTML = '<span class="countdown-label">Scrutin</span><span class="countdown-value">En cours</span>';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    el.innerHTML =
      `<span class="countdown-label">1er tour dans </span>` +
      `<span class="countdown-value">${days}j ${hours}h</span>`;
  }

  /* ========================================================================
     Init
     ======================================================================== */

  function init() {
    const data = TENDANCES_DATA;

    initTheme();
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    updateCountdown();
    setInterval(updateCountdown, 60000);

    const lastUpdateEl = document.getElementById('lastUpdate');
    if (lastUpdateEl) {
      lastUpdateEl.textContent = `Dernière MAJ : ${formatDate(data.metadata.lastUpdate)}`;
    }

    const nationalData = computeNationalData(data);

    renderMap(nationalData);
    renderProjectionGrid(nationalData);
    renderBalance(nationalData);
    renderPartyScores(nationalData);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
