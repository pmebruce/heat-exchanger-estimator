# 熱交換器快速估算器

簡易氣液式熱交換器估算 PWA，可離線安裝使用。

網站：https://pmebruce.github.io/heat-exchanger-estimator/

## ht ε–NTU 整合

移植 ht 1.2.0 的 counterflow、parallel、crossflow approximate、crossflow mixed Cmin/Cmax 五種效能關係。支援幾何估算／手動實測 UA、流向比較、所需液體入口溫度、已知入口驗算可帶走熱量與出口溫度、反算 UA 及 CSV 匯出。Cmin/Cmax 依熱容量率，非固定氣／液側。

入口 CFM 採實際體積流量，有效風量係數同時作用於能量與對流估算，氣側質量流率以入口密度固定。Q/UA 是有效平均溫差，交叉流不能當成未修正 LMTD。幾何 UA、固定液體物性與 h 經驗係數仍屬原本簡化假設。

100 個 ht 1.2.0 參考點加上熱平衡、UA 逆算、極限與無效輸入檢查：`node --test tests/*.test.mjs`。MIT 聲明位於 `licenses/ht-MIT.txt`。
