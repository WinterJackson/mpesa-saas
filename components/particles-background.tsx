"use client";

import { useEffect, useState, useMemo } from "react";
import Particles, { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { useTheme } from "@wrksz/themes/client";

export function ParticlesBackground({ id = "tsparticles" }: { id?: string }) {
  const [init, setInit] = useState(false);
  const { resolvedTheme } = useTheme();

  // `init` flips only after the async engine load resolves (client-only), so it
  // already guarantees we never render during SSR/first paint — no separate
  // synchronous `mounted` setState-in-effect needed (which the React compiler
  // flags for triggering cascading renders).
  useEffect(() => {
    let cancelled = false;
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => {
      if (!cancelled) setInit(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const color = resolvedTheme === "dark" ? "#ffffff" : "#000000";

  const options = useMemo(() => ({
    fullScreen: { enable: false },
    background: {
      color: {
        value: "transparent",
      },
    },
    fpsLimit: 120,
    interactivity: {
      events: {
        onHover: {
          enable: true,
          mode: "grab",
        },
        onClick: {
          enable: true,
          mode: "push",
        },
      },
      modes: {
        grab: {
          distance: 140,
          links: {
            opacity: 1
          }
        },
        push: {
          quantity: 4,
        },
      },
    },
    particles: {
      color: {
        value: color,
      },
      links: {
        color: color,
        distance: 150,
        enable: true,
        opacity: 0.2,
        width: 1,
      },
      move: {
        direction: "none" as const,
        enable: true,
        outModes: {
          default: "bounce" as const,
        },
        random: false,
        speed: 1.5,
        straight: false,
      },
      number: {
        density: {
          enable: true,
        },
        value: 80,
      },
      opacity: {
        value: 0.3,
      },
      shape: {
        type: "circle" as const,
      },
      size: {
        value: { min: 1, max: 3 },
      },
    },
    detectRetina: true,
  }), [color]);

  if (!init) return null;

  return (
    <Particles
      id={id}
      className="absolute inset-0 z-0"
      options={options}
    />
  );
}
