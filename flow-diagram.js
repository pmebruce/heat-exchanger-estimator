import {FLOW_TYPES} from './ht-ntu.js';
const HOT='#ffad72',COLD='#77d9ff';
function arrow(x1,y1,x2,y2,color,width=6){
 const dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
 const bx=x2-11*ux,by=y2-11*uy;
 return `<path d="M${x1} ${y1}L${bx} ${by}" stroke="${color}" stroke-width="${width}" fill="none" stroke-linecap="round"/><path d="M${x2} ${y2}L${bx-5*uy} ${by+5*ux}L${bx+5*uy} ${by-5*ux}Z" fill="${color}"/>`;
}
export function flowDiagram(type,{airCapacity,liquidCapacity,compact=false}={}){
 if(!Object.hasOwn(FLOW_TYPES,type))return '';
 const cross=type.startsWith('crossflow'),known=Number.isFinite(airCapacity)&&airCapacity>0&&Number.isFinite(liquidCapacity)&&liquidCapacity>0;
 const equal=known&&Math.abs(airCapacity-liquidCapacity)<=1e-8*Math.max(airCapacity,liquidCapacity);
 const airMin=known&&airCapacity<=liquidCapacity;
 const mixed=type.includes('mixed Cmin')?'Cmin':type.includes('mixed Cmax')?'Cmax':null;
 const mixedSide=!mixed||!known?null:equal?'air':(mixed==='Cmin'?airMin:!airMin)?'air':'liquid';
 const hotLabel=known?(equal?'Cmin = Cmax':airMin?'Cmax':'Cmin'):'';
 const coldLabel=known?(equal?'Cmin = Cmax':airMin?'Cmin':'Cmax'):'';
 let paths='',labels='';
 if(!cross){
  const reverse=type==='counterflow';
  paths=`<rect x="85" y="67" width="250" height="118" rx="15" fill="#172c3c" stroke="#547488"/><path d="M94 126H326" stroke="#a1bac8" stroke-dasharray="6 6"/>${arrow(40,96,380,96,HOT)}${reverse?arrow(380,156,40,156,COLD):arrow(40,156,380,156,COLD)}`;
  labels=`<text x="35" y="70" fill="${HOT}">熱液入口</text><text x="304" y="70" fill="${HOT}">熱液出口</text><text x="${reverse?302:35}" y="208" fill="${COLD}">冷氣入口</text><text x="${reverse?35:304}" y="208" fill="${COLD}">冷氣出口</text>`;
 }else{
  paths='<rect x="110" y="64" width="200" height="120" rx="12" fill="#172c3c" stroke="#547488"/>';
  // Distinct layers exchange heat; crossing strokes never mean fluid interconnection.
  for(const x of [155,210,265])paths+=arrow(x,33,x,215,COLD,5);
  for(const y of [88,124,160])paths+=`<path d="M100 ${y}H320" stroke="#172c3c" stroke-width="11"/>`+arrow(38,y,382,y,HOT,5);
  if(mixedSide==='air')paths+=arrow(133,174,287,174,COLD,3)+arrow(287,174,133,174,COLD,3);
  if(mixedSide==='liquid')paths+=arrow(295,75,295,173,HOT,3)+arrow(295,173,295,75,HOT,3);
  labels=`<text x="10" y="58" fill="${HOT}">熱液入口</text><text x="310" y="58" fill="${HOT}">熱液出口</text><text x="210" y="23" fill="${COLD}" text-anchor="middle">冷氣入口 ↓</text><text x="210" y="240" fill="${COLD}" text-anchor="middle">冷氣出口 ↓</text>`;
 }
 let note=!cross?(type==='parallel'?'兩側從同一端進入，沿相同方向流動。':'兩側從相反端進入，沿相反方向流動。'):!mixed?'兩側垂直流動，各側流道限制橫向混合。':!known?`${mixed} 側允許橫向混合；輸入有效流量後，會標出是哪一側。`:`${mixedSide==='air'?'冷氣側':'熱液側'}（${mixed}）允許橫向混合，另一側不混合。`;
 if(equal&&mixed)note+=' 兩側熱容量率相同，此圖以氣側混合作示例，請依實際結構確認。';
 const capacity=known?`<div class="flow-capacity"><span><i style="background:${HOT}"></i>熱液：${hotLabel}${compact?'':` · ${liquidCapacity.toFixed(1)} W/K`}</span><span><i style="background:${COLD}"></i>冷氣：${coldLabel}${compact?'':` · ${airCapacity.toFixed(1)} W/K`}</span></div>`:'';
 return `<figure class="flow-schematic ${compact?'compact':''}" data-mixed-side="${mixedSide||'none'}"><svg viewBox="0 0 420 250" role="img" aria-label="${FLOW_TYPES[type]}：${cross?'熱液水平流動，冷氣垂直向下':type==='parallel'?'熱液與冷氣均向右流動':'熱液向右、冷氣向左流動'}"><g>${paths}</g><g font-family="system-ui,sans-serif" font-size="22" font-weight="650">${labels}</g></svg>${capacity}<figcaption>${note}</figcaption>${cross&&!compact?'<p class="flow-mixing-note">細雙向箭頭表示同一流體可在主流方向的橫向混合；不是冷熱流體互相混合。交叉線為分層示意，非管路相通。</p>':''}</figure>`;
}
