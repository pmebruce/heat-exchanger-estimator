const FLUIDS = {
  water: { label: "水", rho: 993.1, cp: 4178 },
  eg50: { label: "EG 50%", rho: 1064, cp: 3330 },
  pg25: { label: "PG 25%", rho: 1020, cp: 3860 }
};

const CFM_TO_M3_S = 0.00047194745;
const AIR_CP = 1006;
const form = document.querySelector("#calculatorForm");
const inputs = [...form.querySelectorAll("input, select")];
const formError = document.querySelector("#formError");

const outputIds = [
  "liquidInletValue", "approachValue", "uncertaintyValue", "diagramLiquidIn",
  "diagramAirOut", "diagramLiquidOut", "diagramAirIn", "corePower", "airOutletValue",
  "airRiseValue", "liquidOutletValue", "liquidDropValue", "lmtdValue",
  "effectivenessValue", "limitingSideValue", "gaugeValue", "performanceLabel",
  "uaValue", "velocityValue", "velocityMetricValue", "areaValue", "hValue",
  "ntuValue", "crValue", "capacityRateValue", "fluidPropertyNote",
  "calculationTimestamp"
];
const output = Object.fromEntries(outputIds.map((id) => [id, document.getElementById(id)]));

function numberValue(id) {
  return Number(document.getElementById(id).value);
}

function setText(key, value) {
  if (output[key]) output[key].textContent = value;
}

