import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

export default function RootHtml({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <title>GamePal — Discover your next game</title>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#0B0F19" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
            :root { color-scheme: dark; background-color: var(--gh-background, #101318); }
            html, body { min-height: 100%; background-color: var(--gh-background, #101318); color: var(--gh-text, #f5f7fa); }
            * { scrollbar-width: thin; scrollbar-color: var(--gh-border, #4b5563) transparent; }
            *::-webkit-scrollbar { width: 8px; height: 8px; }
            *::-webkit-scrollbar-track { background: transparent; }
            *::-webkit-scrollbar-thumb {
              background-color: var(--gh-border, #4b5563);
              border: 2px solid transparent;
              border-radius: 8px;
              background-clip: padding-box;
            }
            *::-webkit-scrollbar-thumb:hover { background-color: var(--gh-accent, #f5c518); }

            @keyframes gh-content-enter {
              from { opacity: 0; transform: translate3d(0, 12px, 0); }
              to { opacity: 1; transform: translate3d(0, 0, 0); }
            }
            .gh-page-enter { animation: gh-content-enter 360ms cubic-bezier(.2,.75,.25,1) both; }
            .gh-featured-hero { transition: transform 220ms ease, box-shadow 220ms ease; }
            .gh-game-card {
              transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
              will-change: transform;
            }
            .gh-game-card img { transition: transform 260ms ease; }
            .gh-motion-button { transition: transform 150ms ease, background-color 150ms ease, border-color 150ms ease, opacity 150ms ease; }
            @media (hover: hover) and (pointer: fine) {
              .gh-featured-hero:hover { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(0,0,0,.24); }
              .gh-game-card:hover { transform: translateY(-4px); border-color: var(--gh-accent-border, #6e5b1c); box-shadow: 0 10px 24px color-mix(in srgb, var(--gh-shadow, #000) 22%, transparent); }
              .gh-game-card:hover img { transform: scale(1.035); }
              .gh-motion-button:hover { transform: translateY(-1px); }
            }
            .gh-motion-button:active { transform: scale(.98); }
            @media (prefers-reduced-motion: reduce) {
              *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
              .gh-game-card { will-change: auto; }
            }
          `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
