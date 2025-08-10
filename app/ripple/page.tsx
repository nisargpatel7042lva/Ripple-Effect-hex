import RippleCanvas from "@/components/ripple-canvas"
import type { Metadata } from "next"
import { ThemeToggleFloating } from "@/components/theme-toggle"

export const metadata: Metadata = {
  title: "Glassy Hex Ripple",
  description: "Visible hex tiles with a gentle, glass-like ripple effect.",
}

export default function Page() {
  return (
    <main className="min-h-dvh relative">
      <RippleCanvas
        defaultAutoRipples={false}
        autoIntervalMs={1600}
        rippleDurationMs={1700}
        hexSize={12}
        hexGap={0.1}
        baseFillAlpha={0.1}
        maxFillAlpha={0.22}
        baseStrokeAlpha={0.28}
        maxStrokeAlpha={0.42}
        baseStrokeWidth={1.0}
        scaleBoost={0.06}
        rippleBandWidth={150}
      />
      <ThemeToggleFloating />
    </main>
  )
}