function fixed(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function airDensity(tempC) {
  return 101325 / (287.058 * (tempC + 273.15));
}

function solveAirOutlet(heatW, inletC, flowM3s) {
  let outletC = inletC + heatW / (airDensity(inletC) * flowM3s * AIR_CP);
  for (let i = 0; i < 5; i += 1) {
    const meanC = (inletC + outletC) / 2;
    outletC = inletC + heatW / (airDensity(meanC) * flowM3s * AIR_CP);
  }
  const capacityRate = heatW / (outletC - inletC);
  return { outletC, capacityRate, rho: capacityRate / (flowM3s * AIR_CP) };
}

function parallelEffectiveness(ua, cMin, cMax) {
  const cr = cMin / cMax;
  const ntu = ua / cMin;
  const effectiveness = (1 - Math.exp(-ntu * (1 + cr))) / (1 + cr);
  return { effectiveness, ntu, cr };
}

function requiredHotInlet(heatW, coldInletC, ua, cMin, cMax) {
  const { effectiveness } = parallelEffectiveness(ua, cMin, cMax);
  return coldInletC + heatW / (effectiveness * cMin);
}

function validate(values) {
  const rules = [
    [values.power > 0, "熱負載必須大於 0 W。"],
    [values.airflow > 0, "風量必須大於 0 CFM。"],
    [values.openingRatio >= 0.05 && values.openingRatio <= 1, "核心開口率需介於 0.05 與 1。"],
    [values.fpi > 0 && values.fpi <= 40, "鰭片密度需大於 0 且不超過 40 FPI。"],
    [values.length > 0 && values.width > 0 && values.thickness > 0, "核心長、寬、厚都必須大於 0 mm。"],
    [values.liquidFlow > 0, "液體流量必須大於 0 L/min。"],
    [values.airflowFactor > 0 && values.airflowFactor <= 1.2, "有效風量係數需介於 10% 與 120%。"],
    [values.finEfficiency > 0 && values.finEfficiency <= 1, "鰭片效率需介於 10% 與 100%。"],
    [values.uaFactor > 0 && values.uaFactor <= 1.5, "UA 修正係數需介於 10% 與 150%。"]
  ];
  return rules.find(([valid]) => !valid)?.[1] || "";
}

function renderChecks({ velocityFpm, airRise, fpi, openingRatio }) {
  const checks = [];

  if (velocityFpm > 1000) {
    checks.push({ type: "warn", icon: "!", label: "氣側速度", text: "偏高，務必用風扇 PQ 扣除核心壓降" });
  } else if (velocityFpm < 150) {
    checks.push({ type: "warn", icon: "!", label: "氣側速度", text: "偏低，換熱結果對旁通風量較敏感" });
  } else {
    checks.push({ type: "ok", icon: "✓", label: "氣側速度", text: "位於常用概念估算區間" });
  }

  if (airRise > 20) {
    checks.push({ type: "alert", icon: "!", label: "空氣溫升", text: "超過 20°C，風量可能是主要瓶頸" });
  } else if (airRise > 12) {
    checks.push({ type: "warn", icon: "!", label: "空氣溫升", text: "溫升偏高，建議確認出風回流" });
  } else {
    checks.push({ type: "ok", icon: "✓", label: "空氣溫升", text: "溫升低於 12°C" });
  }

  if (openingRatio < 0.3 || fpi > 18) {
    checks.push({ type: "warn", icon: "!", label: "核心阻抗", text: "開口率偏低或 FPI 偏高，壓降風險增加" });
  } else {
    checks.push({ type: "ok", icon: "✓", label: "核心幾何", text: "開口率與鰭片密度無明顯警訊" });
  }

  document.getElementById("checks").innerHTML = checks.map((check) => `
    <div class="check check--${check.type}">
      <span class="check-icon" aria-hidden="true">${check.icon}</span>
      <span>${check.label}<strong>${check.text}</strong></span>
    </div>
  `).join("");
}

function calculate() {
  const values = {
    power: numberValue("power"),
    airflow: numberValue("airflow"),
    airInlet: numberValue("airInlet"),
    openingRatio: numberValue("openingRatio"),
    fpi: numberValue("fpi"),
    length: numberValue("length"),
    width: numberValue("width"),
    thickness: numberValue("thickness"),
    liquidFlow: numberValue("liquidFlow"),
    airflowFactor: numberValue("airflowFactor") / 100,
    finEfficiency: numberValue("finEfficiency") / 100,
    uaFactor: numberValue("uaFactor") / 100,
    fluid: document.getElementById("fluid").value
  };

  if (Object.values(values).some((value) => typeof value === "number" && !Number.isFinite(value))) {
    formError.hidden = false;
    formError.textContent = "請填入完整且有效的數值。";
    return;
  }

  const validationMessage = validate(values);
  if (validationMessage) {
    formError.hidden = false;
    formError.textContent = validationMessage;
    return;
  }
  formError.hidden = true;

  const fluid = FLUIDS[values.fluid];
  const airFlowM3s = values.airflow * CFM_TO_M3_S;
  const air = solveAirOutlet(values.power, values.airInlet, airFlowM3s);
  const liquidCapacityRate = fluid.rho * (values.liquidFlow / 60000) * fluid.cp;

  const faceAreaFt2 = (values.length / 304.8) * (values.width / 304.8);
  const velocityFpm = (values.airflow * values.airflowFactor) / (faceAreaFt2 * values.openingRatio);
  const velocityMs = velocityFpm * 0.00508;

  const finCount = (values.length / 25.4) * values.fpi;
  const grossFinAreaM2 = 2 * finCount * (values.width / 1000) * (values.thickness / 1000);
  const effectiveAreaM2 = grossFinAreaM2 * values.finEfficiency;
  const hAir = 0.2875 * Math.pow(velocityFpm, 0.8);
  const ua = hAir * effectiveAreaM2 * values.uaFactor;

  const cMin = Math.min(air.capacityRate, liquidCapacityRate);
  const cMax = Math.max(air.capacityRate, liquidCapacityRate);
  const { effectiveness, ntu, cr } = parallelEffectiveness(ua, cMin, cMax);

  const liquidInlet = values.airInlet + values.power / (effectiveness * cMin);
  const liquidDrop = values.power / liquidCapacityRate;
  const liquidOutlet = liquidInlet - liquidDrop;
  const airRise = air.outletC - values.airInlet;
  const lmtd = values.power / ua;
  const approach = liquidInlet - values.airInlet;

  const hotAtHighUa = requiredHotInlet(values.power, values.airInlet, ua * 1.25, cMin, cMax);
  const hotAtLowUa = requiredHotInlet(values.power, values.airInlet, ua * 0.75, cMin, cMax);
  const lowRange = Math.min(hotAtHighUa, hotAtLowUa);
  const highRange = Math.max(hotAtHighUa, hotAtLowUa);

  setText("liquidInletValue", fixed(liquidInlet, 1));
  setText("approachValue", `${fixed(approach, 1)}°C`);
  setText("uncertaintyValue", `${fixed(lowRange, 1)}–${fixed(highRange, 1)}°C`);
  setText("diagramLiquidIn", `${fixed(liquidInlet, 1)}°C`);
  setText("diagramLiquidOut", `${fixed(liquidOutlet, 1)}°C`);
  setText("diagramAirIn", `${fixed(values.airInlet, 1)}°C`);
  setText("diagramAirOut", `${fixed(air.outletC, 1)}°C`);
  setText("corePower", `${Math.round(values.power).toLocaleString("zh-TW")} W`);
  setText("airOutletValue", `${fixed(air.outletC, 1)}°C`);
  setText("airRiseValue", `升溫 ${fixed(airRise, 1)}°C`);
  setText("liquidOutletValue", `${fixed(liquidOutlet, 1)}°C`);
  setText("liquidDropValue", `降溫 ${fixed(liquidDrop, 1)}°C`);
  setText("lmtdValue", `${fixed(lmtd, 1)}°C`);
  setText("effectivenessValue", `${Math.round(effectiveness * 100)}%`);
  setText("limitingSideValue", air.capacityRate <= liquidCapacityRate ? "氣側限制" : "液側限制");
  setText("gaugeValue", Math.round(effectiveness * 100));
  setText("performanceLabel", effectiveness >= 0.65 ? "良好" : effectiveness >= 0.45 ? "普通" : "偏低");
  setText("uaValue", fixed(ua, 1));
  setText("velocityValue", Math.round(velocityFpm).toLocaleString("zh-TW"));
  setText("velocityMetricValue", `${fixed(velocityMs, 2)} m/s`);
  setText("areaValue", fixed(effectiveAreaM2, 2));
  setText("hValue", fixed(hAir, 1));
  setText("ntuValue", fixed(ntu, 2));
  setText("crValue", fixed(cr, 2));
  setText("capacityRateValue", Math.round(cMin).toLocaleString("zh-TW"));
  setText("fluidPropertyNote", `物性以約 40°C 的${fluid.label}估算：ρ ${fluid.rho.toLocaleString("zh-TW")} kg/m³、Cp ${fluid.cp.toLocaleString("zh-TW")} J/kg·K`);
  setText("calculationTimestamp", `剛剛更新 · ${new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`);

  const gauge = document.getElementById("effectivenessGauge");
  gauge.style.setProperty("--gauge-value", Math.min(100, Math.max(0, effectiveness * 100)).toFixed(1));
  gauge.setAttribute("aria-label", `換熱效能 ${Math.round(effectiveness * 100)}%`);

  renderChecks({ velocityFpm, airRise, fpi: values.fpi, openingRatio: values.openingRatio });

  window.__hxResult = {
    inputs: values,
    results: {
      requiredLiquidInletC: liquidInlet,
      liquidOutletC: liquidOutlet,
      airOutletC: air.outletC,
      lmtdC: lmtd,
      uaWPerK: ua,
      effectiveness,
      velocityFpm,
      effectiveAreaM2,
      airHeatTransferCoefficientWm2K: hAir
    }
  };
}

let animationFrame;
function scheduleCalculation() {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(calculate);
}

form.addEventListener("submit", (event) => event.preventDefault());
inputs.forEach((input) => input.addEventListener("input", scheduleCalculation));
inputs.forEach((input) => input.addEventListener("change", scheduleCalculation));

document.getElementById("resetButton").addEventListener("click", () => {
  form.reset();
  calculate();
  document.getElementById("power").focus({ preventScroll: true });
});

let deferredInstallPrompt = null;
const installButton = document.getElementById("installButton");
const installDialog = document.getElementById("installDialog");
const dialogInstallButton = document.getElementById("dialogInstallButton");
const installHelp = document.getElementById("installHelp");

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

async function promptInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installDialog.close();
    if (isStandalone()) installButton.hidden = true;
    return;
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  installHelp.textContent = isIos
    ? "點選 Safari 下方的分享按鈕，再選擇「加入主畫面」。安裝後即可離線開啟。"
    : "請在瀏覽器選單中選擇「安裝應用程式」或「加到主畫面」。";
  dialogInstallButton.textContent = "我知道了";
  if (!installDialog.open) installDialog.showModal();
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  dialogInstallButton.textContent = "立即安裝";
});

