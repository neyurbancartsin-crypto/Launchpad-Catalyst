"use client";

import { useEffect, useRef } from "react";

/**
 * The "conversation intelligence network" — a substantial redesign of the
 * hero visual around the product's actual idea: many ordinary conversations
 * happening everywhere, Catalyst reading them, and a small number of real
 * opportunities emerging from that noise.
 *
 * Deliberately not a sphere/orb/brain — a central near-black Catalyst "core"
 * sits inside two slowly-rotating orbit rings. Small neutral dots (ordinary
 * conversations) sit on the outer ring; thin, faint lines carry them inward
 * to a handful of larger lime nodes (conversations Catalyst has flagged);
 * brighter lime lines carry a traveling pulse from each of those into the
 * core (the opportunity reaching the founder). A few source-platform cards
 * are woven into the same structure. Pure CSS + SVG, no WebGL — see
 * `globals.css` for the keyframes.
 */

const OUTER_CONVERSATIONS = [
  { x: 92, y: 50 },
  { x: 71, y: 86 },
  { x: 29, y: 86 },
  { x: 8, y: 50 },
  { x: 29, y: 14 },
  { x: 71, y: 14 },
];

const OPPORTUNITY_NODES = [
  { x: 67, y: 67, duration: 3.1 },
  { x: 33, y: 67, duration: 3.6 },
  { x: 33, y: 33, duration: 2.9 },
  { x: 67, y: 33, duration: 3.4 },
];

const FEEDER_LINES: [number, number][] = [
  [0, 0],
  [0, 3],
  [1, 0],
  [2, 1],
  [3, 1],
  [3, 2],
  [4, 2],
  [5, 3],
];

const CARDS = [
  { text: "Looking for a tool that handles this automatically", source: "GitHub", x: 82, y: 20 },
  { text: "How are you solving onboarding drop-off?", source: "Hacker News", x: 84, y: 68 },
  { text: "Any tool for tracking this without spreadsheets?", source: "Stack Overflow", x: 18, y: 80 },
];

