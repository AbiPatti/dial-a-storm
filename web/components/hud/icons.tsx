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
  <Icon>
    <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    <circle cx="8" cy="8" r="1.6" />
  </Icon>
);
export const LabelIcon = () => (
  <Icon>
    <path d="M2.5 4.5h7l4 3.5-4 3.5h-7z" />
  </Icon>
);
export const ChartIcon = () => (
  <Icon>
    <path d="M2.5 13.5h11M4 11l3-4 2.5 2.5L13 4.5" />
  </Icon>
);
export const HelpIcon = () => (
  <Icon>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.3" />
    <circle cx="8" cy="11.4" r=".5" fill="currentColor" />
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
