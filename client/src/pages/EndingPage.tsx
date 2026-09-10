import { ArtFrame, ENDING_LEAVES } from '../components/ArtFrame'
import { EndingArtSvg } from '../components/art/EndingArt'
import { Note } from '../components/Cards'
import { Grades } from '../components/Chrome'
import { ENDING_ART } from '../sceneArt'
import { TOTAL_DAYS } from '../api/script'
import { dateLabel } from '../state/calendar'
import { paragraphs } from '../format'
import type { Snapshot } from '../state/types'

/* ⑤ 已结束。四维各自出档位，学业与社交不给数字（待团队确认，见下面的标注）。 */
export function EndingPage({ snapshot, onRestart }: { snapshot: Snapshot; onRestart: () => void }) {
  const ending = snapshot.ending
  if (!ending) return null

  return (
    <>
      <div className="card" style={{ paddingBottom: 22 }}>
        <ArtFrame frameClass="ending-hero art-frame" src={ENDING_ART} svg={<EndingArtSvg />} leaves={ENDING_LEAVES} />
        <p className="kicker">结局 · {dateLabel(TOTAL_DAYS)}</p>
        <h2 className="etitle">{ending.title}</h2>
        <div className="body">
          {paragraphs(ending.description).map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>

        <Grades grades={ending.grades} />
        <Note>
          当前实现只出四个档位字母，没有任何数值。原型里我按「只有精力/金钱附精确数字」画过一版，
          待团队确认后再决定要不要把这两个数字加回来（学业/社交默认仍然不出现）。
        </Note>

        <div className="sec">
          <p className="h">评价</p>
          <div className="body">
            {paragraphs(ending.evaluation).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
        </div>
        <div className="sec">
          <p className="h">给接下来几周的你</p>
          <div className="body">
            {paragraphs(ending.advice).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
          </div>
        </div>
      </div>
      <button className="btn" onClick={onRestart}>
        重新开始两周
      </button>
      <p className="hint">结束后会清掉旧存档，开始新的一局</p>
    </>
  )
}
