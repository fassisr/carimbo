// Ilustrações vetoriais do Fuilá (apresentação e telas vazias), nas cores da marca.
(() => {
  const I = '#3B2BF5', I2 = '#5A4BFF', I3 = '#8C80FF', L = '#CFC8FF', L2 = '#E6E2FF', Y = '#FFC21A', YE = '#D99A00', P = '#FFFBEF';
  // pin amarelo com check, ponta em (x, y)
  const pin = (x, y, s = 1, glow) => `<g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="2" rx="13" ry="4.5" fill="${I}" opacity=".18"/>
    ${glow ? `<circle cx="0" cy="-34" r="26" fill="${Y}" opacity=".22"/>` : ''}
    <path d="M0 0C-4-7-21-20-21-38a21 21 0 1 1 42 0C21-20 4-7 0 0z" fill="${YE}" transform="translate(0 2.5)"/>
    <path d="M0 0C-4-7-21-20-21-38a21 21 0 1 1 42 0C21-20 4-7 0 0z" fill="${Y}"/>
    <path d="M-9-38l6.5 6.5L10-44" fill="none" stroke="${I}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
    <ellipse cx="-8" cy="-48" rx="5" ry="3" fill="#fff" opacity=".55" transform="rotate(-30 -8 -48)"/>
  </g>`;
  // prédio em perspectiva isométrica
  const bld = (x, y, w, h) => `<g transform="translate(${x} ${y})">
    <path d="M0 0l${w} ${-w / 2}v${-h}l${-w} ${w / 2}z" fill="${I2}"/>
    <path d="M0 0l${-w} ${-w / 2}v${-h}l${w} ${w / 2}z" fill="${I}"/>
    <path d="M0 ${-h}l${w} ${-w / 2}l${-w} ${-w / 2}l${-w} ${w / 2}z" fill="${I3}"/>
  </g>`;
  const spark = (x, y, s = 1, c = Y) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0-8C1-2 2-1 8 0C2 1 1 2 0 8C-1 2-2 1-8 0C-2-1-1-2 0-8z" fill="${c}"/>`;
  const blob = `<path d="M120 12c52 0 104 22 108 74s-40 86-104 86S8 146 12 92 68 12 120 12z" fill="${L2}"/>`;
  const svg = (body, label) => `<svg class="ilu" viewBox="0 0 240 180" role="img" aria-label="${label}">${body}</svg>`;

  const mapa = svg(`${blob}
    <path d="M120 58l92 46-92 46-92-46z" fill="${L}"/>
    <path d="M120 58l92 46-92 46-92-46z" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
    <path d="M74 81l92 46M166 81l-92 46" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>
    <path d="M51 92l92 46" stroke="${Y}" stroke-width="7" stroke-linecap="round" opacity=".95"/>
    ${bld(150, 100, 16, 26)}${bld(178, 112, 12, 16)}${bld(96, 84, 13, 20)}${bld(130, 76, 11, 14)}
    <path d="M62 132c18-6 30-2 44-12s24-18 40-16" fill="none" stroke="${I}" stroke-width="3" stroke-dasharray="1 7" stroke-linecap="round"/>
    <circle cx="60" cy="133" r="7" fill="${I}"/><circle cx="60" cy="133" r="3" fill="#fff"/>
    ${pin(150, 104, 1.05, true)}${pin(86, 100, .62)}${pin(188, 120, .55)}
    ${spark(196, 40, 1)}${spark(44, 56, .7, I3)}${spark(210, 76, .5, I3)}`, 'Mapa com lugares para visitar');

  const stamp = (x, y, r, c, rot) => `<g transform="translate(${x} ${y}) rotate(${rot})" fill="none" stroke="${c}">
    <circle r="${r}" stroke-width="3"/><circle r="${r - 5}" stroke-width="1.2"/><circle r="${r * .5}" stroke-width="1.2"/>
    <path d="M${-r * .2} 0l${r * .12} ${r * .12} ${r * .26}-${r * .26}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    ${Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return `<circle cx="${(Math.cos(a) * (r - 2.5)).toFixed(1)}" cy="${(Math.sin(a) * (r - 2.5)).toFixed(1)}" r=".9" fill="${c}" stroke="none"/>`; }).join('')}
  </g>`;
  const carimbo = svg(`${blob}
    <ellipse cx="120" cy="156" rx="84" ry="8" fill="${I}" opacity=".12"/>
    <path d="M30 48q45-10 90 2v104q-45-12-90-2z" fill="${I}"/>
    <path d="M210 48q-45-10-90 2v104q45-12 90-2z" fill="${I}"/>
    <path d="M34 44q43-9 86 4v102q-43-12-86-4z" fill="${P}"/>
    <path d="M206 44q-43-9-86 4v102q43-12 86-4z" fill="${P}"/>
    <path d="M120 48v102" stroke="${L}" stroke-width="2"/>
    ${[66, 82, 98, 114, 130].map(y => `<path d="M40 ${y}q38-7 74 3M126 ${y + 3}q36-10 74-3" stroke="${I}" stroke-opacity=".07" stroke-width="1.2" fill="none"/>`).join('')}
    ${stamp(62, 80, 20, '#D9468A', -12)}${stamp(96, 118, 17, '#A0522D', 9)}${stamp(152, 86, 19, '#2E9E5B', 14)}
    <circle cx="180" cy="124" r="16" fill="none" stroke="${I3}" stroke-width="2" stroke-dasharray="3 4"/>
    <g transform="translate(186 30)">
      <path d="M-9 8l-6 26 9-5 5 8 4-25zM9 8l6 26-9-5-5 8-4-25z" fill="#D9468A"/>
      <circle r="19" fill="${YE}" cy="2"/><circle r="19" fill="${Y}"/><circle r="13" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2"/>
      <path d="M0-8l2.6 5.4 6 .8-4.3 4.1 1 5.9L0 5.4-5.3 8.2l1-5.9-4.3-4.1 6-.8z" fill="#fff"/>
    </g>
    ${spark(32, 30, .8)}${spark(216, 80, .6, I3)}${spark(146, 26, .5, I3)}`, 'Passaporte com carimbos e uma medalha');

  const cupom = svg(`${blob}
    <ellipse cx="120" cy="150" rx="70" ry="7" fill="${I}" opacity=".12"/>
    <g transform="rotate(-8 120 92)">
      <path d="M52 56h136a8 8 0 0 1 8 8v14a14 14 0 0 0 0 28v14a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8v-14a14 14 0 0 0 0-28V64a8 8 0 0 1 8-8z" fill="${YE}" transform="translate(0 5)"/>
      <path d="M52 56h136a8 8 0 0 1 8 8v14a14 14 0 0 0 0 28v14a8 8 0 0 1-8 8H52a8 8 0 0 1-8-8v-14a14 14 0 0 0 0-28V64a8 8 0 0 1 8-8z" fill="${Y}"/>
      <path d="M150 62v60" stroke="${I}" stroke-opacity=".35" stroke-width="2.5" stroke-dasharray="4 5"/>
      <circle cx="84" cy="80" r="8" fill="none" stroke="${I}" stroke-width="5"/><circle cx="116" cy="106" r="8" fill="none" stroke="${I}" stroke-width="5"/>
      <path d="M116 74l-32 38" stroke="${I}" stroke-width="6" stroke-linecap="round"/>
      <g transform="translate(172 92)"><path d="M0 12C-2 8-11 1-11-9a11 11 0 1 1 22 0c0 10-9 17-11 21z" fill="${I}"/><path d="M-5-9l3.5 3.5L5-12" fill="none" stroke="${Y}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g>
    </g>
    <circle cx="48" cy="44" r="9" fill="${Y}"/><circle cx="48" cy="44" r="5.5" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>
    <circle cx="200" cy="146" r="7" fill="${Y}"/>
    ${spark(204, 40, 1)}${spark(30, 120, .6, I3)}${spark(214, 108, .5, I3)}`, 'Cupom de desconto');

  const cidade = svg(`${blob}
    <circle cx="120" cy="96" r="62" fill="none" stroke="${L}" stroke-width="12"/>
    <circle cx="120" cy="96" r="62" fill="none" stroke="${I}" stroke-width="12" stroke-linecap="round" stroke-dasharray="270 400" transform="rotate(-90 120 96)"/>
    <circle cx="120" cy="96" r="50" fill="#fff"/>
    <g transform="translate(120 96)">
      <path d="M-34 22h68" stroke="${L}" stroke-width="3" stroke-linecap="round"/>
      <rect x="-30" y="-6" width="14" height="28" rx="2" fill="${I2}"/><rect x="-14" y="-24" width="16" height="46" rx="2" fill="${I}"/>
      <rect x="4" y="-12" width="12" height="34" rx="2" fill="${I3}"/><rect x="18" y="2" width="12" height="20" rx="2" fill="${I2}"/>
      ${[-20, -12, -4].map(y => `<rect x="-10" y="${y}" width="3" height="4" fill="${Y}"/><rect x="-4" y="${y}" width="3" height="4" fill="${Y}"/>`).join('')}
    </g>
    ${pin(172, 50, .7)}
    ${spark(54, 40, .9)}${spark(206, 128, .6, I3)}`, 'Cidade com barra de progresso');

  window.FUILA_ILU = { mapa, carimbo, cupom, cidade };
})();
