/** Minimal 16px stroke icons (inline SVG, no icon dependency). */
import type { SVGProps } from "react";

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const PlayIcon = () => (
  <Icon>
    <path d="M5 3.5v9l7.5-4.5z" fill="currentColor" stroke="none" />
  </Icon>
);
export const PauseIcon = () => (
  <Icon>
    <path d="M5 3.5v9M11 3.5v9" strokeWidth={2.2} />
  </Icon>
);
export const RestartIcon = () => (
  <Icon>
    <path d="M3 8a5 5 0 1 0 1.6-3.7" />
    <path d="M3 2.5v2.8h2.8" />
  </Icon>
);
export const FitIcon = () => (
  <Icon width={17} height={17} strokeWidth={1.35}>
    <path d="M2.5 5.5v-2a1 1 0 0 1 1-1h2M10.5 2.5h2a1 1 0 0 1 1 1v2M13.5 10.5v2a1 1 0 0 1-1 1h-2M5.5 13.5h-2a1 1 0 0 1-1-1v-2" />
    <circle cx="8" cy="8" r="1.6" />
  </Icon>
);
export const LabelIcon = () => (
  <Icon width={17} height={17} strokeWidth={1.35}>
    <path d="M2.75 3.5v3.7c0 .27.1.52.3.7l5.3 5.3a1 1 0 0 0 1.4 0l3.4-3.4a1 1 0 0 0 0-1.4L7.85 3.1a1 1 0 0 0-.7-.3H3.45a.7.7 0 0 0-.7.7z" />
    <circle cx="5.6" cy="5.6" r=".85" fill="currentColor" stroke="none" />
  </Icon>
);
export const ChartIcon = () => (
  <Icon width={17} height={17} strokeWidth={1.35}>
    <path d="M2.5 13.5h11" />
    <path d="M4.75 11V8.5M8 11V5.5M11.25 11V3" strokeWidth={1.7} />
  </Icon>
);
export const HelpIcon = () => (
  <Icon width={17} height={17} strokeWidth={1.35}>
    <circle cx="8" cy="8" r="5.75" />
    <path d="M6.4 6.4a1.65 1.65 0 1 1 2.25 1.55c-.4.17-.65.55-.65 1v.3" />
    <circle cx="8" cy="11.1" r=".55" fill="currentColor" stroke="none" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);
export const TargetIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="4.5" />
    <path d="M8 1.5v2.5M8 12v2.5M1.5 8H4M12 8h2.5" />
  </Icon>
);
export const ChevronIcon = ({ open = false }: { open?: boolean }) => (
  <Icon style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}>
    <path d="M4.5 6.5L8 10l3.5-3.5" />
  </Icon>
);
export const ArrowIcon = ({ dir }: { dir: "left" | "right" }) => (
  <Icon style={{ transform: dir === "left" ? "rotate(180deg)" : undefined }}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </Icon>
);
