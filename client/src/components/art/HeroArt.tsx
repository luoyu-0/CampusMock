/* 由 vibe_images/svg2jsx.py 从 design/prototype.html 机械转换，勿手改缩进。 */

/* 开始页校门的内联 SVG 兜底：位图没加载出来时就是它。 */
export function HeroArtSvg() {
  return (
        <svg className="art" viewBox="0 0 330 200" role="img" aria-label="校园校门插画">
          <defs>
            <linearGradient id="cm-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#e6eeff"/><stop offset=".55" stopColor="#f3eeff"/><stop offset="1" stopColor="#fbeeda"/>
            </linearGradient>
            <linearGradient id="cm-roof" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#748ad6"/><stop offset="1" stopColor="#4a5da8"/>
            </linearGradient>
            <linearGradient id="cm-stone" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fbf3e6"/><stop offset="1" stopColor="#e3d3b9"/>
            </linearGradient>
            <linearGradient id="cm-path" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f2e4c9"/><stop offset="1" stopColor="#dbbf95"/>
            </linearGradient>
            <radialGradient id="cm-sun"><stop offset="0" stopColor="#fff4d4"/><stop offset="1" stopColor="#ffd18a"/></radialGradient>
            <radialGradient id="cm-ray"><stop offset="0" stopColor="#ffe3b4" stopOpacity=".45"/><stop offset="1" stopColor="#ffe3b4" stopOpacity="0"/></radialGradient>
            <linearGradient id="cm-haze" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff1da" stopOpacity="0"/><stop offset="1" stopColor="#ffe7c4" stopOpacity=".45"/>
            </linearGradient>
            <filter id="cm-soft" x="-50%" y="-90%" width="200%" height="320%"><feGaussianBlur stdDeviation="2.4"/></filter>
            <clipPath id="cm-frame"><rect width="330" height="200" rx="24"/></clipPath>
          </defs>

          <g clipPath="url(#cm-frame)">
          <rect width="330" height="200" fill="url(#cm-sky)"/>
          <circle cx="276" cy="42" r="40" fill="#ffd79a" opacity=".16"/>
          <circle cx="276" cy="42" r="27" fill="#ffd79a" opacity=".3"/>
          <circle cx="276" cy="42" r="14" fill="url(#cm-sun)"/>
          <g fill="#fff">
            <g opacity=".92"><circle cx="50" cy="50" r="10"/><circle cx="64" cy="43" r="14"/><circle cx="80" cy="51" r="9"/></g>
            <g opacity=".8"><circle cx="196" cy="32" r="7"/><circle cx="207" cy="26" r="10"/><circle cx="219" cy="33" r="6"/></g>
            <g opacity=".55"><circle cx="120" cy="24" r="6"/><circle cx="130" cy="20" r="8"/><circle cx="141" cy="25" r="5"/></g>
          </g>
          <g fill="none" stroke="#aab3c8" strokeWidth="1.5" strokeLinecap="round" opacity=".8">
            <path d="M96 62 q4 -4 8 0 q4 -4 8 0"/><path d="M112 72 q3 -3 6 0 q3 -3 6 0"/>
          </g>

          <path d="M0 146 Q 70 124 150 140 T 330 134 L330 158 L0 158Z" fill="#c2d6f0" opacity=".7"/>
          <path d="M0 153 Q 90 137 180 150 T 330 145 L330 165 L0 165Z" fill="#cfe0c6" opacity=".9"/>
          <g opacity=".55" fill="#b6c6e8">
            <rect x="12" y="88" width="32" height="62" rx="2"/><rect x="46" y="108" width="20" height="42" rx="2"/>
            <rect x="250" y="96" width="28" height="54" rx="2"/><rect x="280" y="112" width="32" height="38" rx="2"/>
          </g>
          <g opacity=".7" fill="#eaf0fc">
            <rect x="17" y="96" width="6" height="7" rx="1"/><rect x="28" y="96" width="6" height="7" rx="1"/>
            <rect x="17" y="110" width="6" height="7" rx="1"/><rect x="28" y="110" width="6" height="7" rx="1"/>
            <rect x="17" y="124" width="6" height="7" rx="1"/><rect x="28" y="124" width="6" height="7" rx="1"/>
            <rect x="51" y="116" width="5" height="6" rx="1"/><rect x="51" y="128" width="5" height="6" rx="1"/>
            <rect x="255" y="104" width="6" height="7" rx="1"/><rect x="265" y="104" width="6" height="7" rx="1"/>
            <rect x="255" y="118" width="6" height="7" rx="1"/><rect x="265" y="118" width="6" height="7" rx="1"/>
            <rect x="286" y="120" width="7" height="6" rx="1"/><rect x="298" y="120" width="7" height="6" rx="1"/>
          </g>

          <g opacity=".8"><path d="M152 112 L166 99 L180 112Z" fill="#a9b8de"/>
            <rect x="156" y="112" width="20" height="38" fill="#c3cee9"/>
            <rect x="160" y="120" width="12" height="11" rx="5.5" fill="#eef2fb"/>
            <path d="M166 123 L166 126 L168.5 127.5" stroke="#8b9bc7" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
            <rect x="161" y="137" width="10" height="13" rx="1" fill="#dfe6f6"/></g>

          <path d="M0 150 Q 80 142 165 148 T 330 145 L330 200 L0 200Z" fill="#cbe0bf"/>
          <path d="M156 148 L174 148 L182 170 L148 170Z" fill="url(#cm-path)" opacity=".95"/>

          <g filter="url(#cm-soft)" fill="#4f7a52" opacity=".26">
            <ellipse cx="112" cy="167" rx="18" ry="4"/><ellipse cx="218" cy="167" rx="18" ry="4"/>
            <ellipse cx="142" cy="164" rx="10" ry="3"/><ellipse cx="188" cy="164" rx="10" ry="3"/>
            <ellipse cx="73" cy="163" rx="24" ry="5"/><ellipse cx="253" cy="163" rx="19" ry="4.5"/>
          </g>

          <g>
            <rect x="106" y="96" width="13" height="70" rx="2.5" fill="url(#cm-stone)"/>
            <rect x="211" y="96" width="13" height="70" rx="2.5" fill="url(#cm-stone)"/>
            <rect x="138" y="100" width="8" height="64" rx="2" fill="url(#cm-stone)"/>
            <rect x="184" y="100" width="8" height="64" rx="2" fill="url(#cm-stone)"/>
            <g fill="#8d7a5c" opacity=".16">
              <rect x="106" y="96" width="3.5" height="70" rx="1.75"/><rect x="211" y="96" width="3.5" height="70" rx="1.75"/>
              <rect x="138" y="100" width="2.4" height="64"/><rect x="184" y="100" width="2.4" height="64"/>
            </g>
            <g fill="#fff" opacity=".5"><rect x="115" y="98" width="2.5" height="66" rx="1.25"/><rect x="220" y="98" width="2.5" height="66" rx="1.25"/></g>
            <rect x="100" y="158" width="25" height="9" rx="2.5" fill="#d9c6a6"/>
            <rect x="205" y="158" width="25" height="9" rx="2.5" fill="#d9c6a6"/>
            <rect x="134" y="157" width="16" height="8" rx="2" fill="#e0cfb2"/>
            <rect x="180" y="157" width="16" height="8" rx="2" fill="#e0cfb2"/>
            <rect x="98" y="82" width="134" height="16" rx="3" fill="url(#cm-stone)"/>
            <rect x="98" y="94" width="134" height="4" rx="2" fill="#c3ab84" opacity=".45"/>
            <rect x="144" y="84.5" width="42" height="11" rx="2" fill="#e7eefc" stroke="#b9c4e8" strokeWidth=".9"/>
            <text x="165" y="93.5" textAnchor="middle" fontSize="8" letterSpacing="1.5" fill="#42579f"
                  fontFamily="'PingFang SC','Microsoft YaHei',sans-serif">大学</text>
            <rect x="155" y="58" width="20" height="13" rx="2" fill="url(#cm-stone)"/>
            <path d="M124 64 Q165 46 204 64 Q165 56 124 64Z" fill="url(#cm-roof)"/>
            <circle cx="124" cy="63.5" r="3" fill="#4a5da8"/><circle cx="204" cy="63.5" r="3" fill="#4a5da8"/>
            <path d="M84 84 Q165 56 246 84 Q165 76 84 84Z" fill="url(#cm-roof)"/>
            <g fill="none" stroke="#fff" strokeOpacity=".2" strokeWidth="1.2">
              <path d="M96 82 Q165 60 234 82"/><path d="M106 83 Q165 65 224 83"/>
            </g>
            <path d="M84 84 Q165 76 246 84" fill="none" stroke="#3d4d90" strokeOpacity=".45" strokeWidth="1.6"/>
            <circle cx="84" cy="83" r="3.6" fill="#4a5da8"/><circle cx="246" cy="83" r="3.6" fill="#4a5da8"/>
            <path d="M165 56 L165 30" stroke="#8b7f6d" strokeWidth="2" strokeLinecap="round"/>
            <path d="M166 31 L181 35.5 L166 40Z" fill="#f0913a"/>
          </g>

          <g><rect x="69" y="106" width="8" height="56" rx="4" fill="#a9763f"/>
            <path d="M73 128 L62 118" stroke="#a9763f" strokeWidth="3" strokeLinecap="round"/>
            <circle cx="73" cy="98" r="24" fill="#6fae78"/><circle cx="55" cy="111" r="15" fill="#86c994"/>
            <circle cx="90" cy="109" r="16" fill="#86c994"/><circle cx="73" cy="85" r="14" fill="#a3dfae"/>
            <circle cx="64" cy="92" r="8" fill="#b7e7bf" opacity=".7"/></g>
          <g><rect x="250" y="114" width="7" height="48" rx="3.5" fill="#a9763f"/>
            <circle cx="253" cy="108" r="20" fill="#6fae78"/><circle cx="239" cy="118" r="12.5" fill="#86c994"/>
            <circle cx="266" cy="116" r="13.5" fill="#86c994"/><circle cx="255" cy="97" r="11" fill="#a3dfae"/></g>

          <path d="M0 170 Q 84 161 170 168 T 330 165 L330 200 L0 200Z" fill="#b3d3a6"/>
          <path d="M148 170 L182 170 L214 200 L116 200Z" fill="url(#cm-path)"/>
          <g stroke="#cdae7f" strokeWidth="1.4" opacity=".75" fill="none">
            <path d="M143 178 L187 178"/><path d="M135 188 L195 188"/><path d="M126 197 L204 197"/>
          </g>
          <g fill="none" stroke="#5f9e6b" strokeWidth="1.8" strokeLinecap="round" opacity=".85">
            <path d="M112 168 q-2 -6 -4 -8 M112 168 q1 -6 3 -8 M112 168 q4 -5 6 -6"/>
            <path d="M218 168 q-2 -6 -4 -8 M218 168 q1 -6 3 -8 M218 168 q4 -5 6 -6"/>
            <path d="M96 174 q-2 -5 -4 -7 M96 174 q2 -5 4 -7"/>
            <path d="M234 173 q-2 -5 -4 -7 M234 173 q2 -5 4 -7"/>
          </g>
          <g><circle cx="104" cy="165" r="9" fill="#5f9e6b"/><circle cx="118" cy="168" r="6.5" fill="#79bd85"/>
            <circle cx="206" cy="166" r="8" fill="#5f9e6b"/><circle cx="222" cy="169" r="6" fill="#79bd85"/>
            <circle cx="139" cy="169" r="5" fill="#6fae78"/><circle cx="191" cy="168" r="5" fill="#6fae78"/>
            <circle cx="130" cy="181" r="7" fill="#5f9e6b"/><circle cx="201" cy="179" r="8" fill="#5f9e6b"/>
            <circle cx="210" cy="184" r="5.5" fill="#79bd85"/></g>
          <g fill="#8fd79c" opacity=".9"><ellipse cx="236" cy="128" rx="4" ry="2" transform="rotate(-28 236 128)"/>
            <ellipse cx="228" cy="142" rx="3.5" ry="1.8" transform="rotate(20 228 142)"/>
            <ellipse cx="100" cy="126" rx="4" ry="2" transform="rotate(35 100 126)"/></g>

          <g><ellipse cx="291" cy="167" rx="24" ry="4" fill="#4f7a52" opacity=".22" filter="url(#cm-soft)"/>
            <rect x="270" y="146" width="44" height="5" rx="2.5" fill="#c58b52"/>
            <rect x="270" y="136" width="44" height="4" rx="2" fill="#b3793f"/>
            <rect x="274" y="151" width="4" height="13" rx="1.5" fill="#a9743f"/><rect x="306" y="151" width="4" height="13" rx="1.5" fill="#a9743f"/></g>
          <g><ellipse cx="35" cy="169" rx="19" ry="4" fill="#4f7a52" opacity=".24" filter="url(#cm-soft)"/>
            <rect x="18" y="141" width="34" height="28" rx="7" fill="#f0913a"/>
            <path d="M26 141 q9 -12 18 0" stroke="#d97a2a" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
            <rect x="18" y="150" width="34" height="4" fill="#d97a2a" opacity=".5"/>
            <rect x="18" y="141" width="34" height="28" rx="7" fill="url(#cm-ray)" opacity=".5"/>
            <circle cx="43" cy="161" r="4.5" fill="#fff" opacity=".7"/></g>

          <g><ellipse cx="157" cy="180" rx="9" ry="2.6" fill="#4f7a52" opacity=".26" filter="url(#cm-soft)"/>
            <rect x="152.5" y="170" width="3" height="9" rx="1.5" fill="#3f4a63"/>
            <rect x="157.5" y="170" width="3" height="9" rx="1.5" fill="#3f4a63"/>
            <rect x="149" y="158" width="15" height="13" rx="5" fill="#4a6cf7"/>
            <rect x="151.5" y="160" width="10" height="10" rx="3.5" fill="#f0913a"/>
            <circle cx="156.5" cy="153" r="5" fill="#3a4256"/></g>
          <g><ellipse cx="174" cy="181" rx="8" ry="2.4" fill="#4f7a52" opacity=".26" filter="url(#cm-soft)"/>
            <rect x="171" y="171" width="2.8" height="9" rx="1.4" fill="#3f4a63"/>
            <rect x="175.6" y="171" width="2.8" height="9" rx="1.4" fill="#3f4a63"/>
            <rect x="168" y="160" width="13" height="12" rx="4.5" fill="#2fa36b"/>
            <rect x="170.5" y="162" width="8" height="9" rx="3" fill="#e0a33c"/>
            <circle cx="174.5" cy="155.5" r="4.5" fill="#3a4256"/></g>

          <rect y="132" width="330" height="68" fill="url(#cm-haze)"/>
          <circle cx="292" cy="12" r="150" fill="url(#cm-ray)"/>
          </g>
          <rect width="330" height="200" rx="24" fill="none" stroke="#fff" strokeWidth="2" opacity=".65"/>
        </svg>
  )
}