installButton.addEventListener("click", promptInstall);
dialogInstallButton.addEventListener("click", () => {
  if (deferredInstallPrompt) promptInstall();
  else installDialog.close();
});
document.getElementById("closeInstallDialog").addEventListener("click", () => installDialog.close());
installDialog.addEventListener("click", (event) => {
  if (event.target === installDialog) installDialog.close();
});

if (isStandalone()) installButton.hidden = true;

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

calculate();

function registerWebMcpTool() {
  const context = document.modelContext;
  if (!context?.registerTool) return;

  const lifecycle = new AbortController();
  const fields = {
    powerW: ["power", 1, 1000000],
    airflowCfm: ["airflow", 0.1, 100000],
    airInletC: ["airInlet", -40, 100],
    openingRatio: ["openingRatio", 0.05, 1],
    finDensityFpi: ["fpi", 1, 40],
    lengthMm: ["length", 1, 10000],
    widthMm: ["width", 1, 10000],
    thicknessMm: ["thickness", 1, 5000],
    liquidFlowLpm: ["liquidFlow", 0.01, 100000]
  };

  const tool = {
    name: "configure_heat_exchanger_estimate",
    title: "設定並估算熱交換器",
    description: "將熱負載、風量、核心幾何與液體流量套用到畫面，並回傳氣液式熱交換器的簡易估算結果。",
    inputSchema: {
      type: "object",
      properties: {
        powerW: { type: "number", minimum: 1, description: "需排除的熱負載，W" },
        airflowCfm: { type: "number", exclusiveMinimum: 0, description: "風扇自由風量，CFM" },
        airInletC: { type: "number", minimum: -40, maximum: 100, description: "空氣入口溫度，°C" },
        openingRatio: { type: "number", minimum: 0.05, maximum: 1, description: "核心有效開口率，0 到 1" },
        finDensityFpi: { type: "number", minimum: 1, maximum: 40, description: "鰭片密度，FPI" },
        lengthMm: { type: "number", exclusiveMinimum: 0, description: "核心長度 L，mm" },
        widthMm: { type: "number", exclusiveMinimum: 0, description: "核心寬度 W，mm" },
        thicknessMm: { type: "number", exclusiveMinimum: 0, description: "核心厚度 T，mm" },
        liquidFlowLpm: { type: "number", exclusiveMinimum: 0, description: "冷卻液體積流量，L/min" },
        fluid: { type: "string", enum: Object.keys(FLUIDS), description: "冷卻液：water、eg50 或 pg25" }
      },
      required: ["powerW", "airflowCfm", "airInletC", "openingRatio", "finDensityFpi", "lengthMm", "widthMm", "thicknessMm", "liquidFlowLpm", "fluid"],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute(input) {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("輸入必須是參數物件。");
      for (const [key, [elementId, min, max]] of Object.entries(fields)) {
        const value = input[key];
        if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
          throw new Error(`${key} 超出允許範圍。`);
        }
        document.getElementById(elementId).value = String(value);
      }
      if (!Object.hasOwn(FLUIDS, input.fluid)) throw new Error("fluid 不是支援的冷卻液。");
      document.getElementById("fluid").value = input.fluid;
      calculate();
      if (!formError.hidden) throw new Error(formError.textContent || "參數無法計算。");

      const result = window.__hxResult.results;
      return {
        requiredLiquidInletC: Number(result.requiredLiquidInletC.toFixed(2)),
        liquidOutletC: Number(result.liquidOutletC.toFixed(2)),
        airOutletC: Number(result.airOutletC.toFixed(2)),
        lmtdC: Number(result.lmtdC.toFixed(2)),
        uaWPerK: Number(result.uaWPerK.toFixed(2)),
        effectivenessPercent: Number((result.effectiveness * 100).toFixed(1))
      };
    }
  };

  try {
    Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {});
  } catch {
    lifecycle.abort();
  }
}

registerWebMcpTool();
