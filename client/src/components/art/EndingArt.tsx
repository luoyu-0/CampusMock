/* 由 vibe_images/svg2jsx.py 从 design/prototype.html 机械转换，勿手改缩进。 */

/* 结局页林荫道的内联 SVG 兜底：位图没加载出来时就是它。 */
export function EndingArtSvg() {
  return (
          <svg className="art" viewBox="0 0 520 200" preserveAspectRatio="none" role="img" aria-label="落日林荫道插画">
            <defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fa7f0"/><stop offset=".55" stopColor="#f6c9a0"/><stop offset="1" stopColor="#fde6cf"/></linearGradient></defs>
            <rect width="520" height="200" fill="url(#dusk)"/>
            <circle cx="380" cy="132" r="26" fill="#fff2c4" opacity=".95"/>
            <path d="M0 156 Q 130 120 260 152 T 520 148 L520 200 L0 200Z" fill="#b6cfa8"/>
            <g stroke="#5d7a52" strokeWidth="6" strokeLinecap="round">
              <path d="M70 156 L70 106"/><path d="M150 158 L150 116"/><path d="M420 152 L420 104"/><path d="M480 154 L480 118"/>
            </g>
            <g fill="#6fae78" opacity=".95"><circle cx="70" cy="92" r="30"/><circle cx="150" cy="104" r="24"/><circle cx="420" cy="90" r="32"/><circle cx="480" cy="106" r="22"/></g>
            <path d="M230 200 L246 150 L274 150 L292 200Z" fill="#e7d8c2"/>
          </svg>
  )
}
