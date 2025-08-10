"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

function setHtmlTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === "dark") root.classList.add("dark")
  else root.classList.remove("dark")
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light"
  const stored = localStorage.getItem("theme")
  if (stored === "light" || stored === "dark") return stored
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return prefersDark ? "dark" : "light"
}

export function ThemeToggleFloating() {
  const [mounted, setMounted] = useState(false)
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    setMounted(true)
    const initial = getInitialTheme()
    setTheme(initial)
    setHtmlTheme(initial)
  }, [])

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    setHtmlTheme(next)
    localStorage.setItem("theme", next)
  }

  return (
    <div className="fixed right-3 top-3 z-50">
      <Button
        onClick={toggle}
        variant="ghost"
        size="icon"
        className="backdrop-blur bg-white/40 dark:bg-black/30 hover:bg-white/60 dark:hover:bg-black/50 border border-black/5 dark:border-white/10 rounded-full shadow-sm"
        aria-label="Toggle theme"
        title="Toggle theme"
        aria-pressed={theme === "dark"}
      >
        {mounted && theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  )
}
