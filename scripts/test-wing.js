/*
 * TEST WING SYMBOL — a stand-in that proves the plan-B drop-in pipeline,
 * NOT art direction. Follows the authored-wing contract exactly
 * (PART_CATALOG 2 + bug-engine PART_SOURCES block):
 *   256x128 canvas, root at the lower-left (0,128), sweeps up-right,
 *   currentColor only, inner detail via opacity.
 * When Stephen's real wings arrive (Midjourney/Recraft -> vtracer -> SVGO),
 * their path data replaces this and nothing else changes.
 */
module.exports =
  '<path d="M0 128 Q 30 34 120 10 Q 210 -6 252 30 Q 240 78 168 104 Q 84 126 0 128 Z"'
  + ' fill="currentColor" opacity="0.32" stroke="currentColor" stroke-opacity="0.85" stroke-width="5"/>'
  + '<path d="M0 128 Q 70 84 132 58 Q 196 34 246 32" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="3"/>'
  + '<path d="M0 128 Q 80 104 150 92 Q 214 80 250 52" fill="none" stroke="currentColor" stroke-opacity="0.45" stroke-width="2.4"/>'
  + '<path d="M44 114 Q 66 66 98 32 M 96 106 Q 118 68 148 42 M 148 96 Q 168 68 196 48" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1.8"/>'
  + '<ellipse cx="218" cy="38" rx="15" ry="8" fill="currentColor" opacity="0.5"/>';
