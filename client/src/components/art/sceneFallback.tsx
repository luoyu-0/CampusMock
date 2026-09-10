/* 由 vibe_images/svg2jsx.py 从 design/prototype.html 机械转换，勿手改缩进。 */
import type { ReactNode } from 'react'

/* 两侧远景的水彩位图取不到时显示的矢量兜底。键 = 主题号 + 左右。 */
export const sceneFallback: Record<string, ReactNode> = {
  "1l": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45" fill="#dbe4f8"><rect x="0" y="70" width="34" height="80"/><rect x="162" y="62" width="38" height="88"/></g>
            <g fill="#eef2fd"><rect x="12" y="52" width="52" height="98"/><rect x="70" y="72" width="38" height="78"/><rect x="116" y="86" width="44" height="64"/></g>
            <g fill="#4a63c9"><path d="M8 52h60l-6-12H14z"/><path d="M66 72h46l-6-11H72z"/><path d="M112 86h52l-6-11H118z"/></g>
            <g fill="#cdd9f5">
              <rect x="20" y="66" width="8" height="11"/><rect x="34" y="66" width="8" height="11"/><rect x="48" y="66" width="8" height="11"/>
              <rect x="20" y="88" width="8" height="11"/><rect x="34" y="88" width="8" height="11"/><rect x="48" y="88" width="8" height="11"/>
              <rect x="20" y="110" width="8" height="11"/><rect x="34" y="110" width="8" height="11"/><rect x="48" y="110" width="8" height="11"/>
              <rect x="79" y="86" width="8" height="10"/><rect x="92" y="86" width="8" height="10"/>
              <rect x="79" y="107" width="8" height="10"/><rect x="92" y="107" width="8" height="10"/>
              <rect x="124" y="99" width="8" height="10"/><rect x="138" y="99" width="8" height="10"/>
            </g>
            <rect x="34" y="130" width="13" height="20" fill="#d9a97e"/>
            <g><rect x="168" y="106" width="6" height="44" fill="#8a7a63"/><circle cx="171" cy="98" r="21" fill="#7fbb86"/><circle cx="182" cy="108" r="12" fill="#a9d3a3"/></g>
          </svg>
  ),
  "1r": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45" fill="#dbe4f8"><rect x="152" y="76" width="44" height="74"/><rect x="6" y="92" width="26" height="58"/></g>
            <path d="M46 56 L98 26 L150 56 Z" fill="#4a63c9"/>
            <rect x="48" y="56" width="100" height="9" fill="#4a63c9"/>
            <g fill="#fff"><rect x="54" y="65" width="11" height="63"/><rect x="76" y="65" width="11" height="63"/><rect x="109" y="65" width="11" height="63"/><rect x="131" y="65" width="11" height="63"/></g>
            <rect x="48" y="128" width="100" height="22" fill="#eef2fd"/>
            <rect x="93" y="80" width="11" height="48" fill="#d9a97e"/>
            <g><rect x="20" y="102" width="6" height="48" fill="#8a7a63"/><circle cx="23" cy="94" r="23" fill="#7fbb86"/><circle cx="35" cy="106" r="12" fill="#a9d3a3"/></g>
            <g><rect x="170" y="112" width="5" height="38" fill="#8a7a63"/><circle cx="172" cy="106" r="16" fill="#e0a33c"/></g>
          </svg>
  ),
  "2l": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45"><g fill="#8a7a63"><rect x="14" y="96" width="4" height="54"/><rect x="52" y="88" width="4" height="62"/></g><g fill="#a9d3a3"><circle cx="16" cy="88" r="17"/><circle cx="54" cy="80" r="19"/></g></g>
            <g fill="#8a7a63"><rect x="92" y="78" width="7" height="72"/><rect x="136" y="86" width="6" height="64"/><rect x="176" y="96" width="5" height="54"/></g>
            <g fill="#7fbb86"><circle cx="95" cy="66" r="27"/><circle cx="139" cy="76" r="22"/><circle cx="178" cy="88" r="17"/></g>
            <g fill="#a9d3a3" opacity=".85"><circle cx="84" cy="78" r="14"/><circle cx="150" cy="86" r="11"/></g>
            <g fill="#d9a97e"><rect x="26" y="122" width="44" height="5"/><rect x="26" y="131" width="44" height="4"/><rect x="30" y="127" width="4" height="23"/><rect x="63" y="127" width="4" height="23"/></g>
          </svg>
  ),
  "2r": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45"><rect x="8" y="100" width="4" height="50" fill="#8a7a63"/><circle cx="10" cy="92" r="16" fill="#e0a33c"/></g>
            <g fill="#8a7a63"><rect x="44" y="84" width="6" height="66"/><rect x="150" y="92" width="6" height="58"/></g>
            <g fill="#e0a33c"><circle cx="47" cy="72" r="25"/><circle cx="153" cy="82" r="21"/></g>
            <circle cx="61" cy="86" r="13" fill="#e6bd6a" opacity=".9"/>
            <g stroke="#4a63c9" strokeWidth="3" fill="none" strokeLinecap="round"><circle cx="98" cy="126" r="15"/><circle cx="132" cy="126" r="15"/><path d="M98 126 L112 102 L126 126 M112 102 L102 102"/></g>
            <rect x="98" y="97" width="15" height="4" rx="2" fill="#4a63c9"/>
          </svg>
  ),
  "3l": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45" fill="#dbe4f8"><rect x="0" y="84" width="30" height="66"/><rect x="172" y="80" width="28" height="70"/></g>
            <path d="M52 62 q42 -40 84 0 V150 H52 Z" fill="#eef2fd"/>
            <path d="M46 62 q48 -48 96 0 l-8 8 q-40 -40 -80 0 Z" fill="#4a63c9"/>
            <path d="M80 150 v-40 q14 -17 28 0 v40 Z" fill="#cdd9f5"/>
            <g fill="#d9a97e"><rect x="58" y="80" width="10" height="17" rx="5"/><rect x="120" y="80" width="10" height="17" rx="5"/></g>
            <g fill="#fff"><rect x="46" y="138" width="96" height="4"/><rect x="38" y="144" width="112" height="6"/></g>
            <g><rect x="164" y="112" width="5" height="38" fill="#8a7a63"/><circle cx="166" cy="106" r="16" fill="#7fbb86"/></g>
          </svg>
  ),
  "3r": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45" fill="#dbe4f8"><rect x="0" y="92" width="34" height="58"/></g>
            <g><rect x="58" y="130" width="80" height="16" rx="3" fill="#4a63c9"/><rect x="66" y="115" width="68" height="15" rx="3" fill="#d9a97e"/><rect x="54" y="100" width="80" height="15" rx="3" fill="#7fbb86"/></g>
            <g fill="#fff" opacity=".7"><rect x="68" y="135" width="28" height="3"/><rect x="74" y="119" width="24" height="3"/><rect x="62" y="105" width="30" height="3"/></g>
            <g><rect x="150" y="100" width="6" height="50" fill="#8a7a63"/><circle cx="153" cy="92" r="22" fill="#a9d3a3"/></g>
            <g><rect x="26" y="110" width="5" height="40" fill="#8a7a63"/><circle cx="28" cy="104" r="17" fill="#e0a33c"/></g>
          </svg>
  ),
  "4l": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45" fill="#dbe4f8"><rect x="154" y="70" width="42" height="80"/></g>
            <path d="M100 22 V84" stroke="#8a7a63" strokeWidth="3"/>
            <path d="M102 24 l26 8 -26 8 Z" fill="#d9534f"/>
            <path d="M22 108 L34 84 h76 L122 108 Z" fill="#4a63c9" opacity=".8"/>
            <g fill="#eef2fd"><rect x="14" y="108" width="112" height="42"/></g>
            <g fill="#cdd9f5"><rect x="14" y="116" width="112" height="6"/><rect x="14" y="128" width="112" height="6"/><rect x="14" y="140" width="112" height="6"/></g>
            <g fill="#8b93a8"><rect x="20" y="108" width="4" height="42"/><rect x="68" y="108" width="4" height="42"/><rect x="116" y="108" width="4" height="42"/></g>
            <g><rect x="150" y="112" width="5" height="38" fill="#8a7a63"/><circle cx="152" cy="106" r="16" fill="#7fbb86"/></g>
            <g><rect x="178" y="120" width="4" height="30" fill="#8a7a63"/><circle cx="180" cy="115" r="12" fill="#a9d3a3"/></g>
          </svg>
  ),
  "4r": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45"><rect x="18" y="112" width="5" height="38" fill="#8a7a63"/><circle cx="20" cy="104" r="19" fill="#7fbb86"/><rect x="178" y="116" width="5" height="34" fill="#8a7a63"/><circle cx="180" cy="108" r="17" fill="#a9d3a3"/></g>
            <g stroke="#dbe4f8" strokeWidth="2"><path d="M74 88 V142 M86 88 V142 M98 88 V142 M110 88 V142 M122 88 V142 M134 88 V142 M64 100 H148 M64 114 H148 M64 128 H148"/></g>
            <g stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round"><path d="M62 144 V84 H150 V144"/><path d="M62 84 L48 96 V144 M150 84 L164 96 V144"/></g>
          </svg>
  ),
  "5l": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45" fill="#dbe4f8"><rect x="0" y="86" width="26" height="64"/></g>
            <path d="M54 60 q42 -16 84 0" fill="none" stroke="#4a63c9" strokeWidth="7" strokeLinecap="round"/>
            <path d="M64 56 q32 -22 64 0 l-6 -12 q-26 -14 -52 0 Z" fill="#3a4f9f"/>
            <g fill="#fff" stroke="#c3d2f0" strokeWidth="1.6"><rect x="66" y="62" width="6" height="66"/><rect x="92" y="62" width="6" height="66"/><rect x="120" y="62" width="6" height="66"/></g>
            <rect x="62" y="98" width="72" height="4" fill="#eef2fd" stroke="#c3d2f0" strokeWidth="1.2"/>
            <rect x="56" y="128" width="80" height="7" fill="#eef2fd"/>
            <rect x="48" y="135" width="96" height="15" fill="#bcd6f0"/>
            <g><rect x="162" y="96" width="6" height="54" fill="#8a7a63"/><circle cx="165" cy="84" r="21" fill="#7fbb86"/>
              <g stroke="#7fbb86" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M148 90 q-4 19 0 32 M157 96 q-3 20 0 30 M173 96 q3 20 0 30 M182 90 q4 19 0 32"/></g></g>
          </svg>
  ),
  "5r": (
          <svg viewBox="0 0 200 150">
            <g opacity=".45"><rect x="166" y="104" width="5" height="46" fill="#8a7a63"/><circle cx="168" cy="98" r="18" fill="#7fbb86"/></g>
            <path d="M24 142 Q96 54 168 142 L152 142 Q96 76 40 142 Z" fill="#eef2fd"/>
            <path d="M24 142 Q96 54 168 142" fill="none" stroke="#4a63c9" strokeWidth="3" opacity=".4"/>
            <path d="M22 130 Q96 42 170 130" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round"/>
            <g stroke="#c3d2f0" strokeWidth="3" strokeLinecap="round"><path d="M45 107 V120 M59 97 V110 M96 86 V98 M133 97 V109 M148 107 V120"/></g>
            <g stroke="#7fbb86" strokeWidth="3" fill="none" strokeLinecap="round"><path d="M8 150 q6 -22 0 -32 M18 150 q4 -18 10 -26 M28 150 q-4 -16 1 -24 M184 150 q-6 -24 0 -34 M174 150 q-4 -18 -10 -26"/></g>
          </svg>
  ),
}
