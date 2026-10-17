// Selected effectiveness relationships ported from ht 1.2.0, MIT, Caleb Bell and contributors.
// https://github.com/CalebBell/ht/blob/master/ht/hx.py
export const FLOW_TYPES={counterflow:'逆流',parallel:'並流','crossflow approximate':'交叉流・雙側不混合（近似）','crossflow, mixed Cmin':'交叉流・Cmin 側混合','crossflow, mixed Cmax':'交叉流・Cmax 側混合'};
export function effectiveness(ntu,cr,type){
 if(!Number.isFinite(ntu)||ntu<0||!Number.isFinite(cr)||cr<0||cr>1||!Object.hasOwn(FLOW_TYPES,type))throw new Error('NTU、Cr 或流向無效。');
 if(ntu===0)return 0;
 if(cr<1e-10)return -Math.expm1(-ntu);
 if(type==='counterflow'){
  if(Math.abs(1-cr)<1e-10)return ntu/(1+ntu);
  const x=-Math.expm1(-ntu*(1-cr));return x/((1-cr)+cr*x);
 }
 if(type==='parallel')return -Math.expm1(-ntu*(1+cr))/(1+cr);
 if(type==='crossflow approximate')return -Math.expm1(ntu**.22/cr*Math.expm1(-cr*ntu**.78));
 if(type==='crossflow, mixed Cmin')return -Math.expm1(Math.expm1(-cr*ntu)/cr);
 return -Math.expm1(cr*Math.expm1(-ntu))/cr;
}
export function requiredUA(heat,deltaT,cmin,cmax,type){
 if(![heat,deltaT,cmin,cmax].every(Number.isFinite)||heat<0||deltaT<=0||cmin<=0||cmax<cmin)throw new Error('熱負載、入口溫差或熱容量率無效。');
 if(heat===0)return 0;const target=heat/(cmin*deltaT),cr=cmin/cmax;
 if(target>=1||target>=effectiveness(1e6,cr,type))return null;
 let low=0,high=1;while(effectiveness(high,cr,type)<target&&high<1e6)high*=2;
 for(let j=0;j<80;j++){const mid=(low+high)/2;if(effectiveness(mid,cr,type)<target)low=mid;else high=mid;}
 return (low+high)/2*cmin;
}
export function rating(ua,ch,cc,thi,tci,type){
 if(![ua,ch,cc,thi,tci].every(Number.isFinite)||ua<0||ch<=0||cc<=0||thi<tci)throw new Error('UA、熱容量率或進口溫度無效。');
 const cmin=Math.min(ch,cc),cmax=Math.max(ch,cc),ntu=ua/cmin,cr=cmin/cmax;
 const epsilon=effectiveness(ntu,cr,type),q=epsilon*cmin*(thi-tci);
 return {q,hotOut:thi-q/ch,coldOut:tci+q/cc,epsilon,ntu,cr};
}