export function HeroVisual() {
  const sceneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    function handlePointerMove(event: PointerEvent) {
      if (!scene) return;
      const rect = scene.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        scene.style.setProperty("--mx", x.toFixed(3));
        scene.style.setProperty("--my", y.toFixed(3));
      });
    }
    function handlePointerLeave() {
      scene?.style.setProperty("--mx", "0");
      scene?.style.setProperty("--my", "0");
    }

    scene.addEventListener("pointermove", handlePointerMove);
    scene.addEventListener("pointerleave", handlePointerLeave);
    return () => {
      scene.removeEventListener("pointermove", handlePointerMove);
      scene.removeEventListener("pointerleave", handlePointerLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      ref={sceneRef}
      role="img"
      aria-label="A network visualization: many ordinary conversation points feeding into a handful of highlighted opportunity nodes, converging into a central Catalyst core."
      className="relative mx-auto aspect-square w-full max-w-2xl [perspective:1400px]"
      style={{ ["--mx" as string]: "0", ["--my" as string]: "0" }}
    >
      {/* orbit guide rings — purely structural, rotate independently */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="rgba(17,17,17,0.08)"
          strokeWidth="0.4"
          strokeDasharray="0.6 3.2"
          className="landing-animate-orbit"
          style={{ ["--landing-orbit-duration" as string]: "90s" }}
        />
        <circle
          cx="50"
          cy="50"
          r="24"
          fill="none"
          stroke="rgba(17,17,17,0.1)"
          strokeWidth="0.4"
          strokeDasharray="0.6 2.4"
          className="landing-animate-orbit-reverse"
          style={{ ["--landing-orbit-duration" as string]: "65s" }}
        />

        {/* feeder lines: many conversations -> a few opportunity nodes */}
        {FEEDER_LINES.map(([from, to], i) => {
          const a = OUTER_CONVERSATIONS[from];
          const b = OPPORTUNITY_NODES[to];
          if (!a || !b) return null;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="rgba(17,17,17,0.14)"
              strokeWidth="0.3"
            />
          );
        })}

        {/* signal lines: opportunity nodes -> the Catalyst core, with a
            traveling lime pulse suggesting the signal actually arriving */}
        {OPPORTUNITY_NODES.map((node, i) => (
          <g key={i}>
            <line
              x1={node.x}
              y1={node.y}
              x2={50}
              y2={50}
              stroke="rgba(184,255,0,0.35)"
              strokeWidth="0.45"
            />
            <line
              x1={node.x}
              y1={node.y}
              x2={50}
              y2={50}
              pathLength={1}
              stroke="#b8ff00"
              strokeWidth="0.9"
              strokeLinecap="round"
              className="landing-animate-signal"
              style={
                {
                  ["--landing-signal-duration" as string]: "3.2s",
                  ["--landing-signal-delay" as string]: `${i * 0.7}s`,
                } as React.CSSProperties
              }
            />
          </g>
        ))}
      </svg>

      {/* the Catalyst core */}
      <div
        aria-hidden="true"
        className="landing-animate-core-glow absolute top-1/2 left-1/2 flex h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[28%] border border-landing-border-on-ink"
        style={{
          background:
            "radial-gradient(circle at 34% 28%, #222222 0%, #111111 60%, #0a0a0a 100%)",
        }}
      >
        <span
          className="h-[18%] w-[18%] rounded-full bg-landing-lime"
          style={{ boxShadow: "0 0 24px 6px rgba(184,255,0,0.65)" }}
        />
      </div>

      {/* ordinary conversations — small, neutral, numerous */}
      {OUTER_CONVERSATIONS.map((dot, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="landing-animate-float absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-landing-ink/55"
          style={
            {
              top: `${dot.y}%`,
              left: `${dot.x}%`,
              "--landing-float-duration": `${7 + i}s`,
              "--landing-float-delay": `${i * 0.4}s`,
            } as React.CSSProperties
          }
        />
      ))}

      {/* flagged opportunities — fewer, larger, lime */}
      {OPPORTUNITY_NODES.map((node, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="landing-animate-pulse absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-landing-lime"
          style={
            {
              top: `${node.y}%`,
              left: `${node.x}%`,
              width: 14,
              height: 14,
              "--landing-pulse-duration": `${node.duration}s`,
              boxShadow: "0 0 18px 5px rgba(184,255,0,0.5)",
            } as React.CSSProperties
          }
        />
      ))}

      {CARDS.map((card, i) => (
        // Two layers so the mouse-parallax transform (outer, inline) and the
        // CSS float-keyframe transform (inner, class-based) don't fight over
        // the same `transform` property on one element.
        <div
          key={i}
          className="absolute"
          style={
            {
              top: `${card.y}%`,
              left: `${card.x}%`,
              // The -50%/-50% centering offset is folded into this same
              // transform (rather than a separate Tailwind translate class)
              // since an inline `transform` would otherwise just overwrite it.
              transform: `translate3d(calc(-50% + var(--mx) * ${18 + i * 6}px), calc(-50% + var(--my) * ${18 + i * 6}px), 0)`,
            } as React.CSSProperties
          }
        >
          <div
            className="landing-animate-bob w-32 rounded-xl border border-landing-border bg-landing-bg px-3 py-2.5 shadow-[0_10px_24px_rgba(17,17,17,0.12)] sm:w-44"
            style={
              {
                "--landing-float-duration": `${9 + i}s`,
                "--landing-float-delay": `${i * 0.6}s`,
              } as React.CSSProperties
            }
          >
            <p className="text-[11px] font-medium leading-snug text-landing-ink">
              &ldquo;{card.text}&rdquo;
            </p>
            <p className="mt-1.5 text-[10px] font-semibold tracking-wide text-landing-muted uppercase">
              {card.source}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
