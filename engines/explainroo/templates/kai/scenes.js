// Kai template starter. Each scene starts almost empty and builds up, piece
// by piece on the narration, to one composed final frame. Then a hard cut.
// The kit is s.kai (engine/kai.js); TEMPLATE.md lists every part.
// Lay scenes out from the top left: the first element sits near the top left
// third and later ones fill the space to its right and below.

export default {
  hook(s) {
    const k = s.kai;
    k.chip('2:00 AM', { x: 1640, y: 120, at: 0.2 });
    k.search({ x: 760, y: 250, w: 1000, text: 'why does the answer appear word by word', at: 0.3, typeAt: 0.6 });
    k.chat({ x: 760, y: 560, w: 1000, h: 300, title: 'AI answer', text: 'A language model writes one token at a time, and each token depends on the ones before it.', at: '#answer', wps: 5 });
    k.tag('why?', { x: 1530, y: 560, at: '#why' });
  },

  journey(s) {
    const k = s.kai;
    k.doc({ x: 340, y: 430, title: 'How LLMs generate', kind: 'notes', at: '#read' });
    k.gauge({ x: 1100, y: 560, r: 190, labels: ['confused', 'curious', 'surprised'], at: '#gauge', keys: [{ at: '#gauge', v: 0.08 }, { at: 'curious', v: 0.5 }, { at: 'surprised', v: 0.92 }] });
  },

  roadmap(s) {
    s.kai.progress(['The question', 'Every word', 'What it means'], { y: 520, w: 1300, at: 0, times: ['#c1', '#c2', '#c3'], grow: true });
  },

  'per-word'(s) {
    const k = s.kai;
    k.conveyor({ x: 700, y: 360, w: 900, at: '#memory', flowAt: '#compute', labels: ['memory', 'compute'] });
    k.counter('1×', { x: 1500, y: 340, color: 'yellow', label: 'per word', at: '#again' });
    k.grid({ x: 700, y: 760, cols: 30, rows: 5, label: 'weights read', at: '#again', fills: [{ at: '#again', dur: 2.5, count: 150, color: 'blue' }] });
  },

  evidence(s) {
    const k = s.kai;
    k.evidence({ x: 760, y: 470, w: 980, kind: 'Your source', quote: 'Replace this with a real sentence from your source, with the *part that matters* marked.', source: 'source name · page', at: '#quote', markAt: 'matters', sourceAt: '#source' });
    k.label('read first', { x: 1500, y: 300, at: '#quote', color: 'yellow' });
  },

  outro(s) {
    const k = s.kai;
    k.card({ x: 560, y: 470, w: 460, h: 230, label: 'problem', title: 'REAL', titleColor: 'red', color: 'red', check: true, at: '#problem' });
    k.card({ x: 1160, y: 470, w: 460, h: 230, label: 'solution', title: 'NUANCED', dashed: true, at: '#solution' });
    k.stamp('look first', { x: 1340, y: 700, at: '#stamp', color: 'yellow' });
  },
};
